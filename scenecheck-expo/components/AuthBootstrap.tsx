// Auth bootstrap — mounted once at the root layout. In live mode this
// is the single source of truth for the Zustand `session` + `me`
// slices; in mock mode (no Supabase env vars) it short-circuits to a
// no-op.
//
// Responsibilities:
//
//   1. Restore an existing session on app load. supabase-js's
//      `persistSession` writes to our SSR-safe `kvStorage` adapter, so
//      a page reload re-hydrates from localStorage on web and
//      AsyncStorage on native. We just need to react to it.
//
//   2. Mirror the auth state into `session`. `components/AuthGate.tsx`
//      reads this to decide whether to redirect unauthenticated visitors
//      to /auth/sign-in.
//
//   3. Hydrate the social slices (`me`, `joined`,
//      `outgoingRequests` / `incomingRequests`, `friends`,
//      `subscribedInterests`) from the matching tables whenever the
//      session changes. On SIGNED_OUT we reset everything to the
//      anonymous SC_ME defaults so the rest of the app keeps rendering.

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toMockId } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { SC_ME } from '@/data/mocks';
import type { Account } from '@/types/domain';

interface FriendshipRow {
  id: string;
  from_id: string;
  to_id: string;
  status: 'pending' | 'accepted' | 'declined';
}

interface SubscriptionRow {
  event_id: string;
}

interface OrgFollowRow {
  org_id: string;
}

