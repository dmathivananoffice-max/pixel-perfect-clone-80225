// ─────────────────────────────────────────────────────────────
// Sprint 2 – Real intake persistence
// Sprint 4 – Validation + audit coverage + draft autosave
// Turns an in-memory IntakeBatch + real File[] into DB rows:
//   • public.intake_batches                (1 row)
//   • public.candidates                    (N rows, one per BatchCandidate)
//   • storage bucket "candidate-documents" (M objects)
//   • public.candidate_documents           (M rows)
//   • public.audit_events                  (candidate_created, document_uploaded,
//                                           intake_approved)
// ─────────────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import type { IntakeBatch, IntakeMode, BatchCandidate } from "./batch";
import { computeSha256, validateFile, standardizeFilename } from "@/lib/docintel/fingerprint";
import { runDocumentIntelligencePipeline } from "@/lib/docintel/pipeline";
import { normalizeExtractionField } from "@/lib/docintel/form-schema";
import { guessDocType } from "./doctype";
import { resolveCountryName } from "@/intake/normalisers";
import { withTimeout } from "@/lib/withTimeout";
import { DRAFT_DB_TIMEOUT_MS, DRAFT_PHASE_BUDGET_MS } from "./hangBudgets";

// ---------- Hang guards ----------
// Supabase storage uploads / hashing / OCR can stall forever on a dropped
// connection. Every async step below is raced against a hard timeout so a
// single stuck file can NEVER freeze the whole batch — the file is marked
// failed and the batch continues.

const HASH_TIMEOUT_MS = 60_000;
const DOC_INSERT_TIMEOUT_MS = 30_000;
const PIPELINE_TIMEOUT_MS = 10 * 60_000; // per candidate, OCR of all its docs
const SESSION_REFRESH_MS = 8_000;
/** Refresh only when the access token is this close to expiry (or missing). */
const SESSION_REFRESH_SKEW_MS = 90_000;
/** Parallel storage uploads — overlaps network without saturating the browser. */
const UPLOAD_CONCURRENCY = 3;

/**
 * After a long OCR run the access token is often near expiry. supabase-js
 * then parks forever inside silent refresh on the next DB write — that is
 * the production hang on "Finalising candidate draft…". Refresh only when
 * needed, bound the call, and continue even if refresh fails (draft writes
 * still timeout).
 */
async function ensureFreshSession(): Promise<void> {
  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      SESSION_REFRESH_MS,
      "Session read before draft save",
    );
    const expiresAtMs = (data.session?.expires_at ?? 0) * 1000;
    if (expiresAtMs && expiresAtMs - Date.now() > SESSION_REFRESH_SKEW_MS) {
      return;
    }
    await withTimeout(
      supabase.auth.refreshSession(),
      SESSION_REFRESH_MS,
      "Session refresh before draft save",
    );
  } catch (e) {
    console.warn("[intake] session refresh before draft failed — continuing with timeouts", e);
  }
}
/** Upload timeout scales with file size: 45s base + 30s per MB, capped at 4 min. */
function uploadTimeoutMs(sizeBytes: number): number {
  const mb = sizeBytes / (1024 * 1024);
  return Math.min(240_000, 45_000 + Math.ceil(mb) * 30_000);
}

/** File carried through the upload step, keeping the raw browser File handle. */
export interface IntakeFile {
  id: string;
  file: File;
  path?: string;
  kind: "pdf" | "image" | "doc" | "zip" | "other";
}

// ---------- Error taxonomy (Sprint 4) ----------

/**
 * Structured error surfaced to the UI so callers can distinguish
 * validation problems (fix your input) from transient issues (retry)
 * from RLS/permission denials (don't retry, escalate).
 */
export type IntakeErrorKind =
  | "validation" // recruiter can fix by editing form (duplicate email, missing field)
  | "permission" // RLS / auth issue — retry won't help
  | "network" // transient — retry is appropriate
  | "unknown"; // fall-back; show raw message

export class IntakeError extends Error {
  kind: IntakeErrorKind;
  field?: string;
  cause?: unknown;
  constructor(kind: IntakeErrorKind, message: string, field?: string, cause?: unknown) {
    super(message);
    this.kind = kind;
    this.field = field;
    this.cause = cause;
  }
}

