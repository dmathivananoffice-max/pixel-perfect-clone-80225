// ─────────────────────────────────────────────────────────────
// Sprint 2 – Real intake persistence
// Turns an in-memory IntakeBatch + real File[] into DB rows:
//   • public.intake_batches                (1 row)
//   • public.candidates                    (N rows, one per BatchCandidate)
//   • storage bucket "candidate-documents" (M objects)
//   • public.candidate_documents           (M rows)
//   • public.audit_events                  (1 row per approval; see approveCandidate)
// ─────────────────────────────────────────────────────────────
import { supabase } from '@/integrations/supabase/client';
import type { IntakeBatch, IntakeMode, BatchCandidate } from './batch';

/** File carried through the upload step, keeping the raw browser File handle. */
export interface IntakeFile {
  id: string;
  file: File;
  path?: string;   // webkitRelativePath for folder uploads
  kind: 'pdf' | 'image' | 'doc' | 'zip' | 'other';
}

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
  batch: IntakeBatch; // candidate.id fields replaced with real DB uuids (candidate_id)
}

/**
 * Persist an intake batch end-to-end. Non-fatal errors on individual file uploads
 * are surfaced via `onFileError` but do not abort the whole batch — the recruiter
 * can re-upload from the verification screen.
 */
export async function persistIntakeBatch(params: {
  mode: IntakeMode;
  productId: string;
  localBatch: IntakeBatch;
  files: IntakeFile[];
  onProgress?: (done: number, total: number) => void;
  onFileError?: (fileName: string, err: string) => void;
}): Promise<PersistedBatch> {
  const { mode, productId, localBatch, files, onProgress, onFileError } = params;

  // 1. Create intake_batches row
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
  if (batchErr || !batchRow) throw new Error(`Failed to create batch: ${batchErr?.message ?? 'unknown'}`);
  const batchDbId = batchRow.id;

  // 2. Insert candidate rows
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
    .select('candidate_id, first_name, last_name');
  if (candErr || !candRows) throw new Error(`Failed to create candidates: ${candErr?.message ?? 'unknown'}`);

  // Map local candidate.id → DB candidate_id (preserve order — Supabase returns in insert order)
  const idMap = new Map<string, string>();
  localBatch.candidates.forEach((c, i) => {
    if (candRows[i]) idMap.set(c.id, candRows[i].candidate_id);
  });

  // 3. Distribute files to candidates
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
        // 4. Insert candidate_documents row
        const { error: docErr } = await supabase.from('candidate_documents').insert({
          candidate_id: candDbId,
          document_type: docType,
          file_name: f.file.name,
          storage_path: objectPath,
          mime_type: f.file.type || null,
          size_bytes: f.file.size,
          ocr_complete: false,
        });
        if (docErr) onFileError?.(f.file.name, docErr.message);
      }
      done += 1;
      onProgress?.(done, total);
    }
  }

  // 5. Flip batch status
  await supabase.from('intake_batches').update({ status: 'ready' }).eq('id', batchDbId);

  // Rewrite batch candidates with DB ids so downstream approve() can UPDATE by id
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

/** Persist a candidate approval — updates status + verification_state + audit log. */
export async function approveCandidate(candidateDbId: string, snapshot: {
  values: Record<string, Record<string, string>>;
  verifiedSections: string[];
  declarations: { reviewed: boolean; matches: boolean; complete: boolean };
}) {
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
  if (updErr) throw updErr;

  await supabase.from('audit_events').insert({
    entity_type: 'candidate',
    entity_id: candidateDbId,
    event_type: 'intake_approved',
    payload: { verifiedSections: snapshot.verifiedSections },
  });
}
