// Shared prop types between the native and web map implementations. The
// architecture doc (FR4.2 discovery radius, FR4.4 pin color-coding by
// source, FR10.3 proximity alerts) drives the shape here — every prop a
// platform implementation might need is declared once.

import type { SCEvent } from '@/types/domain';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MapProps {
  events: SCEvent[];
  // User's current location ("you are here" marker). When undefined the
  // map centers on the default region (UCI / Irvine).
  user?: LatLng;
  // Initial region center; defaults to UCI when omitted.
  initialCenter?: LatLng;
  // Search radius in meters — drawn as a translucent circle around `user`.
  radiusM?: number;
  // Pin tap callback. Native uses the marker's onPress; web uses the marker click.
  onPinPress?: (event: SCEvent) => void;
  // Optional callback when the user pans/zooms — Phase 5.x will use this
  // to refresh `events` from `api.fetchEvents(lat, lng, radius)`.
  onRegionChange?: (center: LatLng) => void;
  // Accept any ViewStyle-compatible shape; the implementations cast.
  style?: unknown;
}

// Default region centered on UCI (Aldrich Park area, per architecture doc).
export const DEFAULT_REGION: LatLng = { latitude: 33.6461, longitude: -117.8427 };
export const DEFAULT_RADIUS_M = 8047; // 5 miles, matches api.fetchEvents default

// Derive a real lat/lng from the prototype's normalized x/y when the
// event row doesn't have explicit coordinates. The forward transform in
// the legacy api.js was:
//   x = (lng + 117.88) / 0.12
//   y = (lat - 33.62)  / 0.06
// so the inverse is:
export function eventLatLng(e: SCEvent): LatLng {
  return {
    latitude:  33.62 + e.y * 0.06,
    longitude: -117.88 + e.x * 0.12,
  };
}

// Pin color for a given event, mirroring the SVG map's legacy palette.
// Components import this so the legend stays in sync with both map
// implementations.
export function pinColor(
  e: SCEvent,
  tokens: { primary: string; accentFriend: string; accentBlue: string; mapPinMute: string },
  meInterests: string[] = [],
): string {
  const sharesTag = e.interests.some(tag => meInterests.includes(tag));
  const isRec = e.kind === 'recommended' || sharesTag;
  if (e.kind === 'yours') return tokens.primary;
  if (e.kind === 'friend') return isRec ? tokens.accentFriend : tokens.mapPinMute;
  return isRec ? tokens.accentBlue : tokens.mapPinMute;
}
