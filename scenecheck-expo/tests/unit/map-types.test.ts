// Unit tests for components/Map/types.ts — the pin color resolver and
// the x/y → lat/lng inverse transform. These are shared between the
// native and web map implementations, so a bug here would break both.

import { eventLatLng, pinColor, DEFAULT_REGION, DEFAULT_RADIUS_M } from '@/components/Map/types';
import { SC_EVENT_BY_ID } from '@/data/mocks';

const TOKENS = {
  primary: '#FF5B47',
  accentFriend: '#1A1714',
  accentBlue: '#2E7BFF',
  mapPinMute: '#A89E8C',
};

describe('eventLatLng', () => {
  test('inverse of the legacy x/y → lng/lat transform', () => {
    // The forward transform in src/api.js was:
    //   x = (lng + 117.88) / 0.12  →  lng = x * 0.12 - 117.88
    //   y = (lat - 33.62)  / 0.06  →  lat = y * 0.06 + 33.62
    const ll = eventLatLng({ ...SC_EVENT_BY_ID.e1, x: 0.5, y: 0.5 });
    expect(ll.longitude).toBeCloseTo(-117.82, 5);
    expect(ll.latitude).toBeCloseTo(33.65, 5);
  });

  test('handles event with x=0 / y=0', () => {
    const ll = eventLatLng({ ...SC_EVENT_BY_ID.e1, x: 0, y: 0 });
    expect(ll.longitude).toBeCloseTo(-117.88, 5);
    expect(ll.latitude).toBeCloseTo(33.62, 5);
  });
});

describe('pinColor', () => {
  test('returns primary for kind: yours', () => {
    expect(pinColor(SC_EVENT_BY_ID.e1, TOKENS, [])).toBe(TOKENS.primary);
  });

  test('returns accentFriend ("Friends") for a friend-hosted event, regardless of interests', () => {
    // e2 (friend) — a friend's event is "Friends" whether or not it shares
    // a tag with you (this is the legend-alignment fix).
    expect(pinColor(SC_EVENT_BY_ID.e2, TOKENS, ['uci'])).toBe(TOKENS.accentFriend);
    expect(pinColor(SC_EVENT_BY_ID.e2, TOKENS, ['nothing-relevant'])).toBe(TOKENS.accentFriend);
  });

  test('a scraped/recommended event is "Recommended" only when it shares an interest', () => {
    // e4 (kind:'recommended') has interests ['running','uci']. It's only blue
    // when the user shares one of those — being scraped is no longer enough.
    expect(pinColor(SC_EVENT_BY_ID.e4, TOKENS, ['uci'])).toBe(TOKENS.accentBlue);
    expect(pinColor(SC_EVENT_BY_ID.e4, TOKENS, [])).toBe(TOKENS.mapPinMute);
    expect(pinColor(SC_EVENT_BY_ID.e4, TOKENS, ['cooking'])).toBe(TOKENS.mapPinMute);
  });

  test('returns accentBlue ("Recommended") for an org event that shares an interest', () => {
    // e9 is kind:org with interest 'uci' — user has 'uci', so it's "recommended".
    expect(pinColor(SC_EVENT_BY_ID.e9, TOKENS, ['uci'])).toBe(TOKENS.accentBlue);
  });

  test('returns mapPinMute ("Other") for an org event with no shared interest', () => {
    expect(pinColor(SC_EVENT_BY_ID.e9, TOKENS, [])).toBe(TOKENS.mapPinMute);
  });
});

describe('Map defaults', () => {
  test('default region is UCI / Aldrich Park', () => {
    expect(DEFAULT_REGION.latitude).toBeCloseTo(33.6461, 4);
    expect(DEFAULT_REGION.longitude).toBeCloseTo(-117.8427, 4);
  });

  test('default radius is 10 miles (16093m)', () => {
    expect(DEFAULT_RADIUS_M).toBe(16093);
  });
});
