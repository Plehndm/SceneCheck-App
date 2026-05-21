// Smoke test for the hosted-events hook. Mock mode filters SC_EVENTS
// by hostId synchronously.

import { renderHook } from '@testing-library/react-native';
import { useHostedEvents } from '@/hooks/useHostedEvents';
import { SC_EVENTS } from '@/data/mocks';

describe('useHostedEvents', () => {
  test('returns the host\'s events synchronously in mock mode', () => {
    const { result } = renderHook(() => useHostedEvents('me'));
    expect(result.current.loading).toBe(false);
    const expected = SC_EVENTS.filter(e => e.hostId === 'me');
    expect(result.current.events.length).toBe(expected.length);
    expect(result.current.events.every(e => e.hostId === 'me')).toBe(true);
  });

  test('returns [] for a host with no events', () => {
    const { result } = renderHook(() => useHostedEvents('nobody-hosts-as-this'));
    expect(result.current.loading).toBe(false);
    expect(result.current.events).toEqual([]);
  });

  test('handles undefined hostId without crashing', () => {
    const { result } = renderHook(() => useHostedEvents(undefined));
    expect(result.current.loading).toBe(false);
    expect(result.current.events).toEqual([]);
  });
});
