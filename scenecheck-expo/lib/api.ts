// SceneCheck API — dual-mode bridge between the frontend and Supabase.
//
// Ported from src/api.js with three structural changes the code review
// called out:
//   1. No more `window.supabase` / `window.SC_*` globals — everything
//      arrives via imports, which makes the module testable in isolation.
//   2. The mock toggle is no longer driven by an in-page Tweaks panel; it
//      flips automatically based on whether Supabase env vars are present
//      (or `EXPO_PUBLIC_USE_MOCK=1` is set).
//   3. Real types — every method's return shape is now declared.
//
// Mock-mode returns the static fixtures from data/mocks.ts so the UI can
// be developed before Supabase is provisioned.

import { supabase, isLiveBackendAvailable } from './supabase';
import { isoToTime, isoToWhen } from './date-time';
import {
  SC_ME, SC_EVENTS, SC_EVENT_BY_ID,
  SC_ACCOUNT_BY_ID, SC_INTERESTS_SUGGESTED, SC_INTERESTS_DETAILS,
  SC_CHATS, SC_THREADS,
  SC_VISIBLE_PEOPLE, SC_FRIEND_REQUESTS, SC_REVIEWS,
} from '@/data/mocks';
import type { SCEvent, Account, Chat, Message, Interest, Visibility, AccountType } from '@/types/domain';

// ── ID mapping (mock string IDs ↔ real UUIDs) ─────────────────
const ID_MAP: Record<string, string> = {
  'me': '00000000-0000-0000-0000-000000000001',
  'p1': '00000000-0000-0000-0000-000000000002',
  'p2': '00000000-0000-0000-0000-000000000003',
  'p3': '00000000-0000-0000-0000-000000000004',
  'p4': '00000000-0000-0000-0000-000000000005',
  'p5': '00000000-0000-0000-0000-000000000006',
  'p6': '00000000-0000-0000-0000-000000000007',
  'org1': '00000000-0000-0000-0000-000000000011',
  'org2': '00000000-0000-0000-0000-000000000012',
  'org3': '00000000-0000-0000-0000-000000000013',
  'orgA': '00000000-0000-0000-0000-000000000021',
  'orgB': '00000000-0000-0000-0000-000000000022',
  'orgC': '00000000-0000-0000-0000-000000000023',
  'orgD': '00000000-0000-0000-0000-000000000024',
  'e1': '20000000-0000-0000-0000-000000000001',
  'e2': '20000000-0000-0000-0000-000000000002',
  'e3': '20000000-0000-0000-0000-000000000003',
  'e4': '20000000-0000-0000-0000-000000000004',
  'e5': '20000000-0000-0000-0000-000000000005',
  'e6': '20000000-0000-0000-0000-000000000006',
  'e7': '20000000-0000-0000-0000-000000000007',
  'e8': '20000000-0000-0000-0000-000000000008',
  'e9': '20000000-0000-0000-0000-000000000009',
};
const REVERSE_ID: Record<string, string> = Object.fromEntries(
  Object.entries(ID_MAP).map(([k, v]) => [v, k])
);

export const toUUID = (mockId: string): string => ID_MAP[mockId] || mockId;
export const toMockId = (uuid: string): string => REVERSE_ID[uuid] || uuid;

// ── Row transforms (DB → in-memory shape) ─────────────────────
// Formatting is delegated to lib/date-time.ts so the legacy duplication
// between this module and the date helpers is eliminated.

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  source: string | null;
  creator_id: string | null;
  capacity: number | null;
  subscriber_count: number | null;
  event_interests?: { interest_id?: { name?: string } | null; name?: string }[];
}

