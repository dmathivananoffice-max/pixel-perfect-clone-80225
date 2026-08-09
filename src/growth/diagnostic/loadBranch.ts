import type { AffectsField, BranchConfig, BranchQuestion } from "./branchTypes";

const ALLOWED_AFFECTS: AffectsField[] = [
  "pathway",
  "band",
  "gaps",
  "timeline_range",
  "risk_notes",
  "next_step",
];

/** FR-D-02: every question must affect pathway, band, or gaps (at minimum one output field). */
export function validateBranchConfig(raw: unknown): BranchConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("branch config must be an object");
  }
  const b = raw as Record<string, unknown>;
  if (typeof b.version !== "string" || !b.version) {
    throw new Error("branch.version is required");
  }
  if (typeof b.branch !== "string" || !b.branch) {
    throw new Error("branch.branch is required");
  }
  if (!Array.isArray(b.questions) || b.questions.length < 6 || b.questions.length > 9) {
    throw new Error("branch must have 6–9 questions (FR-D-02)");
  }

  const questions: BranchQuestion[] = b.questions.map((q, idx) => {
    const question = q as Record<string, unknown>;
    if (typeof question.id !== "string" || !question.id) {
      throw new Error(`questions[${idx}].id is required`);
    }
    if (typeof question.prompt !== "string" || !question.prompt) {
      throw new Error(`questions[${idx}].prompt is required`);
    }
    const affects = question.affects as AffectsField[];
    if (!Array.isArray(affects) || affects.length === 0) {
      throw new Error(
        `questions[${idx}] (${question.id}) affects nothing — invalid (FR-D-02)`,
      );
    }
    for (const a of affects) {
      if (!ALLOWED_AFFECTS.includes(a)) {
        throw new Error(`questions[${idx}] unknown affects: ${a}`);
      }
    }
    // Must influence eligibility outcomes, not only soft notes
    const material = affects.some((a) =>
      ["pathway", "band", "gaps"].includes(a),
    );
    if (!material) {
      throw new Error(
        `questions[${idx}] (${question.id}) must affect pathway, band, or gaps`,
      );
    }
    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error(`questions[${idx}] needs ≥ 2 tap-select options`);
    }
    return {
      id: question.id,
      prompt: question.prompt,
      affects,
      options: question.options as BranchQuestion["options"],
    };
  });

  return {
    version: b.version,
    branch: b.branch,
    title: String(b.title ?? b.branch),
    family_label: String(b.family_label ?? b.title ?? b.branch),
    questions,
  };
}

export function loadBranchFromJson(raw: unknown): BranchConfig {
  return validateBranchConfig(raw);
}
