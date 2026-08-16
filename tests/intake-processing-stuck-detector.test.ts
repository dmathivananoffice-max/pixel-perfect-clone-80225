import { describe, expect, test } from "bun:test";
import { DRAFT_STUCK_MS } from "../src/lib/intake/hangBudgets.ts";

/**
 * Pure simulation of ProcessingStep's drafts-stuck detector.
 * Mirrors the interval check without mounting React.
 */
function shouldForceComplete(opts: {
  done: boolean;
  realStep: number;
  draftEnteredAt: number | null;
  now: number;
}): boolean {
  const steps = 6;
  return (
    !opts.done &&
    opts.realStep >= steps - 1 &&
    opts.draftEnteredAt != null &&
    opts.now - opts.draftEnteredAt > DRAFT_STUCK_MS
  );
}

describe("ProcessingStep drafts-stuck detector", () => {
  test("does not force-complete before entering drafts", () => {
    expect(
      shouldForceComplete({
        done: false,
        realStep: 4,
        draftEnteredAt: null,
        now: Date.now(),
      }),
    ).toBe(false);
  });

  test("does not force-complete within 90s of entering drafts", () => {
    const entered = 1_000_000;
    expect(
      shouldForceComplete({
        done: false,
        realStep: 5,
        draftEnteredAt: entered,
        now: entered + 60_000,
      }),
    ).toBe(false);
  });

  test("force-completes after 90s on drafts (screenshot would have been saved)", () => {
    const entered = 1_000_000;
    expect(
      shouldForceComplete({
        done: false,
        realStep: 5,
        draftEnteredAt: entered,
        now: entered + DRAFT_STUCK_MS + 1,
      }),
    ).toBe(true);
  });

  test("297s elapsed from screenshot exceeds force-complete", () => {
    const entered = 1_000_000;
    expect(
      shouldForceComplete({
        done: false,
        realStep: 5,
        draftEnteredAt: entered,
        now: entered + 297_000,
      }),
    ).toBe(true);
  });

  test("never force-completes once already done", () => {
    const entered = 1_000_000;
    expect(
      shouldForceComplete({
        done: true,
        realStep: 5,
        draftEnteredAt: entered,
        now: entered + 297_000,
      }),
    ).toBe(false);
  });
});
