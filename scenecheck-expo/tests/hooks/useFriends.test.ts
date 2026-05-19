// Smoke tests for the social hooks added in Phase 5.

import { renderHook } from '@testing-library/react-native';
import { useFriends } from '@/hooks/useFriends';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useProfile } from '@/hooks/useProfile';
import { resetStore } from '../test-utils';
import { SC_VISIBLE_PEOPLE, SC_FRIEND_REQUESTS, SC_ACCOUNT_BY_ID } from '@/data/mocks';

beforeEach(() => resetStore());

describe('useFriends', () => {
  test('filters SC_VISIBLE_PEOPLE by the Zustand friends Set in mock mode', () => {
    // resetStore defaults `friends` to ['p1', 'p3', 'p5'].
    const { result } = renderHook(() => useFriends());
    expect(result.current.loading).toBe(false);
    const ids = result.current.friends.map(f => f.id).sort();
    expect(ids).toEqual(['p1', 'p3', 'p5']);
    // Every returned account has a matching profile in SC_VISIBLE_PEOPLE.
    expect(
      result.current.friends.every(f => SC_VISIBLE_PEOPLE.some(p => p.id === f.id)),
    ).toBe(true);
  });

  test('exposes a callable reload function', () => {
    const { result } = renderHook(() => useFriends());
    expect(typeof result.current.reload).toBe('function');
  });
});

describe('useFriendRequests', () => {
  test('filters SC_FRIEND_REQUESTS by the Zustand incomingRequests Set + drops blocked senders', () => {
    // resetStore defaults `incomingRequests` to ['fr1', 'fr2'].
    // fr1 is from p4 (visible); fr2 is from p6 (blockedYou=true, so
    // excluded from SC_VISIBLE_PERSON_BY_ID). Only fr1 survives.
    const { result } = renderHook(() => useFriendRequests());
    expect(result.current.loading).toBe(false);
    const ids = result.current.requests.map(r => r.id);
    expect(ids).toEqual(['fr1']);
    // Every surviving row has the corresponding person attached.
    expect(result.current.requests.every(r => Boolean(r.person))).toBe(true);
    expect(SC_FRIEND_REQUESTS.length).toBeGreaterThan(0);
  });
});

describe('useProfile', () => {
  test('returns the matching account synchronously in mock mode', () => {
    const { result } = renderHook(() => useProfile('p1'));
    expect(result.current.loading).toBe(false);
    expect(result.current.profile).toEqual(SC_ACCOUNT_BY_ID['p1']);
  });

  test('handles undefined id gracefully', () => {
    const { result } = renderHook(() => useProfile(undefined));
    expect(result.current.loading).toBe(false);
    expect(result.current.profile).toBeNull();
  });
});
