// Events-hosted-by-a-given-user hook. Powers the "Hosting / Events
// posted" list on a profile. Mock mode initializes synchronously from
// `SC_EVENTS` filtered by hostId; live mode hits
// `api.fetchEventsByHost` (all statuses, newest first).
//
// `hostId === undefined` short-circuits to an empty list for the
// Expo Router param-not-resolved-yet edge case.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SC_EVENTS } from '@/data/mocks';
import type { SCEvent } from '@/types/domain';

interface UseHostedEventsResult {
  events: SCEvent[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useHostedEvents(hostId: string | undefined): UseHostedEventsResult {
  const mock = api.isMock();
  const [events, setEvents] = useState<SCEvent[]>(() =>
    mock && hostId ? SC_EVENTS.filter(e => e.hostId === hostId) : [],
  );
  const [loading, setLoading] = useState(() => !mock && !!hostId);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (!hostId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (!mock) {
      setLoading(true);
      setError(null);
    }
    api.fetchEventsByHost(hostId)
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
  }, [hostId, mock, reloadCounter]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { events, loading, error, reload };
}
