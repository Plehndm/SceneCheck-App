// Pure helpers for turning a flat list of reviews into the aggregates
// the profile + hosting screens display. Used by both the own-profile
// tab, the other-profile screen, and the my-hosting list so the
// "X.X ★ · N reviews" math + the "no ratings yet" fallback live in
// exactly one place.

import type { Review } from '@/types/domain';

export interface RatingSummary {
  // Average to one decimal, or null when there are no reviews.
  average: number | null;
  count: number;
}

export function summarizeRatings(reviews: Review[]): RatingSummary {
  if (reviews.length === 0) return { average: null, count: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return {
    average: Math.round((sum / reviews.length) * 10) / 10,
    count: reviews.length,
  };
}

// Per-event summary, derived from a host's full review list. The
// reviews returned by `api.fetchRatings(hostId)` / SC_REVIEWS carry
// `eventId`, so we narrow to one event without a second query.
export function ratingForEvent(reviews: Review[], eventId: string): RatingSummary {
  return summarizeRatings(reviews.filter(r => r.eventId === eventId));
}

// Display string: "4.5★ · 3 reviews" or "No ratings yet".
export function formatRatingSummary(s: RatingSummary): string {
  if (s.average == null) return 'No ratings yet';
  return `${s.average.toFixed(1)}★ · ${s.count} ${s.count === 1 ? 'review' : 'reviews'}`;
}
