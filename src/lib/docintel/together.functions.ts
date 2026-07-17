// ─────────────────────────────────────────────────────────────
// Together AI server function — the ONLY place TOGETHER_API_KEY
// is touched. Every call goes through here so we can swap the
// provider (Anthropic, OpenAI, Vertex, etc.) without changing
// any calling code.
//
// Isolation invariants enforced server-side:
//   • The caller must be authenticated (requireSupabaseAuth).
//   • The (candidateId, documentId) pair must resolve to a row
//     the caller can see under RLS. If it doesn't, we refuse to
//     call the model at all — no cross-candidate leakage possible.
//
// Input protocol:
//   The client rasterizes the file to per-page PNG data URLs and
//   posts them here. We never accept a storage_path from the client
//   and re-download it under service role, because that would
//   bypass RLS.
// ─────────────────────────────────────────────────────────────
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const PageInput = z.object({
  pageNumber: z.number().int().positive(),
  dataUrl: z.string().min(32),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
});

const ExtractInput = z.object({
  candidateId: z.string().min(8),
  documentId: z.string().min(8),
  docType: z.string().min(1),
  fileName: z.string().min(1),
  pages: z.array(PageInput).min(1).max(20),
});

export interface TogetherFieldRaw {
  section: string;
  field_name: string;
  value: string;
  confidence: number; // 0..1
  page_number: number;
  bounding_box?: [number, number, number, number] | null; // [x1,y1,x2,y2] pixel coords
}

export interface TogetherPageRaw {
  pageNumber: number;
  widthPx: number;
  heightPx: number;
  text: string;
  fields: TogetherFieldRaw[];
  warnings?: string[];
  /** Full model response for this page, JSON-stringified so it round-trips through the RPC boundary. */
  rawJson: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;


}

export interface TogetherExtractResult {
  model: string;
  processedAt: string;
  documentId: string;
  candidateId: string;
  docType: string;
  fileName: string;
  pages: TogetherPageRaw[];
  totalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  errors: string[];
}

function buildPrompt(docType: string, fileName: string): string {
  return [
    `You are a document intelligence engine.`,
    `Document type hint: "${docType}". Original filename: "${fileName}".`,
    ``,
    `Extract every relevant field visible on THIS page image. Return ONLY a single valid JSON object (no prose, no markdown fences) matching this schema:`,
    `{`,
    `  "text": "<full transcribed text on this page>",`,
    `  "fields": [`,
    `    {`,
    `      "section": "identity | education | employment | language | medical | driving | address | contact | general",`,
    `      "field_name": "<snake_case canonical key, e.g. passport_number, date_of_birth, degree_title>",`,
    `      "value": "<exact value as written on the document>",`,
    `      "confidence": <number 0..1>,`,
    `      "page_number": <this page's number>,`,
    `      "bounding_box": [x1, y1, x2, y2]`,
    `    }`,
    `  ],`,
    `  "warnings": ["<non-fatal notes, e.g. text partially obscured>"]`,
    `}`,
    ``,
    `Rules:`,
    `- bounding_box is REQUIRED for every field and must be in image pixel coordinates: [x1, y1, x2, y2] where (x1,y1) is the top-left corner and (x2,y2) is the bottom-right corner of the rendered text on this page image.`,
    `- If you cannot read a field, do NOT include it. Never invent data.`,
    `- Do not merge information from other documents; extract only what is visible on THIS image.`,
    `- Never include personal opinions or summaries. Field values must be verbatim.`,
    `- For German language certificates (Goethe, TELC, ÖSD, TestDaF) include: certificate_level, certificate_number, examination_date, issuing_institute, module_reading, module_listening, module_writing, module_speaking when visible.`,
    `- Output must be a single JSON object. Do not wrap it in prose or code fences.`,
  ].join('\n');
}

function stripFences(s: string): string {
  const t = s.trim();
  if (t.startsWith('```')) {
    return t.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  }
  return t;
}

function safeParse(content: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(stripFences(content)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function callTogether(
  apiKey: string,
  baseUrl: string,
  model: string,
  prompt: string,
  imageDataUrl: string,
): Promise<{ content: string; usage?: TogetherPageRaw['usage'] }> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 4096,
    response_format: { type: 'json_object' as const },
  };

  // Exponential backoff on 429 / 5xx.
  const maxAttempts = 4;
  let lastErr = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: TogetherPageRaw['usage'];
      };
      const content = json.choices?.[0]?.message?.content ?? '';
      return { content, usage: json.usage };
    }
    const text = await res.text().catch(() => '');
    lastErr = `Together AI ${res.status}: ${text.slice(0, 500)}`;
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
  }
  throw new Error(lastErr || 'Together AI call failed');
}

