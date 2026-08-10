import { useMemo, useState } from "react";
import { PROFILE_FAMILY_QUESTION } from "@/growth/diagnostic/branchTypes";
import { getBranch } from "@/growth/diagnostic/catalog";
import { captureDiagnosticLead } from "@/growth/diagnostic/sessionApi";
import { ContactScreen } from "./ContactScreen";
import { QuestionScreen } from "./QuestionScreen";
import { ResultsScreen } from "./ResultsScreen";
import { useDiagnosticSession } from "./useDiagnosticSession";
import "./diagnostic.css";

type Props = { initialBranch?: string | null };

export function DiagnosticApp({ initialBranch = null }: Props) {
  const s = useDiagnosticSession(initialBranch);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branchConfig = s.branch ? getBranch(s.branch) : null;
  const questions = useMemo(
    () => (branchConfig ? branchConfig.questions : [PROFILE_FAMILY_QUESTION]),
    [branchConfig],
  );
  const total = questions.length;
  const current = questions[Math.min(s.qIndex, total - 1)];

  function selectAnswer(value: string) {
    if (!current) return;

    if (!branchConfig && current.id === "profile_family") {
      s.setBranch(value);
      s.setAnswers({});
      s.setQIndex(0);
      s.sync({
        branch: value,
        answers: {},
        question_index: 0,
        question_id: current.id,
        action: "answer",
      });
      return;
    }

    const nextAnswers = { ...s.answers, [current.id]: value };
    s.setAnswers(nextAnswers);

    if (s.qIndex + 1 >= total) {
      s.completeWith(nextAnswers);
      return;
    }

    const nextIndex = s.qIndex + 1;
    s.setQIndex(nextIndex);
    s.sync({
      answers: nextAnswers,
      question_index: nextIndex,
      question_id: current.id,
      action: "answer",
    });
  }

  function goBack() {
    if (s.phase !== "questions") return;
    if (s.qIndex > 0) {
      s.setQIndex(s.qIndex - 1);
      return;
    }
    if (s.branch && !s.deepBranch) {
      s.setBranch(null);
      s.setAnswers({});
      s.setQIndex(0);
    }
  }

  if (s.phase === "results" && s.result) {
    return (
      <div className="diag">
        <ResultsScreen
          result={s.result}
          onContinue={() => s.setPhase("contact")}
        />
      </div>
    );
  }

  if ((s.phase === "contact" || s.phase === "done") && s.result) {
    return (
      <div className="diag">
        <ResultsScreen
          result={s.result}
          onContinue={() => s.setPhase("contact")}
        />
        {s.phase === "contact" ? (
          <div style={{ marginTop: "1rem" }}>
            <ContactScreen
              busy={busy}
              error={error}
              onSkip={() => s.setPhase("done")}
              onSubmit={async (values) => {
                setBusy(true);
                setError(null);
                const out = await captureDiagnosticLead({
                  phone: values.phone,
                  name: values.name,
                  city: values.city,
                  email: values.email || undefined,
                  diagnostic_session_id: s.sessionId,
                });
                setBusy(false);
                if (!out.ok) {
                  setError(out.error);
                  return;
                }
                s.sync({ action: "contact", lead_id: out.lead_id });
                s.setPhase("done");
              }}
            />
          </div>
        ) : (
          <div className="diag__shell">
            <p className="diag__muted">Your results remain available above.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="diag">
      <QuestionScreen
        progressLabel={
          branchConfig
            ? `${s.qIndex + 1} of ${total}`
            : "1 of … (choose your path)"
        }
        progressRatio={branchConfig ? (s.qIndex + 1) / total : 0.08}
        prompt={current.prompt}
        options={current.options}
        onSelect={selectAnswer}
        onBack={
          s.qIndex > 0 || (Boolean(s.branch) && !s.deepBranch)
            ? goBack
            : undefined
        }
      />
    </div>
  );
}
