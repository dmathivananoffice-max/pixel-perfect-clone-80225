/**
 * FR-N-05 scarcity rule: urgency copy is structurally impossible without
 * an intake_id or calendar_event_id.
 */

export type UrgencyTemplateInput = {
  key: string;
  body: string;
  intake_id?: string | null;
  calendar_event_id?: string | null;
};

export class ScarcitySchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScarcitySchemaError";
  }
}

export function assertUrgencyTemplate(input: UrgencyTemplateInput): void {
  if (!input.key?.trim()) throw new ScarcitySchemaError("key required");
  if (!input.body?.trim()) throw new ScarcitySchemaError("body required");
  const hasIntake = Boolean(input.intake_id?.trim());
  const hasEvent = Boolean(input.calendar_event_id?.trim());
  if (!hasIntake && !hasEvent) {
    throw new ScarcitySchemaError(
      "FR-N-05: urgency copy requires intake_id or calendar_event_id",
    );
  }
}

/** Detect banned free-form scarcity without a calendar reference. */
export function looksLikeUnanchoredScarcity(text: string): boolean {
  return /\b(only\s+\d+\s+spots?|hurry|last\s+chance|filling\s+fast|almost\s+full|limited\s+seats)\b/i.test(
    text,
  );
}
