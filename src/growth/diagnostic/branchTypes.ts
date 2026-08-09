/** Branch question config (FR-D-01, FR-D-02, FR-D-04). */

export type AffectsField =
  | "pathway"
  | "band"
  | "gaps"
  | "timeline_range"
  | "risk_notes"
  | "next_step";

export type BranchOption = {
  value: string;
  label: string;
};

export type BranchQuestion = {
  id: string;
  prompt: string;
  /** Which result fields this question can change — empty = invalid (FR-D-02). */
  affects: AffectsField[];
  options: BranchOption[];
};

export type BranchConfig = {
  version: string;
  branch: string;
  title: string;
  /** Profile-family label shown when this branch is chosen from Q1. */
  family_label: string;
  questions: BranchQuestion[];
};

export const PROFILE_FAMILY_QUESTION: BranchQuestion = {
  id: "profile_family",
  prompt: "Which path are you exploring?",
  affects: ["pathway", "band", "gaps"],
  options: [
    {
      value: "nursing-professional",
      label: "I am already a nurse (degree / diploma)",
    },
    {
      value: "nursing-ausbildung",
      label: "I want Nursing Ausbildung (training in Germany)",
    },
  ],
};
