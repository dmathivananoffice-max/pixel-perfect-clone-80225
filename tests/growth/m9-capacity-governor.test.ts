import { describe, expect, test } from "bun:test";
import {
  computePathwayState,
  fillRatio,
  runGovernor,
} from "../../src/growth/capacity/governor";
import {
  createMemoryCapacityStore,
  demoIntake,
} from "../../src/growth/capacity/memoryStore";
import {
  assertUrgencyTemplate,
  ScarcitySchemaError,
} from "../../src/growth/capacity/scarcity";
import { CapacityService } from "../../src/growth/capacity/service";
import { buildWaitlistCopy } from "../../src/growth/capacity/waitlistCopy";

function monthOffset(n: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

describe("M9 capacity governor threshold behaviour", () => {
  test("fill ratio and waitlist copy", () => {
    expect(fillRatio({ capacity: 20, filled: 18 })).toBeCloseTo(0.9);
    const copy = buildWaitlistCopy({
      nearest_batch_date: "2026-09-01",
      next_batch_date: "2026-10-01",
    });
    expect(copy).toMatch(/September intake is full/i);
    expect(copy).toMatch(/October/i);
  });

  test("below threshold stays open; at 85%+ switches waitlist + throttle", () => {
    const near = demoIntake({
      id: "i1",
      pathway: "nursing-professional",
      batch_date: monthOffset(1),
      capacity: 20,
      filled: 16, // 80%
    });
    const next = demoIntake({
      id: "i2",
      pathway: "nursing-professional",
      batch_date: monthOffset(2),
      capacity: 20,
      filled: 1,
    });
    const open = computePathwayState("nursing-professional", [near, next]);
    expect(open.waitlist_mode).toBe(false);
    expect(open.pathway_throttled).toBe(false);
    expect(open.dashboard_flagged).toBe(false);

    const hot = computePathwayState("nursing-professional", [
      { ...near, filled: 17 }, // 85%
      next,
    ]);
    expect(hot.waitlist_mode).toBe(true);
    expect(hot.pathway_throttled).toBe(true);
    expect(hot.dashboard_flagged).toBe(true);
    expect(hot.waitlist_copy).toMatch(/intake is full/i);
  });

  test("service: 90% filled → Diagnostic CTA waitlist mode", async () => {
    const store = createMemoryCapacityStore([
      demoIntake({
        pathway: "nursing-professional",
        batch_date: monthOffset(1),
        capacity: 20,
        filled: 18,
      }),
      demoIntake({
        pathway: "nursing-professional",
        batch_date: monthOffset(2),
        capacity: 20,
        filled: 2,
      }),
    ]);
    const svc = new CapacityService(store);
    const states = await svc.runHourlyGovernor();
    const st = states.find((s) => s.pathway === "nursing-professional");
    expect(st?.fill_ratio).toBeGreaterThanOrEqual(0.85);
    expect(st?.waitlist_mode).toBe(true);
    expect(st?.pathway_throttled).toBe(true);

    const cta = await svc.resolveCta("nursing-professional");
    expect(cta.mode).toBe("waitlist");
    expect(cta.label).toMatch(/waitlist/i);
    expect(cta.copy).toMatch(/intake is full/i);
    expect(cta.intake_id).toBeTruthy();
  });

  test("runGovernor across pathways", () => {
    const states = runGovernor(
      ["nursing-professional", "nursing-ausbildung"],
      [
        demoIntake({
          pathway: "nursing-professional",
          batch_date: monthOffset(1),
          capacity: 10,
          filled: 9,
        }),
        demoIntake({
          pathway: "nursing-ausbildung",
          batch_date: monthOffset(1),
          capacity: 10,
          filled: 2,
        }),
      ],
    );
    expect(states.find((s) => s.pathway === "nursing-professional")?.waitlist_mode).toBe(
      true,
    );
    expect(states.find((s) => s.pathway === "nursing-ausbildung")?.waitlist_mode).toBe(
      false,
    );
  });

  test("FR-N-05 scarcity schema requires intake or calendar event id", () => {
    expect(() =>
      assertUrgencyTemplate({
        key: "bad",
        body: "Only 3 spots left — hurry!",
      }),
    ).toThrow(ScarcitySchemaError);

    assertUrgencyTemplate({
      key: "ok",
      body: "September intake is nearly full",
      intake_id: crypto.randomUUID(),
    });
  });
});
