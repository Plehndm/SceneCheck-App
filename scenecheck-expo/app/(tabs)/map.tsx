// Map tab — real maps. Native uses react-native-maps (Apple/Google);
// web uses react-leaflet over OpenStreetMap tiles. Metro auto-picks
// the right Map implementation via the .native.tsx / .web.tsx suffix.
//
// FR4.2 discovery radius: drawn as a translucent circle around "you".
// FR4.4 pin color-coding: handled inside Map by `pinColor()`.
// FR1.5 location permission: requested by useLocation().

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCButton } from '@/components/SCAddButton';
import { SCIcon } from '@/components/SCIcon';
import { LegendDot } from '@/components/LegendDot';
import { Map } from '@/components/Map';
import { SCTag } from '@/components/SCTag';
import { eventLatLng, pinColor, type LatLng } from '@/components/Map/types';
import { useLocation } from '@/hooks/useLocation';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useEvents } from '@/hooks/useEvents';
import { useDateCityLabel } from '@/hooks/useDateCityLabel';
import { whenRange } from '@/lib/date-time';
import { eventCategory, EVENT_CATEGORY_LABEL, isAlsoRecommended } from '@/lib/events';
import { MILES_TO_METERS } from '@/lib/units';
import { RADIUS } from '@/theme/tokens';
import type { SCEvent } from '@/types/domain';

// Show at most this many interest tags on the focused-event card; the rest
// collapse into a "+N" pill so the card height stays bounded.
const MAX_FOCUSED_TAGS = 3;

// Discovery-range presets, in miles. Anything off this list (e.g. 7.5,
// set via the Settings slider's 0.5-mi steps) is treated as "custom" and
// surfaces the Custom button instead of highlighting a chip. Top preset
// matches the Settings slider's 50-mi ceiling.
const RADIUS_PRESETS_MI = [1, 3, 5, 10, 25, 50];
// Whole miles render bare ("5"); fractional customs keep one decimal.
const fmtMi = (mi: number) => (Number.isInteger(mi) ? String(mi) : mi.toFixed(1));