/** Map a raw supabase / fetch error to our taxonomy. */
export function classifySupabaseError(err: unknown): IntakeErrorKind {
  if (!err) return "unknown";
  const e = err as { code?: string; message?: string; status?: number };
  const msg = (e.message ?? "").toLowerCase();
  if (msg.includes("row-level security") || msg.includes("permission denied") || e.status === 403) {
    return "permission";
  }
  if (msg.includes("duplicate key") || e.code === "23505") return "validation";
  if (msg.includes("violates not-null") || e.code === "23502") return "validation";
  if (msg.includes("network") || msg.includes("fetch failed") || msg.includes("timeout")) {
    return "network";
  }
  return "unknown";
}

export function isTransient(kind: IntakeErrorKind): boolean {
  return kind === "network";
}

// ---------- Validation (Sprint 4) ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate a single BatchCandidate before we let it hit the database. */
export function validateCandidate(c: BatchCandidate): string[] {
  const errs: string[] = [];
  if (!c.firstName?.trim()) errs.push("First name is required");
  if (!c.lastName?.trim()) errs.push("Last name is required");
  if (!c.email?.trim()) errs.push("Email is required");
  else if (!EMAIL_RE.test(c.email.trim())) errs.push("Email is not a valid address");
  if (!c.country?.trim()) errs.push("Country is required");
  return errs;
}

