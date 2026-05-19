// Thin data hook that calls `api.fetchEvents()` once on mount and
// exposes `{ events, loading, error, reload }`. In mock mode (no
// Supabase env vars) the api returns `SC_EVENTS` immediately, so this
// behaves like a synchronous import. In live mode it pulls from the
// `rank_events_query` RPC and the rest of the screen reacts when the
// promise resolves.
//
// We intentionally don't cache across mounts here — the call is cheap
// (~50ms locally) and any shared cache would need cross-screen
// invalidation logic the legacy didn't have either. Phase 8 can swap
// this for React Query if/when we add more network surface.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SC_EVENTS } from '@/data/mocks';
import type { SCEvent } from '@/types/domain';

interface UseEventsOptions {
  lat?: number;
  lng?: number;
  radiusM?: number;
}

interface UseEventsResult {
  events: SCEvent[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useEvents(opts: UseEventsOptions = {}): UseEventsResult {
  const { lat, lng, radiusM } = opts;
  // In mock mode we initialize synchronously with SC_EVENTS so screens
  // (and unit tests, which run under jest-expo's native preset where
  // Supabase env vars aren't set) render their content on first paint
  // without a flash of empty state. In live mode we start empty +
  // loading and let the effect populate.
  const mock = api.isMock();
  const [events, setEvents] = useState<SCEvent[]>(() => mock ? SC_EVENTS : []);
  const [loading, setLoading] = useState(() => !mock);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!mock) {
      setLoading(true);
      setError(null);
    }
    api.fetchEvents(lat, lng, radiusM)
      .then(list => {
        if (cancelled) return;
        setEvents(list);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lat, lng, radiusM, reloadCounter, mock]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { events, loading, error, reload };
}
