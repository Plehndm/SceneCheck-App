// Other-account profile — handles both people and orgs. The legacy
// codebase had separate SCProfileOther + SCOrgProfile screens; we
// branch on `person.type` so the route handles both.
//   - Person: friend/unfriend, message, block/report
//   - Org:    follow/unfollow, switch-to-account (if managed)
//
// Both surfaces share the events-by-this-account list and the ratings
// chip if there are reviews.

import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCTag } from '@/components/SCTag';
import { SCAvatar } from '@/components/SCAvatar';
import { SCButton } from '@/components/SCAddButton';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useProfile } from '@/hooks/useProfile';
import { useHostedEvents } from '@/hooks/useHostedEvents';
import { useRatings } from '@/hooks/useRatings';
import { useUserInterests } from '@/hooks/useUserInterests';
import { api } from '@/lib/api';
import { SC_VISIBLE_PERSON_BY_ID, SC_MY_ACCOUNTS, SC_ACCOUNT_BY_ID } from '@/data/mocks';
import { whenRange } from '@/lib/date-time';
import { summarizeRatings, ratingForEvent } from '@/lib/ratings';
import { RADIUS } from '@/theme/tokens';

export default function OtherProfileScreen() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  // `useProfile(id)` hits `profiles` in live mode and `SC_ACCOUNT_BY_ID`
  // in mock mode. The visibility gate still consults the mock
  // `VISIBLE_PERSON_BY_ID` table — in live mode the RLS layer
  // already enforces visibility, so anything `useProfile` returns
  // is implicitly visible.
  const mock = api.isMock();
  const { profile: person, loading, reload: reloadProfile } = useProfile(id);
  // Minimal fallback identity for a private account whose full row RLS
  // won't return to a non-friend. Mock-only: the id is a mock id, so
  // SC_ACCOUNT_BY_ID resolves enough — name, avatar, privacy — to render a
  // request card. In live mode the profiles SELECT policy returns the
  // public-safe row, so no fixture fallback is needed.
  const fallback = id && mock ? (SC_ACCOUNT_BY_ID[id] ?? null) : null;

  const friends = useStore(s => s.friends);
  const outgoing = useStore(s => s.outgoingRequests);
  const following = useStore(s => s.following);
  const addFriend = useStore(s => s.addFriend);
  const removeFriend = useStore(s => s.removeFriend);
  const sendRequestLocal = useStore(s => s.sendFriendRequest);
  const toggleFollow = useStore(s => s.toggleFollow);
  const showToast = useStore(s => s.showToast);
  const showConfirm = useStore(s => s.showConfirm);

  // Live in live mode, fixture-filtered in mock mode. Both hooks key
  // off `id` (the host's user id).
  const { events: hostedEvents, reload: reloadHosted } = useHostedEvents(id);
  const { ratings: reviews, reload: reloadReviews } = useRatings(id);
  // Interests come from `user_interests` (publicly readable), not the
  // profiles row — so they resolve even for a private account, which we
  // surface to non-friends (interests only; everything else stays hidden).
  const { interests: userInterests, reload: reloadInterests } = useUserInterests(id);
  // Count of events this person has attended (confirmed subscriptions). Their
  // own event_subscriptions rows are RLS-hidden from us, so this goes through
  // the attended_count RPC. 0 in mock mode.
  const [attendedCount, setAttendedCount] = useState<number | null>(null);
  useEffect(() => {
    if (!id) { setAttendedCount(null); return; }
    let cancelled = false;
    api.getAttendedCount(id)
      .then(n => { if (!cancelled) setAttendedCount(n); })
      .catch(() => { if (!cancelled) setAttendedCount(0); });
    return () => { cancelled = true; };
  }, [id]);
  const refreshProfile = () => { reloadProfile(); reloadHosted(); reloadReviews(); reloadInterests(); };
  const ratingSummary = summarizeRatings(reviews);
  const avgRating = ratingSummary.average != null ? ratingSummary.average.toFixed(1) : null;

  const meId = useStore(s => s.me.id);
  const subject = person ?? fallback;          // whoever we can name
  const subjectName = subject?.name ?? 'this person';
  const isPrivate = subject?.privacy === 'private';
  const isFriend = id ? friends.has(id) : false;
  const isPending = id ? outgoing.has(id) : false;
  const isSelf = !!id && id === meId;
  // A private account is fully visible only to its owner or an accepted
  // friend. For everyone else we show the minimal request card — never
  // interests / bio / hosted events. Enforced client-side in EVERY mode
  // (mock has no RLS; in live this backstops the profiles SELECT policy).
  const privateLocked = isPrivate && !isFriend && !isSelf;

  // Send a friend request. Persists in live mode — the friendships INSERT
  // RLS allows requesting ANY user, private accounts included — with an
  // optimistic store update (re-synced from the DB on the next hydrate).
  // In mock mode a public add is instant; private + every live add goes
  // to "pending" since only the recipient can accept.
  const requestFriend = async () => {
    if (!id || isFriend) return;
    if (isPending) {
      showToast({ message: 'Friend request pending.', kind: 'info' });
      return;
    }
    if (api.isMock()) {
      // Mock: public add is instant; private goes to "pending".
      if (isPrivate) sendRequestLocal(id); else addFriend(id);
      showToast({
        message: isPrivate ? `Request sent to ${subjectName}.` : `${subjectName} added as a friend.`,
        kind: 'success',
      });
      return;
    }
    // Live: every add is a pending request (only the recipient can accept).
    // Optimistically flip the button to "Pending", then persist — and show
    // exactly ONE toast (success XOR error), not both.
    sendRequestLocal(id);
    try {
      await api.sendFriendRequest(id);
      showToast({ message: `Request sent to ${subjectName}.`, kind: 'success' });
    } catch {
      showToast({ message: "Couldn't send request. Try again.", kind: 'error' });
    }
  };

  // ── Gating ──────────────────────────────────────────────────────────
  // Nothing identifiable yet: wait while a live fetch is in flight, else
  // the account is genuinely gone.
  if (!subject) {
    if (loading) {
      return (
        <Screen>
          <SCTopBar onBack={() => router.back()} />
        </Screen>
      );
    }
    return <Unavailable />;
  }

  // Private + not a friend (and not you): show ONLY their interests plus a
  // request card. Bio, ratings, hosted events, and message/safety actions
  // stay hidden until they accept.
  if (privateLocked) {
    return (
      <Screen>
        <SCTopBar onBack={() => router.back()} />
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 14 }}>
          <SCAvatar person={subject} size={96} />
          <SCText variant="displayTight" size={28} style={{ marginTop: 12 }}>{subject.name}</SCText>
          {!!subject.username && (
            <SCText variant="mono" size={12} color={t.ink3} style={{ marginTop: 4 }}>
              @{subject.username}
            </SCText>
          )}
        </View>

        {/* Bio + interests are shown on a private account; the rest isn't. */}
        {!!subject.bio && (
          <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
            <SCText size={14} color={t.ink2} style={{ lineHeight: 20, textAlign: 'center' }}>
              {subject.bio}
            </SCText>
          </View>
        )}
        {userInterests.length > 0 && (
          <View style={{ paddingHorizontal: 18, paddingBottom: 16 }}>
            <SCText variant="labelCap" style={{ marginBottom: 8 }}>Interests</SCText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {userInterests.map(tag => (
                <SCTag key={tag} tag={tag} size="sm" tone="soft" onPress={() => router.push(`/interests/${tag}` as never)} />
              ))}
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: 18, paddingBottom: 16 }}>
          <SCCard style={{ padding: 16, alignItems: 'center', gap: 8 }}>
            <View style={{
              width: 48, height: 48, borderRadius: 24, backgroundColor: t.subtle,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <SCIcon name="lock" size={20} color={t.ink3} />
            </View>
            <SCText size={15} weight="600">This account is private</SCText>
            <SCText size={13} color={t.ink3} style={{ textAlign: 'center', lineHeight: 18 }}>
              You can see {subject.name.split(' ')[0]}&apos;s bio and interests. Send a friend
              request to see the rest of their profile once they accept.
            </SCText>
          </SCCard>
        </View>
        <View style={{ paddingHorizontal: 18 }}>
          <SCButton
            label={isPending ? 'Request pending' : 'Send friend request'}
            onPress={requestFriend}
            variant={isPending ? 'secondary' : 'primary'}
          />
        </View>
      </Screen>
    );
  }

  // Not private-locked but the full row hasn't resolved (e.g. a public
  // profile mid-fetch): wait, then fall back to unavailable.
  if (!person) {
    if (loading) {
      return (
        <Screen>
          <SCTopBar onBack={() => router.back()} />
        </Screen>
      );
    }
    return <Unavailable />;
  }

  // Mock-mode visibility gate (the blocked-you fixtures). In live mode RLS
  // already decided — anything `useProfile` returned is visible (so we
  // short-circuit before touching any SC_* fixture).
  const isVisible = !mock || person.type === 'org' || (id ? !!SC_VISIBLE_PERSON_BY_ID[id] : false);
  if (!isVisible) return <Unavailable />;

  const isOrg = person.type === 'org';
  // Managed-account switching is a mock-only fixture for now; live managed
  // accounts would come from the managed_accounts table.
  const isManaged = mock && SC_MY_ACCOUNTS.some(a => a.id === id);
  const isFollowing = id ? following.has(id) : false;

  const handleFriendToggle = () => {
    if (!id) return;
    if (isFriend) {
      showConfirm({
        title: `Unfriend ${person.name}?`,
        body: 'You can re-add them later by sending a new request.',
        confirmLabel: 'UNFRIEND',
        tone: 'danger',
        onConfirm: () => {
          removeFriend(id);
          showToast({ message: `Unfriended ${person.name}.`, kind: 'info' });
        },
      });
    } else {
      requestFriend();
    }
  };

  const handleFollowToggle = () => {
    if (!id) return;
    toggleFollow(id);
    showToast({
      message: isFollowing ? `Unfollowed ${person.name}.` : `Following ${person.name}.`,
      kind: isFollowing ? 'info' : 'success',
    });
  };

  // Open (or create) a DM with this person via createChat — which returns the
  // real chat id in live mode (RPC) and the legacy dm-<id> stable id in mock.
  // Previously this navigated to a fabricated `dm-<id>` route, which in live
  // mode sent that non-UUID straight into the messages insert ("invalid input
  // syntax for type uuid").
  const handleMessage = async () => {
    if (!id) return;
    try {
      const { id: chatId } = await api.createChat([id], 'dm');
      router.push(`/chat/${chatId}` as never);
    } catch (e) {
      showToast({
        message: e instanceof Error ? `Couldn't open chat: ${e.message}` : "Couldn't open chat.",
        kind: 'error',
      });
    }
  };

  const handleBlock = () => {
    if (!id) return;
    showConfirm({
      title: `Block ${person.name}?`,
      body: 'They won\'t see you in the app, and you won\'t see them. You can unblock from Settings.',
      confirmLabel: 'BLOCK',
      tone: 'danger',
      onConfirm: () => {
        showToast({ message: `Blocked ${person.name}.`, kind: 'info' });
        router.back();
      },
    });
  };

  const handleReport = () => {
    showConfirm({
      title: `Report ${person.name}?`,
      body: 'Our team will review their account within 24 hours.',
      confirmLabel: 'SUBMIT REPORT',
      tone: 'danger',
      icon: 'flag',
      onConfirm: () => {
        showToast({ message: 'Report submitted. Thank you.', kind: 'success' });
      },
    });
  };

  return (
    <Screen onRefresh={refreshProfile}>
      <SCTopBar onBack={() => router.back()} />

      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 14 }}>
        <SCAvatar person={person} size={96} />
        <SCText variant="displayTight" size={28} style={{ marginTop: 12 }}>{person.name}</SCText>
        <SCText variant="mono" size={12} color={t.ink3} style={{ marginTop: 4 }}>
          {person.handle ?? (person.username ? `@${person.username}` : '')}
          {!isOrg && person.mutual ? ` · ${person.mutual} mutual` : ''}
          {isOrg && person.followers != null ? ` · ${person.followers.toLocaleString()} followers` : ''}
        </SCText>
      </View>

      <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
        <SCText
          size={14}
          color={person.bio ? t.ink2 : t.ink3}
          style={{ lineHeight: 20, textAlign: 'center', fontStyle: person.bio ? 'normal' : 'italic' }}
        >
          {person.bio || 'No bio yet.'}
        </SCText>
      </View>

      {/* Stats row (orgs) */}
      {isOrg && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, flexDirection: 'row', gap: 8 }}>
          <Stat label="FOLLOWERS" value={person.followers?.toLocaleString() ?? '0'} />
          <Stat label="EVENTS" value={String(hostedEvents.length)} />
          <Stat
            label="RATING"
            value={avgRating ? `${avgRating}★` : '—'}
            onPress={reviews.length > 0 ? () => router.push(`/ratings/${id}` as never) : undefined}
          />
        </View>
      )}

      {/* Stats row (people) — hosted / attended / rating, like your own tab. */}
      {!isOrg && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, flexDirection: 'row', gap: 8 }}>
          <Stat label="HOSTED" value={String(hostedEvents.length)} />
          <Stat label="ATTENDED" value={attendedCount != null ? String(attendedCount) : '—'} />
          <Stat
            label="RATING"
            value={avgRating ? `${avgRating}★` : '—'}
            onPress={reviews.length > 0 ? () => router.push(`/ratings/${id}` as never) : undefined}
          />
        </View>
      )}

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingBottom: 14 }}>
        {isOrg ? (
          isManaged ? (
            <View style={{ flex: 1 }}>
              <SCButton label="Switch to this account" onPress={() => router.replace('/(tabs)/profile' as never)} variant="secondary" />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <SCButton
                label={isFollowing ? 'Following · tap to unfollow' : 'Follow'}
                onPress={handleFollowToggle}
                variant={isFollowing ? 'secondary' : 'primary'}
              />
            </View>
          )
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <SCButton
                label={isFriend ? 'Friends' : isPending ? 'Pending' : person.privacy === 'private' ? 'Request' : 'Add'}
                onPress={handleFriendToggle}
                variant={isFriend ? 'secondary' : 'primary'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SCButton
                label="Message"
                onPress={handleMessage}
                variant="ghost"
              />
            </View>
          </>
        )}
      </View>

      {/* Interests */}
      {userInterests.length > 0 && (
        <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
          <SCText variant="labelCap" style={{ marginBottom: 8 }}>Interests</SCText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {userInterests.map(tag => (
              <SCTag key={tag} tag={tag} size="sm" tone="soft" onPress={() => router.push(`/interests/${tag}` as never)} />
            ))}
          </View>
        </View>
      )}

      {/* Ratings summary — shown for both people and orgs. Dynamically
          computed from this host's reviews; explicit "no ratings yet"
          when there are none. Tapping opens the full ratings list. */}
      <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
        <SCText variant="labelCap" style={{ marginBottom: 8 }}>Ratings</SCText>
        <Pressable
          onPress={ratingSummary.count > 0 ? () => router.push(`/ratings/${id}` as never) : undefined}
          disabled={ratingSummary.count === 0}
          style={({ pressed }) => [pressed && ratingSummary.count > 0 ? { opacity: 0.9 } : null]}
        >
          <SCCard style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <SCIcon name="star" size={18} color={ratingSummary.average != null ? t.warn : t.ink3} />
            {ratingSummary.average != null ? (
              <>
                <SCText variant="displayTight" size={20}>{avgRating}</SCText>
                <SCText variant="mono" size={11} color={t.ink3} style={{ flex: 1 }}>
                  · {ratingSummary.count} {ratingSummary.count === 1 ? 'review' : 'reviews'}
                </SCText>
                <SCIcon name="chevron-right" size={14} color={t.ink3} />
              </>
            ) : (
              <SCText size={13} color={t.ink3} style={{ flex: 1 }}>
                No ratings yet
              </SCText>
            )}
          </SCCard>
        </Pressable>
      </View>

      {/* Hosted events — each with its own per-event rating. */}
      <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
        <SCText variant="labelCap" style={{ marginBottom: 8 }}>
          {isOrg ? 'Events posted' : 'Hosting'}
        </SCText>
        {hostedEvents.length === 0 ? (
          <SCCard style={{ padding: 16, alignItems: 'center' }}>
            <SCText size={13} color={t.ink3}>
              {isOrg ? 'No events posted yet.' : 'Not hosting anything right now.'}
            </SCText>
          </SCCard>
        ) : (
          <View style={{ gap: 8 }}>
            {hostedEvents.map(e => {
              const er = ratingForEvent(reviews, e.id);
              return (
                <Pressable
                  key={e.id}
                  onPress={() => router.push(`/event/${e.id}` as never)}
                  style={({ pressed }) => [pressed && { opacity: 0.9 }]}
                >
                  <SCCard style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: t.primarySoft,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <SCIcon name="calendar" size={16} color={t.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <SCText variant="display" size={14}>{e.title}</SCText>
                      <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                        {whenRange(e)} · {e.attendees}/{e.cap}
                      </SCText>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <SCIcon name="star" size={11} color={er.average != null ? t.warn : t.ink3} />
                        <SCText variant="mono" size={10} color={t.ink3}>
                          {er.average != null
                            ? `${er.average.toFixed(1)} · ${er.count} ${er.count === 1 ? 'review' : 'reviews'}`
                            : 'No ratings yet'}
                        </SCText>
                      </View>
                    </View>
                    <SCIcon name="chevron-right" size={14} color={t.ink3} />
                  </SCCard>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Safety actions (people only — orgs use Report flow elsewhere) */}
      {!isOrg && (
        <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
          <SCText variant="labelCap" style={{ marginBottom: 8 }}>Safety</SCText>
          <SCCard>
            <Pressable
              onPress={handleBlock}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                borderBottomWidth: 1, borderBottomColor: t.line,
              }, pressed && { opacity: 0.85 }]}
            >
              <SCIcon name="shield" size={18} color={t.danger} />
              <SCText size={14} weight="500" color={t.danger} style={{ flex: 1 }}>
                Block {person.name}
              </SCText>
              <SCIcon name="chevron-right" size={14} color={t.ink3} />
            </Pressable>
            <Pressable
              onPress={handleReport}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
              }, pressed && { opacity: 0.85 }]}
            >
              <SCIcon name="flag" size={18} color={t.ink2} />
              <SCText size={14} weight="500" style={{ flex: 1 }}>Report account</SCText>
              <SCIcon name="chevron-right" size={14} color={t.ink3} />
            </Pressable>
          </SCCard>
        </View>
      )}
    </Screen>
  );
}

// Shown when a profile is genuinely hidden (blocked, or doesn't exist).
// Private accounts get the dedicated request card instead (see above).
function Unavailable() {
  const t = useTokens();
  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} />
      <View style={{ padding: 40, alignItems: 'center' }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32, backgroundColor: t.subtle,
          alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <SCIcon name="lock" size={24} color={t.ink3} />
        </View>
        <SCText size={17} weight="600">Profile unavailable</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6, textAlign: 'center' }}>
          This account isn&apos;t visible to you.
        </SCText>
      </View>
    </Screen>
  );
}

function Stat({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const t = useTokens();
  const inner = (
    <SCCard style={{ flex: 1, padding: 12, alignItems: 'center' }}>
      <SCText variant="displayTight" size={20}>{value}</SCText>
      <SCText variant="mono" size={10} color={t.ink3} style={{ marginTop: 2 }}>{label}</SCText>
    </SCCard>
  );
  if (onPress) {
    return <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.85 }]}>{inner}</Pressable>;
  }
  return inner;
}
