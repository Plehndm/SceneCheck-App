// Ratings — every review left for events this account hosted.
// Filters: star rating (any/1-5) and event (any/specific).

import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCAvatar } from '@/components/SCAvatar';
import { SCListSkeleton } from '@/components/SCSkeleton';
import { RateEventSheet } from '@/components/RateEventSheet';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useProfile } from '@/hooks/useProfile';
import { useRatings } from '@/hooks/useRatings';
import { api } from '@/lib/api';
import { SC_ACCOUNT_BY_ID, SC_ANY_EVENT_BY_ID } from '@/data/mocks';
import { RADIUS } from '@/theme/tokens';

export default function RatingsScreen() {
  const t = useTokens();
  const { hostId } = useLocalSearchParams<{ hostId: string }>();
  // Host name comes from useProfile in either mode. Ratings list
  // joins ratings ⨝ events on creator_id in live mode; mock-mode
  // filters SC_REVIEWS by hostId.
  const { profile: host, reload: reloadHost } = useProfile(hostId);
  const { ratings: all, loading, reload: reloadRatings } = useRatings(hostId);
  const mock = api.isMock();
  // Identify the viewer's own reviews so they can edit/delete them. me.id is a
  // raw UUID in live mode and 'me' in mock; reviewerId is toMockId(user_id) —
  // normalising me.id the same way matches both (incl. the seeded demo self).
  const meId = useStore(s => s.me.id);
  const showConfirm = useStore(s => s.showConfirm);
  const showToast = useStore(s => s.showToast);
  const myReviewKey = api.toMockId(meId);
  // Which review's "⋮" menu is open, and the review currently being edited.
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<
    { eventId: string; eventTitle: string; stars: number; text: string } | null
  >(null);

  const confirmDelete = (eventId: string) => {
    showConfirm({
      title: 'Delete this review?',
      body: 'Your rating and review will be removed from this host.',
      confirmLabel: 'DELETE', cancelLabel: 'KEEP', tone: 'danger', icon: 'trash',
      onConfirm: async () => {
        try {
          await api.deleteRating(eventId);
          showToast({ message: 'Review deleted.', kind: 'info' });
          reloadRatings(); reloadHost();
        } catch (e) {
          showToast({
            message: e instanceof Error ? `Couldn't delete: ${e.message}` : "Couldn't delete review.",
            kind: 'error',
          });
        }
      },
    });
  };
  const ordered = useMemo(
    () => [...all].sort((a, b) => b.id.localeCompare(a.id)),
    [all],
  );

  const [stars, setStars] = useState<number>(0);
  const filtered = stars === 0 ? ordered : ordered.filter(r => r.rating === stars);

  const avg = all.length > 0
    ? (all.reduce((sum, r) => sum + r.rating, 0) / all.length)
    : 0;

  return (
    <Screen onRefresh={() => { reloadRatings(); reloadHost(); }}>
      <SCTopBar onBack={() => router.back()} subtitle="RATINGS" />

      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={32}>
          Reviews for {host?.name ?? 'this host'}
        </SCText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <SCIcon name="star" size={14} color={t.warn} />
          <SCText variant="mono" size={13} weight="600">{avg.toFixed(1)}</SCText>
          <SCText variant="mono" size={11} color={t.ink3}>
            · {all.length} {all.length === 1 ? 'review' : 'reviews'}
          </SCText>
        </View>
      </View>

      {/* Star filter chips */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 14, flexWrap: 'wrap' }}>
        {[0, 5, 4, 3, 2, 1].map(s => (
          <Pressable
            key={s}
            onPress={() => setStars(s)}
            style={({ pressed }) => [{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
              borderWidth: 1,
              backgroundColor: stars === s ? t.ink : t.card,
              borderColor: stars === s ? t.ink : t.line,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }, pressed && { opacity: 0.85 }]}
          >
            <SCText variant="mono" size={11} weight="600" color={stars === s ? 'white' : t.ink}>
              {s === 0 ? 'ALL' : `${s}★`}
            </SCText>
          </Pressable>
        ))}
      </View>

      {/* Reviews list */}
      {loading && all.length === 0 ? (
        <SCListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 20, alignItems: 'center' }}>
            <SCText size={14} color={t.ink2}>
              {all.length === 0 ? 'No reviews yet.' : 'No reviews match this filter.'}
            </SCText>
          </SCCard>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          {filtered.map(r => {
            // Live mode: reviewer + event come enriched on the Review (joins in
            // api.fetchRatings). Mock mode: resolve from SC_* fixtures.
            const reviewer = mock
              ? SC_ACCOUNT_BY_ID[r.reviewerId]
              : { name: r.reviewerName ?? 'Anonymous', picture: r.reviewerPicture ?? null, type: 'person' as const };
            const eventTitle = mock ? SC_ANY_EVENT_BY_ID[r.eventId]?.title : r.eventTitle;
            const eventId = r.eventId;
            const mine = r.reviewerId === myReviewKey;
            const menuOpen = openMenuId === r.id;
            return (
              <View key={r.id} style={{ position: 'relative', zIndex: menuOpen ? 5 : 0 }}>
                <SCCard style={{ padding: 14, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <SCAvatar person={reviewer} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <SCText size={14} weight="600">{reviewer?.name ?? 'Anonymous'}</SCText>
                      <SCText variant="mono" size={11} color={t.ink3}>{r.when}</SCText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <SCIcon
                          key={i}
                          name="star"
                          size={12}
                          color={i < r.rating ? t.warn : t.line}
                        />
                      ))}
                    </View>
                    {/* Your own review: a "⋮" menu to edit or delete it. */}
                    {mine && (
                      <Pressable
                        onPress={() => setOpenMenuId(menuOpen ? null : r.id)}
                        hitSlop={8}
                        accessibilityLabel="Review options"
                        style={({ pressed }) => [{ padding: 4, marginLeft: 2 }, pressed && { opacity: 0.6 }]}
                      >
                        <SCIcon name="more" size={18} color={t.ink2} />
                      </Pressable>
                    )}
                  </View>
                  <SCText size={14} color={t.ink} style={{ lineHeight: 21 }}>{r.text}</SCText>
                  {eventTitle && (
                    <Pressable
                      onPress={() => router.push(`/event/${eventId}` as never)}
                      style={({ pressed }) => [{
                        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
                        gap: 6, paddingHorizontal: 10, paddingVertical: 5,
                        borderRadius: 999, backgroundColor: t.subtle,
                      }, pressed && { opacity: 0.85 }]}
                    >
                      <SCIcon name="calendar" size={11} color={t.ink2} />
                      <SCText variant="mono" size={10} color={t.ink2} numberOfLines={1}>
                        {eventTitle}
                      </SCText>
                    </Pressable>
                  )}
                </SCCard>
                {/* Dropdown — anchored under the "⋮", overlays the next card. */}
                {mine && menuOpen && (
                  <View style={{
                    position: 'absolute', top: 44, right: 10, zIndex: 10, minWidth: 156,
                    backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: RADIUS.md,
                    paddingVertical: 4,
                    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 }, elevation: 6,
                  }}>
                    <Pressable
                      onPress={() => {
                        setOpenMenuId(null);
                        setEditing({ eventId, eventTitle: eventTitle ?? 'this event', stars: r.rating, text: r.text });
                      }}
                      style={({ pressed }) => [{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingHorizontal: 14, paddingVertical: 10,
                      }, pressed && { backgroundColor: t.subtle }]}
                    >
                      <SCIcon name="edit" size={15} color={t.ink} />
                      <SCText size={14}>Edit review</SCText>
                    </Pressable>
                    <View style={{ height: 1, backgroundColor: t.line }} />
                    <Pressable
                      onPress={() => { setOpenMenuId(null); confirmDelete(eventId); }}
                      style={({ pressed }) => [{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingHorizontal: 14, paddingVertical: 10,
                      }, pressed && { backgroundColor: t.subtle }]}
                    >
                      <SCIcon name="trash" size={15} color={t.danger} />
                      <SCText size={14} color={t.danger}>Delete review</SCText>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Edit-review sheet (opened from a review's "⋮" menu). */}
      {editing && (
        <RateEventSheet
          visible={!!editing}
          eventId={editing.eventId}
          eventTitle={editing.eventTitle}
          initialStars={editing.stars}
          initialText={editing.text}
          onClose={() => setEditing(null)}
          onRated={() => { setEditing(null); reloadRatings(); reloadHost(); }}
        />
      )}
    </Screen>
  );
}
