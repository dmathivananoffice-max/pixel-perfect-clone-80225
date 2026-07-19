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
import { supabase } from '@/integrations/supabase/client';
import type { IntakeBatch, IntakeMode, BatchCandidate } from './batch';
import { computeSha256, validateFile, standardizeFilename } from '@/lib/docintel/fingerprint';
import { runDocumentIntelligencePipeline } from '@/lib/docintel/pipeline';

/** File carried through the upload step, keeping the raw browser File handle. */
export interface IntakeFile {
  id: string;
  file: File;
  path?: string;
  kind: 'pdf' | 'image' | 'doc' | 'zip' | 'other';
}

// ---------- Error taxonomy (Sprint 4) ----------

/**
 * Structured error surfaced to the UI so callers can distinguish
 * validation problems (fix your input) from transient issues (retry)
 * from RLS/permission denials (don't retry, escalate).
 */
export type IntakeErrorKind =
  | 'validation'   // recruiter can fix by editing form (duplicate email, missing field)
  | 'permission'   // RLS / auth issue — retry won't help
  | 'network'      // transient — retry is appropriate
  | 'unknown';     // fall-back; show raw message

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
  if (!err) return 'unknown';
  const e = err as { code?: string; message?: string; status?: number };
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('row-level security') || msg.includes('permission denied') || e.status === 403) {
    return 'permission';
  }
  if (msg.includes('duplicate key') || e.code === '23505') return 'validation';
  if (msg.includes('violates not-null') || e.code === '23502') return 'validation';
  if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('timeout')) {
    return 'network';
  }
  return 'unknown';
}

export function isTransient(kind: IntakeErrorKind): boolean {
  return kind === 'network';
}

// ---------- Validation (Sprint 4) ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate a single BatchCandidate before we let it hit the database. */
export function validateCandidate(c: BatchCandidate): string[] {
  const errs: string[] = [];
  if (!c.firstName?.trim()) errs.push('First name is required');
  if (!c.lastName?.trim()) errs.push('Last name is required');
  if (!c.email?.trim()) errs.push('Email is required');
  else if (!EMAIL_RE.test(c.email.trim())) errs.push('Email is not a valid address');
  if (!c.country?.trim()) errs.push('Country is required');
  return errs;
}

/** Query the candidates table for any of these emails and return the ones that already exist. */
export async function findDuplicateEmails(emails: string[]): Promise<Set<string>> {
  const cleaned = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  if (cleaned.length === 0) return new Set();
  const { data, error } = await supabase
    .from('candidates')
    .select('email')
    .in('email', cleaned);
  if (error) {
    // Fail open on duplicate check — a transient DB blip shouldn't kill the whole intake.
    // We do NOT insert duplicates because of the unique index; the DB is the final gate.
    console.warn('[intake] duplicate email lookup failed:', error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => (r.email ?? '').toLowerCase()));
}

// ---------- Helpers ----------

/** Group files by top-level folder so bulk intake can distribute across candidates. */
export function groupFilesByFolder(files: IntakeFile[]): IntakeFile[][] {
  const map = new Map<string, IntakeFile[]>();
  for (const f of files) {
    const folder = f.path ? f.path.split('/').slice(0, -1).join('/') || '__root__' : '__root__';
    const arr = map.get(folder) ?? [];
    arr.push(f);
    map.set(folder, arr);
  }
  const groups = Array.from(map.values());
  return groups.length > 0 ? groups : [files];
}

