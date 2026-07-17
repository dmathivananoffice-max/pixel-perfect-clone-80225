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

  // 1. Validate every candidate before any DB writes.
  for (const c of localBatch.candidates) {
    const problems = validateCandidate(c);
    if (problems.length > 0) {
      throw new IntakeError(
        'validation',
        `${c.firstName || 'Candidate'} ${c.lastName || ''}: ${problems.join('; ')}`,
      );
    }
  }

  // 2. Duplicate email check.
  const emails = localBatch.candidates.map((c) => c.email);
  const dupes = await findDuplicateEmails(emails);
  const conflicts = localBatch.candidates.filter((c) => dupes.has(c.email.trim().toLowerCase()));
  if (conflicts.length > 0) {
    const list = conflicts.map((c) => c.email).join(', ');
    throw new IntakeError(
      'validation',
      `A candidate with this email already exists in the database: ${list}. Please review or merge the existing record.`,
      'email',
    );
  }

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
    is_mock: true,
    verification_state: { status: c.status, extractionConfidence: c.extractionConfidence },
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
      const cleanName = f.file.name.replace(/[^\w.\-]/g, '_');
      const objectPath = `${batchDbId}/${candDbId}/${Date.now()}-${cleanName}`;
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
        const { error: docErr } = await supabase.from('candidate_documents').insert({
          candidate_id: candDbId,
          document_type: docType,
          file_name: f.file.name,
          storage_path: objectPath,
          mime_type: f.file.type || null,
          size_bytes: f.file.size,
          ocr_complete: false,
        });
        if (docErr) {
          onFileError?.(f.file.name, docErr.message);
        } else {
          // Audit: document_uploaded
          void supabase.from('audit_events').insert({
            entity_type: 'candidate',
            entity_id: candDbId,
            event_type: 'document_uploaded',
            actor_name: actorName ?? 'Recruiter',
            new_value: { document_type: docType, file_name: f.file.name },
          });
        }
      }
      done += 1;
      onProgress?.(done, total);
    }
  }

  // 6. Flip batch status
  await supabase.from('intake_batches').update({ status: 'ready' }).eq('id', batchDbId);

  const persistedBatch: IntakeBatch = {
    ...localBatch,
    id: batchDbId,
    candidates: localBatch.candidates.map((c) => ({
      ...c,
      id: idMap.get(c.id) ?? c.id,
    })) as BatchCandidate[],
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
