// useJoinEventHandler — shared optimistic-commit JOIN/LEAVE handler.
//
// Extracts the pattern that home (`(tabs)/index.web.tsx:117-149`) and
// map (`(tabs)/map.web.tsx`) already implement so the secondary list
// pages (search, interests/[tag], my-hosting, my-events, profile) and
// the event-detail overlay stop diverging from it.
//
// The flow mirrors the native `handleToggleJoin`
// (`app/event/[id].tsx:178-278`):
//
//   • LEAVE: schedule a 5-second pending-leave grace timer first so
//     the UI flips immediately and the user can UNDO via the toast
//     action. Commit `api.cancelSubscription` in the background. On
//     error surface a separate error toast — the grace timer still
//     clears after 5s, which keeps state honest.
//   • JOIN: optimistic `joinEvent(id)` first; await
//     `api.subscribeToEvent` and re-toast if the server says
//     `waitlisted`; roll back via `leaveEvent(id)` on failure.
//
// Returned callable takes the full SCEvent (not just id) so callers
// don't need to look it up themselves — they typically already have
// the event in hand from the list they're rendering.

import { useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import type { SCEvent } from '@/types/domain';

export function useJoinEventHandler() {
  const joined = useStore(s => s.joined);
  const pendingLeave = useStore(s => s.pendingLeave);
  const joinStore = useStore(s => s.joinEvent);
  const leaveStore = useStore(s => s.leaveEvent);
  const schedulePendingLeave = useStore(s => s.schedulePendingLeave);
  const cancelPendingLeave = useStore(s => s.cancelPendingLeave);
  const showToast = useStore(s => s.showToast);

  return useCallback(async (event: SCEvent) => {
    const id = event.id;
    // Match the home screen's effective-joined predicate: a row in
    // `joined` that's also pending-leave should read as NOT joined,
    // so re-tapping while the UNDO toast is up performs a re-join.
    const isJoined = joined.has(id) && !pendingLeave.has(id);

    if (isJoined) {
      // Optimistic leave — schedule the grace timer first so the UI
      // flips and the UNDO toast is interactable. Commit the API
      // call in the background; an error surfaces as a separate toast.
      schedulePendingLeave(id);
      showToast({
        message: `Left "${event.title}". Removing in 5s.`,
        kind: 'info',
        duration: 5200,
        action: { label: 'UNDO', onPress: () => cancelPendingLeave(id) },
      });
      try {
        await api.cancelSubscription(id);
      } catch (err) {
        showToast({
          message: err instanceof Error
            ? `Couldn't leave: ${err.message}`
            : "Couldn't leave.",
          kind: 'error',
        });
      }
    } else {
      // Optimistic add — local first, then commit.
      joinStore(id);
      showToast({ message: `Joined "${event.title}".`, kind: 'success' });
      try {
        const result = await api.subscribeToEvent(id, true);
        // FR5.5: if the server places the join on the waitlist,
        // override the optimistic "Joined" toast with the waitlist
        // copy. Position is best-effort (a one-row follow-up SELECT
        // inside api.subscribeToEvent).
        if (result?.status === 'waitlisted') {
          showToast({
            message: typeof result.waitlist_position === 'number'
              ? `You're #${result.waitlist_position} on the waitlist for "${event.title}".`
              : `Added to waitlist for "${event.title}".`,
            kind: 'info',
          });
        }
      } catch (err) {
        // Roll back the optimistic add so the UI matches reality.
        leaveStore(id);
        showToast({
          message: err instanceof Error
            ? `Couldn't join: ${err.message}`
            : "Couldn't join.",
          kind: 'error',
        });
      }
    }
  }, [
    joined,
    pendingLeave,
    joinStore,
    leaveStore,
    schedulePendingLeave,
    cancelPendingLeave,
    showToast,
  ]);
}
