// Smoke tests for the Phase 7 hooks (`useAttendees`, `useRatings`).
// Both follow the established mock-mode-synchronous pattern.

import { renderHook } from '@testing-library/react-native';
import { useAttendees } from '@/hooks/useAttendees';
import { useRatings } from '@/hooks/useRatings';
import { SC_VISIBLE_PEOPLE, SC_REVIEWS } from '@/data/mocks';

describe('useAttendees', () => {
  test('returns SC_VISIBLE_PEOPLE synchronously in mock mode', () => {
    const { result } = renderHook(() => useAttendees('e1'));
    expect(result.current.loading).toBe(false);
    expect(result.current.attendees).toEqual(SC_VISIBLE_PEOPLE);
  });

  test('handles undefined eventId without crashing', () => {
    const { result } = renderHook(() => useAttendees(undefined));
    expect(result.current.loading).toBe(false);
    expect(result.current.attendees).toEqual([]);
  });
});

describe('useRatings', () => {
  test('filters SC_REVIEWS by hostId synchronously in mock mode', () => {
    const { result } = renderHook(() => useRatings('me'));
    expect(result.current.loading).toBe(false);
    // SC_REVIEWS has multiple rows for hostId='me' (Morning Ride reviews).
    const expected = SC_REVIEWS.filter(r => r.hostId === 'me');
    expect(result.current.ratings.length).toBe(expected.length);
    expect(result.current.ratings.every(r => r.hostId === 'me')).toBe(true);
  });

  test('returns an empty list for a host with no reviews', () => {
    const { result } = renderHook(() => useRatings('no-such-host'));
    expect(result.current.loading).toBe(false);
    expect(result.current.ratings).toEqual([]);
  });

  test('handles undefined hostId without crashing', () => {
    const { result } = renderHook(() => useRatings(undefined));
    expect(result.current.loading).toBe(false);
    expect(result.current.ratings).toEqual([]);
  });
});
