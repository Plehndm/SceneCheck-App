// Event detail — full port of SCEventScreen from src/screens.jsx.
// Includes hero accent panel, details card, description, attendees
// preview, host actions (edit/cancel for events you own), and the
// sticky bottom CTA (Join/Leave/Open chat).
//
// The legacy version pulled `window.SC_EVENT_OVERRIDES` for in-memory
// edit persistence; here that lives in the Zustand store as
// `eventOverrides`, so edits survive route changes without globals.

import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon, type IconName } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCTag } from '@/components/SCTag';
import { SCAvatar } from '@/components/SCAvatar';
import { SCAddButton } from '@/components/SCAddButton';
import { EditEventSheet } from '@/components/EditEventSheet';
import { RateEventSheet } from '@/components/RateEventSheet';
import { ShareEventSheet } from '@/components/ShareEventSheet';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useEvent } from '@/hooks/useEvent';
import { useAttendees } from '@/hooks/useAttendees';
import { useProfile } from '@/hooks/useProfile';
import { api } from '@/lib/api';
import { SC_CHATS } from '@/data/mocks';
import { whenRange } from '@/lib/date-time';
import { eventCategory, EVENT_CATEGORY_LABEL, isAlsoRecommended } from '@/lib/events';
import { pinColor } from '@/components/Map/types';
import { RADIUS } from '@/theme/tokens';

interface DetailRowProps {
  icon: IconName;
  k: string;
  v: string;
  last?: boolean;
  onPress?: () => void;
}

function DetailRow({ icon, k, v, last, onPress }: DetailRowProps) {
  const t = useTokens();
  const inner = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: RADIUS.md,
        backgroundColor: onPress ? t.primarySoft : t.subtle,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <SCIcon name={icon} size={16} color={onPress ? t.primary : t.ink2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <SCText size={14} weight="500">{k}</SCText>
        <SCText size={12} color={onPress ? t.primary : t.ink3} weight={onPress ? '600' : '400'} style={{ marginTop: 1 }}>
          {v}
        </SCText>
      </View>
      {onPress && <SCIcon name="chevron-right" size={14} color={t.ink3} />}
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>{inner}</Pressable>;
  }
  return inner;
}

