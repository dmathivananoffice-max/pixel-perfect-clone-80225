export interface ExtractionDebugMappingRow {
  extracted: string;
  resolved: string | null;
  outcome: string;
  rawValue?: string;
  normalisedValue?: string;
}

export interface ExtractionDebugPayload {
  uploadedFile: {
    fileName: string;
    storagePath: string;
    mimeType: string | null;
    sizeBytes: number | null;
  };
  ocrOutput: {
    text: string;
    pageCount: number | null;
    provider: string | null;
    confidence: number | null;
  };
  classification: {
    type: string;
    confidence: number;
    evidence: string[];
  };
  rawModelJson: unknown;
  mapping: ExtractionDebugMappingRow[];
  normalisation: Array<{ extracted: string; before: string; after: string; flags?: string[]; note?: string }>;
  mergeDecision: Array<{
    key: string;
    winner: string;
    source: string;
    status: string;
    competing: Array<{ value: string; docType: string; confidence: number }>;
  }>;
  dbWrite: {
    ok: boolean;
    fieldsWritten: number;
    error?: string | null;
    at: string;
  };
}
