import type { DiagnosticResult } from "./types";

export type LocalDiagSession = {
  session_id: string;
  branch: string | null;
  answers: Record<string, string>;
  /** Index into active question list (0 = first question shown). */
  question_index: number;
  result: DiagnosticResult | null;
  contact_skipped: boolean;
  updated_at: string;
};

const KEY = "wfe_diag_session_v1";

export function loadLocalSession(): LocalDiagSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalDiagSession;
  } catch {
    return null;
  }
}

export function saveLocalSession(session: LocalDiagSession): void {
  localStorage.setItem(
    KEY,
    JSON.stringify({ ...session, updated_at: new Date().toISOString() }),
  );
}

export function clearLocalSession(): void {
  localStorage.removeItem(KEY);
}

export function newSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `diag_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
