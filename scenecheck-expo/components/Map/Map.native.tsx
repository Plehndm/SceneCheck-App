// Native map implementation — iOS uses Apple Maps, Android uses Google
// Maps (requires GOOGLE_MAPS_API_KEY in app.json's `android.config`
// block to render tiles; we leave that as a deploy-time concern).
//
// Metro auto-selects this file on iOS/Android via the `.native.tsx`
// suffix; the TS-only Map.tsx is the fallback the typechecker resolves.

import { Platform, View, type ViewStyle, type StyleProp } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTokens } from '@/theme/ThemeProvider';
import {
  DEFAULT_REGION, DEFAULT_RADIUS_M,
  eventLatLng, pinColor, type MapProps,
} from './types';

export function Map({
  events, user, initialCenter = DEFAULT_REGION, centerOn, radiusM = DEFAULT_RADIUS_M,
  meInterests = [],
  onPinPress, onRegionChange, interactive = true, style, selectedId,
}: MapProps) {
  const t = useTokens();
  // centerOn (a focused event) wins over the you-are-here center. initialRegion
  // is mount-only, so the Map tab remounts (key) when the focus target changes.
  const center = centerOn ?? user ?? initialCenter;

  return (
    <View
      // In preview (non-interactive) mode let touches fall through to a
      // parent Pressable so tapping the snapshot opens the full Map tab.
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[{ width: '100%' as const, height: 300 }, style as StyleProp<ViewStyle>]}
    >
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        onRegionChangeComplete={(region) => {
          onRegionChange?.({ latitude: region.latitude, longitude: region.longitude });
        }}
        showsUserLocation={!!user}
        // Snapshot mode: kill every gesture so the card reads as a
        // static map. `toolbarEnabled` is Android-only.
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        toolbarEnabled={interactive}
      >
        {user && radiusM > 0 && (
          <Circle
            center={user}
            radius={radiusM}
            fillColor={t.accentBlue + '1A'}
            strokeColor={t.accentBlue + '99'}
            strokeWidth={1}
          />
        )}
        {events.map(e => {
          const ll = eventLatLng(e);
          const color = pinColor(e, t, meInterests);
          const selected = e.id === selectedId;
          return (
            <Marker
              key={e.id}
              coordinate={ll}
              // Deliberately no `title` / `description`. Setting either of
              // those engages iOS' MKMarkerAnnotationView callout lifecycle,
              // which has a long-standing Apple Maps bug: after 2–3 select/
              // deselect cycles in a single MapView, `selectAnnotation:`
              // dereferences a callout view that was deallocated on a
              // previous teardown and the app crashes with EXC_BAD_ACCESS.
              // The crash is COUNT-based, not timing-based — pausing
              // between taps doesn't help because the stale internal
              // reference isn't cleared by time, only by being touched.
              // The focused-event card the screen renders below the map
              // already shows the title + venue + when + interest tags +
              // OPEN EVENT CTA, so the native callout was redundant in
              // addition to being the crash source.
              pinColor={color}
              // Selected pin floats above the rest so an overlapping
              // cluster doesn't bury the chosen one.
              zIndex={selected ? 999 : undefined}
              onPress={() => onPinPress?.(e)}
            />
          );
        })}
      </MapView>
    </View>
  );
}
