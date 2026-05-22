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
import { useTokens } from '@/theme/ThemeProvider';
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
  const { ratings: all, reload: reloadRatings } = useRatings(hostId);
  const mock = api.isMock();
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
      {filtered.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 20, alignItems: 'center' }}>
            <SCText size={14} color={t.ink2}>No reviews match this filter.</SCText>
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
            return (
              <SCCard key={r.id} style={{ padding: 14, gap: 8 }}>
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
            );
          })}
        </View>
      )}
    </Screen>
  );
}
