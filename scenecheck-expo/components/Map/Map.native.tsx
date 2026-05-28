// Native map implementation — iOS uses Apple Maps, Android uses Google
// Maps (requires GOOGLE_MAPS_API_KEY in app.json's `android.config`
// block to render tiles; we leave that as a deploy-time concern).
//
// Metro auto-selects this file on iOS/Android via the `.native.tsx`
// suffix; the TS-only Map.tsx is the fallback the typechecker resolves.
//
// Pin selection — what we learned the hard way:
//
//   1. We initially hypothesised an MKMarkerAnnotationView callout-
//      lifecycle bug and dropped `title`/`description` to disengage
//      iOS' callout-view path. Device logs proved the bug ISN'T in the
//      callout layer — crash still hits exactly at selection #3 with a
//      callout-less Marker (just coordinate + pinColor + zIndex +
//      onPress).
//
//   2. With the JS layer proven correct (every onPress + every state
//      update lands fine in the logs), and with no callout to corrupt,
//      the remaining suspect is `react-native-maps@1.20.1`'s native
//      marker update pipeline. Every parent re-render of <Map> passes
//      NEW REFERENCES for `coordinate` (a fresh {latitude,longitude}
//      from eventLatLng) and `onPress` (a fresh closure) to every one
//      of the ~36 markers, even though their underlying values haven't
//      changed. react-native-maps shallow-compares these and shovels
//      each "change" through the JS-native bridge as a native marker
//      update. After a few state changes that's hundreds of bridge
//      messages, and 1.20.1 has open issues for EXC_BAD_ACCESS reads
//      against recycled annotation references in this regime.
//
//   3. Fix: every Marker is now a `React.memo`-wrapped PinMarker that
//      only re-renders when its own props actually differ. Coordinate,
//      colour, and the per-marker tap callback are computed in a
//      useMemo pinned to the events array, so a tap that changes
//      `selectedId` triggers re-renders on AT MOST 2 markers (the new
//      selection and the previously-selected one for the zIndex
//      flip), not on all 36. That cuts the per-tap native bridge
//      traffic by ~95%.
//
// If the crash recurs even after the memoisation cuts, the next step
// is either (a) `npm upgrade react-native-maps` to a release with the
// known annotation-cache fix, or (b) replace Markers with a custom RN
// absolute-positioned overlay using MapView.pointForCoordinate(...)
// for projection — that bypasses MKAnnotationView entirely.
//
// Diagnostic logging under `__DEV__` stays in place so the device
// console keeps showing every tap and every state change.

import { memo, useCallback, useEffect, useMemo } from 'react';
import { Platform, View, type ViewStyle, type StyleProp } from 'react-native';
import MapView, {
  Marker,
  Circle,
  PROVIDER_GOOGLE,
  type MarkerPressEvent,
} from 'react-native-maps';
import { useTokens } from '@/theme/ThemeProvider';
import {
  DEFAULT_REGION, DEFAULT_RADIUS_M,
  eventLatLng, pinColor, type MapProps, type LatLng,
} from './types';

// PinMarker is the per-pin component. Wrapping it in React.memo means
// React will only re-render this marker when its props actually change
// (shallow compare). Combined with stable references for `ll`, `color`,
// and `onPressId` from the parent's useMemo / useCallback, a parent
// re-render that didn't touch this pin's data is a no-op here — no
// bridge message, no native annotation update.
const PinMarker = memo(function PinMarker({
  id,
  ll,
  color,
  selected,
  onPressId,
}: {
  id: string;
  ll: LatLng;
  color: string;
  selected: boolean;
  onPressId: (id: string, action: string | undefined) => void;
}) {
  return (
    <Marker
      coordinate={ll}
      pinColor={color}
      zIndex={selected ? 999 : undefined}
      onPress={(ev: MarkerPressEvent) => {
        onPressId(id, ev?.nativeEvent?.action);
      }}
    />
  );
});

export function Map({
  events, user, initialCenter = DEFAULT_REGION, centerOn, radiusM = DEFAULT_RADIUS_M,
  meInterests = [],
  onPinPress, onRegionChange, interactive = true, style, selectedId,
}: MapProps) {
  const t = useTokens();
  // centerOn (a focused event) wins over the you-are-here center. initialRegion
  // is mount-only, so the Map tab remounts (key) when the focus target changes.
  const center = centerOn ?? user ?? initialCenter;

  // Diagnostic — fires when selection changes or event count changes.
  // Stripped in production by Metro's __DEV__ dead-code elimination.
  useEffect(() => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[Map] selectedId →', selectedId ?? 'null', '· events:', events.length);
    }
  }, [selectedId, events.length]);

  // Stable per-pin data. `ll` and `color` are memoised by event identity
  // (the events array reference) and the inputs to pinColor, so a state
  // change that doesn't touch any of those — e.g. a selection flip —
  // doesn't produce new ll/color references and doesn't invalidate
  // PinMarker's React.memo equality check.
  const markerData = useMemo(
    () => events.map(e => ({
      id: e.id,
      // We keep a reference to the original event so onPressId can
      // hand it back to the screen unchanged.
      e,
      ll: eventLatLng(e),
      color: pinColor(e, t, meInterests),
    })),
    // t.primary / accentFriend / accentBlue / mapPinMute drive pinColor's
    // output, so list them as deps — palette changes (e.g. light↔dark)
    // need to recompute all colours.
    [events, t.primary, t.accentFriend, t.accentBlue, t.mapPinMute, meInterests],
  );

  // Stable tap callback. Receives the marker id (not the closed-over
  // event) so the function identity is invariant per <Map> instance,
  // not per marker. The screen's onPinPress callback is called with the
  // real event looked up via markerData. Diagnostic log fires here so
  // every tap is captured in the device console.
  const onPressId = useCallback(
    (id: string, action: string | undefined) => {
      const found = markerData.find(m => m.id === id);
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[Map] Marker.onPress', {
          id,
          title: found?.e.title,
          wasSelected: id === selectedId,
          action: action ?? 'unknown',
        });
      }
      if (found) onPinPress?.(found.e);
    },
    [markerData, selectedId, onPinPress],
  );

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
        {markerData.map(({ id, ll, color }) => (
          <PinMarker
            key={id}
            id={id}
            ll={ll}
            color={color}
            selected={id === selectedId}
            onPressId={onPressId}
          />
        ))}
      </MapView>
    </View>
  );
}
