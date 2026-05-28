// Native map implementation — iOS uses Apple Maps, Android uses Google
// Maps (requires GOOGLE_MAPS_API_KEY in app.json's `android.config`
// block to render tiles; we leave that as a deploy-time concern).
//
// Metro auto-selects this file on iOS/Android via the `.native.tsx`
// suffix; the TS-only Map.tsx is the fallback the typechecker resolves.
//
// Why this file does NOT render react-native-maps <Marker>s:
// ──────────────────────────────────────────────────────────────────────
// Several iterations of marker-based pin rendering crashed the app
// after 2-3 selections in Expo Go. Captured device logs proved every
// JS-side call landed correctly before each crash, so the bug lives
// entirely in react-native-maps@1.20.x's native marker / annotation
// update pipeline — a path we can't reach from JS, and one we can't
// swap out because Expo Go bundles the native version regardless of
// what package.json says. Custom React Native overlay sidesteps it.
//
// How the overlay works:
//   1. <MapView> renders tiles + the user-location indicator + the
//      discovery-radius Circle. NO <Marker> children of any kind.
//   2. We track the visible Region in state, updated CONTINUOUSLY by
//      onRegionChange (fires on every frame the map moves). Each
//      update is a setState; React 19's automatic batching keeps the
//      re-render rate sane.
//   3. We project each event's lat/lng to a screen {x, y} synchronously
//      in JS via a Mercator-projection useMemo. Same projection Apple
//      Maps / Google Maps use, so the pins land exactly where native
//      annotations would have. ~39 pins × constant-time arithmetic is
//      sub-millisecond per render.
//   4. Pins are absolute-positioned <Pressable> Views in an overlay
//      sibling of the MapView, anchored at the projected coordinates.
//      The overlay container has pointerEvents='box-none' so taps that
//      miss a pin fall through to the map for pan / zoom; each
//      Pressable explicitly captures its own hits with hitSlop=8 for
//      the same effective 36 px tap target the native markers had.
//
// Trade-offs accepted:
//   - The projection ignores map rotation (we read `region.{lat,lng,
//     deltas}` but not `camera.heading`). If the user rotates the map
//     pins won't follow the rotation. rotateEnabled is true so users
//     CAN rotate, but typical map UX doesn't, and Apple Maps north-
//     locks by default anyway. Easy to add later if needed.
//   - Mercator projection deviates from native rendering at the poles;
//     irrelevant for any region this app shows.
//
// Diagnostic __DEV__ logs preserved so future regressions surface in
// the device console the same way the marker crash did.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useTokens } from '@/theme/ThemeProvider';
import { SCIcon } from '@/components/SCIcon';
import {
  DEFAULT_REGION, DEFAULT_RADIUS_M,
  eventLatLng, pinColor, type MapProps,
} from './types';

interface PinPosition { x: number; y: number; }

// Mercator y-projection of a latitude in degrees. This is the projection
// Apple Maps and Google Maps both use for map tiles, so pins computed
// against the visible region land at the exact same screen position
// where a native annotation would have rendered.
//
// The clamp avoids the asymptote at ±90° (tan(π/2) → ∞). Anywhere this
// app actually shows on a map is far from the clamp limits.
function mercatorY(latDeg: number): number {
  const latRad = (latDeg * Math.PI) / 180;
  const clamped = Math.max(-1.4835, Math.min(1.4835, latRad));
  return Math.log(Math.tan(Math.PI / 4 + clamped / 2));
}

