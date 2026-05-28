// Native map implementation — iOS uses Apple Maps, Android uses Google
// Maps (requires GOOGLE_MAPS_API_KEY in app.json's `android.config`
// block to render tiles; we leave that as a deploy-time concern).
//
// Metro auto-selects this file on iOS/Android via the `.native.tsx`
// suffix; the TS-only Map.tsx is the fallback the typechecker resolves.
//
// Pin selection — why there is no native callout bubble:
//
// iOS' MKMapView has a long-standing reference-counting bug in the
// default callout-view lifecycle: after 2-3 `selectAnnotation:` cycles
// on annotations with `canShowCallout = YES`, the next call dereferences
// a callout view that was deallocated on a prior teardown. The crash is
// purely count-based (not rate-based; pausing between taps doesn't help)
// and it's reproducible against this app — see the device log captured
// during debugging:
//
//   [Map] Marker.onPress {id: e9,        wasSelected: false}
//   [PinMarker] effect   {id: e9,        selected: true}
//   [Map] Marker.onPress {id: 9980b6f2…, wasSelected: false}
//   [PinMarker] effect   {id: e9,        selected: false}
//   [PinMarker] effect   {id: 9980b6f2…, selected: true}
//   [Map] Marker.onPress {id: e9,        wasSelected: false}
//   [PinMarker] effect   {id: e9,        selected: true}
//   [PinMarker] effect   {id: 9980b6f2…, selected: false}
//                                            ← every JS log lands, crash
//                                              happens INSIDE iOS' next
//                                              selectAnnotation: tick.
//
// `canShowCallout = YES` is set by iOS whenever a Marker has any of
// `title`, `description`, or a `<Callout>` child. All three engage the
// buggy lifecycle. The only reliable JS-level workaround is to not
// engage it at all: no callout content of any kind on the Marker. The
// brief-summary text the user would have seen in the callout is already
// rendered (with more detail) in the focused-event card below the map
// — see `app/(tabs)/map.tsx` lines ~200-260.
//
// If a callout-like bubble ABOVE the pin is wanted later, build it as
// a custom React Native absolute-positioned overlay using
// MapView.pointForCoordinate(...) for projection. That path doesn't
// involve MKAnnotationView and so doesn't engage the bug.
//
// Diagnostic logging under `__DEV__` stays in place so any regression
// is caught early — Metro strips it from production builds.

import { useEffect } from 'react';
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

  // Diagnostic — fires when the prop the screen passes in changes, so
  // we can correlate React selection state with native behaviour on the
  // device console if anything ever regresses. Stripped in production
  // by Metro's __DEV__ dead-code elimination.
  useEffect(() => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[Map] selectedId →', selectedId ?? 'null', '· events:', events.length);
    }
  }, [selectedId, events.length]);

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
              // No title / description / <Callout> child — see the header
              // comment for the iOS callout-lifecycle crash that any of
              // those engage. Pin appearance is the native sprite tinted
              // by pinColor; selection is purely a zIndex lift so the
              // chosen pin floats above an overlapping cluster.
              pinColor={color}
              zIndex={selected ? 999 : undefined}
              onPress={(ev) => {
                if (__DEV__) {
                  // eslint-disable-next-line no-console
                  console.log(
                    '[Map] Marker.onPress',
                    {
                      id: e.id,
                      title: e.title,
                      wasSelected: selected,
                      action: ev?.nativeEvent?.action ?? 'unknown',
                    },
                  );
                }
                onPinPress?.(e);
              }}
            />
          );
        })}
      </MapView>
    </View>
  );
}
