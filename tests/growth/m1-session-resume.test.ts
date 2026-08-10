import { describe, expect, test } from "bun:test";
import {
  clearLocalSession,
  loadLocalSession,
  saveLocalSession,
} from "../../src/growth/diagnostic/sessionLocal";

describe("diagnostic session resume (FR-D-08)", () => {
  test("localStorage round-trip resumes same question index", () => {
    // jsdom-less: stub localStorage
    const store = new Map<string, string>();
    // @ts-expect-error test stub
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };

    clearLocalSession();
    saveLocalSession({
      session_id: "11111111-1111-1111-1111-111111111111",
      branch: "nursing-ausbildung",
      answers: { qualification: "class_10", age_band: "30_plus" },
      question_index: 2,
      result: null,
      contact_skipped: false,
      updated_at: new Date().toISOString(),
    });

    const loaded = loadLocalSession();
    expect(loaded?.branch).toBe("nursing-ausbildung");
    expect(loaded?.question_index).toBe(2);
    expect(loaded?.answers.german_level).toBeUndefined();
    expect(Object.keys(loaded?.answers ?? {}).length).toBe(2);
  });
});