/** Guess a document type key from filename (mirrors REQUIRED_UPLOADS keys). */
function guessDocType(name: string): string {
  const n = name.toLowerCase();
  if (/passport|reisepass/.test(n)) return 'passport';
  if (/photo|lichtbild|foto/.test(n)) return 'photo';
  if (/degree|bachelor|zeugnis|diploma/.test(n)) return 'degree';
  if (/sprach|goethe|telc|language|deutsch/.test(n)) return 'sprach';
  if (/cv|resume|lebenslauf/.test(n)) return 'cv';
  if (/police|fuehrungszeugnis|clearance/.test(n)) return 'police';
  if (/medical|gesundheit|fitness/.test(n)) return 'medical';
  if (/driving|fuehrerschein|licence|license/.test(n)) return 'driving';
  return 'other';
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
  onFileError?: (fileName: string, err: string) => void;
}): Promise<PersistedBatch> {
  const { mode, productId, localBatch, files, actorName, onProgress, onFileError } = params;

  // Document-first workflow: we do NOT validate candidate identity (name,
  // email, country) before persisting. Those fields don't exist at upload
  // time — they are extracted from the documents by Qwen OCR + AI extraction
  // in the pipeline below. Field-level validation happens only at the
  // Approve step, after a human has verified extracted values.
  //
  // Duplicate detection is deferred to the post-OCR backfill below, because
  // the real email only becomes known after extraction.

  // 3. Create intake_batches row
  const { data: batchRow, error: batchErr } = await supabase
    .from('intake_batches')
    .insert({
      mode,
      product_id: productId,
      status: 'processing',
      total_files: files.length,
      total_candidates: localBatch.candidates.length,
    })
    .select('id')
    .single();
  if (batchErr || !batchRow) {
    throw new IntakeError(
      classifySupabaseError(batchErr),
      `Failed to create batch: ${batchErr?.message ?? 'unknown error'}`,
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
    phone: '',
    status: 'waiting',
    gate_status: 'not_placement_ready',
    source_type: 'internal',
    is_mock: false,
    verification_state: { status: c.status, extractionConfidence: c.extractionConfidence, ocr_state: 'pending' },
    extracted_fields: {},
  }));
  const { data: candRows, error: candErr } = await supabase
    .from('candidates')
    .insert(insertRows)
    .select('candidate_id, first_name, last_name, email');
  if (candErr || !candRows) {
    throw new IntakeError(
      classifySupabaseError(candErr),
      `Failed to create candidates: ${candErr?.message ?? 'unknown error'}`,
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
    entity_type: 'candidate',
    entity_id: r.candidate_id,
    event_type: 'candidate_created',
    actor_name: actorName ?? 'Recruiter',
    new_value: { first_name: r.first_name, last_name: r.last_name, email: r.email, batch_id: batchDbId },
  }));
  if (auditRows.length > 0) {
    const { error: auditErr } = await supabase.from('audit_events').insert(auditRows);
    if (auditErr) console.warn('[intake] audit insert failed:', auditErr.message);
  }

  // 5. Distribute files to candidates
  const groups = mode === 'single' ? [files] : groupFilesByFolder(files);
  const total = files.length;
  let done = 0;

  for (let gi = 0; gi < groups.length; gi++) {
    const candLocalId = localBatch.candidates[gi % localBatch.candidates.length]?.id;
    if (!candLocalId) continue;
    const candDbId = idMap.get(candLocalId);
    if (!candDbId) continue;

    for (const f of groups[gi]) {
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
        continue;
      }


      // Fingerprint — deterministic, tamper-evident, dedupe key.
      let sha256: string;
      try {
        sha256 = await computeSha256(f.file);
      } catch (e) {
        onFileError?.(f.file.name, `Hash failed: ${e instanceof Error ? e.message : 'unknown'}`);
        done += 1;
        onProgress?.(done, total);
        continue;
      }

      const stdName = standardizeFilename(f.file.name);
      const objectPath = `${batchDbId}/${candDbId}/${Date.now()}-${stdName}`;
      const { error: upErr } = await supabase.storage
        .from('candidate-documents')
        .upload(objectPath, f.file, {
          cacheControl: '3600',
          upsert: false,
          contentType: f.file.type || undefined,
        });
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
          uploaded_by_name: actorName ?? 'Recruiter',
          ocr_complete: false,
          ocr_status: 'pending',
          document_state: 'draft',
        };
        const { error: docErr } = await supabase
          .from('candidate_documents')
          .insert(docInsert as never);
        if (docErr) {
          // Duplicate hash within the same candidate is not fatal — surface it clearly.
          const dupe = /duplicate key/.test(docErr.message);
          onFileError?.(f.file.name, dupe ? 'Duplicate file (same content already uploaded for this candidate).' : docErr.message);
        } else {
          // Audit: document_uploaded (includes hash for traceability)
          void supabase.from('audit_events').insert({
            entity_type: 'candidate',
            entity_id: candDbId,
            event_type: 'document_uploaded',
            actor_name: actorName ?? 'Recruiter',
            new_value: { document_type: docType, file_name: f.file.name, sha256, storage_path: objectPath },
          });
        }
      }
      done += 1;
      onProgress?.(done, total);
    }
  }

  // 5b. Kick off Document Intelligence pipeline per candidate (isolated, sequential).
  //     Failures here don't roll back the intake — the candidate stays in the
  //     batch with a status that reflects what actually happened.
  const identityByCand = new Map<string, {
    firstName?: string;
    lastName?: string;
    email?: string;
    country?: string;
    confidence: number;
    status: BatchCandidate['status'];
    docsUploaded: number;
  }>();

  // Count uploaded docs per candidate (from what we just inserted).
  const docCountByCand = new Map<string, number>();
  for (const candDbId of idMap.values()) {
    const { count } = await supabase
      .from('candidate_documents')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candDbId);
    docCountByCand.set(candDbId, count ?? 0);
  }

  for (const candDbId of idMap.values()) {
    const docsUploaded = docCountByCand.get(candDbId) ?? 0;

    // No documents uploaded for this candidate → skip OCR, mark missing_docs.
    if (docsUploaded === 0) {
      await supabase
        .from('candidates')
        .update({
          verification_state: { status: 'missing_docs', extractionConfidence: 0, ocr_state: 'no_documents' },
        })
        .eq('candidate_id', candDbId);
      identityByCand.set(candDbId, { confidence: 0, status: 'missing_docs', docsUploaded: 0 });
      continue;
    }

    let pipelineErr: string | null = null;
    try {
      await runDocumentIntelligencePipeline({ candidateId: candDbId });
    } catch (e) {
      pipelineErr = e instanceof Error ? e.message : String(e);
      console.warn('[intake] pipeline failed for', candDbId, pipelineErr);
    }

    // 5c. Backfill candidate identity from real OCR/AI extractions.
    const { data: exs } = await supabase
      .from('document_extractions')
      .select('field_name, ai_value, confidence, section')
      .eq('candidate_id', candDbId);

    if (!exs || exs.length === 0) {
      // OCR ran but produced nothing (or the pipeline threw).
      await supabase
        .from('candidates')
        .update({
          verification_state: {
            status: 'manual_review',
            extractionConfidence: 0,
            ocr_state: pipelineErr ? 'failed' : 'empty',
            ocr_error: pipelineErr,
          },
        })
        .eq('candidate_id', candDbId);
      identityByCand.set(candDbId, { confidence: 0, status: 'manual_review', docsUploaded });
      continue;
    }

    const pick = (names: string[]): { value: string; confidence: number } | null => {
      const cand = exs
        .filter((e) => names.includes((e.field_name ?? '').toLowerCase()) && e.ai_value)
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      return cand ? { value: String(cand.ai_value), confidence: Number(cand.confidence ?? 0) } : null;
    };
    const firstName = pick(['first_name', 'given_name', 'given_names']);
    const lastName = pick(['last_name', 'surname', 'family_name']);
    const fullName = !firstName || !lastName ? pick(['full_name', 'name']) : null;
    const email = pick(['email', 'email_address']);
    const country = pick(['nationality', 'country', 'country_of_birth']);

    let fn = firstName?.value;
    let ln = lastName?.value;
    if ((!fn || !ln) && fullName?.value) {
      const parts = fullName.value.trim().split(/\s+/);
      fn = fn ?? parts[0];
      ln = ln ?? (parts.slice(1).join(' ') || parts[0]);
    }

    const patch: Record<string, unknown> = {};
    if (fn) patch.first_name = fn;
    if (ln) patch.last_name = ln;
    let normalizedEmail: string | undefined;
    if (email?.value && EMAIL_RE.test(email.value.trim())) {
      normalizedEmail = email.value.trim().toLowerCase();
      patch.email = normalizedEmail;
    }
    if (country?.value) patch.country = country.value;

    const extractedFields: Record<string, Record<string, string>> = {};
    for (const e of exs) {
      const sec = String(e.section ?? 'general');
      const key = String(e.field_name ?? '');
      if (!key) continue;
      extractedFields[sec] = extractedFields[sec] ?? {};
      extractedFields[sec][key] = String(e.ai_value ?? '');
    }
    patch.extracted_fields = extractedFields;

    const meanConf =
      exs.reduce((a, e) => a + Number(e.confidence ?? 0), 0) / Math.max(1, exs.length);

    // Post-OCR duplicate detection.
    let isDuplicate = false;
    if (normalizedEmail) {
      const { data: dupes } = await supabase
        .from('candidates')
        .select('candidate_id')
        .eq('email', normalizedEmail)
        .neq('candidate_id', candDbId)
        .limit(1);
      isDuplicate = !!(dupes && dupes.length > 0);
    }

    // Derive status from OCR reality.
    let status: BatchCandidate['status'];
    if (isDuplicate) status = 'duplicate';
    else if (!fn || !ln || !country?.value) status = 'manual_review';
    else if (meanConf < 0.7) status = 'low_confidence';
    else status = 'ready';

    patch.verification_state = {
      status,
      extractionConfidence: meanConf,
      ocr_state: 'complete',
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
      const { error: idErr } = await supabase
        .from('candidates')
        .update(patch as never)
        .eq('candidate_id', candDbId);
      if (idErr) console.warn('[intake] identity backfill failed for', candDbId, idErr.message);
    }
  }


  // 6. Flip batch status
  await supabase.from('intake_batches').update({ status: 'ready' }).eq('id', batchDbId);

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
export async function approveCandidate(candidateDbId: string, snapshot: {
  values: Record<string, Record<string, string>>;
  verifiedSections: string[];
  declarations: { reviewed: boolean; matches: boolean; complete: boolean };
  requiredSections?: string[];
  actorName?: string;
}) {
  // Guardrail: block approval if declarations aren't checked or required sections are missing.
  const d = snapshot.declarations;
  if (!d.reviewed || !d.matches || !d.complete) {
    throw new IntakeError('validation', 'All three approval declarations must be checked before approving.');
  }
  if (snapshot.requiredSections?.length) {
    const missing = snapshot.requiredSections.filter((s) => !snapshot.verifiedSections.includes(s));
    if (missing.length > 0) {
      throw new IntakeError(
        'validation',
        `Cannot approve — the following sections are not yet verified: ${missing.join(', ')}`,
      );
    }
  }

  const { error: updErr } = await supabase
    .from('candidates')
    .update({
      status: 'shortlisted',
      gate_status: 'eligible',
      verification_state: {
        approved: true,
        approvedAt: new Date().toISOString(),
        verifiedSections: snapshot.verifiedSections,
        declarations: snapshot.declarations,
      },
      extracted_fields: snapshot.values,
    })
    .eq('candidate_id', candidateDbId);
  if (updErr) {
    throw new IntakeError(
      classifySupabaseError(updErr),
      `Failed to approve candidate: ${updErr.message}`,
      undefined,
      updErr,
    );
  }

  await supabase.from('audit_events').insert({
    entity_type: 'candidate',
    entity_id: candidateDbId,
    event_type: 'verification_completed',
    actor_name: snapshot.actorName ?? 'Recruiter',
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
    .from('candidates')
    .update(patch)
    .eq('candidate_id', candidateDbId);
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
    .from('candidate_documents')
    .select('document_type')
    .eq('candidate_id', candidateDbId);
  if (error) {
    console.warn('[intake] required-doc lookup failed:', error.message);
    return [];
  }
  const uploaded = new Set((data ?? []).map((d) => d.document_type));
  return requiredDocTypes.filter((t) => !uploaded.has(t));
}
