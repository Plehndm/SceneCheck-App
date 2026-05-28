// Native map implementation — iOS uses Apple Maps, Android uses Google
// Maps (requires GOOGLE_MAPS_API_KEY in app.json's `android.config`
// block to render tiles; we leave that as a deploy-time concern).
//
// Metro auto-selects this file on iOS/Android via the `.native.tsx`
// suffix; the TS-only Map.tsx is the fallback the typechecker resolves.
//
// Why this file does NOT render react-native-maps <Marker>s:
// ──────────────────────────────────────────────────────────────────────
// Several iterations of marker-based pin rendering all crashed the app
// after 2–3 pin selections in a row. Captured device logs proved every
// JS-side call landed correctly (onPress, state updates, every effect)
// before the crash silence — so the bug lives entirely on the native
// side. Specifically: react-native-maps@1.20.x (the version bundled
// inside Expo Go for SDK 54) has known issues in its marker / annotation
// update pipeline that we can't reach from JS:
//   - Dropping title / description (no callout) didn't help.
//   - Imperative showCallout via Marker ref didn't help.
//   - Memoizing markers + stable refs didn't help (and was buggy too:
//     the per-pin onPress depended on selectedId, so the React.memo
//     equality check was invalidated on every selection anyway).
//   - Upgrading react-native-maps in package.json was a no-op because
//     Expo Go bundles a fixed native version.
//
// The custom-overlay approach below sidesteps the entire marker system.
// MapView renders ONLY the user-location indicator and the discovery-
// radius circle. Event "pins" are absolute-positioned React Native
// <Pressable> Views laid on top of the map, anchored at the screen
// coordinates we compute by projecting each event's lat/lng through
// MapView.pointForCoordinate(...). There are no native annotations
// involved, so there's no annotation cache to poison, no select/
// deselect lifecycle to corrupt, no count-based crash threshold.
//
// Trade-offs we accept:
//   - Pin positions update when the map region settles (we recompute on
//     onRegionChangeComplete + on map ready + when the events list
//     changes). During an active pan / zoom the pins lag the tiles
//     until the gesture ends. This is the standard cost of an overlay
//     versus a native annotation, and is acceptable here because the
//     map is mainly used at rest for tapping a pin and reading the
//     focused card below.
//   - We lose react-native-maps' built-in tap-target sizing magic.
//     Mitigated with hitSlop={8} on each Pressable so the effective
//     touch area is ~36 px even though the visible dot is 20 px.
//
// Diagnostic __DEV__ logs are preserved so a future regression — or any
// unexpected behaviour the user hits during normal use — can be debugged
// from the device console the same way the marker crash was.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTokens } from '@/theme/ThemeProvider';
import {
  DEFAULT_REGION, DEFAULT_RADIUS_M,
  eventLatLng, pinColor, type MapProps,
} from './types';

interface PinPosition {
  x: number;
  y: number;
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

  const mapRef = useRef<MapView | null>(null);
  // Screen coords for each pin, by event id. Empty until the MapView is
  // ready + we've run the first projection pass.
  const [positions, setPositions] = useState<Record<string, PinPosition>>({});
  // MapView.pointForCoordinate returns garbage (or rejects) before the
  // map has finished laying out, so we wait for onMapReady before
  // running the first projection.
  const [mapReady, setMapReady] = useState(false);

  // Per-pin data, memoized. Stable across renders that don't change the
  // event list, the palette tokens, or the user's interests.
  const markerData = useMemo(
    () => events.map(e => ({
      id: e.id,
      e,
      ll: eventLatLng(e),
      color: pinColor(e, t, meInterests),
    })),
    // `t` is the tokens object from useTokens(); it's stable across
    // renders that don't touch the palette / mode, so listing the whole
    // object keeps the dep list short without invalidating the memo on
    // unrelated re-renders.
    [events, t, meInterests],
  );

  // Project every pin's lat/lng to a screen {x, y}. Called on:
  //   - the first onMapReady fire
  //   - whenever the event list (or palette / interests) changes
  //   - whenever the map region settles after a pan / zoom
  // Pins that fail to project (off-screen, or transiently rejected by
  // the native side during a layout pass) are simply omitted from
  // `positions`; the render loop below skips any id without a position.
  const projectAll = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const results = await Promise.all(
      markerData.map(async ({ id, ll }) => {
        try {
          const pt = await map.pointForCoordinate(ll);
          return { id, pos: { x: pt.x, y: pt.y } };
        } catch {
          return null;
        }
      }),
    );
    const next: Record<string, PinPosition> = {};
    for (const r of results) if (r) next[r.id] = r.pos;
    setPositions(next);
    if (__DEV__) {
      console.log('[Map] projected', { count: Object.keys(next).length });
    }
  }, [markerData, mapReady]);

  // Re-project whenever the inputs change.
  useEffect(() => { projectAll(); }, [projectAll]);

  // Diagnostic — fires when selection or events count changes.
  useEffect(() => {
    if (__DEV__) {
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
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={(region) => {
          onRegionChange?.({ latitude: region.latitude, longitude: region.longitude });
          // Re-project after the gesture settles so the pins land in
          // their new screen positions.
          projectAll();
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
        {/* NO <Marker>s here — see the file header. Pins live in the
            overlay below. */}
      </MapView>

      {/* Pin overlay. pointerEvents='box-none' on the container lets
          taps fall through to the underlying MapView for pan / zoom;
          each Pressable inside captures its own taps. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        }}
      >
        {markerData.map(({ id, e, color }) => {
          const pos = positions[id];
          if (!pos) return null;
          const selected = id === selectedId;
          // Slightly bigger dot when selected; thicker white ring too.
          const size = selected ? 28 : 20;
          const half = size / 2;
          return (
            <Pressable
              key={id}
              accessibilityLabel={e.title}
              // hitSlop=8 makes the effective tap target 36 px square
              // even though the visible dot is 20 px (or 28 px when
              // selected). Matches what react-native-maps gave us for
              // free on native markers.
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
    </View>
  );
}
