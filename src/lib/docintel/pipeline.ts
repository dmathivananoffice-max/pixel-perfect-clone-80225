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
//
// Batch reliability guarantees:
//   • One failed document never stops the batch — each document is
//     isolated in its own try/catch and processed sequentially.
//   • No document is ever left in ocr_status='processing': a per-document
//     finally guard plus a post-loop sweep force-stuck rows to 'failed'.
//   • `batch_complete` is always emitted (even if every document fails)
//     so the UI spinner always stops.
//   • Every OCR failure raises an `ocr_failed_manual_review` audit event
//     and moves the candidate's verification_state to manual_review.
// ─────────────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import { fetchCandidateDocuments } from "./isolation";
import { getOcrProvider, getAiExtractor } from ".";
import { LOW_CONFIDENCE_THRESHOLD, type OcrResult } from "./types";
import type { OcrDocumentLog } from "./providers/ocrspace";
import { mapDocument, type MappedValue } from "@/intake/mapper";
import { mergeCandidateFields, validateMerged } from "@/intake/merge";
import { canonicalDocType, classifyDocument } from "@/intake/documentTypes";

/** Mean block confidence for an OCR result (0..1), used for the document badge. */
function ocrMeanConfidence(ocr: OcrResult): number {
  const blocks = (ocr.blocks ?? []).filter((b) => typeof b.confidence === "number");
  if (blocks.length === 0) return (ocr.text ?? "").trim().length > 0 ? 0.8 : 0;
  const sum = blocks.reduce((a, b) => a + (b.confidence ?? 0), 0);
  return Math.max(0, Math.min(1, sum / blocks.length));
}

export interface PipelineOptions {
  candidateId: string;
  onStep?: (step: string, detail?: string) => void;
}

/** Aggregate OCR statistics for one pipeline run. */
export interface OcrBatchSummary {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  averageOcrTimeMs: number;
  documents: OcrDocumentLog[];
}

export interface PipelineResult {
  candidateId: string;
  ocrRun: number;
  ocrCached: number;
  ocrFailed: number;
  ocrSkipped: number;
  fieldsExtracted: number;
  lowConfidenceFields: number;
  warnings: number;
  /** Canonical winners kept in memory for the intake draft builder. */
  draftFields: Array<{
    section: string;
    fieldName: string;
    value: string;
    confidence: number;
  }>;
  /** Summary of OCR processing for this batch. */
  ocrSummary?: OcrBatchSummary;
}

async function downloadDocumentBytes(storagePath: string): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from("candidate-documents").download(storagePath);
  if (error || !data) return null;
  return await data.arrayBuffer();
}

/** Force a document out of the 'processing' state — never leave it hanging. */
async function forceFinalizeDocument(
  docId: string,
  candidateId: string,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from("candidate_documents")
    .update({ ocr_status: "failed", ocr_error: errorMessage })
    .eq("id", docId)
    .eq("candidate_id", candidateId)
    .eq("ocr_status", "processing");
}

/** Route a failed-OCR candidate to manual review + audit trail. */
async function flagCandidateForManualReview(
  candidateId: string,
  docId: string,
  fileName: string,
  errorMessage: string,
): Promise<void> {
  try {
    await supabase.from("audit_events").insert({
      entity_type: "candidate",
      entity_id: candidateId,
      event_type: "ocr_failed_manual_review",
      actor_name: "Document Intelligence Engine",
      new_value: { document_id: docId, file_name: fileName, error: errorMessage },
    });

    const { data: cand } = await supabase
      .from("candidates")
      .select("verification_state")
      .eq("candidate_id", candidateId)
      .maybeSingle();

    const existing =
      cand && typeof cand.verification_state === "object" && cand.verification_state !== null
        ? (cand.verification_state as Record<string, unknown>)
        : {};

    await supabase
      .from("candidates")
      .update({
        verification_state: { ...existing, status: "manual_review", ocr_state: "failed" },
      } as never)
      .eq("candidate_id", candidateId);
  } catch (err) {
    // Manual-review flagging must never break the batch.
    console.error("[docintel] manual_review flagging failed", err);
  }
}

