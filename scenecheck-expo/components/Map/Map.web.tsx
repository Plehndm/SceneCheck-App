// Web map entry — client-only wrapper around the real leaflet
// implementation in Map.web.impl.tsx.
//
// Why this indirection: with `web.output: "static"` Expo Router
// pre-renders pages in Node. `leaflet` (transitive dep of
// react-leaflet) touches `window` at module load, which crashes the
// SSR pass. By deferring the import via React.lazy() AND only rendering
// the Suspense boundary after `useEffect` flips `mounted` to true, we
// guarantee the leaflet module never resolves on the server — it loads
// in the browser after hydration where `window` exists.

import { lazy, Suspense, useEffect, useState } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import type { MapProps } from './types';

const LeafletMap = lazy(() =>
  import('./Map.web.impl').then(m => ({ default: m.Map })),
);

export function Map(props: MapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const placeholder = (
    <View style={[
      { width: '100%' as const, height: 300, overflow: 'hidden' as const },
      props.style as StyleProp<ViewStyle>,
    ]} />
  );

  if (!mounted) return placeholder;

  return (
    <Suspense fallback={placeholder}>
      <LeafletMap {...props} />
    </Suspense>
  );
}
