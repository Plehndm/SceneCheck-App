// Events the current user has joined (confirmed subscriptions) — powers the
// "events you've joined" screen reached from the profile ATTENDED stat.
//
// Mock mode derives the list from the local `joined` set + SC_EVENTS so it
// stays reactive to join/leave without a round-trip. Live mode hits
// `api.fetchJoinedEvents()` (event_subscriptions ⨝ events, confirmed).

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { SC_EVENTS } from '@/data/mocks';
import type { SCEvent } from '@/types/domain';

interface UseJoinedEventsResult {
  events: SCEvent[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useJoinedEvents(): UseJoinedEventsResult {
  const mock = api.isMock();
  const joined = useStore(s => s.joined);
  const [events, setEvents] = useState<SCEvent[]>(() =>
    mock ? SC_EVENTS.filter(e => joined.has(e.id)) : [],
  );
  const [loading, setLoading] = useState(() => !mock);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (mock) {
      setEvents(SC_EVENTS.filter(e => joined.has(e.id)));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.fetchJoinedEvents()
      .then(list => { if (!cancelled) { setEvents(list); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e : new Error(String(e))); setLoading(false); } });
    return () => { cancelled = true; };
  }, [mock, joined, reloadCounter]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { events, loading, error, reload };
}
