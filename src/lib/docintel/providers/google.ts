// ─────────────────────────────────────────────────────────────
// Google Cloud Document AI provider — SKELETON.
// Not active until GCP credentials (service account + processor id)
// are provided via secrets and a server function is added to call
// the Google API server-side. The interface matches OcrProvider so
// switching from `stub` is a config change, not a code redesign.
//
// To activate:
//   1. Add secrets: GOOGLE_DOC_AI_PROJECT_ID, GOOGLE_DOC_AI_LOCATION,
//      GOOGLE_DOC_AI_PROCESSOR_ID, GOOGLE_DOC_AI_CREDENTIALS_JSON.
//   2. Implement a `createServerFn` that signs a JWT with the service
//      account, calls `documents:process`, and returns the raw
//      Google response.
//   3. Map the response to our `OcrResult` shape below.
// ─────────────────────────────────────────────────────────────
import type { OcrProvider, OcrProviderContext, OcrResult } from '../types';

export const googleDocAiProvider: OcrProvider = {
  name: 'google-document-ai',
  version: 'skeleton-v0',
  async extract(_ctx: OcrProviderContext, _fileBytes: ArrayBuffer): Promise<OcrResult> {
    throw new Error(
      'google-document-ai provider not configured. Add GCP credentials as secrets and wire the server function first.',
    );
  },
};
