import type { Event, EventType } from "@/lib/types";

// §6.6 — derived (never stored) status badge shown next to a member's name
// in the sidebar. Find the member's earliest event covering today and
// surface its first title word, lowercased, ≤6 chars. Type drives the
// badge background color via EVENT_TYPE_STYLE.
export interface MemberStatus {
  label: string;
  type: EventType;
}

export function deriveMemberStatus(
  userId: string,
  todayEvents: Event[],
): MemberStatus | null {
  let earliest: Event | null = null;
  for (const e of todayEvents) {
    if (e.creatorId !== userId) continue;
    if (!earliest || e.createdAt.toMillis() < earliest.createdAt.toMillis()) {
      earliest = e;
    }
  }
  if (!earliest) return null;
  const firstWord = earliest.title.trim().split(/\s+/)[0] ?? "";
  if (firstWord.length === 0) return null;
  return {
    label: firstWord.toLowerCase().slice(0, 6),
    type: earliest.type,
  };
}
