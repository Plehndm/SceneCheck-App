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

// The single bucket an event falls into, matching the map legend. Color AND
// label everywhere derive from this so they can't disagree (the old code
// labelled by `kind` — e.g. "ORG · POSTED" — while pinColor classified by
// interest, so a matching org event showed a blue "recommended" pin under an
// "ORG · POSTED" label). Priority: your own > a friend's > matches an interest
// > everything else.
export type EventCategory = 'yours' | 'friend' | 'recommended' | 'other';

export function eventCategory(event: SCEvent, meInterests: string[]): EventCategory {
  if (event.kind === 'yours') return 'yours';
  if (event.kind === 'friend') return 'friend';
  if (isRecommendedFor(event, meInterests)) return 'recommended';
  return 'other';
}

export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  yours: 'YOUR EVENT',
  friend: 'FRIEND HOSTING',
  recommended: 'RECOMMENDED',
  other: 'NEARBY',
};

// A friend's event can ALSO match your interests. `eventCategory` short-circuits
// on `friend` (so the pin stays the friend colour), which would otherwise hide
// that it's recommended too. This flag tells the UI to show an extra
// "RECOMMENDED" badge alongside the "FRIEND HOSTING" label. It's intentionally
// only true for friend events: an `other` event that matches is already
// `recommended` (badge would be redundant), and for your own event the
// recommendation is moot (you chose the interests).
export function isAlsoRecommended(event: SCEvent, meInterests: string[]): boolean {
  return eventCategory(event, meInterests) === 'friend' && isRecommendedFor(event, meInterests);
}
