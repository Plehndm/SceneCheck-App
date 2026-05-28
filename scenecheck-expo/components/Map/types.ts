// Shared prop types between the native and web map implementations. The
// architecture doc (FR4.2 discovery radius, FR4.4 pin color-coding by
// source, FR10.3 proximity alerts) drives the shape here — every prop a
// platform implementation might need is declared once.

import type { SCEvent } from '@/types/domain';
import { eventCategory } from '@/lib/events';

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
  // Center the map here, taking precedence over `user`/`initialCenter`. Used to
  // focus a specific event (e.g. tapping "View location" on an event). On web
  // it pans imperatively; on native, remount the Map (key) for it to apply.
  centerOn?: LatLng;
  // Search radius in meters — drawn as a translucent circle around `user`.
  radiusM?: number;
  // Interest tags the current user has subscribed to. Used by pinColor to
  // mark recommended events. Passed as a prop instead of read from the
  // global store so the Map component stays prop-driven and testable
  // without a Zustand provider.
  meInterests?: string[];
  // Pin tap callback. Native uses the marker's onPress; web uses the marker click.
  onPinPress?: (event: SCEvent) => void;
  // Map-background tap (anywhere that isn't a pin). The screen wires this to
  // clear the focused selection so the "tap off the pin to deselect" UX
  // works without requiring the user to hunt for the CLEAR button on the
  // focused-event card.
  onMapPress?: () => void;
  // The currently-selected event's id. Its pin renders enlarged + ringed (the
  // same look a tap produces) — so arriving from an event's "View location"
  // highlights that pin, not just centers on it.
  selectedId?: string;
  // Optional callback when the user pans/zooms — Phase 5.x will use this
  // to refresh `events` from `api.fetchEvents(lat, lng, radius)`.
  onRegionChange?: (center: LatLng) => void;
  // When false, the map renders real device-specific tiles + pins but
  // disables every gesture (pan / zoom / rotate / pitch). Used by the
  // Home-screen `MapPreview` to show a static "lay of the land"
  // snapshot of the actual map the user would see on the Map tab.
  // Defaults to true (the full interactive Map tab).
  interactive?: boolean;
  // Accept any ViewStyle-compatible shape; the implementations cast.
  style?: unknown;
}

// Default region centered on UCI (Aldrich Park area, per architecture doc).
export const DEFAULT_REGION: LatLng = { latitude: 33.6461, longitude: -117.8427 };
export const DEFAULT_RADIUS_M = 8047; // 5 miles, matches api.fetchEvents default

// Real-world coordinates for an event. Prefer `lat`/`lng` from the database
// row; fall back to the prototype's normalized x/y transform for fixtures
// that don't have explicit coordinates. The forward transform in the
// legacy api.js was:
//   x = (lng + 117.88) / 0.12
//   y = (lat - 33.62)  / 0.06
// so the inverse used for x/y fallback is:
export function eventLatLng(e: SCEvent): LatLng {
  if (e.lat != null && e.lng != null) {
    return { latitude: e.lat, longitude: e.lng };
  }
  return {
    latitude:  33.62 + e.y * 0.06,
    longitude: -117.88 + e.x * 0.12,
  };
}

// Pin color for a given event. Each color maps 1:1 to a map-legend
// entry, chosen by the event's relationship to you (highest-priority
// bucket wins):
//
//   primary      → "Your events"  — you host it (kind 'yours')
//   accentFriend → "Friends"      — a friend hosts it (kind 'friend')
//   accentBlue   → "Recommended"  — it matches one of your interests (this is
//                                    the only thing that makes an event
//                                    recommended now; a scraped/app-discovered
//                                    event you have no interest in is "Other")
//   mapPinMute   → "Other"        — anything else (e.g. an org/scraped event
//                                    you have no interest connection to)
//
// Components import this so both map implementations + the legend stay in
// sync.
export function pinColor(
  e: SCEvent,
  tokens: { primary: string; accentFriend: string; accentBlue: string; mapPinMute: string },
  meInterests: string[] = [],
): string {
  // Same bucket the labels use (lib/events.eventCategory), so color + label
  // never disagree.
  switch (eventCategory(e, meInterests)) {
    case 'yours': return tokens.primary;
    case 'friend': return tokens.accentFriend;
    case 'recommended': return tokens.accentBlue;
    default: return tokens.mapPinMute;
  }
}