function transformEventRow(row: EventRow, currentUserId: string | null): SCEvent {
  const creatorMockId = row.creator_id ? toMockId(row.creator_id) : null;
  const kind: SCEvent['kind'] = row.source === 'scraped'
    ? 'recommended'
    : row.creator_id === currentUserId
      ? 'yours'
      : 'friend'; // simplified — accurate version needs the friendship table
  return {
    id: toMockId(row.id),
    kind,
    hostId: creatorMockId,
    title: row.title,
    desc: row.description || '',
    interests: (row.event_interests || []).map(ei =>
      (typeof ei === 'string' ? ei : ei.interest_id?.name || ei.name || '') as string
    ),
    when: isoToWhen(row.start_at),
    endTime: isoToTime(row.end_at),
    where: row.location_name || '',
    attendees: row.subscriber_count || 0,
    cap: row.capacity || 0,
    rating: null,
    // Pass real coordinates through directly. components/Map/types.ts:eventLatLng
    // prefers `lat`/`lng` when present; x/y stay at a centered default so any
    // legacy fixture/consumer still gets a valid number.
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    x: 0.5,
    y: 0.5,
  };
}

// DB `profiles` row → in-memory Account. The table's PK is `user_id` and
// it stores `avatar_url` / `visibility` / `account_type`; the UI's Account
// uses `id` / `picture` / `privacy` / `type`. A bare `as Account` cast
// (the previous behaviour) left `id` undefined in live mode, which broke
// React list keys (`key={p.id}`) and profile-link navigation
// (`/profile/undefined`). This maps the columns explicitly.
interface ProfileRow {
  user_id: string;
  name?: string | null;
  username?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  visibility?: Visibility | null;
  account_type?: AccountType | null;
  avg_rating?: number | null;
}

function transformProfileRow(row: ProfileRow): Account {
  return {
    id: row.user_id,
    type: row.account_type ?? 'person',
    name: row.name ?? '',
    username: row.username ?? undefined,
    bio: row.bio ?? '',
    privacy: row.visibility ?? 'public',
    picture: row.avatar_url ?? null,
    rating: row.avg_rating ?? undefined,
  };
}

export const isMock = (): boolean => !isLiveBackendAvailable();

function requireClient() {
  if (!supabase) throw new Error('Supabase client not configured — set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY.');
  return supabase;
}