export function AuthBootstrap() {
  const setMe = useStore(s => s.setMe);
  const setSession = useStore(s => s.setSession);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    // `metaName` is the display name stamped into the auth user's
    // metadata at sign-up time (api.signUp passes `options.data.
    // display_name`). It's part of the auth.users row, so it's
    // available immediately + race-free — unlike `profiles.name`,
    // which api.signUp writes in a separate statement that can land
    // AFTER this hydrate's profile read. Resolution order below is
    // therefore: live profiles.name → metadata name → email prefix.
    async function hydrate(userId: string, email: string | null, metaName?: string | null) {
      // Account switch: drop the previous user's locally-picked photo
      // overrides. `picture` / `orgPictures` are persisted and NOT tied to
      // a user, so without this, signing in as someone else keeps your old
      // avatar. `me.id` is persisted too, so it reliably names the last
      // hydrated user: a plain reload (same id) keeps the photo; a
      // different sign-in clears it.
      if (useStore.getState().me.id !== userId) {
        useStore.setState({ picture: null, orgPictures: {} });
      }

      // Fire every read in parallel — none depend on each other.
      const [
        { data: profile },
        { data: tagRows },
        { data: subRows },
        { data: friendshipRows },
        { data: followRows },
      ] = await Promise.all([
        supabase!.from('profiles')
          .select('name, username, bio, visibility, account_type, avatar_url')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase!.from('user_interests')
          .select('interests(name)')
          .eq('user_id', userId)
          // `interests` is a to-one embed (one interest per row), but
          // without generated DB types supabase-js widens every embed to
          // an array. Declare the real object shape.
          .overrideTypes<{ interests: { name: string } | null }[], { merge: false }>(),
        // Confirmed subscriptions = events the user has joined.
        // (Waitlisted/removed/cancelled are kept out of `joined`.)
        supabase!.from('event_subscriptions')
          .select('event_id')
          .eq('user_id', userId)
          .eq('status', 'confirmed'),
        // Both sides of the friendship table. We split by status +
        // direction below into the three Zustand sets.
        supabase!.from('friendships')
          .select('id, from_id, to_id, status')
          .or(`from_id.eq.${userId},to_id.eq.${userId}`),
        // Org follows (FR7.1, migration 00034). The store's `following` Set
        // was previously client-only — without this hydrate, signing in
        // on a fresh device showed no followed orgs, even if the user had
        // followed several from another device.
        supabase!.from('org_follows')
          .select('org_id')
          .eq('user_id', userId),
      ]);

      if (cancelled) return;

      // Profile + interests.
      const interests = (tagRows ?? [])
        .map(r => r.interests?.name)
        .filter((n): n is string => Boolean(n));

      // Self-heal a missing profiles row. The handle_new_user trigger
      // creates one at sign-up, but accounts made before that migration
      // (or added via the dashboard) have an auth.users row with no
      // matching profiles row — which is why they "don't show in the
      // profiles table." Upsert a skeleton so the row exists. Best-effort:
      // needs the self-insert RLS policy (migration 00016); a failure
      // (e.g. policy not applied yet) must not break sign-in.
      if (!profile) {
        await supabase!.from('profiles')
          .upsert(
            { user_id: userId, account_type: 'person', name: metaName?.trim() || '' },
            { onConflict: 'user_id' },
          )
          .then(() => {}, () => {});
      }

      const dbName = (profile?.name as string | undefined)?.trim();
      const profilePatch: Partial<Account> = {
        id: userId,
        type: (profile?.account_type as 'person' | 'org' | null) ?? 'person',
        // Prefer the persisted profile name; fall back to the auth-
        // metadata display name (race-free at sign-up); only then to
        // the email *prefix* (never the full email — that's what made
        // the header read like an address).
        name: dbName || metaName?.trim() || email?.split('@')[0] || 'You',
        username: (profile?.username as string | undefined) || email?.split('@')[0] || undefined,
        bio: (profile?.bio as string | undefined) ?? '',
        interests,
        privacy: ((profile?.visibility as 'public' | 'private' | undefined) ?? 'public'),
        picture: (profile?.avatar_url as string | undefined) ?? null,
      };
      setMe(profilePatch);

      // Joined events. Map through toMockId so these match the ids the rest
      // of the app uses: transformEventRow stamps every event id with
      // toMockId(row.id) (seeded events → 'e1'… ; real events unchanged), so
      // the raw event_id here would never equal the screen's `id` for seeded
      // events — leaving the join/leave button stuck on the wrong state.
      const joined = new Set<string>(
        (subRows ?? []).map((r: SubscriptionRow) => toMockId(r.event_id)),
      );

      // Friend graph splits:
      //   - accepted (either direction) → friends
      //   - pending where I'm the sender (from_id = me) → outgoing
      //   - pending where I'm the recipient (to_id = me) → incoming
      const friends = new Set<string>();
      const outgoing = new Set<string>();
      const incoming = new Set<string>();
      for (const r of (friendshipRows ?? []) as FriendshipRow[]) {
        if (r.status === 'accepted') {
          friends.add(r.from_id === userId ? r.to_id : r.from_id);
        } else if (r.status === 'pending') {
          if (r.from_id === userId) outgoing.add(r.to_id);
          // For incoming we key by the friendship row id rather than
          // the sender id — the store's accept/decline calls reference
          // this id.
          else if (r.to_id === userId) incoming.add(r.id);
        }
      }

      const subscribedInterests = new Set<string>(interests);

      // Map followed-org UUIDs through toMockId so seeded mock orgs survive
      // a hybrid mock/live transition (parity with the joined-events mapping).
      const following = new Set<string>(
        (followRows ?? []).map((r: OrgFollowRow) => toMockId(r.org_id)),
      );

      useStore.setState({
        joined,
        friends,
        outgoingRequests: outgoing,
        incomingRequests: incoming,
        subscribedInterests,
        following,
      });
    }

    function reset() {
      setMe({ ...SC_ME });
      useStore.setState({
        joined: new Set(),
        friends: new Set(),
        outgoingRequests: new Set(),
        incomingRequests: new Set(),
        subscribedInterests: new Set(),
        // Clear the locally-picked photo overrides so a signed-out (or
        // next) account doesn't inherit the previous user's avatar.
        picture: null,
        orgPictures: {},
      });
    }

    const metaDisplayName = (u: { user_metadata?: { display_name?: string } } | null | undefined) =>
      u?.user_metadata?.display_name ?? null;

    // Authorize the Realtime socket with the user's JWT. RLS-scoped
    // postgres_changes (chat messages) are only delivered to a socket carrying
    // the user's token — without this, the OTHER chat member receives no live
    // INSERT events. supabase-js wires this on token change, but we set it
    // explicitly so the token is present before the first channel subscribes
    // (a known React-Native timing gap).
    const authorizeRealtime = (token: string | null) => {
      try { supabase!.realtime.setAuth(token); } catch { /* socket not up yet — fine */ }
    };

    // 1. Initial session check (fires once at mount).
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session?.user) {
        authorizeRealtime(session.access_token);
        setSession({ userId: session.user.id, email: session.user.email ?? null });
        hydrate(session.user.id, session.user.email ?? null, metaDisplayName(session.user));
      } else {
        setSession(null);
      }
    });

    // 2. Subscribe to all subsequent auth events.
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          authorizeRealtime(session.access_token);
          setSession({ userId: session.user.id, email: session.user.email ?? null });
          hydrate(session.user.id, session.user.email ?? null, metaDisplayName(session.user));
        }
      }
      if (event === 'SIGNED_OUT') {
        authorizeRealtime(null);
        setSession(null);
        reset();
      }
    });

    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, [setMe, setSession]);

  return null;
}
