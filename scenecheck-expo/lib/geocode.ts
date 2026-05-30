// Free-form place / address → up to 5 candidates via OpenStreetMap Nominatim
// (no API key, CORS-enabled, works on web + native). Results are biased to a
// viewbox centred on `near` (the user's location, or a default region) and
// `bounded` to it, so the dropdown surfaces nearby matches rather than
// far-flung ones. Returns [] on no match / network failure.
//
// Shared by the native LocationPickerSheet and the web create-event location
// field so the geocoding behaviour (and the courtesy bias to the user) stays
// identical across platforms.

export interface LatLngLite {
  latitude: number;
  longitude: number;
}

export interface PlaceSuggestion {
  label: string;
  lat: number;
  lng: number;
}

// Half-width of the bias box in degrees (~40mi). Wide enough to cover the
// surrounding metro, tight enough to keep results local.
const BIAS_BOX_DEG = 0.6;

export async function suggestPlaces(q: string, near: LatLngLite): Promise<PlaceSuggestion[]> {
  const { latitude: lat, longitude: lng } = near;
  const viewbox = `${lng - BIAS_BOX_DEG},${lat - BIAS_BOX_DEG},${lng + BIAS_BOX_DEG},${lat + BIAS_BOX_DEG}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5`
    + `&viewbox=${encodeURIComponent(viewbox)}&bounded=1&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (Array.isArray(data)) {
      return data
        .map((d: { display_name?: string; lat?: string; lon?: string }) => ({
          label: String(d.display_name ?? ''),
          lat: parseFloat(String(d.lat)),
          lng: parseFloat(String(d.lon)),
        }))
        .filter(s => s.label && Number.isFinite(s.lat) && Number.isFinite(s.lng));
    }
  } catch {
    /* network / parse failure → no suggestions */
  }
  return [];
}