export async function runDocumentIntelligencePipeline(
  opts: PipelineOptions,
): Promise<PipelineResult> {
  const { candidateId, onStep } = opts;
  onStep?.("start", candidateId);

  const documents = await fetchCandidateDocuments(candidateId);
  const ocrProvider = getOcrProvider();
  const aiExtractor = getAiExtractor();

  const result: PipelineResult = {
    candidateId,
    ocrRun: 0,
    ocrCached: 0,
    ocrFailed: 0,
    ocrSkipped: 0,
    fieldsExtracted: 0,
    lowConfidenceFields: 0,
    warnings: 0,
    draftFields: [],
  };

  const ocrByDoc = new Map<string, { ocr: OcrResult; docType: string }>();
  const documentLogs: OcrDocumentLog[] = [];

  const emitBatchComplete = () => {
    const timed = documentLogs.filter((d) => d.elapsedMs > 0);
    const summary: OcrBatchSummary = {
      processed: result.ocrRun + result.ocrCached + result.ocrFailed + result.ocrSkipped,
      succeeded: result.ocrRun + result.ocrCached,
      failed: result.ocrFailed,
      skipped: result.ocrSkipped,
      averageOcrTimeMs: timed.length
        ? Math.round(timed.reduce((a, d) => a + d.elapsedMs, 0) / timed.length)
        : 0,
      documents: documentLogs,
    };
    result.ocrSummary = summary;
    console.info("[docintel] batch_summary", {
      candidateId,
      processed: summary.processed,
      succeeded: summary.succeeded,
      failed: summary.failed,
      skipped: summary.skipped,
      averageOcrTimeMs: summary.averageOcrTimeMs,
    });
    onStep?.(
      "batch_complete",
      `processed=${summary.processed} succeeded=${summary.succeeded} failed=${summary.failed} skipped=${summary.skipped} avgOcrMs=${summary.averageOcrTimeMs}`,
    );
  };

  // Documents are processed with a small concurrency pool: OCR is network
  // bound and one document per round-trip made large batches crawl. Every
  // promise is awaited before the pool resolves, so no unresolved promises
  // leak and one failed document can never stop the batch.
  // Rasterising several multi-page PDFs at once can exhaust the browser tab.
  // Two workers still overlap network time without retaining four sets of
  // full-resolution canvases/base64 pages simultaneously.
  const OCR_CONCURRENCY = 2;
  const processDocument = async (doc: (typeof documents)[number]) => {
    // Cross-candidate guard (defense in depth — isolation layer already filtered).
    if (doc.candidate_id !== candidateId) return;

    if (doc.ocr_status === "complete" && doc.ocr_raw && doc.ocr_provider) {
      onStep?.("ocr_cached", doc.file_name);
      const cached = doc.ocr_raw as unknown as OcrResult;
      ocrByDoc.set(doc.id, { ocr: cached, docType: doc.document_type });
      result.ocrCached += 1;
      return;
    }

    const docStarted = performance.now();
    try {
      await supabase
        .from("candidate_documents")
        .update({ ocr_status: "processing" })
        .eq("id", doc.id)
        .eq("candidate_id", candidateId);

      const bytes = await downloadDocumentBytes(doc.storage_path);
      if (!bytes) throw new Error("Storage download failed");

      onStep?.("ocr_start", doc.file_name);
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

      if (!(ocr.text ?? "").trim()) {
        throw new Error("OCR returned no readable text");
      }

      const confidence = ocrMeanConfidence(ocr);
      // Re-classify with the OCR text now available — filenames alone
      // leave most documents as "other", which starves the mapper.
      const reclass = classifyDocument({ fileName: doc.file_name, ocrText: ocr.text });
      const docType =
        doc.document_type && doc.document_type !== "other"
          ? canonicalDocType(doc.document_type)
          : canonicalDocType(reclass.type);

      await supabase
        .from("candidate_documents")
        .update({
          ocr_status: "complete",
          ocr_complete: true,
          ocr_provider: ocr.provider,
          ocr_version: ocr.version,
          ocr_confidence: confidence,
          document_type: docType,
          ocr_raw: JSON.parse(JSON.stringify(ocr)),
          page_count: ocr.pageCount,
          processed_at: ocr.processedAt,
          document_state: "ai_processed",
        })
        .eq("id", doc.id)
        .eq("candidate_id", candidateId);

      console.info("[docintel] ocr_done", {
        candidateId,
        documentId: doc.id,
        file: doc.file_name,
        docType,
        chars: ocr.text.length,
        confidence,
      });

      ocrByDoc.set(doc.id, { ocr, docType });
      result.ocrRun += 1;

      // Consume the provider's per-document log if it exposed one.
      const providerLog = (ocrProvider as { __lastLog?: OcrDocumentLog }).__lastLog;
      documentLogs.push(
        providerLog && providerLog.fileName === doc.file_name
          ? providerLog
          : {
              fileName: doc.file_name,
              mimeType: doc.mime_type ?? "application/octet-stream",
              originalBytes: bytes.byteLength,
              compressionAttempted: false,
              compressedBytes: null,
              ocrRequestStarted: new Date(Date.now() - (performance.now() - docStarted)).toISOString(),
              ocrResponseReceived: new Date().toISOString(),
              httpStatus: null,
              elapsedMs: Math.round(performance.now() - docStarted),
              finalStatus: "success",
              errorMessage: null,
            },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const skipped = /^OCR skipped/i.test(message);
      await supabase
        .from("candidate_documents")
        .update({ ocr_status: "failed", ocr_error: message })
        .eq("id", doc.id)
        .eq("candidate_id", candidateId);
      onStep?.(skipped ? "ocr_skipped" : "ocr_failed", `${doc.file_name}: ${message}`);

      const providerLog = (ocrProvider as { __lastLog?: OcrDocumentLog }).__lastLog;
      documentLogs.push(
        providerLog && providerLog.fileName === doc.file_name
          ? providerLog
          : {
              fileName: doc.file_name,
              mimeType: doc.mime_type ?? "application/octet-stream",
              originalBytes: 0,
              compressionAttempted: false,
              compressedBytes: null,
              ocrRequestStarted: new Date(Date.now() - (performance.now() - docStarted)).toISOString(),
              ocrResponseReceived: null,
              httpStatus: null,
              elapsedMs: Math.round(performance.now() - docStarted),
              finalStatus: skipped ? "skipped" : "failed",
              errorMessage: message,
            },
      );

      if (skipped) {
        result.ocrSkipped += 1;
      } else {
        result.ocrFailed += 1;
        // Real OCR failures route the candidate to manual review.
        await flagCandidateForManualReview(candidateId, doc.id, doc.file_name, message);
      }
    } finally {
      // Belt-and-suspenders: if anything above crashed between setting
      // 'processing' and the terminal update, force the row to 'failed'.
      await forceFinalizeDocument(doc.id, candidateId, "Pipeline terminated unexpectedly");
    }
  };

  {
    const queue = [...documents];
    let completed = 0;
    const workers = Array.from(
      { length: Math.min(OCR_CONCURRENCY, queue.length) },
      async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (!next) break;
          await processDocument(next);
          completed += 1;
          onStep?.("ocr_progress", `${completed}/${documents.length}`);
        }
      },
    );
    await Promise.all(workers);
  }

  // Post-loop sweep: nothing from this candidate may remain 'processing'.
  await supabase
    .from("candidate_documents")
    .update({ ocr_status: "failed", ocr_error: "Pipeline terminated unexpectedly" })
    .eq("candidate_id", candidateId)
    .eq("ocr_status", "processing");

  if (ocrByDoc.size === 0) {
    emitBatchComplete();
    onStep?.("done");
    return result;
  }

  onStep?.("ai_extract");
  const aiInput = Array.from(ocrByDoc.entries()).map(([documentId, v]) => ({
    documentId,
    docType: v.docType,
    ocr: v.ocr,
  }));
  const aiResult = await aiExtractor.extract(candidateId, aiInput);

  // ── MAPPING LAYER ────────────────────────────────────────────
  // Model output never touches the form directly. Every field goes
  // through the canonical mapper (alias → namespaced key → normalise)
  // and then the deterministic multi-document merge.
  onStep?.("mapping");
  const allMapped: MappedValue[] = [];
  const allUnmapped: Array<Record<string, unknown>> = [];
  for (const [documentId, v] of ocrByDoc.entries()) {
    const docFields = aiResult.fields.filter((f) => f.documentId === documentId);
    const res = mapDocument({
      documentId,
      docType: canonicalDocType(v.docType),
      ocrText: v.ocr.text,
      fields: docFields.map((f) => ({
        name: f.fieldName,
        section: f.section,
        value: f.value,
        confidence: f.confidence,
        page: f.page,
        bbox: f.bbox ?? null,
      })),
    });
    allMapped.push(...res.mapped);
    for (const u of res.unmapped) {
      allUnmapped.push({ ...u });
    }
  }

  // Human-verified values already on record outrank any re-extraction (R4).
  const { data: humanRows } = await supabase
    .from("document_extractions")
    .select("section, field_name, human_value, status")
    .eq("candidate_id", candidateId)
    .not("human_value", "is", null);
  const humanValues = (humanRows ?? [])
    .filter((r) => r.human_value)
    .map((r) => ({
      key: `${r.section}.${r.field_name}`,
      value: String(r.human_value),
      status: (r.status === "verified" ? "verified" : "human_edited") as "verified" | "human_edited",
    }));

  const merged = mergeCandidateFields(allMapped, humanValues);
  result.draftFields = merged
    .filter((field) => Boolean(field.value))
    .map((field) => ({
      section: field.section,
      fieldName: field.fieldKey,
      value: field.value,
      confidence: field.confidence,
    }));
  const reviewItems = validateMerged(merged);

  // Winners are written per canonical key; every losing value is kept as a
  // 'superseded' row so nothing is ever silently discarded.
  const winnerRows = merged
    .filter((f) => f.source !== "human")
    .map((f) => ({
      candidate_id: candidateId,
      document_id: f.documentId || null,
      section: f.section,
      field_name: f.fieldKey,
      ai_value: f.value || null,
      confidence: f.confidence,
      page_number: f.page ?? null,
      bbox: (f.bbox ?? null) as unknown as Record<string, unknown> | null,
      ocr_provider: getOcrProvider().name,
      ocr_version: getOcrProvider().version,
      ai_model_version: aiResult.modelVersion,
      status:
        f.status === "conflict" || f.status === "needs_review"
          ? "flagged"
          : f.confidence < LOW_CONFIDENCE_THRESHOLD
            ? "flagged"
            : "pending",
    }));

  const supersededRows = allMapped
    .filter(
      (v) =>
        !merged.some(
          (m) => m.key === v.key && m.documentId === v.documentId && m.value === v.value,
        ),
    )
    .map((v) => ({
      candidate_id: candidateId,
      document_id: v.documentId,
      section: v.section,
      field_name: v.fieldKey,
      ai_value: v.value || null,
      confidence: v.confidence,
      page_number: v.page ?? null,
      bbox: (v.bbox ?? null) as unknown as Record<string, unknown> | null,
      ocr_provider: getOcrProvider().name,
      ocr_version: getOcrProvider().version,
      ai_model_version: aiResult.modelVersion,
      status: "superseded",
    }));

  const rows = [...winnerRows, ...supersededRows];

  // Values the model returned but the dictionary could not place — surfaced
  // for the debug panel, never dropped.
  if (allUnmapped.length > 0) {
    console.warn("[docintel] unmapped_fields", { candidateId, count: allUnmapped.length, allUnmapped });
    await supabase.from("audit_events").insert({
      entity_type: "candidate",
      entity_id: candidateId,
      event_type: "unmapped_fields",
      actor_name: "Document Intelligence Engine",
      new_value: JSON.parse(JSON.stringify({ fields: allUnmapped })),
    });
  }
  if (reviewItems.length > 0) {
    await supabase.from("audit_events").insert({
      entity_type: "candidate",
      entity_id: candidateId,
      event_type: "mapping_review_items",
      actor_name: "Document Intelligence Engine",
      new_value: JSON.parse(JSON.stringify({ items: reviewItems })),
    });
  }

  if (rows.length > 0) {
    // Re-running extraction replaces prior AI rows; human values are held in
    // separate rows (human_value) and are never deleted here.
    await supabase
      .from("document_extractions")
      .delete()
      .eq("candidate_id", candidateId)
      .is("human_value", null);
    const { error } = await supabase.from("document_extractions").insert(rows as never);
    if (error) {
      onStep?.("extraction_persist_failed", error.message);
      console.error("[docintel] extraction persist failed", error);
    } else {
      result.fieldsExtracted = winnerRows.length;
      result.lowConfidenceFields = winnerRows.filter((r) => r.status === "flagged").length;
    }
  }

  // Audit warnings but never auto-resolve.
  if (aiResult.warnings.length > 0) {
    result.warnings = aiResult.warnings.length;
    await supabase.from("audit_events").insert(
      aiResult.warnings.map((w) => ({
        entity_type: "candidate",
        entity_id: candidateId,
        event_type: "ai_warning",
        actor_name: "Document Intelligence Engine",
        new_value: w,
      })),
    );
  }

  await supabase.from("audit_events").insert({
    entity_type: "candidate",
    entity_id: candidateId,
    event_type: "ai_extraction_completed",
    actor_name: "Document Intelligence Engine",
    new_value: {
      model: aiResult.model,
      model_version: aiResult.modelVersion,
      fields: rows.length,
      low_confidence: result.lowConfidenceFields,
    },
  });

  console.info("[docintel] summary", {
    candidateId,
    processed: result.ocrRun + result.ocrCached + result.ocrFailed + result.ocrSkipped,
    succeeded: result.ocrRun + result.ocrCached,
    failed: result.ocrFailed,
    skipped: result.ocrSkipped,
    fields: result.fieldsExtracted,
    lowConfidence: result.lowConfidenceFields,
  });
  emitBatchComplete();
  onStep?.("done");
  return result;
}
