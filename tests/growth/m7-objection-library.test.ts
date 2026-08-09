import { describe, expect, test } from "bun:test";
import { answerExitSurvey, dispatchExitSurveys } from "../../src/growth/objections/exitSurvey";
import { createMemoryObjectionStore } from "../../src/growth/objections/memoryStore";
import { ObjectionService } from "../../src/growth/objections/service";
import { parseExitSurveyReply } from "../../src/growth/objections/taxonomy";

describe("M7 objection library (FR-O-01…03)", () => {
  test("counsellor one-tap log writes taxonomy + source", async () => {
    const store = createMemoryObjectionStore();
    const svc = new ObjectionService(store);
    const t0 = performance.now();
    const row = await svc.log({
      source: "counsellor",
      taxonomy_code: "VISA-RISK",
      logged_by: "counsellor-1",
      pathway: "nursing-professional",
      verbatim: "worried about refusal",
    });
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(10_000);
    expect(row.source).toBe("counsellor");
    expect(row.taxonomy_code).toBe("VISA-RISK");
    expect(row.pathway).toBe("nursing-professional");
  });

  test("exit survey reply maps number → taxonomy and logs", async () => {
    expect(parseExitSurveyReply("3")).toBe("VISA-RISK");
    expect(parseExitSurveyReply("1")).toBe("COST");
    const store = createMemoryObjectionStore();
    const svc = new ObjectionService(store);
    const row = await answerExitSurvey(svc, {
      reply: "1",
      lead_id: crypto.randomUUID(),
      pathway: "nursing-ausbildung",
      session_id: crypto.randomUUID(),
    });
    expect(row?.source).toBe("diag_exit_survey");
    expect(row?.taxonomy_code).toBe("COST");
  });

  test("dispatch exit surveys marks candidates sent", async () => {
    const sent: string[] = [];
    const marked: string[] = [];
    const n = await dispatchExitSurveys(
      [
        {
          session_id: "s1",
          lead_id: "l1",
          pathway: "nursing-professional",
          phone_e164: "+919999000001",
        },
      ],
      {
        async sendTemplate(phone, name) {
          sent.push(`${phone}:${name}`);
        },
        async markSent(c) {
          marked.push(c.session_id);
        },
      },
    );
    expect(n).toBe(1);
    expect(sent[0]).toContain("diag_exit_survey");
    expect(marked).toEqual(["s1"]);
  });

  test("trends aggregate by week, code, pathway", async () => {
    const store = createMemoryObjectionStore();
    const svc = new ObjectionService(store);
    await svc.log({
      source: "counsellor",
      taxonomy_code: "COST",
      logged_by: "c1",
      pathway: "nursing-professional",
    });
    await svc.log({
      source: "whatsapp",
      taxonomy_code: "COST",
      logged_by: "wa",
      pathway: "nursing-professional",
    });
    await svc.log({
      source: "counsellor",
      taxonomy_code: "TIMELINE",
      logged_by: "c1",
      pathway: "nursing-ausbildung",
    });
    const trends = await svc.trends(8);
    const cost = trends.find(
      (t) =>
        t.taxonomy_code === "COST" && t.pathway === "nursing-professional",
    );
    expect(cost?.objection_count).toBeGreaterThanOrEqual(2);
    const filtered = await svc.trends(8, "nursing-ausbildung");
    expect(filtered.every((t) => t.pathway === "nursing-ausbildung")).toBe(true);
  });

  test("taxonomy mapping upsert updates talk track", async () => {
    const store = createMemoryObjectionStore();
    const svc = new ObjectionService(store);
    const saved = await svc.upsertMapping({
      code: "COST",
      talk_track: "Share APPROVED fee breakdown only.",
      underlying_fear: "Hidden costs",
      evidence_type: "fee_breakdown",
      updated_by: "marketing_operator",
    });
    expect(saved.talk_track).toContain("APPROVED");
    const list = await svc.listMappings();
    expect(list.find((m) => m.code === "COST")?.underlying_fear).toBe("Hidden costs");
  });
});
