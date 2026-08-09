import { useEffect, useState } from "react";
import { getRules, isKnownBranch } from "@/growth/diagnostic/catalog";
import { evaluateDiagnostic } from "@/growth/diagnostic/engine";
import { syncDiagnosticSession } from "@/growth/diagnostic/sessionApi";
import {
  loadLocalSession,
  newSessionId,
  saveLocalSession,
  type LocalDiagSession,
} from "@/growth/diagnostic/sessionLocal";
import type { DiagnosticResult } from "@/growth/diagnostic/types";

export type Phase = "questions" | "results" | "contact" | "done";

export function useDiagnosticSession(initialBranch: string | null) {
  const deepBranch =
    initialBranch && isKnownBranch(initialBranch) ? initialBranch : null;

  const existingLocal = loadLocalSession();
  const [sessionId] = useState(
    () => existingLocal?.session_id ?? newSessionId(),
  );
  const isFreshSession = !existingLocal?.session_id;
  const [branch, setBranch] = useState<string | null>(
    () => loadLocalSession()?.branch ?? deepBranch,
  );
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => loadLocalSession()?.answers ?? {},
  );
  const [qIndex, setQIndex] = useState(
    () => loadLocalSession()?.question_index ?? 0,
  );
  const [result, setResult] = useState<DiagnosticResult | null>(
    () => loadLocalSession()?.result ?? null,
  );
  const [phase, setPhase] = useState<Phase>(() => {
    const local = loadLocalSession();
    if (local?.result && local.contact_skipped) return "done";
    if (local?.result) return "results";
    return "questions";
  });

  useEffect(() => {
    const payload: LocalDiagSession = {
      session_id: sessionId,
      branch,
      answers,
      question_index: qIndex,
      result,
      contact_skipped: phase === "done",
      updated_at: new Date().toISOString(),
    };
    saveLocalSession(payload);
  }, [sessionId, branch, answers, qIndex, result, phase]);

  useEffect(() => {
    if (!isFreshSession) return;
    void syncDiagnosticSession({
      action: "start",
      session_id: sessionId,
      branch,
      answers,
      question_index: qIndex,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isFreshSession]);

  function sync(
    partial: Partial<LocalDiagSession> & {
      action?: "answer" | "complete" | "contact";
      question_id?: string;
      lead_id?: string;
    },
  ) {
    void syncDiagnosticSession({
      action: partial.action ?? "answer",
      session_id: sessionId,
      branch: partial.branch ?? branch,
      answers: partial.answers ?? answers,
      question_index: partial.question_index ?? qIndex,
      question_id: partial.question_id,
      result: partial.result ?? result,
      lead_id: partial.lead_id,
    });
  }

  function completeWith(nextAnswers: Record<string, string>) {
    const rules = getRules(branch!);
    if (!rules) return;
    const evaluated = evaluateDiagnostic({
      branch: branch!,
      answers: nextAnswers,
      rules,
    });
    setResult(evaluated);
    setPhase("results");
    sync({
      answers: nextAnswers,
      result: evaluated,
      action: "complete",
    });
  }

  return {
    deepBranch,
    sessionId,
    branch,
    setBranch,
    answers,
    setAnswers,
    qIndex,
    setQIndex,
    result,
    phase,
    setPhase,
    sync,
    completeWith,
  };
}
