// Attendees roster for an event. Excludes anyone who has blocked the
// viewer (handled by SC_VISIBLE_PEOPLE).
//
// FR5.10 — when the viewer is the event's creator, each row gains a small
// "Remove" affordance that confirms then calls api.organizerRemove. Removal
// pulls the user out of event_subscriptions AND chat_members (handled
// server-side by the organizer-remove Edge Function). The host can't remove
// themselves; the affordance hides on their own row.

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCAvatar } from '@/components/SCAvatar';
import { SCListSkeleton } from '@/components/SCSkeleton';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useEvent } from '@/hooks/useEvent';
import { useAttendees } from '@/hooks/useAttendees';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';
import type { Account } from '@/types/domain';

export default function AttendeesScreen() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  // useEvent: mock-mode sync from SC_EVENT_BY_ID, live from
  // api.getEventById. useAttendees: live joins event_subscriptions ⨝
  // profiles for confirmed rows; mock returns SC_VISIBLE_PEOPLE so
  // the existing screen test still sees the full roster.
  const { event, reload: reloadEvent } = useEvent(id);
  const { attendees: serverAttendees, loading, reload: reloadAttendees } = useAttendees(id);
  const meId = useStore(s => s.me.id);
  const showToast = useStore(s => s.showToast);
  const showConfirm = useStore(s => s.showConfirm);

  // FR5.10 — local override so the optimistic-then-commit + rollback pattern
  // is observable while the api call is in flight. The set holds ids of
  // attendees we've removed; on api error we re-add the id to the
  // displayed list by clearing it from this set.
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const visible = serverAttendees.filter(a => !removed.has(a.id));

  if (!event) {
    return (
      <Screen>
        <SCTopBar onBack={() => router.back()} title="Attendees" />
        <View style={{ padding: 24 }}>
          <SCText size={14} color={t.ink2}>Event not found.</SCText>
        </View>
      </Screen>
    );
  }

  // FR5.10 gate. The host owns the event; everyone else sees the read-only
  // roster. `hostId === meId` is the canonical check that works in both
  // mock and live (where `kind === 'yours'` may not be propagated through
  // the attendee fetch path).
  const isHost = !!event.hostId && event.hostId === meId;

  const removeAttendee = (person: Account) => {
    if (!id) return;
    showConfirm({
      title: `Remove ${person.name}?`,
      body: 'They will be removed from the event and the group chat.',
      confirmLabel: 'REMOVE',
      cancelLabel: 'KEEP',
      tone: 'danger',
      icon: 'trash',
      onConfirm: async () => {
        // Optimistic: hide the row immediately so the host sees the result.
        setRemoved(prev => {
          const next = new Set(prev);
          next.add(person.id);
          return next;
        });
        try {
          await api.organizerRemove(id, person.id);
          showToast({
            message: `${person.name} removed from "${event.title}".`,
            kind: 'info',
          });
          // Refresh both event (attendee count) and the roster so the next
          // render is sourced from the server rather than the local override.
          reloadAttendees();
          reloadEvent();
        } catch (e) {
          // Roll back the local hide and surface the error.
          setRemoved(prev => {
            const next = new Set(prev);
            next.delete(person.id);
            return next;
          });
          showToast({
            message: e instanceof Error
              ? `Couldn't remove ${person.name}: ${e.message}`
              : `Couldn't remove ${person.name}.`,
            kind: 'error',
          });
        }
      },
    });
  };

  return (
    <Screen onRefresh={() => { reloadEvent(); reloadAttendees(); }}>
      <SCTopBar onBack={() => router.back()} subtitle={event.title.toUpperCase()} title="Going" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="labelCap">{visible.length} of {event.attendees} going</SCText>
        <SCText variant="displayTight" size={32} style={{ marginTop: 4 }}>Attendees</SCText>
      </View>
      {loading && visible.length === 0 ? (
        <SCListSkeleton rows={5} />
      ) : visible.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 20, alignItems: 'center' }}>
            <SCText size={14} color={t.ink2}>No one&apos;s joined yet</SCText>
            <SCText size={12} color={t.ink3} style={{ marginTop: 4, textAlign: 'center' }}>
              Be the first to join this event.
            </SCText>
          </SCCard>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          {visible.map(p => {
            // Hide the remove affordance on the host's own row — they can't
            // remove themselves (and the Edge Function rejects it anyway).
            const showRemove = isHost && p.id !== meId;
            return (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/profile/${p.id}` as never)}
                style={({ pressed }) => [pressed && { opacity: 0.9 }]}
              >
                <SCCard style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <SCAvatar person={p} size={42} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <SCText size={15} weight="600">{p.name}</SCText>
                    <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                      @{p.username} · {p.mutual ?? 0} mutual
                    </SCText>
                  </View>
                  {showRemove && (
                    <Pressable
                      onPress={(ev) => {
                        // Stop the outer row press from navigating to the profile.
                        ev.stopPropagation();
                        removeAttendee(p);
                      }}
                      accessibilityLabel={`Remove ${p.name} from event`}
                      hitSlop={8}
                      style={({ pressed }) => [{
                        width: 36, height: 36, borderRadius: RADIUS.md,
                        borderWidth: 1, borderColor: t.danger + '59',
                        backgroundColor: t.card,
                        alignItems: 'center', justifyContent: 'center',
                      }, pressed && { opacity: 0.85 }]}
                    >
                      <SCIcon name="trash" size={14} color={t.danger} />
                    </Pressable>
                  )}
                </SCCard>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
