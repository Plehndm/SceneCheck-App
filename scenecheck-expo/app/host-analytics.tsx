// FR5.3 — Host analytics. Two ranked lists ("popular interest tags") scoped
// by either a city or a venue. Linked from /my-hosting via an "Analytics"
// row at the top of that screen.
//
// Data sources:
// - api.fetchHostAnalyticsByCity(city) → [{ interest_name, event_count }]
// - api.fetchHostAnalyticsByVenue(venue) → same shape
// Both work in mock + live mode. We render the top-10 of each list in a
// simple two-column table; empty-state copy when both come back empty.
//
// Defaults: if the viewing host has already published events, we seed the
// city input from their most-frequent `where` (the closest proxy for "city"
// SCEvent carries — there's no separate city column on the client model
// yet). Venue stays empty until the user types.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCTopBar } from '@/components/SCTopBar';
import { SCButton } from '@/components/SCAddButton';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useHostedEvents } from '@/hooks/useHostedEvents';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';
import type { HostAnalyticsRow } from '@/types/domain';

const TOP_N = 10;

export default function HostAnalyticsScreen() {
  const t = useTokens();
  const meId = useStore(s => s.me.id);
  const showToast = useStore(s => s.showToast);
  const { events: hosted } = useHostedEvents(meId);

  // Seed the city input with the host's most-frequent `where` (the closest
  // we have to "city" on the client). The user can overwrite freely.
  const defaultCity = useMemo(() => {
    if (hosted.length === 0) return '';
    const counts = new Map<string, number>();
    for (const e of hosted) {
      const key = (e.where ?? '').trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let top = '';
    let topCount = 0;
    for (const [k, n] of counts) {
      if (n > topCount) { top = k; topCount = n; }
    }
    return top;
  }, [hosted]);

  const [city, setCity] = useState('');
  const [venue, setVenue] = useState('');
  const [byCity, setByCity] = useState<HostAnalyticsRow[]>([]);
  const [byVenue, setByVenue] = useState<HostAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(false);

  // One-shot seeder: once useHostedEvents resolves, prefill the city input.
  // Done in an effect (not a useState initializer) because the hook fires
  // async in live mode.
  useEffect(() => {
    if (!city && defaultCity) setCity(defaultCity);
  }, [city, defaultCity]);

  const runAnalytics = useCallback(async (c: string, v: string) => {
    setLoading(true);
    try {
      // Parallel fetches — both RPCs are independent and small.
      const [cityRows, venueRows] = await Promise.all([
        c.trim() ? api.fetchHostAnalyticsByCity(c.trim()) : Promise.resolve([] as HostAnalyticsRow[]),
        v.trim() ? api.fetchHostAnalyticsByVenue(v.trim()) : Promise.resolve([] as HostAnalyticsRow[]),
      ]);
      // Server already orders by event_count DESC (per migration 00036), but
      // sort defensively in case mock-mode aggregation returns unordered.
      const byCount = (a: HostAnalyticsRow, b: HostAnalyticsRow) => b.event_count - a.event_count;
      setByCity([...cityRows].sort(byCount).slice(0, TOP_N));
      setByVenue([...venueRows].sort(byCount).slice(0, TOP_N));
    } catch (e) {
      showToast({
        message: e instanceof Error ? `Couldn't load analytics: ${e.message}` : "Couldn't load analytics.",
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Auto-run on first city seed so the host sees something immediately. The
  // user can refine + tap "Update" to re-run.
  useEffect(() => {
    if (defaultCity && byCity.length === 0 && byVenue.length === 0 && !loading) {
      runAnalytics(defaultCity, '');
    }
    // We intentionally only depend on `defaultCity` so this fires once when
    // the hosted-events list resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCity]);

  const onUpdate = () => runAnalytics(city, venue);

  const bothEmpty =
    !loading && byCity.length === 0 && byVenue.length === 0 &&
    (city.trim().length > 0 || venue.trim().length > 0);

  return (
    <Screen onRefresh={() => runAnalytics(city, venue)}>
      <SCTopBar onBack={() => router.back()} subtitle="HOSTING" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={32}>Analytics</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6, lineHeight: 19 }}>
          See which interest tags are popular by city or venue, so you can
          tag your next event to match local demand.
        </SCText>
      </View>

      {/* Inputs — two single-line text fields + an update button */}
      <View style={{ paddingHorizontal: 18, gap: 12 }}>
        <View>
          <SCText variant="labelCap" style={{ marginBottom: 6 }}>City</SCText>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Irvine"
            placeholderTextColor={t.ink3}
            autoCapitalize="words"
            autoCorrect={false}
            style={inputStyle(t)}
          />
        </View>
        <View>
          <SCText variant="labelCap" style={{ marginBottom: 6 }}>Venue</SCText>
          <TextInput
            value={venue}
            onChangeText={setVenue}
            placeholder="e.g. Anteater Plaza"
            placeholderTextColor={t.ink3}
            autoCapitalize="words"
            autoCorrect={false}
            style={inputStyle(t)}
          />
        </View>
        <SCButton
          label={loading ? 'LOADING…' : 'UPDATE'}
          onPress={onUpdate}
          disabled={loading || (!city.trim() && !venue.trim())}
        />
      </View>

      {/* Results — two side-by-side tables. On narrow screens they stack
          (default flexbox column direction); on wider we let them flow. */}
      <View style={{ paddingHorizontal: 14, marginTop: 18, gap: 14 }}>
        <AnalyticsTable
          title={city.trim() ? `Top tags in ${city.trim()}` : 'Top tags by city'}
          rows={byCity}
          emptyLabel={city.trim() ? 'No events found for that city.' : 'Enter a city to see results.'}
        />
        <AnalyticsTable
          title={venue.trim() ? `Top tags at ${venue.trim()}` : 'Top tags by venue'}
          rows={byVenue}
          emptyLabel={venue.trim() ? 'No events found for that venue.' : 'Enter a venue to see results.'}
        />
      </View>

      {bothEmpty && (
        <View style={{ paddingHorizontal: 18, marginTop: 12 }}>
          <SCCard style={{ padding: 16, alignItems: 'center' }}>
            <SCText size={13} color={t.ink2} style={{ textAlign: 'center' }}>
              No events found for that city/venue.
            </SCText>
            <SCText size={11} color={t.ink3} style={{ marginTop: 4, textAlign: 'center' }}>
              Try a different spelling or check back after more events publish.
            </SCText>
          </SCCard>
        </View>
      )}
    </Screen>
  );
}

function AnalyticsTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: HostAnalyticsRow[];
  emptyLabel: string;
}) {
  const t = useTokens();
  return (
    <View>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 4, marginBottom: 6,
      }}>
        <SCText variant="labelCap">{title}</SCText>
        <SCText variant="mono" size={10} color={t.ink3}>
          {rows.length} TAG{rows.length === 1 ? '' : 'S'}
        </SCText>
      </View>
      <SCCard style={{ paddingVertical: 4 }}>
        {rows.length === 0 ? (
          <View style={{ padding: 14, alignItems: 'center' }}>
            <SCText size={12} color={t.ink3}>{emptyLabel}</SCText>
          </View>
        ) : (
          rows.map((row, i) => (
            <View
              key={row.interest_name}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 14, paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.line,
              }}
            >
              <View style={{
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: t.subtle,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <SCText variant="mono" size={10} weight="700" color={t.ink2}>
                  {i + 1}
                </SCText>
              </View>
              <SCText variant="mono" size={13} weight="600" style={{ flex: 1 }}>
                <SCText variant="mono" size={13} style={{ opacity: 0.5 }}>#</SCText>
                {row.interest_name}
              </SCText>
              <SCText variant="mono" size={12} color={t.ink2}>
                {row.event_count} event{row.event_count === 1 ? '' : 's'}
              </SCText>
            </View>
          ))
        )}
      </SCCard>
    </View>
  );
}

function inputStyle(t: ReturnType<typeof useTokens>) {
  return {
    height: 44,
    backgroundColor: t.card,
    borderColor: t.line,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    color: t.ink,
    fontSize: 14,
  };
}
