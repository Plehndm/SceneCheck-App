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

  test('returns accentFriend for kind: friend when interests overlap', () => {
    // e2 (friend) has interests ['cooking','uci']; "uci" overlaps below.
    expect(pinColor(SC_EVENT_BY_ID.e2, TOKENS, ['uci'])).toBe(TOKENS.accentFriend);
  });

  test('returns mapPinMute for kind: friend with no shared interests', () => {
    expect(pinColor(SC_EVENT_BY_ID.e2, TOKENS, ['nothing-relevant'])).toBe(TOKENS.mapPinMute);
  });

  test('returns accentBlue for recommended events', () => {
    expect(pinColor(SC_EVENT_BY_ID.e4, TOKENS, [])).toBe(TOKENS.accentBlue);
  });

  test('returns accentBlue for org events that share an interest with the user', () => {
    // e9 is kind:org with interest 'uci' — user has 'uci', so it's "recommended".
    expect(pinColor(SC_EVENT_BY_ID.e9, TOKENS, ['uci'])).toBe(TOKENS.accentBlue);
  });
});

describe('Map defaults', () => {
  test('default region is UCI / Aldrich Park', () => {
    expect(DEFAULT_REGION.latitude).toBeCloseTo(33.6461, 4);
    expect(DEFAULT_REGION.longitude).toBeCloseTo(-117.8427, 4);
  });

  test('default radius is 5 miles (8047m)', () => {
    expect(DEFAULT_RADIUS_M).toBe(8047);
  });
});
