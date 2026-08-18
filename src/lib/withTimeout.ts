// ─────────────────────────────────────────────────────────────
// Bounded await. Several platform calls (supabase-js session
// refresh inside getSession, edge-function invokes) can pend
// FOREVER without resolving or rejecting — e.g. an expired token
// with a stuck background refresh leaves every later request
// parked with zero error. Racing such calls against a timeout is
// the only way to surface an honest failure instead of an
// infinite spinner.
// ─────────────────────────────────────────────────────────────

export class BoundedTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not respond within ${Math.round(ms / 1000)}s`);
    this.name = "BoundedTimeoutError";
  }
}

/** Race `p` against a timeout. The underlying promise is left pending (it cannot be cancelled) but never blocks the caller again. */
export function withTimeout<T>(p: PromiseLike<T>, ms: number, label = "Operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new BoundedTimeoutError(label, ms)), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