// ── API surface ───────────────────────────────────────────────
export const api = {
  isMock,
  toUUID,
  toMockId,

  // ── Auth ──
  async signUp(email: string, password: string, displayName?: string) {
    if (isMock()) return { user: SC_ME, session: { access_token: 'mock' } };
    const sb = requireClient();
    // Pass `emailRedirectTo` so the confirmation link doesn't depend
    // on the project's Site URL being correctly configured. On web we
    // can use the current origin; on native we route via the app's
    // URL scheme (configured in app.json). The destination is the
    // sign-in screen with ?confirmed=1 so the screen can show a
    // success banner once Supabase verifies the token + redirects.
    const emailRedirectTo = typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/auth/sign-in?confirmed=1`
      : 'scenecheckexpo://auth/sign-in?confirmed=1';
    const name = displayName?.trim();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        // Stamp the display name into auth.users metadata. This rides
        // along on the same row the SIGNED_IN session carries, so
        // AuthBootstrap.hydrate can read it immediately + race-free
        // via `session.user.user_metadata.display_name`. Without this
        // the hydrate would read the still-empty profiles.name (the
        // separate update below can land after the hydrate's read) and
        // fall back to the email — the bug this fixes.
        data: name ? { display_name: name } : undefined,
      },
    });
    if (error) throw error;
    // Belt-and-suspenders: also persist to profiles.name so anything
    // that reads the profiles table directly (other users viewing this
    // profile, the ratings join, etc.) sees the name. The metadata
    // above is what makes the *current user's* own display correct
    // instantly; this write makes it correct for everyone else too.
    const userId = data.user?.id;
    if (name && userId) {
      try {
        await sb.from('profiles')
          .update({ name })
          .eq('user_id', userId);
      } catch { /* swallow — name can be edited later from the profile tab */ }
    }
    return data;
  },

  async signIn(email: string, password: string) {
    if (isMock()) return { user: SC_ME, session: { access_token: 'mock' } };
    const sb = requireClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut(): Promise<void> {
    if (isMock()) return;
    await requireClient().auth.signOut();
  },

  // Re-send the confirmation email for an unconfirmed sign-up.
  // Supabase rate-limits this; the wrapper just propagates any error
  // up to the screen so the user sees a real toast.
  async resendConfirmation(email: string): Promise<{ ok: true }> {
    if (isMock()) return { ok: true };
    const { error } = await requireClient().auth.resend({ type: 'signup', email });
    if (error) throw error;
    return { ok: true };
  },

  // Kick off password recovery — Supabase emails the user a link
  // that lands on `${redirectTo}#access_token=…&type=recovery`.
  // supabase-js auto-creates a temporary session from that hash when
  // the page loads, which lets `auth.updateUser({ password })` work
  // on the reset-password screen.
  //
  // We compute `redirectTo` from window.location.origin on web; on
  // native we fall back to the app's URL scheme (scenecheckexpo://
  // configured in app.json). The native deep-link path needs
  // expo-linking config to actually open the app — currently this
  // flow is web-first; native users can still reset via the same
  // email link opened in a browser.
  async requestPasswordReset(email: string): Promise<{ ok: true }> {
    if (isMock()) return { ok: true };
    const redirectTo = typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/auth/reset-password`
      : 'scenecheckexpo://auth/reset-password';
    const { error } = await requireClient().auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return { ok: true };
  },

  // Change the signed-in user's email. Supabase sends a confirmation
  // to BOTH the old and new addresses; the email isn't switched until
  // both confirm (this is the default — projects can require only
  // the new address to confirm).
  async updateEmail(newEmail: string): Promise<{ ok: true }> {
    if (isMock()) return { ok: true };
    const { error } = await requireClient().auth.updateUser({ email: newEmail });
    if (error) throw error;
    return { ok: true };
  },

  // Change the signed-in user's password. Requires an active session
  // (the AuthGate ensures one exists before settings is reachable).
  async updatePassword(newPassword: string): Promise<{ ok: true }> {
    if (isMock()) return { ok: true };
    const { error } = await requireClient().auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { ok: true };
  },

  async getCurrentUser() {
    if (isMock()) return SC_ME;
    const { data } = await requireClient().auth.getUser();
    return data?.user ?? null;
  },

  // ── Events ──
  async fetchEvents(lat?: number, lng?: number, radiusM?: number): Promise<SCEvent[]> {
    if (isMock()) return SC_EVENTS;
    const sb = requireClient();
    const user = await this.getCurrentUser();
    const { data, error } = await sb.rpc('rank_events_query', {
      p_lat: lat ?? 33.6461,
      p_lng: lng ?? -117.8427,
      // p_radius is an INT in the RPC signature — round so a fractional
      // meters value (miles × 1609.34) doesn't fail function resolution.
      p_radius: Math.round(radiusM ?? 8047),
      p_user_id: (user && 'id' in user) ? user.id : null,
    });
    if (error) throw error;
    return (data || []).map((row: EventRow) =>
      transformEventRow(row, (user && 'id' in user) ? user.id : null)
    );
  },

  // All events created by a given host, regardless of status (so the
  // profile screen can show past + cancelled events too, not just the
  // discovery-ranked published ones `fetchEvents` returns). Ordered
  // newest-start first. Mock mode filters SC_EVENTS by hostId.
  async fetchEventsByHost(hostId: string): Promise<SCEvent[]> {
    if (isMock()) return SC_EVENTS.filter(e => e.hostId === hostId);
    const sb = requireClient();
    const { data, error } = await sb
      .from('events')
      .select('*, event_interests(interest_id(name))')
      .eq('creator_id', toUUID(hostId))
      .order('start_at', { ascending: false });
    if (error) throw error;
    const user = await this.getCurrentUser();
    const meId = (user && 'id' in user) ? user.id : null;
    return (data ?? []).map((row) => transformEventRow(row as EventRow, meId));
  },

  async getEventById(eventId: string): Promise<SCEvent | null> {
    if (isMock()) return SC_EVENT_BY_ID[eventId] || null;
    const sb = requireClient();
    const { data, error } = await sb
      .from('events')
      .select('*, event_interests(interest_id(name))')
      .eq('id', toUUID(eventId))
      .single();
    if (error) throw error;
    const user = await this.getCurrentUser();
    return transformEventRow(data as EventRow, (user && 'id' in user) ? user.id : null);
  },

  async createEvent(form: Record<string, unknown>) {
    if (isMock()) return { event_id: 'mock_' + Date.now() };
    const sb = requireClient();
    // The create-event function links tags by interest_id (UUID), but the
    // form carries tag *names*. Resolve names → ids so the tags actually
    // attach; unknown tags are simply dropped rather than failing publish.
    const body = { ...form };
    const names = form.interests as string[] | undefined;
    if (Array.isArray(names) && names.length) {
      const { data: rows } = await sb.from('interests').select('id, name').in('name', names);
      body.interests = (rows ?? []).map((r) => r.id as string);
    }
    const { data, error } = await sb.functions.invoke('create-event', { body });
    if (error) throw error;
    return data;
  },

  async subscribeToEvent(eventId: string, joinChat = false) {
    if (isMock()) return { status: 'confirmed' as const, chat_id: null };
    const { data, error } = await requireClient().functions.invoke('subscribe-to-event', {
      body: { event_id: toUUID(eventId), join_chat: joinChat },
    });
    if (error) throw error;
    return data;
  },

  // Remove the caller's row from event_subscriptions. The legacy used
  // a soft-delete (status='cancelled') so analytics could see leaves;
  // we follow the same shape so dispatch-notification can still find
  // the row if/when we add a "$user left your event" notification.
  async cancelSubscription(eventId: string) {
    if (isMock()) return { ok: true };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { error } = await sb.from('event_subscriptions')
      .update({ status: 'cancelled' })
      .eq('event_id', toUUID(eventId))
      .eq('user_id', user.id);
    if (error) throw error;
    return { ok: true };
  },

  // Host-only edit. Accepts the in-memory SCEvent shape and translates
  // to the DB column names (`location_name`, `capacity`, `description`).
  // `when` / `endTime` are intentionally NOT mapped here — those are
  // friendly strings ("Sat May 9 · 7:00 AM") that would need parsing
  // back into ISO timestamps. A dedicated start/end picker for editing
  // will land in a later phase; for now the field stays editable but
  // doesn't persist to the DB time columns.
  async updateEvent(
    eventId: string,
    patch: { title?: string; where?: string; cap?: number; desc?: string },
  ) {
    if (isMock()) return patch;
    const dbPatch: Record<string, unknown> = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.where !== undefined) dbPatch.location_name = patch.where;
    if (patch.cap !== undefined) dbPatch.capacity = patch.cap;
    if (patch.desc !== undefined) dbPatch.description = patch.desc;
    if (Object.keys(dbPatch).length === 0) return patch;
    const sb = requireClient();
    const { error } = await sb.from('events')
      .update(dbPatch)
      .eq('id', toUUID(eventId));
    if (error) throw error;
    return patch;
  },

  // Soft-cancel an event. `rank_events_query` filters on
  // `status='published'`, so flipping the column hides the event from
  // Home / Map / Search without losing the row (and the subscribers
  // table, so dispatch-notification can fan out cancellation emails).
  // RLS on the events table requires the caller to be the creator.
  async cancelEvent(eventId: string) {
    if (isMock()) return { ok: true };
    const sb = requireClient();
    const { error } = await sb.from('events')
      .update({ status: 'cancelled' })
      .eq('id', toUUID(eventId));
    if (error) throw error;
    return { ok: true };
  },

  // ── Profile ──
  async getProfile(userId: string): Promise<Account> {
    if (isMock()) return SC_ACCOUNT_BY_ID[userId] || SC_ME;
    const sb = requireClient();
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('user_id', toUUID(userId))
      .single();
    if (error) throw error;
    return transformProfileRow(data as ProfileRow);
  },

  async updateProfile(fields: Partial<Account>) {
    if (isMock()) return fields;
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    // Upsert (not update) so a missing profiles row is created instead of
    // silently matching zero rows + erroring on `.single()`. Keyed on
    // user_id; the self-insert RLS policy is migration 00016.
    const { data, error } = await sb
      .from('profiles')
      .upsert({ ...fields, user_id: user.id }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── Social ──
  async sendFriendRequest(targetId: string) {
    if (isMock()) return { status: 'pending' as const };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    // Insert the pending friendship directly. The friendships INSERT RLS
    // allows from_id = auth.uid() to any to_id (private accounts included),
    // so this needs no Edge Function — which removes the failure that made
    // the UI show BOTH a "request sent" and a "send failed" toast. It's
    // idempotent (re-requesting the same person is a no-op, not a UNIQUE
    // violation). The notification fan-out the send-friend-request function
    // did is dropped here; persisting the request is what the UI needs.
    const { error } = await sb
      .from('friendships')
      .upsert(
        { from_id: user.id, to_id: toUUID(targetId), status: 'pending' },
        { onConflict: 'from_id,to_id', ignoreDuplicates: true },
      );
    if (error) throw error;
    return { status: 'pending' as const };
  },

  async acceptFriendRequest(friendshipId: string) {
    if (isMock()) return { status: 'accepted' as const };
    const sb = requireClient();
    const { data, error } = await sb
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async blockUser(targetId: string) {
    if (isMock()) return { blocked: true as const };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { error } = await sb
      .from('blocks')
      .insert({ blocker_id: user.id, blocked_id: toUUID(targetId) });
    if (error) throw error;
    return { blocked: true as const };
  },

  // Decline a pending friend request. Soft-delete via status flip
  // (vs row delete) so dispatch-notification keeps a record. Pairs
  // with the existing acceptFriendRequest above.
  async declineFriendRequest(friendshipId: string) {
    if (isMock()) return { status: 'declined' as const };
    const sb = requireClient();
    const { error } = await sb
      .from('friendships')
      .update({ status: 'declined' })
      .eq('id', friendshipId);
    if (error) throw error;
    return { status: 'declined' as const };
  },

  // Drop a friendship row entirely. Either side can remove (RLS
  // policy 00011_create_rls_policies allows it where from_id =
  // auth.uid() OR to_id = auth.uid()).
  async removeFriend(otherUserId: string) {
    if (isMock()) return { ok: true };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const me = user.id;
    const other = toUUID(otherUserId);
    const { error } = await sb
      .from('friendships')
      .delete()
      .or(`and(from_id.eq.${me},to_id.eq.${other}),and(from_id.eq.${other},to_id.eq.${me})`);
    if (error) throw error;
    return { ok: true };
  },

  // Fetch the caller's accepted friends as full profile rows. In
  // mock mode returns SC_VISIBLE_PEOPLE unfiltered — the hook
  // narrows by the Zustand `friends` Set so the screen can stay
  // reactive to unfriend operations. In live mode does the
  // friendships ↔ profiles join in both directions and unions
  // client-side (Supabase doesn't have a built-in UNION through
  // PostgREST).
  async fetchFriends(): Promise<Account[]> {
    if (isMock()) return SC_VISIBLE_PEOPLE;
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const me = user.id;
    const [{ data: outRows }, { data: inRows }] = await Promise.all([
      sb.from('friendships')
        .select('to:profiles!friendships_to_id_fkey(*)')
        .eq('from_id', me)
        .eq('status', 'accepted')
        // to-one embed of the `profiles` row; override the array shape
        // supabase-js infers without generated DB types.
        .overrideTypes<{ to: ProfileRow | null }[], { merge: false }>(),
      sb.from('friendships')
        .select('from:profiles!friendships_from_id_fkey(*)')
        .eq('to_id', me)
        .eq('status', 'accepted')
        .overrideTypes<{ from: ProfileRow | null }[], { merge: false }>(),
    ]);
    // Map profiles rows → Account (user_id → id etc.) — not a bare cast,
    // so list keys + profile links work.
    const out = (outRows ?? []).flatMap(r => (r.to ? [transformProfileRow(r.to)] : []));
    const inn = (inRows ?? []).flatMap(r => (r.from ? [transformProfileRow(r.from)] : []));
    return [...out, ...inn];
  },

  // Pending incoming friend requests. Returns the legacy FriendRequest
  // shape (`{ id, personId, when, note }`) so the existing requests
  // screen stays as-is. Mock mode returns SC_FRIEND_REQUESTS; the
  // hook narrows by the store's `incomingRequests` Set.
  async fetchFriendRequests(): Promise<import('@/types/domain').FriendRequest[]> {
    if (isMock()) return SC_FRIEND_REQUESTS;
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { data, error } = await sb
      .from('friendships')
      .select('id, from_id, created_at')
      .eq('to_id', user.id)
      .eq('status', 'pending');
    if (error) throw error;
    return (data ?? []).map(r => ({
      id: r.id as string,
      personId: r.from_id as string,
      when: new Date(r.created_at as string).toLocaleDateString(),
      note: null,
    }));
  },

  // ── Interests ──
  // DB columns are `name` / `subscriber_count` / `description` /
  // `similar_tags`; the in-memory Interest type uses `tag` / `others`
  // / `desc` / `similar`. The transform here mirrors the shape the
  // rest of the app already expects (see `data/mocks.ts`).
  async searchInterests(query: string): Promise<Interest[]> {
    if (isMock()) {
      return SC_INTERESTS_SUGGESTED.filter(i =>
        i.tag.toLowerCase().includes(query.toLowerCase())
      );
    }
    const sb = requireClient();
    const q = sb.from('interests').select('name, description, subscriber_count, similar_tags');
    const filtered = query.trim().length > 0
      ? q.ilike('name', `%${query.trim()}%`)
      : q;
    const { data, error } = await filtered.order('subscriber_count', { ascending: false }).limit(50);
    if (error) throw error;
    return (data ?? []).map(row => ({
      tag: row.name as string,
      desc: (row.description as string) ?? '',
      others: (row.subscriber_count as number) ?? 0,
      similar: (row.similar_tags as string[]) ?? [],
    }));
  },

  // Single-tag lookup for the interest-detail screen. Returns null if
  // the tag isn't in the catalog (live mode) so the screen can show
  // an "unknown tag" state without crashing.
  async getInterest(tagName: string): Promise<Interest | null> {
    if (isMock()) return SC_INTERESTS_DETAILS[tagName] ?? null;
    const sb = requireClient();
    const { data, error } = await sb
      .from('interests')
      .select('name, description, subscriber_count, similar_tags')
      .eq('name', tagName)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      tag: data.name as string,
      desc: (data.description as string) ?? '',
      others: (data.subscriber_count as number) ?? 0,
      similar: (data.similar_tags as string[]) ?? [],
    };
  },

  async subscribeToInterest(interestId: string) {
    if (isMock()) return { subscribed: true as const };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { error } = await sb
      .from('user_interests')
      .insert({ user_id: user.id, interest_id: toUUID(interestId) });
    if (error) throw error;
    return { subscribed: true as const };
  },

  // A given user's interest tag names. `user_interests` is publicly
  // readable (RLS `USING (true)`), so this works for ANY account —
  // including private ones, whose interests we intentionally expose even
  // when the rest of their profile is hidden.
  async getInterestsForUser(userId: string): Promise<string[]> {
    if (isMock()) return SC_ACCOUNT_BY_ID[userId]?.interests ?? [];
    const sb = requireClient();
    const { data, error } = await sb
      .from('user_interests')
      .select('interests(name)')
      .eq('user_id', toUUID(userId))
      .overrideTypes<{ interests: { name: string } | null }[], { merge: false }>();
    if (error) throw error;
    return (data ?? [])
      .map(r => r.interests?.name)
      .filter((n): n is string => Boolean(n));
  },

  // Subscribe/unsubscribe the current user to an interest BY TAG NAME, so
  // the choice persists to `user_interests` (and survives reload, where
  // AuthBootstrap re-hydrates interests from the DB). Resolves the tag to
  // its `interests.id`, creating the interest row for a brand-new custom
  // tag. Idempotent. Mock mode is a no-op (the store + AsyncStorage hold it).
  async setInterestSubscribed(tag: string, subscribed: boolean) {
    if (isMock()) return { ok: true as const };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { data: existing } = await sb.from('interests').select('id').eq('name', tag).maybeSingle();
    let interestId = (existing?.id as string | undefined) ?? undefined;
    if (subscribed) {
      if (!interestId) {
        const { data: created, error: cErr } = await sb
          .from('interests').insert({ name: tag }).select('id').single();
        if (cErr) throw cErr;
        interestId = created.id as string;
      }
      const { error } = await sb.from('user_interests')
        .upsert({ user_id: user.id, interest_id: interestId }, { onConflict: 'user_id,interest_id', ignoreDuplicates: true });
      if (error) throw error;
    } else if (interestId) {
      const { error } = await sb.from('user_interests')
        .delete().eq('user_id', user.id).eq('interest_id', interestId);
      if (error) throw error;
    }
    return { ok: true as const };
  },

  // ── Chat ──
  async getChats(): Promise<Chat[]> {
    if (isMock()) return SC_CHATS;
    const sb = requireClient();
    const { data, error } = await sb
      .from('chats')
      .select('*, chat_members(user_id), messages(body, created_at, sender_id)')
      .order('created_at', { foreignTable: 'messages', ascending: false });
    if (error) throw error;
    return data as Chat[];
  },

  async getChatMessages(chatId: string): Promise<Message[]> {
    if (isMock()) return SC_THREADS[chatId] || [];
    const sb = requireClient();
    const { data, error } = await sb
      .from('messages')
      .select('*')
      .eq('chat_id', toUUID(chatId))
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data as Message[];
  },

  async sendMessage(chatId: string, body: string) {
    if (isMock()) return { id: 'mock_' + Date.now(), body };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { data, error } = await sb
      .from('messages')
      .insert({ chat_id: toUUID(chatId), sender_id: user.id, body })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  subscribeToChat(chatId: string, onMessage: (m: unknown) => void) {
    if (isMock()) return { unsubscribe: () => {} };
    const sb = requireClient();
    const uuid = toUUID(chatId);
    const channel = sb.channel(`messages:${uuid}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${uuid}`,
      }, (payload) => onMessage(payload.new))
      .subscribe();
    return { unsubscribe: () => { sb.removeChannel(channel); } };
  },

  // Create a new chat row + members. `memberIds` are the OTHER users
  // — the caller's own id is added automatically. Returns the new
  // chat id so the new-chat screen can navigate straight into the
  // thread.
  async createChat(
    memberIds: string[],
    type: 'dm' | 'group',
    title: string = '',
  ): Promise<{ id: string }> {
    if (isMock()) {
      // Mock-mode returns a stable id pattern the legacy router
      // already understands (used by new-chat.tsx pre-Phase-6).
      const prefix = type === 'dm' ? 'dm' : 'group';
      return { id: `${prefix}-${memberIds.join('-')}` };
    }
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { data: chatRow, error: chatErr } = await sb
      .from('chats')
      .insert({ type, title })
      .select('id')
      .single();
    if (chatErr) throw chatErr;
    const chatId = chatRow.id as string;
    const memberRows = [user.id, ...memberIds.map(toUUID)].map(uid => ({
      chat_id: chatId, user_id: uid,
    }));
    const { error: memErr } = await sb.from('chat_members').insert(memberRows);
    if (memErr) throw memErr;
    return { id: chatId };
  },

  // Fetch the confirmed attendees of an event as full Account rows.
  // Mock mode returns SC_VISIBLE_PEOPLE — the screen still treats
  // it as an opaque list. Live mode joins `event_subscriptions` to
  // `profiles` and filters status='confirmed'.
  async fetchAttendees(eventId: string): Promise<Account[]> {
    if (isMock()) return SC_VISIBLE_PEOPLE;
    const sb = requireClient();
    const { data, error } = await sb
      .from('event_subscriptions')
      .select('profile:profiles!event_subscriptions_user_id_fkey(*)')
      .eq('event_id', toUUID(eventId))
      .eq('status', 'confirmed')
      // to-one embed of the `profiles` row; override the array shape
      // supabase-js infers without generated DB types.
      .overrideTypes<{ profile: ProfileRow | null }[], { merge: false }>();
    if (error) throw error;
    // Map profiles rows → Account (user_id → id etc.) so keys + links work.
    return (data ?? []).flatMap(r => (r.profile ? [transformProfileRow(r.profile)] : []));
  },

  // Ratings table doesn't carry `host_id` directly — the host is
  // `events.creator_id`. We embed the events row via PostgREST
  // `!inner` so we can both join and filter by the host. Result is
  // mapped to the legacy `Review` shape the screen already uses.
  async fetchRatings(hostId: string): Promise<import('@/types/domain').Review[]> {
    if (isMock()) return SC_REVIEWS.filter(r => r.hostId === hostId);
    const sb = requireClient();
    const hostUuid = toUUID(hostId);
    const { data, error } = await sb
      .from('ratings')
      .select('event_id, user_id, stars, text, created_at, events!inner(creator_id)')
      .eq('events.creator_id', hostUuid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    interface Row {
      event_id: string;
      user_id: string;
      stars: number;
      text: string | null;
      created_at: string;
    }
    return (data ?? []).map((r: Row) => ({
      // The DB primary key is (event_id, user_id); compose a stable
      // id string so React keys + the screen's `r.id` filter still work.
      id: `${toMockId(r.event_id)}:${toMockId(r.user_id)}`,
      eventId: toMockId(r.event_id),
      hostId: hostId,
      reviewerId: toMockId(r.user_id),
      rating: r.stars,
      when: new Date(r.created_at).toLocaleDateString(),
      text: r.text ?? '',
    }));
  },

  // ── Notifications ──
  async fetchNotifications() {
    if (isMock()) return [];
    const sb = requireClient();
    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  },

  async markNotificationRead(notifId: string): Promise<void> {
    if (isMock()) return;
    await requireClient().from('notifications').update({ read: true }).eq('id', notifId);
  },

  // ── Ratings ──
  async rateEvent(eventId: string, stars: number, text: string) {
    if (isMock()) return { rated: true as const };
    const { data, error } = await requireClient().functions.invoke('rollup-rating', {
      body: { event_id: toUUID(eventId), stars, text },
    });
    if (error) throw error;
    return data;
  },

  // ── Reports ──
  async submitReport(
    targetUserId: string | null,
    targetEventId: string | null,
    reason: string,
    details?: string,
  ) {
    if (isMock()) return { reported: true as const };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { error } = await sb.from('reports').insert({
      reporter_id: user.id,
      target_user_id: targetUserId ? toUUID(targetUserId) : null,
      target_event_id: targetEventId ? toUUID(targetEventId) : null,
      reason,
      details: details || '',
    });
    if (error) throw error;
    return { reported: true as const };
  },
};

export type Api = typeof api;
