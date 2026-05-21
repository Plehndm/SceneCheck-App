// Bottom-sheet map picker for an event's location. Two ways to set the
// point: (1) type a place/address and pick from a live suggestions
// dropdown, or (2) drag the map so the fixed center pin marks the spot.
// Either way the map's center (reported via `onRegionChange`) is returned
// as { lat, lng } on confirm.
//
// We pass `initialCenter` (not `user`) to <Map>: the `user` prop drives a
// recenter effect on web that would fight every pan and loop. To jump the
// map (after picking a suggestion) we remount it via a changing `key`,
// while the center-pin overlay marks the chosen point.

import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { SCButton } from './SCAddButton';
import { Map } from './Map';
import { DEFAULT_REGION, type LatLng } from './Map/types';
import { useLocation } from '@/hooks/useLocation';
import { useTokens } from '@/theme/ThemeProvider';
import { RADIUS } from '@/theme/tokens';

interface Props {
  visible: boolean;
  initial?: { lat: number; lng: number } | null;
  onClose: () => void;
  onConfirm: (coords: { lat: number; lng: number }) => void;
}

interface Suggestion { label: string; lat: number; lng: number }

// Free-form place/address → up to 5 candidates, via OpenStreetMap
// Nominatim (no API key, CORS-enabled, works on web + native). Returns []
// on no match / network failure.
async function suggestPlaces(q: string): Promise<Suggestion[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
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
    /* network/parse failure → no suggestions */
  }
  return [];
}

export function LocationPickerSheet({ visible, initial, onClose, onConfirm }: Props) {
  const t = useTokens();
  const { coords } = useLocation();
  // Start at the already-picked point, else the host's location, else UCI.
  const start: LatLng = initial
    ? { latitude: initial.lat, longitude: initial.lng }
    : coords ?? DEFAULT_REGION;
  const [center, setCenter] = useState<LatLng>(start);
  // Bumping this remounts <Map> so a new `initialCenter` takes effect —
  // how we jump the map to a chosen suggestion without the recenter loop.
  const [mapKey, setMapKey] = useState(0);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  // Skip the next debounced fetch — set when WE change the query text
  // (selecting a suggestion) so the dropdown doesn't immediately reopen.
  const skipNext = useRef(false);

  // Re-seed each time the sheet opens (the Map remounts on `visible`/key).
  useEffect(() => {
    if (visible) {
      setCenter(start);
      setMapKey(k => k + 1);
      setQuery('');
      setSuggestions([]);
      setNoMatch(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Debounced autocomplete — fetch as the user types (≥3 chars).
  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    const q = query.trim();
    if (q.length < 3) { setSuggestions([]); return; }
    let cancelled = false;
    const handle = setTimeout(async () => {
      const results = await suggestPlaces(q);
      if (!cancelled) setSuggestions(results);
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query]);

  const selectSuggestion = (s: Suggestion) => {
    skipNext.current = true;
    setQuery(s.label.split(',')[0]); // short label in the box
    setSuggestions([]);
    setNoMatch(false);
    setCenter({ latitude: s.lat, longitude: s.lng });
    setMapKey(k => k + 1); // remount → map jumps to the result
  };

  // GO / submit: jump to the current top suggestion, else fetch one.
  const runSearch = async () => {
    const q = query.trim();
    if (!q || searching) return;
    if (suggestions.length > 0) { selectSuggestion(suggestions[0]); return; }
    setSearching(true);
    setNoMatch(false);
    const results = await suggestPlaces(q);
    setSearching(false);
    if (results.length > 0) selectSuggestion(results[0]);
    else setNoMatch(true);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: t.card,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 16, paddingBottom: 28, paddingHorizontal: 18, gap: 12,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <SCText variant="mono" size={10} weight="600" color={t.ink3}>SET LOCATION</SCText>
              <SCText variant="displayTight" size={22}>Pin the spot</SCText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close location picker"
              style={({ pressed }) => [{
                width: 36, height: 36, borderRadius: 18, backgroundColor: t.subtle,
                alignItems: 'center', justifyContent: 'center',
              }, pressed && { opacity: 0.85 }]}
            >
              <SCIcon name="x" size={16} color={t.ink2} />
            </Pressable>
          </View>

          {/* Search box + autocomplete dropdown (overlays the map below). */}
          <View style={{ position: 'relative', zIndex: 10 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: t.subtle, borderRadius: RADIUS.md, paddingHorizontal: 12, height: 44,
            }}>
              <SCIcon name="search" size={16} color={t.ink3} />
              <TextInput
                value={query}
                onChangeText={(v) => { setQuery(v); setNoMatch(false); }}
                onSubmitEditing={runSearch}
                returnKeyType="search"
                placeholder="Search a place or address…"
                placeholderTextColor={t.ink3}
                autoCorrect={false}
                style={{ flex: 1, color: t.ink, fontSize: 14, height: '100%' }}
              />
              <Pressable onPress={runSearch} disabled={searching} accessibilityLabel="Search location">
                <SCText variant="mono" size={11} weight="700" color={t.primary}>
                  {searching ? '…' : 'GO'}
                </SCText>
              </Pressable>
            </View>

            {suggestions.length > 0 && (
              <View style={{
                position: 'absolute', top: 48, left: 0, right: 0, zIndex: 20,
                backgroundColor: t.card, borderColor: t.line, borderWidth: 1,
                borderRadius: RADIUS.md, overflow: 'hidden',
                shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 }, elevation: 8,
              }}>
                {suggestions.map((s, i) => (
                  <Pressable
                    key={`${s.lat},${s.lng},${i}`}
                    onPress={() => selectSuggestion(s)}
                    style={({ pressed }) => [{
                      flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
                      borderBottomWidth: i < suggestions.length - 1 ? 1 : 0, borderBottomColor: t.line,
                    }, pressed && { backgroundColor: t.subtle }]}
                  >
                    <SCIcon name="pin" size={14} color={t.ink3} />
                    <SCText size={13} color={t.ink2} numberOfLines={2} style={{ flex: 1 }}>{s.label}</SCText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <SCText size={11} color={noMatch ? t.danger : t.ink3}>
            {noMatch ? 'No match — try a more specific name.' : 'Search, or drag the map so the pin marks the spot.'}
          </SCText>

          <View style={{
            height: 260, borderRadius: RADIUS.lg, overflow: 'hidden',
            borderWidth: 1, borderColor: t.line,
          }}>
            {visible && (
              <Map
                key={mapKey}
                events={[]}
                initialCenter={center}
                radiusM={0}
                onRegionChange={(c) => setCenter(c)}
                style={{ width: '100%', height: '100%' }}
              />
            )}
            {/* Fixed center pin — marks the map center the gesture reports. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {/* Nudge up so the pin's tip rests on the exact center. */}
              <View style={{ marginBottom: 26 }}>
                <SCIcon name="pin" size={34} color={t.primary} />
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SCIcon name="crosshair" size={14} color={t.ink3} />
            <SCText variant="mono" size={12} color={t.ink2}>
              {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
            </SCText>
          </View>

          <SCButton
            label="Use this location"
            size="lg"
            onPress={() => {
              onConfirm({ lat: center.latitude, lng: center.longitude });
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
