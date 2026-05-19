// Smoke test for the `useEvents` hook. In mock mode (the jest-expo
// environment doesn't get Supabase env vars) the hook initializes
// synchronously with `SC_EVENTS`, so a single `renderHook` call
// observes the right shape on first render without needing `waitFor`.
// Live-mode behavior is covered indirectly by the screen integration
// tests that already exercise `api.fetchEvents` through this hook.

import { renderHook } from '@testing-library/react-native';
import { useEvents } from '@/hooks/useEvents';
import { SC_EVENTS } from '@/data/mocks';

describe('useEvents', () => {
  test('returns SC_EVENTS synchronously in mock mode', () => {
    const { result } = renderHook(() => useEvents());
    // Mock mode: events ready on the first render, loading already false.
    expect(result.current.loading).toBe(false);
    expect(result.current.events).toEqual(SC_EVENTS);
    expect(result.current.error).toBeNull();
  });

  test('exposes a reload function', () => {
    const { result } = renderHook(() => useEvents());
    expect(typeof result.current.reload).toBe('function');
  });
});
