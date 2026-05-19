// Map tab — real maps. Native uses react-native-maps (Apple/Google);
// web uses react-leaflet over OpenStreetMap tiles. Metro auto-picks
// the right Map implementation via the .native.tsx / .web.tsx suffix.
//
// FR4.2 discovery radius: drawn as a translucent circle around "you".
// FR4.4 pin color-coding: handled inside Map by `pinColor()`.
// FR1.5 location permission: requested by useLocation().

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCButton } from '@/components/SCAddButton';
import { SCIcon } from '@/components/SCIcon';
import { LegendDot } from '@/components/LegendDot';
import { Map } from '@/components/Map';
import { useLocation } from '@/hooks/useLocation';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { SC_EVENTS } from '@/data/mocks';
import { fmtDate, whenRange } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';
import type { SCEvent } from '@/types/domain';

const RADIUS_OPTIONS_M = [1600, 4828, 8047, 16093]; // 1, 3, 5, 10 miles

export default function MapTab() {
  const t = useTokens();
  const { coords, status, isFallback, request } = useLocation();
  const meInterests = useStore(s => s.me.interests ?? []);
  const [radius, setRadius] = useState<number>(RADIUS_OPTIONS_M[2]);
  const [focused, setFocused] = useState<SCEvent | null>(null);

  return (
    <Screen scroll={false}>
      <View style={{
        paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12,
        flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <View style={{ flex: 1 }}>
          <SCText variant="labelCap">{fmtDate(new Date())} · Irvine</SCText>
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
            events={SC_EVENTS}
            user={coords}
            radiusM={radius}
            meInterests={meInterests}
            onPinPress={(e) => setFocused(e)}
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      </View>

      {/* Radius chips */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 18, paddingVertical: 10 }}>
        {RADIUS_OPTIONS_M.map(r => (
          <Pressable
            key={r}
            onPress={() => setRadius(r)}
            style={({ pressed }) => [{
              paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999,
              borderWidth: 1,
              backgroundColor: radius === r ? t.ink : t.card,
              borderColor: radius === r ? t.ink : t.line,
            }, pressed && { opacity: 0.85 }]}
          >
            <SCText variant="mono" size={10} weight="600" color={radius === r ? 'white' : t.ink}>
              {(r / 1609).toFixed(0)} MI
            </SCText>
          </Pressable>
        ))}
      </View>

      {/* Focused event card OR legend */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
        {focused ? (
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
              <SCText variant="display" size={15}>{focused.title}</SCText>
              <SCText variant="mono" size={11} color={t.ink2} style={{ marginTop: 2 }}>
                {whenRange(focused)}
              </SCText>
              <SCText size={12} color={t.ink3} style={{ marginTop: 2 }}>{focused.where}</SCText>
              <View style={{ marginTop: 10 }}>
                <SCButton label="OPEN EVENT" onPress={() => router.push(`/event/${focused.id}` as never)} />
              </View>
            </Pressable>
          </SCCard>
        ) : (
          <SCCard style={{ padding: 14, gap: 8 }}>
            <SCText variant="labelCap">Key</SCText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <LegendDot color={t.primary} label="Your events" />
              <LegendDot color={t.accentFriend} label="Friends" />
              <LegendDot color={t.accentBlue} label="Recommended" />
              <LegendDot color={t.mapPinMute} label="Other" />
            </View>
            <SCText size={11} color={t.ink3} style={{ lineHeight: 16 }}>
              Pins show events only. People&apos;s locations are never displayed.
            </SCText>
          </SCCard>
        )}
      </View>
    </Screen>
  );
}
