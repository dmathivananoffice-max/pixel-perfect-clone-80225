/** Honest waitlist copy — never fake scarcity (FR-G-03 / FR-N-05). */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "the upcoming";
  return MONTHS[d.getUTCMonth()] ?? "the upcoming";
}

export function buildWaitlistCopy(input: {
  nearest_batch_date: string;
  next_batch_date: string | null;
}): string {
  const fullMonth = monthName(input.nearest_batch_date);
  const nextMonth = input.next_batch_date
    ? monthName(input.next_batch_date)
    : "the following intake";
  return `The ${fullMonth} intake is full — join the list for ${nextMonth}`;
}

export function buildOpenCtaCopy(nearest_batch_date: string | null): string {
  if (!nearest_batch_date) {
    return "Continue to get this plan on WhatsApp and speak with an advisor.";
  }
  return `Continue for the ${monthName(nearest_batch_date)} intake — get this plan on WhatsApp and speak with an advisor.`;
}
