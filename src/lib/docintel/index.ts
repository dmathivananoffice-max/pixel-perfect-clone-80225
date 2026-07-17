// ─────────────────────────────────────────────────────────────
// Document Intelligence Engine — public entry point.
// Callers use `getOcrProvider()` and `getAiExtractor()`; the
// concrete provider is chosen here so the rest of the app is
// decoupled from Google / AWS / Azure / stub implementations.
// ─────────────────────────────────────────────────────────────
import type { OcrProvider, AiExtractor } from './types';
import { stubOcrProvider, stubAiExtractor } from './providers/stub';
// import { googleDocAiProvider } from './providers/google';

export * from './types';
export { computeSha256, validateFile, standardizeFilename } from './fingerprint';
export { fetchCandidateDocuments, fetchDocumentForCandidate, fetchExtractionsForCandidate } from './isolation';
export { runDocumentIntelligencePipeline } from './pipeline';

type ProviderName = 'stub' | 'google-document-ai';

const ACTIVE_OCR: ProviderName = 'stub';

export function getOcrProvider(): OcrProvider {
  switch (ACTIVE_OCR) {
    // case 'google-document-ai': return googleDocAiProvider;
    case 'stub':
    default:
      return stubOcrProvider;
  }
}

export function getAiExtractor(): AiExtractor {
  return stubAiExtractor;
}
