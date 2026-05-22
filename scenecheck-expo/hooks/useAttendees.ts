// Attendees-for-event hook. Mock-mode synchronous init from
// SC_VISIBLE_PEOPLE so the existing attendees screen test keeps
// rendering the same list. Live mode hits `event_subscriptions ⨝
// profiles` for confirmed-status rows.
//
// `eventId === undefined` short-circuits to an empty list to handle
// the Expo Router param-not-resolved-yet edge case.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SC_VISIBLE_PEOPLE } from '@/data/mocks';
import type { Account } from '@/types/domain';

interface UseAttendeesResult {
  attendees: Account[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useAttendees(eventId: string | undefined): UseAttendeesResult {
  const mock = api.isMock();
  const [attendees, setAttendees] = useState<Account[]>(() =>
    mock ? SC_VISIBLE_PEOPLE : [],
  );
  const [loading, setLoading] = useState(() => !mock && !!eventId);
  const [error, setError] = useState<Error | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (!eventId) {
      setAttendees([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (!mock) {
      setLoading(true);
      setError(null);
    }
    api.fetchAttendees(eventId)
      .then(list => {
        if (cancelled) return;
        setAttendees(list);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [eventId, mock, reloadCounter]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);
  return { attendees, loading, error, reload };
}
