// Native map implementation — iOS uses Apple Maps, Android uses Google
// Maps (requires GOOGLE_MAPS_API_KEY in app.json's `android.config`
// block to render tiles; we leave that as a deploy-time concern).
//
// Metro auto-selects this file on iOS/Android via the `.native.tsx`
// suffix; the TS-only Map.tsx is the fallback the typechecker resolves.
//
// Pin selection: `title` and `description` populate the native callout
// bubble. The selected-animation trigger is decoupled from the iOS
// gesture recognizer's auto-select path by attaching a ref to each
// Marker and imperatively calling `showCallout()` / `hideCallout()` in
// response to the screen's `selectedId` prop. That way the React
// `focused` state is the single source of truth, and the callout's
// open/close animation is driven by an explicit, traceable JS call
// rather than by iOS' implicit gesture-recognizer → selectAnnotation:
// path that has been the recurring crash source. Diagnostic
// console.logs under `__DEV__` let us correlate every tap with its
// props on the device console (Metro Bundler / adb logcat / Safari
// Web Inspector) when the crash is reproduced — see the PinMarker
// component below.

import { useEffect, useRef } from 'react';
import { Platform, View, type ViewStyle, type StyleProp } from 'react-native';
import MapView, {
  Marker,
  Circle,
  PROVIDER_GOOGLE,
  type MapMarker,
} from 'react-native-maps';
import { useTokens } from '@/theme/ThemeProvider';
import {
  DEFAULT_REGION, DEFAULT_RADIUS_M,
  eventLatLng, pinColor, type MapProps, type LatLng,
} from './types';
import type { SCEvent } from '@/types/domain';

// One pin. The component exists so each Marker can own its own ref and
// useEffect, and so the show/hide-callout calls fire in lock-step with
// the `selected` prop change (rather than from a parent-level effect
// that would have to iterate every marker on every selection change —
// noisier on the device console, harder to attribute crashes to a
// specific pin).
function PinMarker({
  e,
  ll,
  color,
  selected,
  onPress,
}: {
  e: SCEvent;
  ll: LatLng;
  color: string;
  selected: boolean;
  onPress: (ev: SCEvent) => void;
}) {
  // MapMarker is the ref shape exported by react-native-maps for the
  // Marker class component; showCallout / hideCallout are members of it.
  const ref = useRef<MapMarker | null>(null);

  // Drive the native callout from React state. When `selected` flips:
  //   true → ref.current.showCallout() (animates the callout open)
  //   false → ref.current.hideCallout() (animates it closed)
  // The native gesture-recognizer will ALSO trigger a select-on-tap
  // for the same marker, but that's now an additive event, not the
  // sole trigger — and it operates on the SAME annotation view rather
  // than competing with React's view of the world.
  useEffect(() => {
    if (selected) ref.current?.showCallout();
    else ref.current?.hideCallout();
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[PinMarker] effect', { id: e.id, selected });
    }
  }, [selected, e.id]);

  return (
    <Marker
      ref={ref}
      coordinate={ll}
      // title + description populate the native callout's text. They
      // are read by iOS once when the callout view is built; the view
      // is then shown/hidden via the ref calls above.
      title={e.title}
      description={e.where}
      pinColor={color}
      // Selected pin floats above the rest so an overlapping cluster
      // doesn't bury the chosen one.
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
        onPress(e);
      }}
    />
  );
}

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
  // we can correlate React selection state with native callout
  // behaviour on the device console. Stripped in production by Metro's
  // __DEV__ dead-code elimination.
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
            <PinMarker
              key={e.id}
              e={e}
              ll={ll}
              color={color}
              selected={selected}
              onPress={(ev) => onPinPress?.(ev)}
            />
          );
        })}
      </MapView>
    </View>
  );
}
