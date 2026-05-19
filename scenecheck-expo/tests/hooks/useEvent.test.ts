// Smoke test for the single-event hook. Mirrors useEvents.test.ts —
// in mock mode the initializer runs synchronously against
// `SC_EVENT_BY_ID[id]`, so the first render already has the event.
// Live-mode behavior is covered indirectly by the event-detail
// screen tests + the manual smoke described in
// `docs/PROGRESS_SNAPSHOT.md` Phase 2 section.

import { renderHook } from '@testing-library/react-native';
import { useEvent } from '@/hooks/useEvent';
import { SC_EVENT_BY_ID } from '@/data/mocks';

describe('useEvent', () => {
  test('returns the matching event synchronously in mock mode', () => {
    const { result } = renderHook(() => useEvent('e1'));
    expect(result.current.loading).toBe(false);
    expect(result.current.event).toEqual(SC_EVENT_BY_ID.e1);
    expect(result.current.error).toBeNull();
  });

  test('returns null event for an unknown id', () => {
    const { result } = renderHook(() => useEvent('DOES_NOT_EXIST'));
    expect(result.current.loading).toBe(false);
    expect(result.current.event).toBeNull();
  });

  test('handles undefined id without crashing', () => {
    const { result } = renderHook(() => useEvent(undefined));
    expect(result.current.loading).toBe(false);
    expect(result.current.event).toBeNull();
  });
});
