// react-leaflet is web-only. Replace with no-op components so native
// test bundles don't crash trying to evaluate browser DOM code.
export const MapContainer = () => null;
export const TileLayer = () => null;
export const CircleMarker = () => null;
export const Tooltip = () => null;
export const Circle = () => null;
export const useMap = () => ({ setView: () => {}, getZoom: () => 13 });
export const useMapEvents = () => ({});
