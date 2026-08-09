export type CounsellingSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  capacity: number;
  booked: number;
  status: "OPEN" | "BOOKED" | "CANCELLED";
  lead_id: string | null;
};

export function formatOpenSlots(slots: CounsellingSlot[], limit = 3): string {
  const open = slots
    .filter((s) => s.status === "OPEN" && s.booked < s.capacity)
    .slice(0, limit);
  if (open.length === 0) {
    return "No counselling slots are open right now. Reply ADVISOR and we'll arrange a time.";
  }
  const lines = open.map((s, i) => {
    const start = new Date(s.starts_at).toISOString().replace(".000Z", "Z");
    return `${i + 1}. ${start} (${s.timezone})`;
  });
  return `I can offer these counselling slots — reply with the number to book:\n${lines.join("\n")}`;
}

export function bookSlot(
  slots: CounsellingSlot[],
  slotId: string,
  leadId: string,
): CounsellingSlot {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) throw new Error("slot not found");
  if (slot.status !== "OPEN" || slot.booked >= slot.capacity) {
    throw new Error("slot unavailable");
  }
  slot.booked += 1;
  slot.lead_id = leadId;
  if (slot.booked >= slot.capacity) slot.status = "BOOKED";
  return slot;
}

export function wantsBooking(text: string): boolean {
  return /\b(book|booking|counsell?ing|advisor\s+call|schedule|appointment|slot)\b/i.test(
    text,
  );
}
