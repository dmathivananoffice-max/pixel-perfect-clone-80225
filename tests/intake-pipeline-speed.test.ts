import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("intake pipeline speedups", () => {
  test("OCR concurrency is at least 3", () => {
    const src = read("src/lib/docintel/pipeline.ts");
    expect(src).toMatch(/OCR_CONCURRENCY\s*=\s*([3-9]|\d{2,})/);
  });

  test("Together page concurrency is at least 3", () => {
    const src = read("src/lib/docintel/together.functions.ts");
    expect(src).toMatch(/PAGE_CONCURRENCY\s*=\s*([3-9]|\d{2,})/);
  });

  test("vision retries are capped at 2 attempts", () => {
    const src = read("src/lib/docintel/together.functions.ts");
    expect(src).toMatch(/maxAttempts\s*=\s*2\b/);
  });

  test("PDF raster width is 1024 or lower", () => {
    const src = read("src/lib/docintel/rasterize.ts");
    const m = src.match(/PDF_RENDER_MAX_WIDTH\s*=\s*(\d+)/);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBeLessThanOrEqual(1024);
  });

  test("pipeline skips forceFinalize after terminal OCR status", () => {
    const src = read("src/lib/docintel/pipeline.ts");
    expect(src).toContain("reachedTerminalStatus");
    expect(src).toMatch(/if\s*\(\s*!reachedTerminalStatus\s*\)/);
  });

  test("extraction audits are fire-and-forget after rows are written", () => {
    const src = read("src/lib/docintel/pipeline.ts");
    expect(src).toContain("void (async () => {");
    expect(src).toContain("background extraction audit failed");
    expect(src).toContain('await quietDb("insert extractions"');
  });

  test("fresh intake skips human merge lookup", () => {
    const persist = read("src/lib/intake/persist.ts");
    const pipeline = read("src/lib/docintel/pipeline.ts");
    expect(persist).toContain("skipHumanMerge: true");
    expect(pipeline).toContain("skipHumanMerge");
  });

  test("session refresh is conditional on near-expiry", () => {
    const src = read("src/lib/intake/persist.ts");
    expect(src).toContain("SESSION_REFRESH_SKEW_MS");
    expect(src).toContain("getSession()");
    expect(src).toContain("refreshSession()");
  });

  test("uploads run with concurrency pool", () => {
    const src = read("src/lib/intake/persist.ts");
    expect(src).toMatch(/UPLOAD_CONCURRENCY\s*=\s*([3-9]|\d{2,})/);
  });
});