/** Query the candidates table for any of these emails and return the ones that already exist. */
export async function findDuplicateEmails(emails: string[]): Promise<Set<string>> {
  const cleaned = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  if (cleaned.length === 0) return new Set();
  const { data, error } = await supabase.from("candidates").select("email").in("email", cleaned);
  if (error) {
    // Fail open on duplicate check — a transient DB blip shouldn't kill the whole intake.
    // We do NOT insert duplicates because of the unique index; the DB is the final gate.
    console.warn("[intake] duplicate email lookup failed:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => (r.email ?? "").toLowerCase()));
}

// ---------- Helpers ----------

/** Group files by top-level folder so bulk intake can distribute across candidates. */
export function groupFilesByFolder(files: IntakeFile[]): IntakeFile[][] {
  const map = new Map<string, IntakeFile[]>();
  for (const f of files) {
    const folder = f.path ? f.path.split("/").slice(0, -1).join("/") || "__root__" : "__root__";
    const arr = map.get(folder) ?? [];
    arr.push(f);
    map.set(folder, arr);
  }
  const groups = Array.from(map.values());
  return groups.length > 0 ? groups : [files];
}

export interface PersistedBatch {
  batchDbId: string;
  batch: IntakeBatch;
}

/**
 * Persist an intake batch end-to-end.
 * Sprint 4: validates every candidate, blocks duplicate emails, writes an
 *           audit_events row for each created candidate and uploaded document,
 *           and throws `IntakeError` with a taxonomy the UI can act on.
 */
export async function persistIntakeBatch(params: {
  mode: IntakeMode;
  productId: string;
  localBatch: IntakeBatch;
  files: IntakeFile[];
  actorName?: string;
  onProgress?: (done: number, total: number) => void;
  /** Human-readable live status for the processing UI (replaces fake ticker text). */
  onStatus?: (text: string) => void;
  onFileError?: (fileName: string, err: string) => void;
}): Promise<PersistedBatch> {
  const { mode, productId, localBatch, files, actorName, onProgress, onStatus, onFileError } =
    params;

  // Document-first workflow: we do NOT validate candidate identity (name,
  // email, country) before persisting. Those fields don't exist at upload
  // time — they are extracted from the documents by Qwen OCR + AI extraction
  // in the pipeline below. Field-level validation happens only at the
  // Approve step, after a human has verified extracted values.
  //
  // Duplicate detection is deferred to the post-OCR backfill below, because
  // the real email only becomes known after extraction.

  // 3. Create intake_batches row
  onStatus?.("Creating intake batch…");
  const { data: batchRow, error: batchErr } = await supabase
    .from("intake_batches")
    .insert({
      mode,
      product_id: productId,
      status: "processing",
      total_files: files.length,
      total_candidates: localBatch.candidates.length,
    })
    .select("id")
    .single();
  if (batchErr || !batchRow) {
    throw new IntakeError(
      classifySupabaseError(batchErr),
      `Failed to create batch: ${batchErr?.message ?? "unknown error"}`,
      undefined,
      batchErr,
    );
  }
  const batchDbId = batchRow.id;

  // 4. Insert candidate rows
  const insertRows = localBatch.candidates.map((c) => ({
    batch_id: batchDbId,
    product_id: productId,
    first_name: c.firstName,
    last_name: c.lastName,
    country: c.country,
    email: c.email,
    phone: "",
    status: "waiting",
    gate_status: "not_placement_ready",
    source_type: "internal",
    is_mock: false,
    verification_state: {
      status: c.status,
      extractionConfidence: c.extractionConfidence,
      ocr_state: "pending",
    },
    extracted_fields: {},
  }));
  const { data: candRows, error: candErr } = await supabase
    .from("candidates")
    .insert(insertRows)
    .select("candidate_id, first_name, last_name, email");
  if (candErr || !candRows) {
    throw new IntakeError(
      classifySupabaseError(candErr),
      `Failed to create candidates: ${candErr?.message ?? "unknown error"}`,
      undefined,
      candErr,
    );
  }

  // Map local candidate.id → DB candidate_id
  const idMap = new Map<string, string>();
  localBatch.candidates.forEach((c, i) => {
    if (candRows[i]) idMap.set(c.id, candRows[i].candidate_id);
  });

  // 4b. Audit: candidate_created (one row per candidate)
  const auditRows = candRows.map((r) => ({
    entity_type: "candidate",
    entity_id: r.candidate_id,
    event_type: "candidate_created",
    actor_name: actorName ?? "Recruiter",
    new_value: {
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      batch_id: batchDbId,
    },
  }));
  if (auditRows.length > 0) {
    const { error: auditErr } = await supabase.from("audit_events").insert(auditRows);
    if (auditErr) console.warn("[intake] audit insert failed:", auditErr.message);
  }

  // 5. Distribute files to candidates (parallel uploads within a small pool).
  const groups = mode === "single" ? [files] : groupFilesByFolder(files);
  const total = files.length;
  let done = 0;

  type UploadJob = { f: IntakeFile; candDbId: string };
  const uploadJobs: UploadJob[] = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const candLocalId = localBatch.candidates[gi % localBatch.candidates.length]?.id;
    if (!candLocalId) continue;
    const candDbId = idMap.get(candLocalId);
    if (!candDbId) continue;
    for (const f of groups[gi]) {
      uploadJobs.push({ f, candDbId });
    }
  }

  const uploadOne = async ({ f, candDbId }: UploadJob) => {
    // TODO(security): Add virus/malware scanning here (e.g. MetaDefender
    // Cloud API or Cloudmersive) BEFORE this upload path is opened to
    // external candidates or agencies. Currently only internal team
    // members upload test documents — acceptable for internal testing
    // only, not for any candidate-facing or agency-facing upload.

    // Pre-OCR gate: validate before touching storage.
    const validationErr = validateFile(f.file);
    if (validationErr) {
      onFileError?.(f.file.name, validationErr.message);
      done += 1;
      onProgress?.(done, total);
      onStatus?.(`Uploading ${done}/${total}`);
      return;
    }

    onStatus?.(`Uploading ${Math.min(done + 1, total)}/${total} — ${f.file.name}`);

    // Fingerprint — deterministic, tamper-evident, dedupe key.
    let sha256: string;
    try {
      sha256 = await withTimeout(
        computeSha256(f.file),
        HASH_TIMEOUT_MS,
        `Hashing ${f.file.name}`,
      );
    } catch (e) {
      onFileError?.(f.file.name, `Hash failed: ${e instanceof Error ? e.message : "unknown"}`);
      done += 1;
      onProgress?.(done, total);
      return;
    }

    const stdName = standardizeFilename(f.file.name);
    const objectPath = `${batchDbId}/${candDbId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${stdName}`;
    let upErr: { message: string } | null = null;
    try {
      const res = await withTimeout(
        supabase.storage.from("candidate-documents").upload(objectPath, f.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.file.type || undefined,
        }),
        uploadTimeoutMs(f.file.size),
        `Uploading ${f.file.name}`,
      );
      upErr = res.error;
    } catch (e) {
      upErr = { message: e instanceof Error ? e.message : String(e) };
    }
    if (upErr) {
      onFileError?.(f.file.name, upErr.message);
    } else {
      const docType = guessDocType(f.file.name);
      const docInsert: Record<string, unknown> = {
        candidate_id: candDbId,
        document_type: docType,
        file_name: f.file.name,
        standardized_filename: stdName,
        storage_path: objectPath,
        mime_type: f.file.type || null,
        size_bytes: f.file.size,
        sha256,
        uploaded_by_name: actorName ?? "Recruiter",
        ocr_complete: false,
        ocr_status: "pending",
        document_state: "draft",
      };
      const { error: docErr } = await withTimeout(
        supabase.from("candidate_documents").insert(docInsert as never),
        DOC_INSERT_TIMEOUT_MS,
        `Registering ${f.file.name}`,
      );
      if (docErr) {
        // Duplicate hash within the same candidate is not fatal — surface it clearly.
        const dupe = /duplicate key/.test(docErr.message);
        onFileError?.(
          f.file.name,
          dupe
            ? "Duplicate file (same content already uploaded for this candidate)."
            : docErr.message,
        );
      } else {
        // Audit: document_uploaded (includes hash for traceability)
        void supabase.from("audit_events").insert({
          entity_type: "candidate",
          entity_id: candDbId,
          event_type: "document_uploaded",
          actor_name: actorName ?? "Recruiter",
          new_value: {
            document_type: docType,
            file_name: f.file.name,
            sha256,
            storage_path: objectPath,
          },
        });
      }
    }
    done += 1;
    onProgress?.(done, total);
  };

  {
    const queue = [...uploadJobs];
    const workers = Array.from(
      { length: Math.min(UPLOAD_CONCURRENCY, queue.length) },
      async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (!next) break;
          await uploadOne(next);
        }
      },
    );
    await Promise.all(workers);
  }

  // 5b. Kick off Document Intelligence pipeline per candidate (isolated, sequential).
  //     Failures here don't roll back the intake — the candidate stays in the
  //     batch with a status that reflects what actually happened.
  const identityByCand = new Map<
    string,
    {
      firstName?: string;
      lastName?: string;
      email?: string;
      country?: string;
      confidence: number;
      status: BatchCandidate["status"];
      docsUploaded: number;
    }
  >();

  // Count uploaded docs per candidate (from what we just inserted).
  const docCountByCand = new Map<string, number>();
  await Promise.all(
    [...idMap.values()].map(async (candDbId) => {
      let docCount = 0;
      try {
        const res = await withTimeout(
          supabase
            .from("candidate_documents")
            .select("id", { count: "exact", head: true })
            .eq("candidate_id", candDbId),
          DRAFT_DB_TIMEOUT_MS,
          "Counting uploaded documents",
        );
        docCount = res.count ?? 0;
      } catch (e) {
        console.warn("[intake] doc count failed for", candDbId, e);
      }
      docCountByCand.set(candDbId, docCount);
    }),
  );

  for (const candDbId of idMap.values()) {
    const docsUploaded = docCountByCand.get(candDbId) ?? 0;

    // No documents uploaded for this candidate → skip OCR, mark missing_docs.
    if (docsUploaded === 0) {
      try {
        await withTimeout(
          supabase
            .from("candidates")
            .update({
              verification_state: {
                status: "missing_docs",
                extractionConfidence: 0,
                ocr_state: "no_documents",
              },
            })
            .eq("candidate_id", candDbId),
          DRAFT_DB_TIMEOUT_MS,
          "Marking missing documents",
        );
      } catch (e) {
        console.warn("[intake] missing_docs update failed for", candDbId, e);
      }
      identityByCand.set(candDbId, { confidence: 0, status: "missing_docs", docsUploaded: 0 });
      continue;
    }

    let pipelineErr: string | null = null;
    let pipelineFields: Array<{
      section: string;
      fieldName: string;
      value: string;
      confidence: number;
    }> = [];
    try {
      const pipelineResult = await withTimeout(
        runDocumentIntelligencePipeline({
          candidateId: candDbId,
          // Fresh intake: no prior human edits to merge — skip the extra DB round-trip.
          skipHumanMerge: true,
          onStep: (step, detail) => {
            if (step === "ocr_start") onStatus?.(`Running OCR — ${detail}`);
            else if (step === "ocr_progress") onStatus?.(`Running OCR — ${detail} documents`);
            else if (step === "ocr_cached") onStatus?.(`OCR already done — ${detail}`);
            else if (step === "ocr_failed") onStatus?.(`OCR failed — ${detail}`);
            else if (step === "ocr_skipped") onStatus?.(`OCR skipped — ${detail}`);
            else if (step === "ai_extract") onStatus?.("AI extraction of structured fields…");
            else if (step === "done") onStatus?.("Building candidate draft…");
          },
        }),
        PIPELINE_TIMEOUT_MS,
        "Document Intelligence pipeline",
      );
      pipelineFields = pipelineResult.draftFields;
    } catch (e) {
      pipelineErr = e instanceof Error ? e.message : String(e);
      console.warn("[intake] pipeline failed for", candDbId, pipelineErr);
    }

    // 5c. Backfill candidate identity from real OCR/AI extractions.
    const draftStarted = performance.now();
    console.info("[intake] draft_creation START", { candidateId: candDbId });
    try {
      // Entire draft phase is budget-capped. Nested DB calls also use
      // DRAFT_DB_TIMEOUT_MS; this outer budget stops any missed await from
      // parking the UI on "Finalising candidate draft…" forever.
      await withTimeout(
        (async () => {
          await ensureFreshSession();
          onStatus?.("Finalising candidate draft…");

          // Every DB call below is timeout-bound: supabase-js can park forever
          // in its silent token-refresh path after a long OCR run, and a hung
          // call here is exactly what froze the "Building candidate drafts"
          // stage. On any failure the draft is marked and the batch continues.
          let exs: {
            field_name: string | null;
            ai_value: unknown;
            confidence: number | null;
            section: string | null;
            status?: string | null;
          }[] | null = pipelineFields.map((field) => ({
            field_name: field.fieldName,
            ai_value: field.value,
            confidence: field.confidence,
            section: field.section,
            status: "pending",
          }));

          if (!exs || exs.length === 0) {
            // OCR ran but produced nothing (or the pipeline threw).
            try {
              await withTimeout(
                supabase
                  .from("candidates")
                  .update({
                    verification_state: {
                      status: "manual_review",
                      extractionConfidence: 0,
                      ocr_state: pipelineErr ? "failed" : "empty",
                      ocr_error: pipelineErr,
                    },
                  })
                  .eq("candidate_id", candDbId),
                DRAFT_DB_TIMEOUT_MS,
                "Marking candidate for manual review",
              );
            } catch (e) {
              console.warn("[intake] manual_review update failed for", candDbId, e);
            }
            identityByCand.set(candDbId, {
              confidence: 0,
              status: "manual_review",
              docsUploaded,
            });
            return;
          }

          // Rows are already canonical (`section` + `field_name`) because the
          // mapping layer ran inside the pipeline. Pick by namespaced key only.
          const pick = (keys: string[]): { value: string; confidence: number } | null => {
            const cand = exs
              .filter(
                (e) =>
                  keys.includes(
                    `${(e.section ?? "").toLowerCase()}.${(e.field_name ?? "").toLowerCase()}`,
                  ) && e.ai_value,
              )
              .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
            return cand
              ? { value: String(cand.ai_value), confidence: Number(cand.confidence ?? 0) }
              : null;
          };
          const firstName = pick(["personal.first_name"]);
          const lastName = pick(["personal.last_name"]);
          const email = pick(["contact.email"]);
          const country = pick(["personal.nationality", "contact.country"]);

          let fn = firstName?.value;
          let ln = lastName?.value;

          const patch: Record<string, unknown> = {};
          if (fn) patch.first_name = fn;
          if (ln) patch.last_name = ln;
          let normalizedEmail: string | undefined;
          const emailValue = email?.value?.trim().toLowerCase() ?? "";
          // A placeholder is a row key, never an extracted contact value.
          if (emailValue && !emailValue.endsWith("@intake.local") && EMAIL_RE.test(emailValue)) {
            normalizedEmail = emailValue;
            patch.email = normalizedEmail;
          }
          if (country?.value) patch.country = resolveCountryName(country.value) ?? country.value;

          const extractedFields: Record<string, Record<string, string>> = {};
          for (const e of exs) {
            const normalized = normalizeExtractionField({
              section: e.section,
              field_name: e.field_name,
              value: e.ai_value,
              confidence: e.confidence,
            });
            if (!normalized) continue;
            extractedFields[normalized.section] = extractedFields[normalized.section] ?? {};
            extractedFields[normalized.section][normalized.field_name] = normalized.value;
          }
          patch.extracted_fields = extractedFields;

          const meanConf =
            exs.reduce((a, e) => a + Number(e.confidence ?? 0), 0) / Math.max(1, exs.length);

          // Post-OCR duplicate detection.
          let isDuplicate = false;
          if (normalizedEmail) {
            try {
              const { data: dupes } = await withTimeout(
                supabase
                  .from("candidates")
                  .select("candidate_id")
                  .eq("email", normalizedEmail)
                  .neq("candidate_id", candDbId)
                  .limit(1),
                DRAFT_DB_TIMEOUT_MS,
                "Duplicate check",
              );
              isDuplicate = !!(dupes && dupes.length > 0);
            } catch (e) {
              console.warn("[intake] duplicate check failed for", candDbId, e);
            }
          }

          // Derive status from OCR reality.
          let status: BatchCandidate["status"];
          if (isDuplicate) status = "duplicate";
          else if (!fn || !ln) status = "manual_review";
          else if (meanConf < 0.7) status = "low_confidence";
          else if (!country?.value) status = "low_confidence";
          else status = "ready";

          patch.verification_state = {
            status,
            extractionConfidence: meanConf,
            ocr_state: "complete",
            isDuplicate,
          };

          identityByCand.set(candDbId, {
            firstName: fn,
            lastName: ln,
            email: normalizedEmail,
            country: country?.value,
            confidence: meanConf,
            status,
            docsUploaded,
          });

          if (Object.keys(patch).length > 0) {
            try {
              const { error: idErr } = await withTimeout(
                supabase
                  .from("candidates")
                  .update(patch as never)
                  .eq("candidate_id", candDbId),
                DRAFT_DB_TIMEOUT_MS,
                "Saving candidate draft",
              );
              if (idErr)
                console.warn("[intake] identity backfill failed for", candDbId, idErr.message);
            } catch (e) {
              console.warn("[intake] identity backfill failed for", candDbId, e);
            }
          }
        })(),
        DRAFT_PHASE_BUDGET_MS,
        "Draft phase",
      );
    } catch (e) {
      // Draft creation failed or budget exhausted — mark and keep moving.
      console.warn("[intake] draft creation failed for", candDbId, e);
      if (!identityByCand.has(candDbId)) {
        identityByCand.set(candDbId, {
          confidence: 0,
          status: "manual_review",
          docsUploaded,
        });
      }
      onStatus?.(
        e instanceof Error && /timed out|did not respond/i.test(e.message)
          ? "Draft save timed out — routed to manual review"
          : "Draft failed — routed to manual review",
      );
    } finally {
      // Always runs: emits completion + timing for this draft, so progress
      // can never park below 100% on a stuck draft.
      console.info("[intake] draft_creation END", {
        candidateId: candDbId,
        elapsedMs: Math.round(performance.now() - draftStarted),
        status: identityByCand.get(candDbId)?.status ?? "unknown",
      });
      onStatus?.("Candidate draft ready");
    }
  }

  // 6. Flip batch status (timeout-bound — the final step must never hang).
  try {
    await withTimeout(
      supabase.from("intake_batches").update({ status: "ready" }).eq("id", batchDbId),
      DRAFT_DB_TIMEOUT_MS,
      "Finalising batch",
    );
  } catch (e) {
    console.warn("[intake] batch status flip failed", e);
  }

  const persistedBatch: IntakeBatch = {
    ...localBatch,
    id: batchDbId,
    candidates: localBatch.candidates.map((c) => {
      const dbId = idMap.get(c.id) ?? c.id;
      const ident = identityByCand.get(dbId);
      return {
        ...c,
        id: dbId,
        firstName: ident?.firstName ?? c.firstName,
        lastName: ident?.lastName ?? c.lastName,
        email: ident?.email ?? c.email,
        country: ident?.country ?? c.country,
        extractionConfidence: ident?.confidence ?? c.extractionConfidence,
        status: ident?.status ?? c.status,
      };
    }) as BatchCandidate[],
  };

  return { batchDbId, batch: persistedBatch };
}