export default function MapTab() {
  const t = useTokens();
  const { coords, status, isFallback, request } = useLocation();
  const meInterests = useStore(s => s.me.interests ?? []);
  // Discovery range lives in the store (miles) so it persists across
  // sessions and stays in sync with the Settings slider — tapping a chip
  // here writes the same preference Settings reads. The Map/query want
  // meters, so convert at the boundary.
  const radius = useStore(s => s.radius);
  const setRadius = useStore(s => s.setRadius);
  const isCustomRadius = !RADIUS_PRESETS_MI.includes(radius);
  // Round to a whole number of meters — rank_events_query's p_radius is an
  // INT, and passing a float (e.g. 5 × 1609.34 = 8046.7) makes the RPC
  // call fail to resolve, which is why pins vanished from the full map.
  const radiusM = Math.round(radius * MILES_TO_METERS);
  // Same live date + city label the Home header uses. Location is passed in
  // (rather than the hook reading its own) so this screen's single
  // useLocation() above is the only GPS reader.
  const dateCityLabel = useDateCityLabel(coords, status);
  const [focused, setFocused] = useState<SCEvent | null>(null);
  // Diagnostic — fires when React selection state actually changes, so
  // each device-console line is a real state transition (not a render).
  // Stripped in production by Metro's __DEV__ dead-code elimination.
  useEffect(() => {
    if (__DEV__) {
      console.log('[MapScreen] focused →', focused?.id ?? 'null',
        focused ? `(${focused.title})` : '');
    }
  }, [focused]);
  // Pull pins from the API. In live mode this hits the rank_events_query
  // RPC against PostGIS; in mock mode it returns SC_EVENTS synchronously.
  const { events, reload: reloadEvents } = useEvents({
    lat: coords?.latitude,
    lng: coords?.longitude,
    radiusM,
  });

  // Arriving from an event's "View location" (/(tabs)/map?focus=<id>): select
  // that event (focused card) and center the map on it. centerOn wins over the
  // you-are-here center; mapKey forces the native map to re-init centered there.
  const params = useLocalSearchParams<{ focus?: string }>();
  const [centerOn, setCenterOn] = useState<LatLng | null>(null);
  const [mapKey, setMapKey] = useState('map-default');
  useEffect(() => {
    const fid = params.focus;
    if (!fid) return;
    const ev = events.find(e => e.id === fid);
    if (!ev) return; // events may still be loading — retry on the next run
    setFocused(ev);
    setCenterOn(eventLatLng(ev));
    setMapKey(`map-focus-${ev.id}`);
    router.setParams({ focus: '' }); // consume so a later tab visit doesn't re-center
  }, [params.focus, events]);

  return (
    <Screen scroll={false} onRefresh={reloadEvents}>
      <View style={{
        paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12,
        flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <View style={{ flex: 1 }}>
          <SCText variant="labelCap">{dateCityLabel}</SCText>
          <SCText variant="displayTight" size={32} style={{ marginTop: 4 }}>Map</SCText>
          {isFallback && (
            <Pressable
              onPress={request}
              style={({ pressed }) => [{
                marginTop: 8, alignSelf: 'flex-start',
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                backgroundColor: t.primarySoft,
              }, pressed && { opacity: 0.85 }]}
            >
              <SCText variant="mono" size={10} weight="600" color={t.primary}>
                {status === 'denied' ? 'LOCATION DENIED · USING UCI DEFAULT' :
                 status === 'unavailable' ? 'LOCATION UNAVAILABLE · USING UCI DEFAULT' :
                 'TAP TO ENABLE LOCATION'}
              </SCText>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => router.push('/create-event' as never)}
          accessibilityLabel="Create a new event"
          style={({ pressed }) => [{
            width: 42, height: 42, borderRadius: RADIUS.lg,
            backgroundColor: t.ink,
            alignItems: 'center', justifyContent: 'center',
            marginTop: 6,
          }, pressed && { opacity: 0.85 }]}
        >
          <SCIcon name="plus" size={18} color={t.card} />
        </Pressable>
      </View>

      {/* Real map */}
      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        <View style={{
          flex: 1, borderRadius: RADIUS.xl, overflow: 'hidden',
          borderWidth: 1, borderColor: t.line,
        }}>
          <Map
            key={mapKey}
            events={events}
            user={coords}
            centerOn={centerOn ?? undefined}
            radiusM={radiusM}
            meInterests={meInterests}
            selectedId={focused?.id}
            onPinPress={(e) => setFocused(e)}
            // Tap anywhere on the map that isn't a pin → clear the
            // focused selection. The Map component routes the
            // MapView.onPress here only when the gesture missed every
            // pin (the pin overlay's Pressables capture their own
            // taps), so this is the "tap off the selected pin"
            // behaviour the user asked for.
            onMapPress={() => setFocused(null)}
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      </View>

      {/* Discovery-range chips — tapping one writes the persisted store
          radius (shared with the Settings slider). When the saved range
          isn't one of the presets, a Custom button appears on its own row
          below, showing the value and deep-linking to Settings for fine
          control. */}
      <View style={{ paddingHorizontal: 18, paddingVertical: 10, gap: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, alignItems: 'center' }}
        >
          {RADIUS_PRESETS_MI.map(mi => {
            const active = radius === mi;
            return (
              <Pressable
                key={mi}
                onPress={() => setRadius(mi)}
                accessibilityLabel={`Set discovery range to ${mi} miles`}
                style={({ pressed }) => [{
                  paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999,
                  borderWidth: 1,
                  backgroundColor: active ? t.ink : t.card,
                  borderColor: active ? t.ink : t.line,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCText variant="mono" size={10} weight="600" color={active ? t.surface : t.ink}>
                  {mi} MI
                </SCText>
              </Pressable>
            );
          })}
        </ScrollView>
        {isCustomRadius && (
          <Pressable
            onPress={() => router.push('/settings' as never)}
            accessibilityLabel={`Custom discovery range, ${fmtMi(radius)} miles. Opens settings to adjust.`}
            style={({ pressed }) => [{
              alignSelf: 'flex-start',
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999,
              borderWidth: 1, backgroundColor: t.primary, borderColor: t.primary,
            }, pressed && { opacity: 0.85 }]}
          >
            <SCIcon name="settings" size={11} color={t.primaryInk} />
            <SCText variant="mono" size={10} weight="600" color={t.primaryInk}>
              CUSTOM · {fmtMi(radius)} MI
            </SCText>
          </Pressable>
        )}
      </View>

      {/* Focused event card (when a pin is selected) + the colour key.
          The key stays visible at all times so the pin colours are
          always decodable, even with an event focused. */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
        {focused && (
          <SCCard style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <SCText variant="labelCap">Focused on map</SCText>
              <Pressable onPress={() => setFocused(null)}>
                <SCText variant="mono" size={10} weight="600" color={t.ink2}>CLEAR</SCText>
              </Pressable>
            </View>
            <Pressable
              onPress={() => router.push(`/event/${focused.id}` as never)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              {/* Category chip — same yours/friend/recommended/other coding as
                  the map pins + legend, plus the RECOMMENDED badge when a
                  friend's event also matches your interests. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: pinColor(focused, t, meInterests) }} />
                <SCText variant="mono" size={9.5} weight="600" color={pinColor(focused, t, meInterests)}>
                  {EVENT_CATEGORY_LABEL[eventCategory(focused, meInterests)]}
                </SCText>
                {isAlsoRecommended(focused, meInterests) && (
                  <View style={{
                    backgroundColor: t.accentBlue, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                  }}>
                    <SCText variant="mono" size={9} weight="600" color="white">RECOMMENDED</SCText>
                  </View>
                )}
              </View>
              <SCText variant="display" size={15}>{focused.title}</SCText>
              <SCText variant="mono" size={11} color={t.ink2} style={{ marginTop: 2 }}>
                {whenRange(focused)}
              </SCText>
              <SCText size={12} color={t.ink3} style={{ marginTop: 2 }}>{focused.where}</SCText>
              {/* Interest tags — truncated past MAX_FOCUSED_TAGS into a +N pill. */}
              {focused.interests.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {focused.interests.slice(0, MAX_FOCUSED_TAGS).map(tag => (
                    <SCTag key={tag} tag={tag} size="sm" tone="soft" />
                  ))}
                  {focused.interests.length > MAX_FOCUSED_TAGS && (
                    <View style={{
                      paddingVertical: 4, paddingHorizontal: 9, borderRadius: RADIUS.pill, backgroundColor: t.subtle,
                      justifyContent: 'center',
                    }}>
                      <SCText variant="mono" size={12} color={t.ink2}>
                        +{focused.interests.length - MAX_FOCUSED_TAGS}
                      </SCText>
                    </View>
                  )}
                </View>
              )}
              <View style={{ marginTop: 10 }}>
                <SCButton label="OPEN EVENT" onPress={() => router.push(`/event/${focused.id}` as never)} />
              </View>
            </Pressable>
          </SCCard>
        )}
        <SCCard style={{ padding: 14, gap: 8 }}>
          <SCText variant="labelCap">Key</SCText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <LegendDot color={t.primary} label="Your events" />
            <LegendDot color={t.accentFriend} label="Friends" />
            <LegendDot color={t.accentBlue} label="Recommended" />
            <LegendDot color={t.mapPinMute} label="Other" />
          </View>
          {!focused && (
            <SCText size={11} color={t.ink3} style={{ lineHeight: 16 }}>
              Pins show events only. People&apos;s locations are never displayed.
            </SCText>
          )}
        </SCCard>
      </View>
    </Screen>
  );
}
