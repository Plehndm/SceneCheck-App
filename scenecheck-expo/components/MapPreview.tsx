// Placeholder for the Home screen's map preview card. The legacy SCMap is
// a 200-line hand-tuned SVG of UCI — that port is scheduled for Phase 5
// when we also wire in the real native maps (react-native-maps on iOS/
// Android, react-leaflet on web). For now this renders a stylized card
// with a "live" chip and a tappable "open map" hint, so the Home screen
// can ship end-to-end and we can prove the rest of the stack works.

import { Pressable, View } from 'react-native';
import { useTokens } from '@/theme/ThemeProvider';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { RADIUS } from '@/theme/tokens';
import type { SCEvent } from '@/types/domain';

interface Props {
  events: SCEvent[];
  onPress?: () => void;
}

export function MapPreview({ events, onPress }: Props) {
  const t = useTokens();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{
      height: 210, borderRadius: RADIUS.xl, overflow: 'hidden',
      backgroundColor: t.mapLand, borderColor: t.line, borderWidth: 1,
      position: 'relative',
    }, pressed && { opacity: 0.95 }]}>
      {/* Faux park */}
      <View style={{
        position: 'absolute', left: '20%', top: '30%', right: '20%', bottom: '30%',
        borderRadius: 999, backgroundColor: t.mapPark, opacity: 0.85,
      }} />
      {/* Faux water */}
      <View style={{
        position: 'absolute', left: 0, top: 0, width: '32%', height: '32%',
        backgroundColor: t.mapWater, borderBottomRightRadius: 80,
      }} />
      {/* Faux pin */}
      <View style={{
        position: 'absolute', left: '45%', top: '45%',
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: t.accentBlue, borderColor: 'white', borderWidth: 3,
      }} />
      {/* LIVE chip */}
      <View style={{
        position: 'absolute', left: 12, top: 12,
        backgroundColor: t.ink,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
      }}>
        <SCText variant="mono" size={10} weight="600" color={t.card}>
          LIVE · {events.length} EVENTS NEARBY
        </SCText>
      </View>
      {/* OPEN MAP chip */}
      <View style={{
        position: 'absolute', right: 12, bottom: 12,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: t.card,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: t.line,
      }}>
        <SCText variant="mono" size={11} weight="600">OPEN MAP</SCText>
        <SCIcon name="chevron-right" size={12} color={t.ink} />
      </View>
    </Pressable>
  );
}
