/** Lightweight local embedding for FAQ pattern matching (no external API). */

const DIM = 256;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s%€]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function embedText(text: string): Float32Array {
  const vec = new Float32Array(DIM);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;
  for (const t of tokens) {
    const h = hashToken(t);
    vec[h % DIM] += 1;
    vec[(h >>> 8) % DIM] += 0.5;
  }
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i++) vec[i] /= norm;
  return vec;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}
