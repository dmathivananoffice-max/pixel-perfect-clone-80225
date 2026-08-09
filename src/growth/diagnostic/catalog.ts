import { loadBranchFromJson } from "./loadBranch";
import { loadRulesFromJson } from "./loadRules";
import type { BranchConfig } from "./branchTypes";
import type { DiagnosticRulesConfig } from "./types";
import nursingProfessionalBranch from "./branches/nursing-professional.v1.json";
import nursingAusbildungBranch from "./branches/nursing-ausbildung.v1.json";
import nursingProfessionalRules from "./rules/nursing-professional.v1.json";
import nursingAusbildungRules from "./rules/nursing-ausbildung.v1.json";

const BRANCHES: Record<string, BranchConfig> = {
  "nursing-professional": loadBranchFromJson(nursingProfessionalBranch),
  "nursing-ausbildung": loadBranchFromJson(nursingAusbildungBranch),
};

const RULES: Record<string, DiagnosticRulesConfig> = {
  "nursing-professional": loadRulesFromJson(nursingProfessionalRules),
  "nursing-ausbildung": loadRulesFromJson(nursingAusbildungRules),
};

export function listBranches(): BranchConfig[] {
  return Object.values(BRANCHES);
}

export function getBranch(branch: string): BranchConfig | null {
  return BRANCHES[branch] ?? null;
}

export function getRules(branch: string): DiagnosticRulesConfig | null {
  return RULES[branch] ?? null;
}

export function isKnownBranch(branch: string): boolean {
  return branch in BRANCHES;
}