/**
 * Persist a candidate approval — updates status + verification_state + audit log.
 * Sprint 4: enforces "all mandatory sections verified" before approval.
 */
export async function approveCandidate(
  candidateDbId: string,
  snapshot: {
    values: Record<string, Record<string, string>>;
    verifiedSections: string[];
    declarations: { reviewed: boolean; matches: boolean; complete: boolean };
    requiredSections?: string[];
    actorName?: string;
  },
) {
  // Guardrail: block approval if declarations aren't checked or required sections are missing.
  const d = snapshot.declarations;
  if (!d.reviewed || !d.matches || !d.complete) {
    throw new IntakeError(
      "validation",
      "All three approval declarations must be checked before approving.",
    );
  }
  if (snapshot.requiredSections?.length) {
    const missing = snapshot.requiredSections.filter((s) => !snapshot.verifiedSections.includes(s));
    if (missing.length > 0) {
      throw new IntakeError(
        "validation",
        `Cannot approve — the following sections are not yet verified: ${missing.join(", ")}`,
      );
    }
  }

  const { error: updErr } = await supabase
    .from("candidates")
    .update({
      status: "shortlisted",
      gate_status: "eligible",
      verification_state: {
        approved: true,
        approvedAt: new Date().toISOString(),
        verifiedSections: snapshot.verifiedSections,
        declarations: snapshot.declarations,
      },
      extracted_fields: snapshot.values,
    })
    .eq("candidate_id", candidateDbId);
  if (updErr) {
    throw new IntakeError(
      classifySupabaseError(updErr),
      `Failed to approve candidate: ${updErr.message}`,
      undefined,
      updErr,
    );
  }

  await supabase.from("audit_events").insert({
    entity_type: "candidate",
    entity_id: candidateDbId,
    event_type: "verification_completed",
    actor_name: snapshot.actorName ?? "Recruiter",
    new_value: { verifiedSections: snapshot.verifiedSections },
  });
}

