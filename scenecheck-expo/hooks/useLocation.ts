// useLocation — small wrapper around expo-location. On first call it
// requests foreground permission, then watches the device coordinates
// and exposes them as a stable LatLng. Falls back to the UCI default
// region if permission is denied or the device is unavailable.
//
// FR1.5 in the requirements doc: "App requests location permission
// after sign-up and on first map view." This hook is the single place
// that request happens.

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { DEFAULT_REGION, type LatLng } from '@/components/Map/types';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export interface UseLocationResult {
  status: LocationStatus;
  coords: LatLng;     // always a usable value (defaults to UCI on denial)
  isFallback: boolean; // true when `coords` is the default rather than real GPS
  request: () => Promise<void>;
}

export function useLocation(): UseLocationResult {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<LatLng>(DEFAULT_REGION);

  // Stable identity across renders — callers (e.g. the map's "Allow location"
  // Pressable) hand this to `onPress`, and consumers that depend on `request`
  // (the auto-mount effect below) only need to re-fire when the function
  // genuinely changes, which is never. `setStatus` / `setCoords` are React's
  // stable setters so the empty dep array is correct.
  const request = useCallback(async () => {
    setStatus('requesting');
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setStatus('denied');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        // Balanced is fast enough for event-discovery; FR4.2 doesn't need cm precision.
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      setStatus('granted');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    // Auto-request on mount. Web's permission dialog only fires the first
    // time per origin; native shows the system prompt.
    if (Platform.OS !== 'web') {
      void request();
    } else {
      // On web, defer to user gesture (browsers block automatic geolocation).
      // The map screen calls `request()` from a button if needed.
      setStatus('idle');
    }
  }, [request]);

  return {
    status,
    coords,
    isFallback: status !== 'granted',
    request,
  };
}
