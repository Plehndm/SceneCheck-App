// Web map implementation — uses react-leaflet (open-source, no API
// key, free tiles from OpenStreetMap). Metro auto-selects this file
// on web via the `.web.tsx` suffix.
//
// Leaflet quirks handled:
//   - Default marker icons load by relative path and break under
//     bundlers — we render <CircleMarker> which doesn't need them.
//   - <MapContainer> doesn't accept eventHandlers directly; the proper
//     pattern is a child component that uses useMapEvents().

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Circle, useMap, useMapEvents } from 'react-leaflet';
import { useEffect } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { useTokens } from '@/theme/ThemeProvider';
import {
  DEFAULT_REGION, DEFAULT_RADIUS_M,
  eventLatLng, pinColor, type MapProps, type LatLng,
} from './types';

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

function RegionChangeReporter({ onChange }: { onChange?: (c: LatLng) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onChange?.({ latitude: c.lat, longitude: c.lng });
    },
  });
  return null;
}

export function Map({
  events, user, initialCenter = DEFAULT_REGION, radiusM = DEFAULT_RADIUS_M,
  meInterests = [],
  onPinPress, onRegionChange, interactive = true, style,
}: MapProps) {
  const t = useTokens();
  const center = user ?? initialCenter;

  return (
    <View
      // Non-interactive preview: let clicks fall through to the parent
      // Pressable that opens the full Map tab.
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[{ width: '100%' as const, height: 300, overflow: 'hidden' as const }, style as StyleProp<ViewStyle>]}
    >
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        // Snapshot mode disables every leaflet interaction + the zoom
        // control chrome so the preview reads as a static map.
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        boxZoom={interactive}
        keyboard={interactive}
        zoomControl={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RegionChangeReporter onChange={onRegionChange} />
        {user && <Recenter lat={user.latitude} lng={user.longitude} />}
        {user && radiusM > 0 && (
          <Circle
            center={[user.latitude, user.longitude]}
            radius={radiusM}
            pathOptions={{ color: t.accentBlue, fillColor: t.accentBlue, fillOpacity: 0.1, weight: 1 }}
          />
        )}
        {user && (
          <CircleMarker
            center={[user.latitude, user.longitude]}
            radius={8}
            pathOptions={{ color: 'white', weight: 3, fillColor: t.accentBlue, fillOpacity: 1 }}
          />
        )}
        {events.map(e => {
          const ll = eventLatLng(e);
          const color = pinColor(e, t, meInterests);
          return (
            <CircleMarker
              key={e.id}
              center={[ll.latitude, ll.longitude]}
              radius={9}
              pathOptions={{ color: 'white', weight: 2, fillColor: color, fillOpacity: 1 }}
              eventHandlers={{ click: () => onPinPress?.(e) }}
            >
              <Tooltip>{e.title}</Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </View>
  );
}
