// useOptimisticAttendees — make an event's attendee count reflect the
// viewer's own join/leave the instant they tap, instead of waiting for the
// next `rank_events_query` refetch.
//
// `useEvents` returns `event.attendees` straight from the server
// (subscriber_count). The join button + JOINED chip already flip optimistically
// (they read the store's joined set), but the count — and anything derived from
// it, like WebCapBar's unknown-capacity "people are going" stripe — stayed
// stale until a refetch. This hook overlays a ±1 adjustment for events the
// viewer has toggled this session.
//
// Correctness without double-counting:
//   • On the first toggle of an event, we snapshot the membership the *server
//     count already reflects* (1 if the viewer was joined, else 0) into `base`.
//   • The displayed count is `attendees + (joinedNow - base)`. So joining adds
//     +1, leaving subtracts 1, and undo / re-toggle resolve back to the server
//     count automatically (they key off the live `effectiveJoined` set).
//   • Fresh server data (a new `events` array) clears `base`, so the overlay
//     never lingers past the point the server count catches up.
//
// `markToggled(id)` MUST be called from the join/leave handler *before*
// mutating the store, so it captures the pre-toggle membership.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SCEvent } from '@/types/domain';

interface Result {
  /** `events` with the viewer's optimistic ±1 applied to `attendees`. */
  displayEvents: SCEvent[];
  /** Record the viewer's pre-toggle membership for an event (call in onJoin). */
  markToggled: (id: string) => void;
}

export function useOptimisticAttendees(
  events: SCEvent[],
  effectiveJoined: Set<string>,
): Result {
  const [base, setBase] = useState<Record<string, 0 | 1>>({});

  // A fresh server fetch is authoritative — drop the optimistic overlay so a
  // join the server now counts isn't added twice.
  useEffect(() => { setBase({}); }, [events]);

  const markToggled = useCallback((id: string) => {
    setBase(m => (id in m ? m : { ...m, [id]: effectiveJoined.has(id) ? 1 : 0 }));
  }, [effectiveJoined]);

  const displayEvents = useMemo(() => events.map(e => {
    const b = base[e.id];
    if (b === undefined) return e;
    const delta = (effectiveJoined.has(e.id) ? 1 : 0) - b;
    return delta ? { ...e, attendees: Math.max(0, e.attendees + delta) } : e;
  }), [events, effectiveJoined, base]);

  return { displayEvents, markToggled };
}
