// useNotifications — in-app notifications feed for the rail bell
// panel + the full-page notifications screen.
//
// SINGLETON PATTERN
// -----------------
// Several callers consume this hook simultaneously (WebShell wires the
// rail badge, WebActivityPanel renders the dropdown body, the full
// /notifications page renders the feed). Each is its own React
// component, so each gets its own hook instance — but they all want
// the same data + the same Realtime channel.
//
// Supabase's `client.channel(name)` returns the SAME channel instance
// if one with that topic already exists (joined or not). Calling `.on`
// on a channel that's already in the `joined` state throws
// `cannot add 'postgres_changes' callbacks ... after subscribe()`.
// That's exactly the error a multi-consumer setup would hit in dev
// (React 19 strict-mode double-mount makes it bite immediately).
//
// Fix: lift the subscription + the in-memory list to module scope.
// The first hook instance opens one subscription, runs one fetch, and
// fills `_cache`. Every other instance just subscribes to `_listeners`
// for re-renders. Refcount on mount/unmount tears the channel down
// when the last consumer leaves.
//
// Mock mode (api.isMock()): no Supabase client, so `data` stays `[]`
// and the page/panel show their empty state. There are no notification
// fixtures in `data/mocks.ts`.

import { useCallback, useEffect, useReducer, useState } from 'react';
import { supabase, isLiveBackendAvailable } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';

// Open shape: we don't constrain `type` here so a freshly added
// notification type (e.g. an `event_invite` after a future migration)
// surfaces without a code change. WebActivityRow switches on `.type`.
export interface NotificationRow {
  id: string;
  user_id?: string;
  type: string;
  payload_json?: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

interface UseNotificationsResult {
  data: NotificationRow[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

// ── Module-level singleton state ──────────────────────────────────
// Per-user cache. We only ever subscribe to one user at a time; on a
// user switch the active subscription tears down + the cache resets.
let _cache: NotificationRow[] = [];
let _activeUserId: string | null = null;
let _initialLoading = false;
let _initialError: Error | null = null;
let _hasFetched = false;
let _refCount = 0;
let _channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
const _listeners = new Set<() => void>();

function emit() {
  for (const l of _listeners) l();
}

function setCache(
  next: NotificationRow[] | ((prev: NotificationRow[]) => NotificationRow[]),
) {
  _cache = typeof next === 'function'
    ? (next as (prev: NotificationRow[]) => NotificationRow[])(_cache)
    : next;
  emit();
}

async function loadOnce(meId: string) {
  if (_hasFetched && _activeUserId === meId) return;
  _activeUserId = meId;
  _hasFetched = true;
  _initialLoading = true;
  _initialError = null;
  emit();
  try {
    const rows = await api.fetchNotifications();
    setCache((rows as NotificationRow[] | null) ?? []);
  } catch (e) {
    _initialError = e instanceof Error ? e : new Error(String(e));
  } finally {
    _initialLoading = false;
    emit();
  }
}

function openSubscription(meId: string) {
  if (_channel || !supabase) return;
  const client = supabase;
  _channel = client
    .channel(`notifications:${meId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${meId}`,
      },
      (payload) => {
        const row = payload.new as NotificationRow | undefined;
        if (!row?.id) return;
        setCache(prev =>
          prev.some(n => n.id === row.id) ? prev : [row, ...prev],
        );
      },
    )
    .subscribe();
}

function closeSubscription() {
  if (!_channel || !supabase) return;
  supabase.removeChannel(_channel);
  _channel = null;
}

function resetForUser(meId: string | null) {
  // Called when the signed-in user changes (sign-out, account switch).
  // Drops cached data + tears down the old subscription so the next
  // mount fetches fresh rows for the new user.
  closeSubscription();
  _activeUserId = meId;
  _cache = [];
  _hasFetched = false;
  _initialLoading = false;
  _initialError = null;
  emit();
}

// ── Hook ──────────────────────────────────────────────────────────

export function useNotifications(): UseNotificationsResult {
  const mock = api.isMock();
  const meId = useStore(s => s.me.id);
  // useReducer-as-forceUpdate so each component re-renders when _cache
  // mutates without owning local state for the rows themselves.
  const [, force] = useReducer((x: number) => x + 1, 0);
  // Mirror the singleton's loading/error into local state on each render
  // for the consumer's destructure. We read them from the closure on
  // every render, so a render tick after emit() picks up the latest.
  const [, setTickLE] = useState(0);

  // Subscribe to cache-change events (cheap fan-out).
  useEffect(() => {
    const l = () => {
      force();
      setTickLE(t => t + 1);
    };
    _listeners.add(l);
    return () => {
      _listeners.delete(l);
    };
  }, []);

  // Open/close the singleton subscription with a refcount. Last
  // consumer's unmount tears the channel down — useful for tests +
  // when the user signs out (RootLayout unmounts the whole tree).
  useEffect(() => {
    if (mock) return;
    if (!isLiveBackendAvailable() || !supabase || !meId) return;
    // User-switch: drop everything, reset, then proceed.
    if (_activeUserId && _activeUserId !== meId) resetForUser(meId);
    _refCount += 1;
    openSubscription(meId);
    // Fire-and-forget initial fetch (singleton-dedupe inside loadOnce).
    void loadOnce(meId);
    return () => {
      _refCount = Math.max(0, _refCount - 1);
      if (_refCount === 0) closeSubscription();
    };
  }, [mock, meId]);

  const reload = useCallback(() => {
    if (mock) return;
    if (!meId) return;
    _hasFetched = false;
    void loadOnce(meId);
  }, [mock, meId]);

  // Optimistic flip + server PATCH. We do NOT roll back on failure —
  // the read flag is purely a "you've seen it" hint; a stale-true is
  // less surprising than a flicker back to bold. Mutation errors are
  // intentionally SWALLOWED so they don't pollute `_initialError`,
  // which the page-level error toast / "couldn't load activity"
  // banner consumes — a transient PATCH failure on mark-as-read was
  // otherwise breaking every notifications consumer (M-03).
  const markRead = useCallback(async (id: string) => {
    setCache(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    if (mock) return;
    try {
      await api.markNotificationRead(id);
    } catch {
      // Best-effort. The optimistic flip stays.
    }
  }, [mock]);

  // Batch the same toggle. In live mode we issue ONE PATCH (eq user +
  // read=false) rather than N individual updates so a busy feed
  // doesn't fan out into a hundred requests. Same swallow-on-error
  // reasoning as markRead — a failed PATCH must not surface as a
  // "couldn't load activity" banner (M-03).
  const markAllRead = useCallback(async () => {
    setCache(prev => prev.map(n => (n.read ? n : { ...n, read: true })));
    if (mock) return;
    if (!isLiveBackendAvailable() || !supabase || !meId) return;
    try {
      const { error: pErr } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', meId)
        .eq('read', false);
      if (pErr) throw pErr;
    } catch {
      // Best-effort batch update.
    }
  }, [mock, meId]);

  return {
    data: _cache,
    loading: _initialLoading,
    error: _initialError,
    reload,
    markRead,
    markAllRead,
  };
}
