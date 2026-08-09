import { EXIT_SURVEY_CHOICES, parseExitSurveyReply } from "./taxonomy";
import type { ObjectionService } from "./service";
import type { ObjectionRecord } from "./types";

export type ExitSurveyCandidate = {
  session_id: string;
  lead_id: string;
  pathway: string | null;
  phone_e164: string;
};

export type ExitSurveyDispatcher = {
  sendTemplate(phone: string, templateName: string, body: string): Promise<void>;
  markSent(candidate: ExitSurveyCandidate): Promise<void>;
};

export function buildExitSurveyBody(): string {
  const lines = EXIT_SURVEY_CHOICES.map((c) => `${c.n} ${c.label}`);
  return `Quick question — what made you pause the Pathway Diagnostic? Reply with a number:\n${lines.join("\n")}`;
}

/** Dispatch template messages for abandoned diagnostics with contact. */
export async function dispatchExitSurveys(
  candidates: ExitSurveyCandidate[],
  dispatcher: ExitSurveyDispatcher,
): Promise<number> {
  const body = buildExitSurveyBody();
  let n = 0;
  for (const c of candidates) {
    await dispatcher.sendTemplate(c.phone_e164, "diag_exit_survey", body);
    await dispatcher.markSent(c);
    n += 1;
  }
  return n;
}

/** Map inbound WhatsApp reply (or web tap) to an objection row. */
export async function answerExitSurvey(
  svc: ObjectionService,
  input: {
    reply: string;
    lead_id: string;
    session_id?: string | null;
    pathway?: string | null;
    logged_by?: string;
  },
): Promise<ObjectionRecord | null> {
  const code = parseExitSurveyReply(input.reply);
  if (!code) return null;
  return svc.log({
    lead_id: input.lead_id,
    source: "diag_exit_survey",
    taxonomy_code: code,
    verbatim: input.reply.trim(),
    logged_by: input.logged_by ?? "diag_exit_survey",
    pathway: input.pathway ?? null,
    session_id: input.session_id ?? null,
    meta: { exit_survey: true },
  });
}
