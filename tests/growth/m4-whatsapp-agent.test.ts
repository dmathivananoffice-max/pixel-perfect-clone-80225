import { describe, expect, test } from "bun:test";
import { emptyClaimChecklist } from "../../src/growth/assets/claims";
import type { AssetRecord } from "../../src/growth/assets/types";
import { ConversationService } from "../../src/growth/whatsapp/conversationService";
import { detectEscalation } from "../../src/growth/whatsapp/escalation";
import { isBudgetBreached } from "../../src/growth/whatsapp/budget";
import { createStubLlm } from "../../src/growth/whatsapp/llm";
import { createMemoryWhatsAppStore } from "../../src/growth/whatsapp/memoryStore";
import { resolveApprovedForSend } from "../../src/growth/whatsapp/retrieval";
import { AssetNotApprovedError } from "../../src/growth/assets/types";
import { AUTOMATION_DISCLOSURE } from "../../src/growth/whatsapp/constants";

function approvedFaq(partial: Partial<AssetRecord> & Pick<AssetRecord, "id" | "title" | "answer_text" | "question_patterns">): AssetRecord {
  const now = new Date().toISOString();
  return {
    type: "FAQ_ANSWER",
    version: 1,
    status: "APPROVED",
    claim_bearing: true,
    body_ref: "asset:faq",
    body: {},
    claim_checklist: emptyClaimChecklist(),
    approved_by: "reviewer",
    approved_at: now,
    reviewed_by: "reviewer",
    reviewed_at: now,
    review_comment: null,
    submitted_by: "author",
    submitted_at: now,
    created_by: "author",
    parent_asset_id: null,
    version_hash: "vh_test",
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

describe("M4 escalation triggers (FR-W-05)", () => {
  test("detects ADVISOR, payment, complaint, personal visa, streak", () => {
    expect(detectEscalation({ text: "Please connect me to ADVISOR", low_confidence_streak: 0 }).trigger).toBe("ADVISOR");
    expect(detectEscalation({ text: "I want a refund now", low_confidence_streak: 0 }).trigger).toBe("PAYMENT_REFUND");
    expect(detectEscalation({ text: "This is a scam complaint", low_confidence_streak: 0 }).trigger).toBe("COMPLAINT");
    expect(detectEscalation({ text: "Can you advise on my visa case refusal?", low_confidence_streak: 0 }).trigger).toBe("PERSONAL_LEGAL_VISA");
    expect(detectEscalation({ text: "hmm", low_confidence_streak: 3 }).trigger).toBe("LOW_CONFIDENCE_STREAK");
    expect(detectEscalation({ text: "?", low_confidence_streak: 0, out_of_corpus: true }).trigger).toBe("OUT_OF_CORPUS");
  });

  test("conversation escalates on ADVISOR reply", async () => {
    const store = createMemoryWhatsAppStore([
      approvedFaq({
        id: "faq-1",
        title: "Visa FAQ",
        question_patterns: ["visa process"],
        answer_text: "Visa decisions are made by authorities; outcomes are not guaranteed.",
      }),
    ]);
    const svc = new ConversationService(store, createStubLlm(), async () => {});
    const lead = crypto.randomUUID();
    await svc.handleInbound({
      lead_id: lead,
      wa_phone: "+919999000001",
      text: "Hi",
      diagnostic_summary: "Pathway: nursing-professional. Band: WARM.",
      dry_run: true,
    });
    const turn = await svc.handleInbound({
      lead_id: lead,
      wa_phone: "+919999000001",
      text: "I want ADVISOR now",
      dry_run: true,
    });
    expect(turn.escalated).toBe(true);
    expect(turn.escalation_trigger).toBe("ADVISOR");
    expect(store.queue.length).toBe(1);
  });
});

describe("M4 token budget handoff (FR-W-09)", () => {
  test("breach detection and conversation handoff message", async () => {
    expect(
      isBudgetBreached(
        { tokens_in_total: 9000, tokens_out_total: 100 },
        { max_tokens_in: 8000, max_tokens_out: 4000, max_total: 10000 },
      ),
    ).toBe(true);

    const store = createMemoryWhatsAppStore();
    const svc = new ConversationService(store, createStubLlm(), async () => {});
    const lead = crypto.randomUUID();
    const first = await svc.handleInbound({
      lead_id: lead,
      wa_phone: "+919999000002",
      text: "hello",
      diagnostic_summary: "Summary here",
      dry_run: true,
    });
    expect(first.outbound_text).toContain(AUTOMATION_DISCLOSURE);

    const convId = [...store.conversations.keys()][0]!;
    await store.updateConversation(convId, {
      tokens_in_total: 9999,
      tokens_out_total: 9999,
    });
    const handoff = await svc.handleInbound({
      lead_id: lead,
      wa_phone: "+919999000002",
      text: "what next?",
      dry_run: true,
    });
    expect(handoff.escalated).toBe(true);
    expect(handoff.escalation_trigger).toBe("TOKEN_BUDGET");
    expect(handoff.outbound_text.length).toBeGreaterThan(10);
    expect(handoff.outbound_text.toLowerCase()).not.toBe("");
  });
});

describe("M4 APPROVED-only asset resolution (G-2)", () => {
  test("unapproved FAQ cannot resolve on send path", async () => {
    const store = createMemoryWhatsAppStore([
      approvedFaq({
        id: "draft-faq",
        title: "Draft",
        status: "DRAFT",
        question_patterns: ["salary"],
        answer_text: "You will definitely earn €4000.",
      }),
    ]);
    await expect(
      resolveApprovedForSend("draft-faq", (id) => store.getAsset(id)),
    ).rejects.toBeInstanceOf(AssetNotApprovedError);

    // Approved resolves
    const store2 = createMemoryWhatsAppStore([
      approvedFaq({
        id: "ok-faq",
        title: "OK",
        question_patterns: ["recognition process"],
        answer_text: "Recognition is case-by-case; not guaranteed.",
      }),
    ]);
    const resolved = await resolveApprovedForSend("ok-faq", (id) =>
      store2.getAsset(id),
    );
    expect(resolved.status).toBe("APPROVED");
  });
});

describe("M4 bait deflection + filter log", () => {
  test("visa/salary bait deflects, escalates, and logs filter catch", async () => {
    const store = createMemoryWhatsAppStore([
      approvedFaq({
        id: "faq-visa",
        title: "Visa FAQ",
        question_patterns: ["will i get a visa", "visa guaranteed"],
        answer_text:
          "No one can guarantee a visa outcome. Authorities decide.",
      }),
    ]);
    const svc = new ConversationService(store, createStubLlm(), async () => {});
    const lead = crypto.randomUUID();
    await svc.handleInbound({
      lead_id: lead,
      wa_phone: "+919999000003",
      text: "start",
      diagnostic_summary: "Nursing professional — WARM fit.",
      dry_run: true,
    });

    const visa = await svc.handleInbound({
      lead_id: lead,
      wa_phone: "+919999000003",
      text: "Is my visa guaranteed?",
      dry_run: true,
    });
    expect(visa.escalated).toBe(true);
    expect(visa.filter_hit?.blocked).toBe(true);
    expect(store.filterLogs.length).toBeGreaterThan(0);

    // New conversation for second bait (prior is escalated)
    const storeB = createMemoryWhatsAppStore();
    const svcB = new ConversationService(storeB, createStubLlm(), async () => {});
    const leadB = crypto.randomUUID();
    await svcB.handleInbound({
      lead_id: leadB,
      wa_phone: "+919999000004",
      text: "hi",
      dry_run: true,
    });
    const salary = await svcB.handleInbound({
      lead_id: leadB,
      wa_phone: "+919999000004",
      text: "What salary will I definitely get?",
      dry_run: true,
    });
    expect(salary.escalated).toBe(true);
    expect(salary.filter_hit?.matched_rules.length).toBeGreaterThan(0);
    expect(storeB.filterLogs.length).toBe(1);
  });
});