export function Map({
  events, user, initialCenter = DEFAULT_REGION, centerOn, radiusM = DEFAULT_RADIUS_M,
  meInterests = [],
  onPinPress, onMapPress, onRegionChange, interactive = true, style, selectedId,
}: MapProps) {
  const t = useTokens();
  // centerOn (a focused event) wins over the you-are-here center. The
  // initialRegion derived from this is used by MapView only at mount;
  // after that, the region tracked in state below is the source of
  // truth for pin projection.
  const center = centerOn ?? user ?? initialCenter;

  // Imperative handle on the MapView so the recenter button can call
  // animateToRegion. Stays null until the MapView mounts.
  const mapRef = useRef<MapView | null>(null);

  // Current visible region. Initialised from `center` for the mount-
  // time render; updated continuously by onRegionChange while the user
  // pans / zooms.
  const [region, setRegion] = useState<Region>({
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  });

  // Pixel size of the map viewport. Captured via onLayout on the
  // wrapper View. Pin projection needs this to map degrees → pixels.
  const [viewSize, setViewSize] = useState<{ w: number; h: number } | null>(null);

  // Memoised per-pin data — stable across renders unless events,
  // palette tokens, or the user's interests change.
  const markerData = useMemo(
    () => events.map(e => ({
      id: e.id,
      e,
      ll: eventLatLng(e),
      color: pinColor(e, t, meInterests),
    })),
    [events, t, meInterests],
  );

  // Project every pin's lat/lng to a screen {x, y}. Synchronous, pure
  // arithmetic, recomputed only when the region, viewport size, or
  // pin set changes — so the cost is bounded but the result is
  // immediately available for the next render. No pointForCoordinate
  // async dance, no waiting on a native bridge round-trip per frame.
  //
  // Off-screen pins are skipped to keep the overlay tree small; the
  // 0.1° pad lets pins just beyond the visible region still render
  // their tail end (matches native-annotation behaviour at edges).
  const positions = useMemo<Record<string, PinPosition>>(() => {
    if (!viewSize) return {};
    const { w, h } = viewSize;
    const halfLat = region.latitudeDelta / 2;
    const halfLng = region.longitudeDelta / 2;
    const southLat = region.latitude - halfLat;
    const northLat = region.latitude + halfLat;
    const westLng = region.longitude - halfLng;
    const eastLng = region.longitude + halfLng;
    // Mercator y bounds for the current region — pre-computed once.
    const yNorth = mercatorY(northLat);
    const ySouth = mercatorY(southLat);
    const ySpan = yNorth - ySouth;

    const next: Record<string, PinPosition> = {};
    for (const { id, ll } of markerData) {
      if (
        ll.latitude  < southLat - 0.1 ||
        ll.latitude  > northLat + 0.1 ||
        ll.longitude < westLng - 0.1 ||
        ll.longitude > eastLng + 0.1
      ) continue;
      // Longitude is linear in Mercator x; map [westLng..eastLng] → [0..w].
      const x = ((ll.longitude - westLng) / region.longitudeDelta) * w;
      // Latitude is logarithmic in Mercator y; map [yNorth..ySouth] → [0..h].
      const yPin = mercatorY(ll.latitude);
      const y = ((yNorth - yPin) / ySpan) * h;
      next[id] = { x, y };
    }
    return next;
  }, [markerData, region, viewSize]);

  const onLayout = useCallback((ev: LayoutChangeEvent) => {
    const { width, height } = ev.nativeEvent.layout;
    setViewSize(prev => {
      if (prev && prev.w === width && prev.h === height) return prev;
      return { w: width, h: height };
    });
  }, []);

  // Skip the setState (and therefore the render) when the native
  // MapView reports a region identical to what we already have. iOS
  // and Android both occasionally fire onRegionChange with no actual
  // change during quiescence; this guard avoids the wasted reconcile.
  const updateRegion = useCallback((next: Region) => {
    setRegion(prev => {
      if (
        prev.latitude === next.latitude &&
        prev.longitude === next.longitude &&
        prev.latitudeDelta === next.latitudeDelta &&
        prev.longitudeDelta === next.longitudeDelta
      ) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    if (__DEV__) {
      console.log('[Map] selectedId →', selectedId ?? 'null', '· events:', events.length);
    }
  }, [selectedId, events.length]);

  // Recenter the map on (in priority order):
  //   1. the selected event's coordinates, if any
  //   2. the user's current location, if available
  //   3. the initialCenter prop (defaults to UCI / Irvine)
  // Animation uses the current region's deltas so the zoom level is
  // preserved across the recenter — only the centroid changes.
  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    let target = initialCenter;
    if (selectedId) {
      const found = markerData.find(m => m.id === selectedId);
      if (found) target = found.ll;
    } else if (user) {
      target = user;
    }
    map.animateToRegion(
      {
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      },
      300,
    );
  }, [selectedId, markerData, user, initialCenter, region.latitudeDelta, region.longitudeDelta]);

  return (
    <View
      onLayout={onLayout}
      // In preview (non-interactive) mode let touches fall through to a
      // parent Pressable so tapping the snapshot opens the full Map tab.
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[{ width: '100%' as const, height: 300 }, style as StyleProp<ViewStyle>]}
    >
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        // Continuous: fires on every frame the map moves. Keeping the
        // pins glued to their geographic positions while the user is
        // panning depends on this — onRegionChangeComplete alone would
        // only update on gesture end (the original 'snap-back' bug).
        onRegionChange={updateRegion}
        onRegionChangeComplete={(r) => {
          updateRegion(r);
          onRegionChange?.({ latitude: r.latitude, longitude: r.longitude });
        }}
        // Tap on the map background (anywhere that isn't a pin) →
        // onMapPress. The pin overlay below uses pointerEvents='box-none'
        // and individual Pressables for the pins themselves, so a tap
        // either hits a Pressable (→ onPinPress) OR falls through to
        // the MapView (→ this handler). The two are mutually exclusive
        // per gesture, so no cross-fire guard is needed here.
        onPress={interactive ? () => onMapPress?.() : undefined}
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
        {/* NO <Marker>s — see file header. Event pins live in the
            overlay below. */}
      </MapView>

      {/* Pin overlay. pointerEvents='box-none' lets taps fall through
          to the underlying MapView for pan / zoom when not on a pin;
          each Pressable inside captures its own hits. */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {markerData.map(({ id, e, color }) => {
          const pos = positions[id];
          if (!pos) return null;
          const selected = id === selectedId;
          const size = selected ? 28 : 20;
          const half = size / 2;
          return (
            <Pressable
              key={id}
              accessibilityLabel={e.title}
              hitSlop={8}
              onPress={() => {
                if (__DEV__) {
                  console.log('[Map] Pin tap', {
                    id, title: e.title, wasSelected: selected,
                  });
                }
                onPinPress?.(e);
              }}
              style={{
                position: 'absolute',
                left: pos.x - half,
                top: pos.y - half,
                width: size,
                height: size,
                borderRadius: half,
                backgroundColor: color,
                borderWidth: selected ? 3 : 2,
                borderColor: 'white',
                // Selected pin floats above the rest so an overlapping
                // cluster doesn't bury the chosen one.
                zIndex: selected ? 999 : 1,
                // Subtle drop shadow so the pin reads against light /
                // dark map tiles.
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowOffset: { width: 0, height: 1 },
                shadowRadius: 2,
                elevation: 3,
              }}
            />
          );
        })}
      </View>

      {/* Recenter button. Sits in the bottom-right corner of the map,
          floating above the tiles + pin overlay. Tap target:
            • selected event's coordinates, if any
            • the user's current location, otherwise
            • the initialCenter (default region), if neither is available.
          Only rendered in interactive mode so the static MapPreview on
          the Home tab doesn't get one. */}
      {interactive && (
        <Pressable
          onPress={recenter}
          accessibilityLabel="Recenter map"
          hitSlop={8}
          style={({ pressed }) => [{
            position: 'absolute',
            bottom: 12,
            right: 12,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: t.card,
            borderWidth: 1,
            borderColor: t.line,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 4,
            elevation: 4,
          }, pressed && { opacity: 0.7 }]}
        >
          <SCIcon name="crosshair" size={18} color={t.ink} />
        </Pressable>
      )}
    </View>
  );
}
