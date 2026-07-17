// ─────────────────────────────────────────────────────────────
// Document Intelligence Engine — public entry point.
// Callers use `getOcrProvider()` and `getAiExtractor()`; the
// concrete provider is chosen here so the rest of the app is
// decoupled from Google / AWS / Azure / stub implementations.
// ─────────────────────────────────────────────────────────────
import type { OcrProvider, AiExtractor } from './types';
import { stubOcrProvider, stubAiExtractor } from './providers/stub';
import { togetherAiProvider, togetherAiExtractor } from './providers/together';

export * from './types';
export { computeSha256, validateFile, standardizeFilename } from './fingerprint';
export { fetchCandidateDocuments, fetchDocumentForCandidate, fetchExtractionsForCandidate } from './isolation';
export { runDocumentIntelligencePipeline } from './pipeline';

type ProviderName = 'stub' | 'together-ai' | 'google-document-ai';

/**
 * Active provider selector. Swapping providers is a one-line change here —
 * every caller talks to `getOcrProvider()` / `getAiExtractor()`, never to
 * a concrete implementation. To temporarily fall back to the deterministic
 * stub (e.g. during offline development), change to 'stub'.
 */
const ACTIVE_PROVIDER: ProviderName = 'together-ai';

export function getOcrProvider(): OcrProvider {
  switch (ACTIVE_PROVIDER) {
    case 'together-ai':
      return togetherAiProvider;
    case 'stub':
      return stubOcrProvider;
    case 'google-document-ai':
    default:
      return stubOcrProvider;
  }
}

export function getAiExtractor(): AiExtractor {
  switch (ACTIVE_PROVIDER) {
    case 'together-ai':
      return togetherAiExtractor;
    case 'stub':
    default:
      return stubAiExtractor;
  }
}

