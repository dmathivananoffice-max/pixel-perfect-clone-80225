// ─────────────────────────────────────────────────────────────
// CANDIDATE ISOLATION LAYER — CRITICAL GUARDRAIL.
//
// This is the single choke-point through which every document read
// MUST flow. Callers pass a candidate id; the query is scoped by
// candidate_id BEFORE the row leaves the database. There is no
// path in this module that fetches documents without a candidate
// filter, no fuzzy match, no cross-candidate join.
//
// Rule: if you find yourself writing `supabase.from('candidate_documents')`
// anywhere outside this file, stop and use these helpers instead.
// ─────────────────────────────────────────────────────────────
import { supabase } from '@/integrations/supabase/client';

export interface IsolatedDocument {
  id: string;
  candidate_id: string;
  document_type: string;
  file_name: string;
  standardized_filename: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  sha256: string | null;
  upload_id: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  ocr_status: string;
  ocr_raw: unknown;
  ocr_provider: string | null;
  ocr_version: string | null;
  ocr_confidence: number | null;
  ocr_complete: boolean;
  ocr_error: string | null;
  ai_model_version: string | null;
  page_count: number | null;
  document_state: string;
  processed_at: string | null;
  created_at: string;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
}

export interface IsolatedExtraction {
  id: string;
  candidate_id: string;
  document_id: string;
  section: string;
  field_name: string;
  ai_value: string | null;
  human_value: string | null;
  confidence: number | null;
  page_number: number | null;
  bbox: unknown;
  ocr_provider: string | null;
  ocr_version: string | null;
  ai_model_version: string | null;
  status: string;
  processed_at: string;
}

function assertCandidateId(candidateId: string) {
  if (!candidateId || typeof candidateId !== 'string' || candidateId.length < 8) {
    throw new Error(
      '[docintel/isolation] Refusing document query without a valid candidate id. Cross-candidate access is forbidden.',
    );
  }
}

/** ALL documents for a single candidate. Hard-scoped by candidate_id. */
export async function fetchCandidateDocuments(candidateId: string): Promise<IsolatedDocument[]> {
  assertCandidateId(candidateId);
  const { data, error } = await supabase
    .from('candidate_documents')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // Defense in depth: even if the DB returned an unrelated row, we filter it out client-side too.
  return (data ?? []).filter((d) => d.candidate_id === candidateId) as unknown as IsolatedDocument[];
}

/**
 * A single document — but ONLY if it belongs to the given candidate.
 * If a caller has a documentId and asks for a different candidate,
 * this returns null instead of leaking the row.
 */
export async function fetchDocumentForCandidate(
  candidateId: string,
  documentId: string,
): Promise<IsolatedDocument | null> {
  assertCandidateId(candidateId);
  if (!documentId) throw new Error('documentId required');
  const { data, error } = await supabase
    .from('candidate_documents')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('id', documentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.candidate_id !== candidateId) return null; // paranoia
  return data as unknown as IsolatedDocument;
}

/** All extractions for a candidate. Hard-scoped by candidate_id. */
export async function fetchExtractionsForCandidate(candidateId: string): Promise<IsolatedExtraction[]> {
  assertCandidateId(candidateId);
  const { data, error } = await supabase
    .from('document_extractions')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('processed_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).filter((e) => e.candidate_id === candidateId) as unknown as IsolatedExtraction[];
}

/**
 * Signed URL for a document preview. The candidate_id is verified
 * against the document BEFORE the URL is generated — a mismatch
 * throws and no URL is issued.
 */
export async function getPreviewUrl(candidateId: string, documentId: string): Promise<string | null> {
  const doc = await fetchDocumentForCandidate(candidateId, documentId);
  if (!doc) {
    throw new Error(
      `[docintel/isolation] Document ${documentId} does not belong to candidate ${candidateId}. Preview blocked.`,
    );
  }
  const { data, error } = await supabase.storage
    .from('candidate-documents')
    .createSignedUrl(doc.storage_path, 300);
  if (error) throw error;
  return data?.signedUrl ?? null;
}
