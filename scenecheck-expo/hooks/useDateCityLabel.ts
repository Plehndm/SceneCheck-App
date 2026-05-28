// Builds the "Sat May 9 · Irvine" label shown in the Home + Map
// headers. The date is always live (`fmtDate(new Date())`). The
// city comes from reverse-geocoding the user's coordinates IF
// location permission was granted; otherwise the label is just the
// date — per the requirement "if the user does not allow location
// then just display the day of the week and date."
//
// Location is passed in (not read internally) so the screen owns the
// single `useLocation()` call and the label/map share one GPS read
// instead of double-firing `getCurrentPositionAsync()` per mount
// (M4 in CODE_REVIEW_REPORT_3.md).
//
// Reverse geocoding is native-only in expo-location; on web (and in
// the jest mock) it throws or returns nothing, which the try/catch
// funnels into the date-only path.

import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { fmtDate } from '@/lib/date-time';
import type { LatLng } from '@/components/Map/types';
import type { LocationStatus } from '@/hooks/useLocation';

export function useDateCityLabel(coords: LatLng | null, status: LocationStatus): string {
  const [city, setCity] = useState<string | null>(null);

  // Recompute the date once per mount (a header doesn't need to tick
  // at midnight — a fresh app open re-evaluates it).
  const dateLabel = fmtDate(new Date());

  // Pull the lat/lng off the coords prop so the effect dependency list can
  // be primitive numbers (avoids re-running on a new {lat,lng} object
  // reference each render).
  const latitude = coords?.latitude;
  const longitude = coords?.longitude;

  useEffect(() => {
    if (status !== 'granted' || latitude == null || longitude == null) {
      setCity(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (cancelled) return;
        const first = results?.[0];
        // `city` is the precise field; fall back to subregion
        // (county) or region (state) when a reverse-geocoder doesn't
        // return a city name for the point.
        setCity(first?.city || first?.subregion || first?.region || null);
      } catch {
        if (!cancelled) setCity(null);
      }
    })();
    return () => { cancelled = true; };
  }, [status, latitude, longitude]);

  return city ? `${dateLabel} · ${city}` : dateLabel;
}
