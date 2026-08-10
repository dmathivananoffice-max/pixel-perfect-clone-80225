/**
 * Meta Marketing API — READ ONLY HTTP helper.
 * Only GET is exposed. Write verbs are intentionally absent (C-05).
 */
export type MetaGetJson = (
  path: string,
  params?: Record<string, string>,
) => Promise<unknown>;

export type MetaReadCredentials = {
  accessToken: string;
  apiVersion?: string;
};

/**
 * Build a GET-only Meta Graph client.
 * Deliberately omits any mutation verb so callers cannot write spend.
 */
export function createMetaReadClient(
  creds: MetaReadCredentials,
  fetchImpl: typeof fetch = fetch,
): { getJson: MetaGetJson } {
  const version = creds.apiVersion ?? "v21.0";
  const base = `https://graph.facebook.com/${version}`;

  return {
    async getJson(path, params = {}) {
      const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
      url.searchParams.set("access_token", creds.accessToken);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      const res = await fetchImpl(url.toString(), { method: "GET" });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Meta read failed ${res.status}: ${body.slice(0, 200)}`);
      }
      return res.json();
    },
  };
}
