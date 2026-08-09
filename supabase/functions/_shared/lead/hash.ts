/** Stable SHA-256 hex for suppression keys (FR-L-04). Works in Deno and Node/Bun. */

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
