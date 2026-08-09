const WINDOW_MS = 24 * 60 * 60 * 1000;

/** FR-W-06: free-form replies only inside 24h of last inbound. */
export function isInsideSessionWindow(
  lastInboundAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (!lastInboundAt) return true; // first touch opens the window
  const last = new Date(lastInboundAt).getTime();
  if (Number.isNaN(last)) return false;
  return now.getTime() - last <= WINDOW_MS;
}

export function sessionWindowExpiresAt(lastInboundAt: string): string {
  return new Date(new Date(lastInboundAt).getTime() + WINDOW_MS).toISOString();
}
