// ─────────────────────────────────────────────────────────────
// End-to-end Document Intelligence pipeline for ONE candidate.
//
//   Storage → OCR (cached by sha256) → AI extraction → document_extractions
//
// Isolation invariants enforced here:
//   1. Every document processed belongs to `candidateId` (verified via
//      the isolation layer, not by trusting the caller).
//   2. The AI prompt only ever contains OCR from THIS candidate.
//   3. OCR is skipped when the same sha256 already has ocr_status='complete'.
// ─────────────────────────────────────────────────────────────
import { supabase } from '@/integrations/supabase/client';
import { fetchCandidateDocuments } from './isolation';
import { getOcrProvider, getAiExtractor } from '.';
import { LOW_CONFIDENCE_THRESHOLD, type OcrResult } from './types';

export interface PipelineOptions {
  candidateId: string;
  onStep?: (step: string, detail?: string) => void;
}

export interface PipelineResult {
  candidateId: string;
  ocrRun: number;
  ocrCached: number;
  ocrFailed: number;
  fieldsExtracted: number;
  lowConfidenceFields: number;
  warnings: number;
}

async function downloadDocumentBytes(storagePath: string): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from('candidate-documents').download(storagePath);
  if (error || !data) return null;
  return await data.arrayBuffer();
}

export async function runDocumentIntelligencePipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const { candidateId, onStep } = opts;
  onStep?.('start', candidateId);

  const documents = await fetchCandidateDocuments(candidateId);
  const ocrProvider = getOcrProvider();
  const aiExtractor = getAiExtractor();

  const result: PipelineResult = {
    candidateId,
    ocrRun: 0,
    ocrCached: 0,
    ocrFailed: 0,
    fieldsExtracted: 0,
    lowConfidenceFields: 0,
    warnings: 0,
  };

  const ocrByDoc = new Map<string, { ocr: OcrResult; docType: string }>();

  for (const doc of documents) {
    // Cross-candidate guard (defense in depth — isolation layer already filtered).
    if (doc.candidate_id !== candidateId) continue;

    if (doc.ocr_status === 'complete' && doc.ocr_raw && doc.ocr_provider) {
      onStep?.('ocr_cached', doc.file_name);
      const cached = doc.ocr_raw as unknown as OcrResult;
      ocrByDoc.set(doc.id, { ocr: cached, docType: doc.document_type });
      result.ocrCached += 1;
      continue;
    }

    try {
      await supabase
        .from('candidate_documents')
        .update({ ocr_status: 'processing' })
        .eq('id', doc.id)
        .eq('candidate_id', candidateId);

      const bytes = await downloadDocumentBytes(doc.storage_path);
      if (!bytes) throw new Error('Storage download failed');

      onStep?.('ocr_start', doc.file_name);
      const ocr = await ocrProvider.extract(
        {
          candidateId,
          documentId: doc.id,
          storagePath: doc.storage_path,
          mimeType: doc.mime_type,
          fileName: doc.file_name,
        },
        bytes,
      );

      await supabase
        .from('candidate_documents')
        .update({
          ocr_status: 'complete',
          ocr_complete: true,
          ocr_provider: ocr.provider,
          ocr_version: ocr.version,
          ocr_raw: ocr as unknown as Record<string, unknown>,
          page_count: ocr.pageCount,
          processed_at: ocr.processedAt,
          document_state: 'ai_processed',
        })
        .eq('id', doc.id)
        .eq('candidate_id', candidateId);

      ocrByDoc.set(doc.id, { ocr, docType: doc.document_type });
      result.ocrRun += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from('candidate_documents')
        .update({ ocr_status: 'failed', ocr_error: message })
        .eq('id', doc.id)
        .eq('candidate_id', candidateId);
      onStep?.('ocr_failed', `${doc.file_name}: ${message}`);
      result.ocrFailed += 1;
    }
  }

  if (ocrByDoc.size === 0) return result;

  onStep?.('ai_extract');
  const aiInput = Array.from(ocrByDoc.entries()).map(([documentId, v]) => ({
    documentId,
    docType: v.docType,
    ocr: v.ocr,
  }));
  const aiResult = await aiExtractor.extract(candidateId, aiInput);

  // Persist extractions — every row carries candidate_id + document_id, and
  // low-confidence fields land in status='flagged' so the UI can force review.
  const rows = aiResult.fields.map((f) => ({
    candidate_id: candidateId,
    document_id: f.documentId,
    section: f.section,
    field_name: f.fieldName,
    ai_value: f.value || null,
    confidence: f.confidence,
    page_number: f.page,
    bbox: (f.bbox ?? null) as unknown as Record<string, unknown> | null,
    ocr_provider: getOcrProvider().name,
    ocr_version: getOcrProvider().version,
    ai_model_version: aiResult.modelVersion,
    status: f.confidence < LOW_CONFIDENCE_THRESHOLD ? 'flagged' : 'pending',
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from('document_extractions').insert(rows as never);
    if (error) {
      onStep?.('extraction_persist_failed', error.message);
    } else {
      result.fieldsExtracted = rows.length;
      result.lowConfidenceFields = rows.filter((r) => r.status === 'flagged').length;
    }
  }

  // Audit warnings but never auto-resolve.
  if (aiResult.warnings.length > 0) {
    result.warnings = aiResult.warnings.length;
    await supabase.from('audit_events').insert(
      aiResult.warnings.map((w) => ({
        entity_type: 'candidate',
        entity_id: candidateId,
        event_type: 'ai_warning',
        actor_name: 'Document Intelligence Engine',
        new_value: w,
      })),
    );
  }

  await supabase.from('audit_events').insert({
    entity_type: 'candidate',
    entity_id: candidateId,
    event_type: 'ai_extraction_completed',
    actor_name: 'Document Intelligence Engine',
    new_value: {
      model: aiResult.model,
      model_version: aiResult.modelVersion,
      fields: rows.length,
      low_confidence: result.lowConfidenceFields,
    },
  });

  onStep?.('done');
  return result;
}
