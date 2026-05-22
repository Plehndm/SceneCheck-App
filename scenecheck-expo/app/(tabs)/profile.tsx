// Profile tab — your own profile. Now wired to all the my-X sub-screens
// from Phase 4: hosting, friends, following, interests, ratings,
// settings, drafts.

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCAvatar } from '@/components/SCAvatar';
import { SCTag } from '@/components/SCTag';
import { SCSection } from '@/components/SCSection';
import { SCIcon, type IconName } from '@/components/SCIcon';
import { EditProfileSheet } from '@/components/EditProfileSheet';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useHostedEvents } from '@/hooks/useHostedEvents';
import { useRatings } from '@/hooks/useRatings';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useOutgoingRequests } from '@/hooks/useOutgoingRequests';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { summarizeRatings } from '@/lib/ratings';
import { RADIUS } from '@/theme/tokens';

export default function ProfileTab() {
  const [editOpen, setEditOpen] = useState(false);
  const t = useTokens();
  const me = useStore(s => s.me);
  const picture = useStore(s => s.picture);
  const setPicture = useStore(s => s.setPicture);
  const friends = useStore(s => s.friends);
  const following = useStore(s => s.following);
  // Request counts come from the same hooks the /requests screen uses, so the
  // hint always reflects the true, current in/out numbers (and matches what
  // you'll see on that screen) instead of a snapshot of the store sets.
  const { requests: incomingReqs } = useFriendRequests();
  const { people: outgoingReqs } = useOutgoingRequests();
  const drafts = useStore(s => s.drafts);
  const showToast = useStore(s => s.showToast);
  const showConfirm = useStore(s => s.showConfirm);

  const { picking, pick, error } = useImagePicker();
  // Dynamic stats: events you host + your rating summary, computed
  // from the same live hooks the other-profile screen uses.
  const { events: hostedEvents } = useHostedEvents(me.id);
  const { ratings: myRatings } = useRatings(me.id);
  const hostedCount = hostedEvents.length;
  const ratingSummary = summarizeRatings(myRatings);

  const handleChangePhoto = async () => {
    const next = await pick();
    if (next) {
      setPicture(next);
      showToast({ message: 'Profile photo updated.', kind: 'success' });
    } else if (error) {
      showToast({ message: error, kind: 'error' });
    }
  };

  const handleRemovePhoto = () => {
    showConfirm({
      title: 'Remove profile photo?',
      body: 'Your avatar will revert to your initials.',
      confirmLabel: 'REMOVE',
      tone: 'danger',
      onConfirm: () => {
        setPicture(null);
        showToast({ message: 'Photo removed.', kind: 'info' });
      },
    });
  };

  const accountWithPic = { ...me, picture: picture ?? me.picture };

  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 12 }}>
        <View style={{ position: 'relative' }}>
          <SCAvatar person={accountWithPic} size={96} />
          <Pressable
            onPress={handleChangePhoto}
            disabled={picking}
            style={({ pressed }) => [{
              position: 'absolute', right: -4, bottom: -4,
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: t.primary, borderWidth: 3, borderColor: t.pageBg,
              alignItems: 'center', justifyContent: 'center',
              opacity: picking ? 0.6 : 1,
            }, pressed && { opacity: 0.85 }]}
          >
            <SCIcon name="camera" size={14} color={t.primaryInk} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => setEditOpen(true)}
          accessibilityLabel="Edit display name"
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
          }, pressed && { opacity: 0.7 }]}
        >
          <SCText variant="displayTight" size={28}>{me.name || 'Set your name'}</SCText>
          <View style={{
            width: 26, height: 26, borderRadius: 13,
            backgroundColor: t.subtle,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <SCIcon name="edit" size={12} color={t.ink2} />
          </View>
        </Pressable>
        <SCText variant="mono" size={12} color={t.ink3} style={{ marginTop: 4 }}>
          @{me.username} · {me.city}
        </SCText>
        {picture && (
          <Pressable onPress={handleRemovePhoto} style={{ marginTop: 6 }}>
            <SCText variant="mono" size={10} weight="600" color={t.ink3}>REMOVE PHOTO</SCText>
          </Pressable>
        )}
      </View>

      <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
        <SCText size={14} color={t.ink2} style={{ lineHeight: 20 }}>{me.bio}</SCText>
      </View>

      {/* Stats — HOSTED + RATING are computed live from hosted events
          and received ratings; "—" when you have no ratings yet. */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
        <SCCard style={{ flexDirection: 'row', padding: 14, justifyContent: 'space-around' }}>
          <Stat label="HOSTED" value={String(hostedCount)} />
          <Stat label="ATTENDED" value={String(me.events_attended ?? 0)} />
          <Stat
            label="RATING"
            value={ratingSummary.average != null ? `${ratingSummary.average.toFixed(1)}★` : '—'}
          />
        </SCCard>
      </View>

      {/* Interests */}
      <SCSection title="INTERESTS" action={
        <Pressable onPress={() => router.push('/interests' as never)}>
          <SCText variant="mono" size={11} weight="600" color={t.ink2}>EDIT →</SCText>
        </Pressable>
      }>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(me.interests ?? []).map(tag => (
            <SCTag key={tag} tag={tag} size="sm" onPress={() => router.push(`/interests/${tag}` as never)} />
          ))}
        </View>
      </SCSection>

      {/* My stuff */}
      <SCSection title="MY STUFF">
        <SCCard>
          <Row icon="calendar" label="Events I'm hosting" v={String(hostedCount)} onPress={() => router.push('/my-hosting' as never)} />
          <Row icon="people" label="Friends" v={String(friends.size)} onPress={() => router.push('/my-friends' as never)} />
          <Row icon="user-plus" label="Friend requests" v={`${incomingReqs.length} in · ${outgoingReqs.length} sent`} onPress={() => router.push('/requests' as never)} />
          <Row icon="people" label="Following" v={String(following.size)} onPress={() => router.push('/my-following' as never)} />
          <Row icon="star" label="My ratings" v={ratingSummary.average != null ? `${ratingSummary.average.toFixed(1)}★ · ${ratingSummary.count}` : 'None yet'} onPress={() => router.push(`/ratings/${me.id}` as never)} />
          {drafts.length > 0 && (
            <Row icon="edit" label="Drafts" v={String(drafts.length)} onPress={() => router.push('/drafts' as never)} />
          )}
          <Row icon="settings" label="Settings" v="" last onPress={() => router.push('/settings' as never)} />
        </SCCard>
      </SCSection>

      {/* Create + Search shortcuts */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 18 }}>
        <Pressable
          onPress={() => router.push('/create-event' as never)}
          style={({ pressed }) => [{
            flex: 1, height: 52, borderRadius: RADIUS.lg,
            backgroundColor: t.primary,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          }, pressed && { opacity: 0.85 }]}
        >
          <SCIcon name="plus" size={16} color={t.primaryInk} />
          <SCText variant="mono" size={12} weight="700" color={t.primaryInk}>NEW EVENT</SCText>
        </Pressable>
        <Pressable
          onPress={() => router.push('/search' as never)}
          style={({ pressed }) => [{
            width: 52, height: 52, borderRadius: RADIUS.lg,
            borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
            alignItems: 'center', justifyContent: 'center',
          }, pressed && { opacity: 0.85 }]}
        >
          <SCIcon name="search" size={16} color={t.ink} />
        </Pressable>
      </View>

      <EditProfileSheet visible={editOpen} onClose={() => setEditOpen(false)} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTokens();
  return (
    <View style={{ alignItems: 'center' }}>
      <SCText variant="displayTight" size={24}>{value}</SCText>
      <SCText variant="mono" size={10} color={t.ink3} style={{ marginTop: 2 }}>{label}</SCText>
    </View>
  );
}

interface RowProps {
  icon: IconName;
  label: string;
  v: string;
  onPress: () => void;
  last?: boolean;
}

function Row({ icon, label, v, onPress, last }: RowProps) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line,
      }, pressed && { opacity: 0.85 }]}
    >
      <View style={{
        width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: t.subtle,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <SCIcon name={icon} size={16} color={t.ink2} />
      </View>
      <SCText size={14} weight="500" style={{ flex: 1 }}>{label}</SCText>
      {!!v && <SCText variant="mono" size={11} color={t.ink3}>{v}</SCText>}
      <SCIcon name="chevron-right" size={14} color={t.ink3} />
    </Pressable>
  );
}
