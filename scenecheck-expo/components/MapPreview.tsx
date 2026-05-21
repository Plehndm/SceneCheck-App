// Home-screen map preview card. Renders a NON-INTERACTIVE snapshot of
// the real device-specific map (Apple Maps on iOS, Google Maps on
// Android, OpenStreetMap/leaflet on web) centered on the user's
// location, with the live event pins on top — so the user gets a
// quick "lay of the land" of what's happening near them. Tapping
// anywhere opens the full Map tab.
//
// The `<Map interactive={false}>` flag disables every gesture and
// sets `pointerEvents="none"` on the map view so taps fall through
// to the surrounding Pressable. The map still resolves real tiles +
// pins, which is the "snapshot from the actual device map" the
// preview should show instead of the old hand-drawn faux card.

import { Pressable, View } from 'react-native';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useLocation } from '@/hooks/useLocation';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { Map } from './Map';
import { RADIUS } from '@/theme/tokens';
import type { SCEvent } from '@/types/domain';

interface Props {
  events: SCEvent[];
  onPress?: () => void;
}

export function MapPreview({ events, onPress }: Props) {
  const t = useTokens();
  const meInterests = useStore(s => s.me.interests ?? []);
  // Center the snapshot on the user when location is granted; the hook
  // falls back to the UCI default region otherwise, so the preview
  // always shows a real map even without permission.
  const { coords, status } = useLocation();
  const user = status === 'granted' ? coords : undefined;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Open the map"
      style={({ pressed }) => [{
        height: 210, borderRadius: RADIUS.xl, overflow: 'hidden',
        backgroundColor: t.mapLand, borderColor: t.line, borderWidth: 1,
        position: 'relative',
      }, pressed && { opacity: 0.95 }]}
    >
      {/* Real device map, gestures off (interactive={false}) so this
          card behaves as a tappable snapshot. radiusM=0 keeps the
          discovery ring out of the small preview. */}
      <Map
        events={events}
        user={user}
        meInterests={meInterests}
        radiusM={0}
        interactive={false}
        style={{ width: '100%', height: '100%' }}
      />

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
