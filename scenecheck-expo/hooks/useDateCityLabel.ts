// Builds the "Sat May 9 · Irvine" label shown in the Home + Map
// headers. The date is always live (`fmtDate(new Date())`). The
// city comes from reverse-geocoding the user's coordinates IF
// location permission was granted; otherwise the label is just the
// date — per the requirement "if the user does not allow location
// then just display the day of the week and date."
//
// Reverse geocoding is native-only in expo-location; on web (and in
// the jest mock) it throws or returns nothing, which the try/catch
// funnels into the date-only path.

import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { useLocation } from '@/hooks/useLocation';
import { fmtDate } from '@/lib/date-time';

export function useDateCityLabel(): string {
  const { coords, status } = useLocation();
  const [city, setCity] = useState<string | null>(null);

  // Recompute the date once per mount (a header doesn't need to tick
  // at midnight — a fresh app open re-evaluates it).
  const dateLabel = fmtDate(new Date());

  useEffect(() => {
    if (status !== 'granted') {
      setCity(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
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
  }, [status, coords.latitude, coords.longitude]);

  return city ? `${dateLabel} · ${city}` : dateLabel;
}