export default function EventDetailScreen() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // useEvent: in mock mode this is synchronous (SC_EVENT_BY_ID lookup);
  // in live mode it hits `api.getEventById` and re-renders when the
  // promise resolves. `reload()` is called after a successful host
  // edit so the screen reflects the freshly-written row.
  const mock = api.isMock();
  const { event: baseEvent, reload: reloadEvent } = useEvent(id);
  const override = useStore(s => id ? s.eventOverrides[id] : null);
  const isJoined = useStore(s => id ? s.isJoined(id) : false);
  const joinEvent = useStore(s => s.joinEvent);
  const leaveEventStore = useStore(s => s.leaveEvent);
  const schedulePendingLeave = useStore(s => s.schedulePendingLeave);
  const cancelPendingLeave = useStore(s => s.cancelPendingLeave);
  const showToast = useStore(s => s.showToast);
  const showConfirm = useStore(s => s.showConfirm);
  const me = useStore(s => s.me);
  const meId = me.id;
  // Real attendees — live mode: confirmed event_subscriptions ⨝ profiles;
  // mock mode: SC_VISIBLE_PEOPLE. Drives the count + preview avatars.
  const { attendees, reload: reloadAttendees } = useAttendees(id);
  // The host's profile, so "Hosted by" can show their name + link to it.
  // (transformEventRow doesn't carry the host's name in live mode.)
  const { profile: host } = useProfile(baseEvent?.hostId ?? undefined);

  if (!baseEvent) {
    return (
      <Screen>
        <SCTopBar onBack={() => router.back()} />
        <View style={{ padding: 24, alignItems: 'center' }}>
          <View style={{
            width: 76, height: 76, borderRadius: 22,
            backgroundColor: t.subtle, alignItems: 'center', justifyContent: 'center',
            marginBottom: 18,
          }}>
            <SCIcon name="calendar" size={30} color={t.ink3} />
          </View>
          <SCText variant="displayTight" size={28}>This event is gone</SCText>
          <SCText size={13} color={t.ink3} style={{ marginTop: 12, lineHeight: 19, textAlign: 'center', maxWidth: 280 }}>
            The host may have cancelled it, or you may have lost access.
          </SCText>
        </View>
      </Screen>
    );
  }

  const e = { ...baseEvent, ...(override ?? {}) };
  // People actually attending. Merge yourself in optimistically when
  // you've joined (the attendees fetch won't have refreshed yet) so the
  // count + preview reflect your RSVP immediately.
  const goingPeople = (isJoined && !attendees.some(a => a.id === meId))
    ? [me, ...attendees]
    : attendees;
  const goingCount = goingPeople.length;
  // `kind === 'yours'` is the canonical signal from transformEventRow;
  // hostId comparison falls back to me.id (not the literal string 'me')
  // so host actions also appear in live mode where hostId is a UUID.
  // Round-2 code-review finding §2 Important.
  const isHost = e.kind === 'yours' || e.hostId === meId;
  // Label + hero accent both from the shared category (lib/events), so they
  // match the map legend and recolor/relabel as you add/remove interests.
  const label = EVENT_CATEGORY_LABEL[eventCategory(e, me.interests ?? [])];
  const accent = pinColor(e, t, me.interests ?? []);
  // A friend-hosted event that also matches your interests shows a second
  // "RECOMMENDED" pill next to the category label.
  const alsoRec = isAlsoRecommended(e, me.interests ?? []);

  const handleToggleJoin = async () => {
    if (!id) return;
    if (isJoined) {
      // Optimistic: schedule the local pending-leave grace timer first
      // so the UI flips immediately; the API call commits the leave to
      // the DB. If the API call fails, surface a separate error toast
      // — the pending-leave timer will still clear after 5s.
      schedulePendingLeave(id);
      showToast({
        message: `Left "${e.title}". Removing in 5s.`,
        kind: 'info', duration: 5200,
        action: { label: 'UNDO', onPress: () => cancelPendingLeave(id) },
      });
      try {
        await api.cancelSubscription(id);
      } catch (err) {
        showToast({
          message: err instanceof Error ? `Couldn't leave: ${err.message}` : "Couldn't leave.",
          kind: 'error',
        });
      }
    } else {
      // Optimistic add — local first, then commit.
      joinEvent(id);
      showToast({ message: `Joined "${e.title}".`, kind: 'success' });
      try {
        await api.subscribeToEvent(id, true);
      } catch (err) {
        // Roll back the optimistic add so the UI matches reality.
        leaveEventStore(id);
        showToast({
          message: err instanceof Error ? `Couldn't join: ${err.message}` : "Couldn't join.",
          kind: 'error',
        });
      }
    }
  };

  const handleCancelEvent = () => {
    if (!id) return;
    showConfirm({
      title: 'Cancel this event?',
      body: `"${e.title}" will be removed from the map and all ${goingCount} attendees will be notified. This can't be undone.`,
      confirmLabel: 'CANCEL EVENT',
      cancelLabel: 'KEEP IT',
      tone: 'danger',
      icon: 'x',
      onConfirm: async () => {
        try {
          // Soft-cancel via `api.cancelEvent` → sets status='cancelled'
          // in live mode; no-op in mock mode. After it succeeds we
          // navigate back; the home / map screens will re-fetch and
          // drop the row because `rank_events_query` filters on
          // `status='published'`.
          await api.cancelEvent(id);
          showToast({ message: `"${e.title}" cancelled. Attendees notified.`, kind: 'info' });
          router.back();
        } catch (err) {
          showToast({
            message: err instanceof Error ? `Couldn't cancel: ${err.message}` : "Couldn't cancel.",
            kind: 'error',
          });
        }
      },
    });
  };

  const handleOpenChat = async () => {
    // Mock: match the event chat in SC_CHATS. Live: find it in the user's
    // chats (normalize ids to UUIDs so a mock-id vs UUID mismatch can't hide
    // a match). No SC_* read in live mode.
    if (mock) {
      const chat = SC_CHATS.find(c => c.kind === 'event' && c.eventId === e.id);
      if (chat) router.push(`/chat/${chat.id}` as never);
      else showToast({ message: 'No group chat yet — it opens once attendees join.', kind: 'info' });
      return;
    }
    try {
      const chats = await api.getChats();
      const chat = chats.find(c => c.kind === 'event' && api.toUUID(c.eventId ?? '') === api.toUUID(e.id));
      if (chat) router.push(`/chat/${chat.id}` as never);
      else showToast({ message: 'No group chat yet — it opens once attendees join.', kind: 'info' });
    } catch {
      showToast({ message: "Couldn't open the chat. Try again.", kind: 'error' });
    }
  };

  return (
    <Screen contentContainerStyle={{ paddingBottom: 140 }} onRefresh={() => { reloadEvent(); reloadAttendees(); }}>
      {/* Hero panel — kept compact; the old 240px left a lot of dead space. */}
      <View style={{ position: 'relative', height: 120, backgroundColor: accent, overflow: 'hidden' }}>
        <SCTopBar
          onBack={() => router.back()}
          right={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setShareOpen(true)}
                accessibilityLabel="Share event with friends"
                style={({ pressed }) => [{
                  width: 38, height: 38, borderRadius: RADIUS.md,
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  alignItems: 'center', justifyContent: 'center',
                }, pressed && { opacity: 0.85 }]}
              >
                <SCIcon name="share" size={16} color={t.ink} />
              </Pressable>
              <Pressable
                onPress={handleOpenChat}
                accessibilityLabel="Open event chat"
                style={({ pressed }) => [{
                  width: 38, height: 38, borderRadius: RADIUS.md,
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  alignItems: 'center', justifyContent: 'center',
                }, pressed && { opacity: 0.85 }]}
              >
                <SCIcon name="send" size={16} color={t.ink} />
              </Pressable>
            </View>
          }
        />
        <View style={{
          position: 'absolute', bottom: 16, left: 18, right: 18,
          flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <View style={{
            backgroundColor: t.card,
            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
          }}>
            <SCText variant="mono" size={10} weight="600" color={t.ink}>{label}</SCText>
          </View>
          {alsoRec && (
            <View style={{
              backgroundColor: t.card,
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
            }}>
              <SCText variant="mono" size={10} weight="600" color={t.accentBlue}>RECOMMENDED</SCText>
            </View>
          )}
        </View>
      </View>

      {/* Title + tags */}
      <View style={{ paddingHorizontal: 18, paddingTop: 20 }}>
        <SCText variant="displayTight" size={30}>{e.title}</SCText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {e.interests.map(tag => <SCTag key={tag} tag={tag} size="md" tone="soft" />)}
        </View>
      </View>

      {/* Detail card */}
      <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
        <SCCard>
          <DetailRow
            icon="calendar"
            k={whenRange(e)}
            v={`${goingCount}/${e.cap} going${goingCount >= e.cap ? ' · waitlist' : ''}`}
          />
          <DetailRow
            icon="pin"
            k={e.where}
            v="Open on map →"
            // Open the Map tab focused on this event (selected + centered).
            onPress={() => router.push(`/(tabs)/map?focus=${e.id}` as never)}
          />
          {e.sourceUrl ? (
            // Scraped (app-created) events have no host — link to the original
            // listing the info was scraped from instead.
            <DetailRow
              icon="globe"
              k="Scraped event"
              v="View original listing →"
              last
              onPress={() => { Linking.openURL(e.sourceUrl!).catch(() => {}); }}
            />
          ) : (
            <DetailRow
              icon="people"
              k={`Hosted by ${e.host ?? host?.name ?? (e.hostId ? 'Host' : 'App-created')}`}
              v={e.hostId ? 'View profile →' : (e.kind === 'recommended' ? 'Auto-discovered' : '')}
              last
              // Tap a real host to open their profile; app-created events
              // (no creator) stay non-interactive.
              onPress={e.hostId ? () => router.push(`/profile/${e.hostId}` as never) : undefined}
            />
          )}
        </SCCard>
      </View>

      {/* About */}
      {!!e.desc && (
        <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          <SCText variant="labelCap" style={{ marginBottom: 6 }}>About</SCText>
          <SCText size={15} style={{ lineHeight: 22 }}>{e.desc}</SCText>
        </View>
      )}

      {/* Host actions */}
      {isHost && (
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 16 }}>
          <Pressable
            onPress={() => setEditOpen(true)}
            style={({ pressed }) => [{
              flex: 1, height: 44, borderRadius: RADIUS.md,
              borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            }, pressed && { opacity: 0.85 }]}
          >
            <SCIcon name="edit" size={13} color={t.ink} />
            <SCText variant="mono" size={11} weight="600">EDIT EVENT</SCText>
          </Pressable>
          <Pressable
            onPress={handleCancelEvent}
            style={({ pressed }) => [{
              flex: 1, height: 44, borderRadius: RADIUS.md,
              borderWidth: 1, borderColor: t.danger + '59', backgroundColor: t.card,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            }, pressed && { opacity: 0.85 }]}
          >
            <SCIcon name="x" size={13} color={t.danger} />
            <SCText variant="mono" size={11} weight="600" color={t.danger}>CANCEL EVENT</SCText>
          </Pressable>
        </View>
      )}

      {/* Attendees preview */}
      <Pressable
        onPress={() => router.push(`/attendees/${e.id}` as never)}
        style={({ pressed }) => [{
          marginHorizontal: 18, marginTop: 18, padding: 14,
          backgroundColor: t.card, borderWidth: 1, borderColor: t.line,
          borderRadius: RADIUS.lg,
        }, pressed && { opacity: 0.9 }]}
      >
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <SCText variant="labelCap">{goingCount} going</SCText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <SCText variant="mono" size={11} color={t.ink3}>VIEW ALL</SCText>
            <SCIcon name="chevron-right" size={12} color={t.ink3} />
          </View>
        </View>
        {goingCount === 0 ? (
          <SCText size={13} color={t.ink3}>No one&apos;s joined yet — be the first.</SCText>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {goingPeople.slice(0, 4).map((p, i) => (
              <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <SCAvatar person={p} size={36} />
              </View>
            ))}
            {goingCount > 4 && (
              <View style={{
                width: 36, height: 36, borderRadius: 18, backgroundColor: t.subtle,
                alignItems: 'center', justifyContent: 'center', marginLeft: -8,
              }}>
                <SCText variant="mono" size={11} weight="600">+{goingCount - 4}</SCText>
              </View>
            )}
          </View>
        )}
      </Pressable>

      {/* Bottom CTA */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 18, backgroundColor: t.surface,
        flexDirection: 'row', gap: 10,
      }}>
        <Pressable
          onPress={handleOpenChat}
          style={({ pressed }) => [{
            width: 56, height: 56, borderRadius: RADIUS.lg,
            borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
            alignItems: 'center', justifyContent: 'center',
          }, pressed && { opacity: 0.85 }]}
        >
          <SCIcon name="chat" size={20} color={t.ink} />
        </Pressable>
        {/* Rate the event — not on your own event (you don't rate yourself). */}
        {!isHost && (
          <Pressable
            onPress={() => setRateOpen(true)}
            accessibilityLabel="Rate this event"
            // Filled gold with a dark star so the rate-this-event affordance
            // stands out instead of blending into the card row.
            style={({ pressed }) => [{
              width: 56, height: 56, borderRadius: RADIUS.lg,
              borderWidth: 1, borderColor: t.warn, backgroundColor: t.warn,
              alignItems: 'center', justifyContent: 'center',
            }, pressed && { opacity: 0.85 }]}
          >
            <SCIcon name="star" size={22} color={t.warnInk} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <SCAddButton
            joined={isJoined}
            onPress={handleToggleJoin}
            label={goingCount >= e.cap ? 'JOIN WAITLIST' : 'JOIN EVENT'}
          />
        </View>
      </View>

      <EditEventSheet
        visible={editOpen}
        event={e}
        onClose={() => setEditOpen(false)}
        onSaved={() => reloadEvent()}
      />

      <RateEventSheet
        visible={rateOpen}
        eventId={e.id}
        eventTitle={e.title}
        onClose={() => setRateOpen(false)}
      />

      <ShareEventSheet
        visible={shareOpen}
        eventId={e.id}
        eventTitle={e.title}
        onClose={() => setShareOpen(false)}
      />
    </Screen>
  );
}