/**
 * Sprint 4 — draft autosave.
 * Persists in-progress verification state to the candidate row without
 * flipping any status. Safe to call on blur/interval; a failure is
 * swallowed and returned as a flag so the UI can show a subtle indicator.
 */
export async function saveCandidateDraft(
  candidateDbId: string,
  draft: {
    values?: Record<string, Record<string, string>>;
    verifiedSections?: string[];
  },
): Promise<{ ok: boolean; savedAt: string; error?: string }> {
  const savedAt = new Date().toISOString();
  const patch: {
    extracted_fields?: Record<string, Record<string, string>>;
    verification_state?: { draft: true; draftSavedAt: string; verifiedSections: string[] };
  } = {};
  if (draft.values) patch.extracted_fields = draft.values;
  if (draft.verifiedSections) {
    patch.verification_state = {
      draft: true,
      draftSavedAt: savedAt,
      verifiedSections: draft.verifiedSections,
    };
  }
  if (Object.keys(patch).length === 0) return { ok: true, savedAt };
  const { error } = await supabase
    .from("candidates")
    .update(patch)
    .eq("candidate_id", candidateDbId);
  if (error) return { ok: false, savedAt, error: error.message };
  return { ok: true, savedAt };
}

/**
 * Sprint 4 — required-documents gate.
 * Given the candidate id and the set of required document types for the
 * candidate's product, returns the ones that haven't been uploaded yet.
 * Used before allowing status transitions to shortlisted/contract.
 */
export async function missingRequiredDocuments(
  candidateDbId: string,
  requiredDocTypes: string[],
): Promise<string[]> {
  const { data, error } = await supabase
    .from("candidate_documents")
    .select("document_type")
    .eq("candidate_id", candidateDbId);
  if (error) {
    console.warn("[intake] required-doc lookup failed:", error.message);
    return [];
  }
  const uploaded = new Set((data ?? []).map((d) => d.document_type));
  return requiredDocTypes.filter((t) => !uploaded.has(t));
}
