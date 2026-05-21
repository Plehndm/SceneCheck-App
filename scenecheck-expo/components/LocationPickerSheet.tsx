// Bottom-sheet map picker for an event's location. The user drags the map
// so a fixed center pin marks the spot; the map's center is reported via
// `onRegionChange` and returned as { lat, lng } on confirm.
//
// We intentionally pass `initialCenter` (not `user`) to <Map>: the `user`
// prop drives a "recenter" effect on web that would fight every pan and
// loop. initialCenter seeds the map once and lets the gesture move freely,
// while the center-pin overlay marks the chosen point.

import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { SCButton } from './SCAddButton';
import { Map } from './Map';
import { DEFAULT_REGION, type LatLng } from './Map/types';
import { useLocation } from '@/hooks/useLocation';
import { useTokens } from '@/theme/ThemeProvider';
import { RADIUS } from '@/theme/tokens';

interface Props {
  visible: boolean;
  initial?: { lat: number; lng: number } | null;
  onClose: () => void;
  onConfirm: (coords: { lat: number; lng: number }) => void;
}

export function LocationPickerSheet({ visible, initial, onClose, onConfirm }: Props) {
  const t = useTokens();
  const { coords } = useLocation();
  // Start at the already-picked point, else the host's location, else UCI.
  const start: LatLng = initial
    ? { latitude: initial.lat, longitude: initial.lng }
    : coords ?? DEFAULT_REGION;
  const [center, setCenter] = useState<LatLng>(start);

  // Re-seed the center each time the sheet opens (the Map below remounts
  // when `visible` flips, so it re-centers on `start` too).
  useEffect(() => {
    if (visible) setCenter(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: t.card,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 16, paddingBottom: 28, paddingHorizontal: 18, gap: 14,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <SCText variant="mono" size={10} weight="600" color={t.ink3}>SET LOCATION</SCText>
              <SCText variant="displayTight" size={22}>Pin the spot</SCText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close location picker"
              style={({ pressed }) => [{
                width: 36, height: 36, borderRadius: 18, backgroundColor: t.subtle,
                alignItems: 'center', justifyContent: 'center',
              }, pressed && { opacity: 0.85 }]}
            >
              <SCIcon name="x" size={16} color={t.ink2} />
            </Pressable>
          </View>

          <SCText size={12} color={t.ink3}>
            Drag the map so the pin marks where your event is.
          </SCText>

          <View style={{
            height: 280, borderRadius: RADIUS.lg, overflow: 'hidden',
            borderWidth: 1, borderColor: t.line,
          }}>
            {visible && (
              <Map
                events={[]}
                initialCenter={start}
                radiusM={0}
                onRegionChange={(c) => setCenter(c)}
                style={{ width: '100%', height: '100%' }}
              />
            )}
            {/* Fixed center pin — marks the map center the gesture reports. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {/* Nudge up so the pin's tip rests on the exact center. */}
              <View style={{ marginBottom: 26 }}>
                <SCIcon name="pin" size={34} color={t.primary} />
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SCIcon name="crosshair" size={14} color={t.ink3} />
            <SCText variant="mono" size={12} color={t.ink2}>
              {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
            </SCText>
          </View>

          <SCButton
            label="Use this location"
            size="lg"
            onPress={() => {
              onConfirm({ lat: center.latitude, lng: center.longitude });
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
