// Event classification helpers shared by the map, the events list, and the
// event card so "Recommended" means the same thing everywhere.

import type { SCEvent } from '@/types/domain';

// Is this event "Recommended for you"? An event is recommended only when it
// shares at least one of your subscribed interests. Source no longer matters:
// a scraped/app-discovered event you have no interest in is "Other", not
// "Recommended" (so the feed/map only highlight events relevant to you).
export function isRecommendedFor(event: SCEvent, meInterests: string[]): boolean {
  if (!meInterests.length) return false;
  return event.interests.some(tag => meInterests.includes(tag));
}
