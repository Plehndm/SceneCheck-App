// Smoke tests for the interest catalog hooks.
// Mirrors useEvent / useEvents — mock-mode synchronous init so the
// existing interest-screen tests keep their first-render assertions.

import { renderHook } from '@testing-library/react-native';
import { useInterests } from '@/hooks/useInterests';
import { useInterest } from '@/hooks/useInterest';
import { SC_INTERESTS_SUGGESTED, SC_INTERESTS_DETAILS } from '@/data/mocks';

describe('useInterests', () => {
  test('returns the full curated list synchronously in mock mode', () => {
    const { result } = renderHook(() => useInterests());
    expect(result.current.loading).toBe(false);
    expect(result.current.interests).toEqual(SC_INTERESTS_SUGGESTED);
  });

  test('filters by substring match on the tag name', () => {
    const { result } = renderHook(() => useInterests('cook'));
    expect(result.current.interests.length).toBeGreaterThan(0);
    expect(result.current.interests.every(i => i.tag.includes('cook'))).toBe(true);
  });
});

describe('useInterest', () => {
  test('returns the matching tag synchronously in mock mode', () => {
    const { result } = renderHook(() => useInterest('biking'));
    expect(result.current.loading).toBe(false);
    expect(result.current.interest).toEqual(SC_INTERESTS_DETAILS['biking']);
  });

  test('returns null for an unknown tag', () => {
    const { result } = renderHook(() => useInterest('not-a-real-tag'));
    expect(result.current.loading).toBe(false);
    expect(result.current.interest).toBeNull();
  });

  test('handles undefined tag without crashing', () => {
    const { result } = renderHook(() => useInterest(undefined));
    expect(result.current.loading).toBe(false);
    expect(result.current.interest).toBeNull();
  });
});
