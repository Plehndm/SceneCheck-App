// Unit tests for the pure rating-aggregation helpers in lib/ratings.ts.

import { summarizeRatings, ratingForEvent, formatRatingSummary } from '@/lib/ratings';
import type { Review } from '@/types/domain';

function review(eventId: string, rating: number): Review {
  return {
    id: `${eventId}:r${rating}`,
    eventId,
    hostId: 'h1',
    reviewerId: 'rev',
    rating,
    when: 'today',
    text: '',
  };
}

describe('summarizeRatings', () => {
  test('returns null average + 0 count for an empty list', () => {
    expect(summarizeRatings([])).toEqual({ average: null, count: 0 });
  });

  test('averages and rounds to one decimal', () => {
    // (5 + 4 + 4) / 3 = 4.333… → 4.3
    const s = summarizeRatings([review('e1', 5), review('e1', 4), review('e1', 4)]);
    expect(s.count).toBe(3);
    expect(s.average).toBe(4.3);
  });

  test('handles a single review', () => {
    expect(summarizeRatings([review('e1', 5)])).toEqual({ average: 5, count: 1 });
  });
});

describe('ratingForEvent', () => {
  test('narrows to one event before averaging', () => {
    const reviews = [
      review('e1', 5), review('e1', 3),
      review('e2', 1),
    ];
    expect(ratingForEvent(reviews, 'e1')).toEqual({ average: 4, count: 2 });
    expect(ratingForEvent(reviews, 'e2')).toEqual({ average: 1, count: 1 });
    expect(ratingForEvent(reviews, 'e3')).toEqual({ average: null, count: 0 });
  });
});

describe('formatRatingSummary', () => {
  test('formats a populated summary', () => {
    expect(formatRatingSummary({ average: 4.5, count: 3 })).toBe('4.5★ · 3 reviews');
  });

  test('singularizes one review', () => {
    expect(formatRatingSummary({ average: 5, count: 1 })).toBe('5.0★ · 1 review');
  });

  test('falls back to "No ratings yet" when empty', () => {
    expect(formatRatingSummary({ average: null, count: 0 })).toBe('No ratings yet');
  });
});
