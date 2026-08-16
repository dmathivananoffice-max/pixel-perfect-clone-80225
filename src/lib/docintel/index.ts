// ─────────────────────────────────────────────────────────────
// Document Intelligence Engine — public entry point.
// Callers use `getOcrProvider()` and `getAiExtractor()`; the
// concrete provider is chosen here so the rest of the app is
// decoupled from Google / AWS / Azure / stub implementations.
// ─────────────────────────────────────────────────────────────
import type { OcrProvider, AiExtractor } from "./types";
import { stubOcrProvider, stubAiExtractor } from "./providers/stub";
import { togetherAiProvider, togetherAiExtractor } from "./providers/together";
import { ocrSpaceProvider, ocrSpaceExtractor } from "./providers/ocrspace";
import { googleDocAIProvider, googleDocAIExtractor } from "./providers/googledocai";

export * from "./types";
export * from "./form-schema";
export { buildMasterOcrPrompt } from "./master-prompt";
export { computeSha256, validateFile, standardizeFilename } from "./fingerprint";
export {
  fetchCandidateDocuments,
  fetchDocumentForCandidate,
  fetchExtractionsForCandidate,
} from "./isolation";
export { runDocumentIntelligencePipeline } from "./pipeline";

type ProviderName = "stub" | "together-ai" | "google-document-ai" | "ocrspace";

/**
 * Active provider selector. Swapping providers is a one-line change here —
 * every caller talks to `getOcrProvider()` / `getAiExtractor()`, never to
 * a concrete implementation. The "together-ai" slot is the vision OCR path
 * whose default backend is Mistral AI (see resolveVisionConfig); Together /
 * Lovable remain fallbacks when MISTRAL_API_KEY is unset.
 */
const ACTIVE_PROVIDER: ProviderName = "together-ai";

export function getOcrProvider(): OcrProvider {
  switch (ACTIVE_PROVIDER) {
    case "together-ai":
      return togetherAiProvider;
    case "ocrspace":
      return ocrSpaceProvider;
    case "google-document-ai":
      return googleDocAIProvider;
    case "stub":
    default:
      return stubOcrProvider;
  }
}

export function getAiExtractor(): AiExtractor {
  switch (ACTIVE_PROVIDER) {
    case "together-ai":
      return togetherAiExtractor;
    case "ocrspace":
      return ocrSpaceExtractor;
    case "google-document-ai":
      return googleDocAIExtractor;
    case "stub":
    default:
      return stubAiExtractor;
  }
}

