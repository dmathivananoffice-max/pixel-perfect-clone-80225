import type { AssetRecord } from "../assets/types";
import { formatOpenSlots, wantsBooking } from "./booking";
import { ESCALATION_AUTO_REPLY, LOW_CONFIDENCE_REPLY, QUALIFICATION_QUESTIONS } from "./constants";
import { matchFaq, resolveApprovedForSend } from "./retrieval";
import type { WhatsAppStore } from "./store";

export type SkillDraft = {
  text: string;
  skill: string;
  meta: Record<string, unknown>;
  out_of_corpus?: boolean;
  outside_skill?: boolean;
  low_confidence?: boolean;
};

export async function draftClosedSkillReply(input: {
  text: string;
  store: WhatsAppStore;
  qualification_state: Record<string, unknown>;
  conversation_id: string;
  threshold: number;
}): Promise<SkillDraft> {
  const { text, store } = input;

  if (/\b(write\s+code|hack\s+the|unrelated\s+to\s+nursing)\b/i.test(text)) {
    return {
      text: ESCALATION_AUTO_REPLY,
      skill: "outside_skill",
      meta: {},
      outside_skill: true,
    };
  }

  if (wantsBooking(text)) {
    return {
      text: formatOpenSlots(await store.listOpenSlots()),
      skill: "booking",
      meta: {},
    };
  }

  if (/\b(proof|document|brochure|success\s+stor)\b/i.test(text)) {
    return proofDraft(store);
  }

  const unanswered = QUALIFICATION_QUESTIONS.find(
    (q) => !input.qualification_state[q.id],
  );
  // Prefer FAQ for clear questions; ask qualification when message is short/ack
  const looksLikeQuestion =
    /\?/.test(text) ||
    /\b(what|when|how|will|can|do|is|are|visa|salary|cost|recognition)\b/i.test(text);

  if (!looksLikeQuestion && unanswered) {
    await store.updateConversation(input.conversation_id, {
      qualification_state: {
        ...input.qualification_state,
        [unanswered.id]: "asked",
      },
    });
    return { text: unanswered.prompt, skill: "qualification", meta: { id: unanswered.id } };
  }

  const faqs = await store.listApprovedFaqs();
  const match = matchFaq(text, faqs, input.threshold);
  if (match) {
    return {
      text: match.answer_text,
      skill: "faq",
      meta: { asset_id: match.asset.id, score: match.score },
    };
  }

  if (unanswered) {
    await store.updateConversation(input.conversation_id, {
      qualification_state: {
        ...input.qualification_state,
        [unanswered.id]: "asked",
      },
    });
    return { text: unanswered.prompt, skill: "qualification", meta: { id: unanswered.id } };
  }

  return {
    text: LOW_CONFIDENCE_REPLY,
    skill: "faq_low_confidence",
    meta: {},
    out_of_corpus: true,
    low_confidence: true,
  };
}

async function proofDraft(store: WhatsAppStore): Promise<SkillDraft> {
  const faqs = await store.listApprovedFaqs();
  const all = faqs as AssetRecord[];
  const proof =
    all.find((a) => a.type === "PROOF_ASSET") ??
    all.find((a) => a.type === "FAQ_ANSWER");
  if (!proof) {
    return {
      text: "I don't have an approved proof asset to share yet. Reply ADVISOR for help.",
      skill: "proof_asset",
      meta: {},
    };
  }
  try {
    const resolved = await resolveApprovedForSend(proof.id, (id) => store.getAsset(id));
    return {
      text: `Sharing approved material: ${resolved.title} (v${resolved.version}).`,
      skill: "proof_asset",
      meta: { asset_id: resolved.id },
    };
  } catch {
    return {
      text: "I can only share approved materials. Reply ADVISOR and we'll help.",
      skill: "proof_asset",
      meta: { blocked_unapproved: true },
    };
  }
}