export const extractDocumentWithTogether = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }): Promise<TogetherExtractResult> => {
    const apiKey = process.env.TOGETHER_API_KEY;
    const baseUrl = process.env.TOGETHER_API_BASE_URL ?? 'https://api.together.ai/v1';
    const model = process.env.TOGETHER_VISION_MODEL ?? 'Qwen/Qwen2.5-VL-72B-Instruct';
    if (!apiKey) throw new Error('TOGETHER_API_KEY is not configured on the server.');

    // ISOLATION GATE: verify the doc belongs to the caller-visible candidate BEFORE any model call.
    const { data: doc, error } = await context.supabase
      .from('candidate_documents')
      .select('id, candidate_id')
      .eq('id', data.documentId)
      .eq('candidate_id', data.candidateId)
      .maybeSingle();
    if (error) throw new Error(`Isolation check failed: ${error.message}`);
    if (!doc) {
      throw new Error(
        `Refused: document ${data.documentId} does not belong to candidate ${data.candidateId} for this user.`,
      );
    }

    const prompt = buildPrompt(data.docType, data.fileName);
    const pagesOut: TogetherPageRaw[] = [];
    const errors: string[] = [];
    const totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    for (const page of data.pages) {
      try {
        const { content, usage } = await callTogether(apiKey, baseUrl, model, prompt, page.dataUrl);
        if (usage) {
          totalUsage.prompt_tokens += usage.prompt_tokens ?? 0;
          totalUsage.completion_tokens += usage.completion_tokens ?? 0;
          totalUsage.total_tokens += usage.total_tokens ?? 0;
        }
        const parsed = safeParse(content);
        if (!parsed.ok) {
          errors.push(`Page ${page.pageNumber}: invalid JSON — ${parsed.error}`);
          pagesOut.push({
            pageNumber: page.pageNumber,
            widthPx: page.widthPx,
            heightPx: page.heightPx,
            text: '',
            fields: [],
            warnings: [`invalid_json:${parsed.error}`],
            rawJson: JSON.stringify({ rawContent: content }),
            usage: usage ? { prompt_tokens: usage.prompt_tokens ?? 0, completion_tokens: usage.completion_tokens ?? 0, total_tokens: usage.total_tokens ?? 0 } : null,

          });
          continue;
        }
        const v = parsed.value as {
          text?: string;
          fields?: TogetherFieldRaw[];
          warnings?: string[];
        };
        const fields = Array.isArray(v.fields)
          ? v.fields
              .filter((f) => f && typeof f.field_name === 'string' && typeof f.value === 'string')
              .map<TogetherFieldRaw>((f) => ({
                section: String(f.section ?? 'general'),
                field_name: String(f.field_name),
                value: String(f.value),
                confidence: Math.max(0, Math.min(1, Number(f.confidence ?? 0))),
                page_number: page.pageNumber,
                bounding_box: Array.isArray(f.bounding_box) && f.bounding_box.length === 4
                  ? [
                      Number(f.bounding_box[0]),
                      Number(f.bounding_box[1]),
                      Number(f.bounding_box[2]),
                      Number(f.bounding_box[3]),
                    ]
                  : null,
              }))
          : [];
        pagesOut.push({
          pageNumber: page.pageNumber,
          widthPx: page.widthPx,
          heightPx: page.heightPx,
          text: typeof v.text === 'string' ? v.text : '',
          fields,
          warnings: Array.isArray(v.warnings) ? v.warnings.map(String) : [],
          rawJson: JSON.stringify(v),
          usage: usage ? { prompt_tokens: usage.prompt_tokens ?? 0, completion_tokens: usage.completion_tokens ?? 0, total_tokens: usage.total_tokens ?? 0 } : null,

        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Page ${page.pageNumber}: ${msg}`);
        pagesOut.push({
          pageNumber: page.pageNumber,
          widthPx: page.widthPx,
          heightPx: page.heightPx,
          text: '',
          fields: [],
          warnings: [`page_failed:${msg}`],
          rawJson: 'null',
        });
      }
    }

    return {
      model,
      processedAt: new Date().toISOString(),
      documentId: data.documentId,
      candidateId: data.candidateId,
      docType: data.docType,
      fileName: data.fileName,
      pages: pagesOut,
      totalUsage,
      errors,
    };
  });
