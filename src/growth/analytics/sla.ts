/**
 * HOT counsellor SLA: 4 business hours (FR-S-02 / FR-DB).
 * Business hours: Mon–Fri 09:00–18:00 UTC (config-friendly constant for now).
 */

const WORK_START = 9;
const WORK_END = 18;
const DEFAULT_SLA_HOURS = 4;

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** Advance one UTC hour into the next business hour slot. */
function nextBusinessHour(from: Date): Date {
  const d = new Date(from.getTime());
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + 1);
  while (isWeekend(d) || d.getUTCHours() < WORK_START || d.getUTCHours() >= WORK_END) {
    if (isWeekend(d) || d.getUTCHours() >= WORK_END) {
      // jump to next day 09:00
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCHours(WORK_START, 0, 0, 0);
    } else if (d.getUTCHours() < WORK_START) {
      d.setUTCHours(WORK_START, 0, 0, 0);
    }
  }
  return d;
}

export function addBusinessHours(
  startIso: string,
  hours = DEFAULT_SLA_HOURS,
): string {
  let cursor = new Date(startIso);
  // If start is outside business hours, move to next open slot first
  if (
    isWeekend(cursor) ||
    cursor.getUTCHours() < WORK_START ||
    cursor.getUTCHours() >= WORK_END
  ) {
    cursor = nextBusinessHour(new Date(cursor.getTime() - 3600000));
  }
  let remaining = hours;
  while (remaining > 0) {
    cursor = nextBusinessHour(cursor);
    remaining -= 1;
  }
  return cursor.toISOString();
}

export function slaStatus(
  scoredAt: string,
  now = new Date(),
  slaHours = DEFAULT_SLA_HOURS,
): { deadline: string; hours_remaining: number; breached: boolean } {
  const deadline = addBusinessHours(scoredAt, slaHours);
  const ms = new Date(deadline).getTime() - now.getTime();
  const hours_remaining = Math.round((ms / 3600000) * 10) / 10;
  return {
    deadline,
    hours_remaining,
    breached: ms < 0,
  };
}
