// Other-account profile — handles both people and orgs. The legacy
// codebase had separate SCProfileOther + SCOrgProfile screens; we
// branch on `person.type` so the route handles both.
//   - Person: friend/unfriend, message, block/report
//   - Org:    follow/unfollow, switch-to-account (if managed)
//
// Both surfaces share the events-by-this-account list and the ratings
// chip if there are reviews.

import { useMemo } from 'react';
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
import { api } from '@/lib/api';
import {
  SC_EVENTS, SC_VISIBLE_PERSON_BY_ID, SC_REVIEWS, SC_MY_ACCOUNTS,
} from '@/data/mocks';
import { whenRange } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';

export default function OtherProfileScreen() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  // `useProfile(id)` hits `profiles` in live mode and `SC_ACCOUNT_BY_ID`
  // in mock mode. The visibility gate still consults the mock
  // `VISIBLE_PERSON_BY_ID` table — in live mode the RLS layer
  // already enforces visibility, so anything `useProfile` returns
  // is implicitly visible.
  const { profile: person } = useProfile(id);
  const isVisible = id
    ? person?.type === 'org' || !!SC_VISIBLE_PERSON_BY_ID[id] || !api.isMock()
    : false;

  const friends = useStore(s => s.friends);
  const outgoing = useStore(s => s.outgoingRequests);
  const following = useStore(s => s.following);
  const addFriend = useStore(s => s.addFriend);
  const removeFriend = useStore(s => s.removeFriend);
  const sendFriendRequest = useStore(s => s.sendFriendRequest);
  const toggleFollow = useStore(s => s.toggleFollow);
  const showToast = useStore(s => s.showToast);
  const showConfirm = useStore(s => s.showConfirm);

  const hostedEvents = useMemo(
    () => (id ? SC_EVENTS.filter(e => e.hostId === id) : []),
    [id],
  );
  const reviews = useMemo(
    () => (id ? SC_REVIEWS.filter(r => r.hostId === id) : []),
    [id],
  );
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  if (!person || !isVisible) {
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

  const isOrg = person.type === 'org';
  const isManaged = SC_MY_ACCOUNTS.some(a => a.id === id);
  const isFriend = id ? friends.has(id) : false;
  const isPending = id ? outgoing.has(id) : false;
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
    } else if (isPending) {
      showToast({ message: 'Friend request pending.', kind: 'info' });
    } else {
      if (person.privacy === 'private') {
        sendFriendRequest(id);
        showToast({ message: `Request sent to ${person.name}.`, kind: 'success' });
      } else {
        addFriend(id);
        showToast({ message: `${person.name} added as a friend.`, kind: 'success' });
      }
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
    <Screen>
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

      {!!person.bio && (
        <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
          <SCText size={14} color={t.ink2} style={{ lineHeight: 20, textAlign: 'center' }}>
            {person.bio}
          </SCText>
        </View>
      )}

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
                onPress={() => router.push(`/chat/dm-${id}` as never)}
                variant="ghost"
              />
            </View>
          </>
        )}
      </View>

      {/* Interests */}
      {!!person.interests?.length && (
        <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
          <SCText variant="labelCap" style={{ marginBottom: 8 }}>Interests</SCText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {person.interests.map(tag => (
              <SCTag key={tag} tag={tag} size="sm" tone="soft" onPress={() => router.push(`/interests/${tag}` as never)} />
            ))}
          </View>
        </View>
      )}

      {/* Hosted events */}
      {hostedEvents.length > 0 && (
        <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
          <SCText variant="labelCap" style={{ marginBottom: 8 }}>
            {isOrg ? 'Events posted' : 'Hosting'}
          </SCText>
          <View style={{ gap: 8 }}>
            {hostedEvents.map(e => (
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
                  </View>
                  <SCIcon name="chevron-right" size={14} color={t.ink3} />
                </SCCard>
              </Pressable>
            ))}
          </View>
        </View>
      )}

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
