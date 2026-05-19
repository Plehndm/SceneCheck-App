// ThemeProvider — replaces the legacy `applyPalette()` that mutated CSS
// custom properties on document.documentElement. On React Native there's
// no global CSS scope, so we plumb tokens through context. The active
// palette + mode come from the Zustand UI store, so any component can
// change them via `useStore.getState().setPalette('cobalt')` and every
// styled child re-renders with the new tokens.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useStore } from '@/store/useStore';
import { getTokens, type Tokens, type PaletteName, type Mode } from './tokens';

interface ThemeValue {
  tokens: Tokens;
  palette: PaletteName;
  mode: Mode;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const palette = useStore(s => s.palette);
  const mode = useStore(s => s.mode);
  const value = useMemo<ThemeValue>(() => ({
    tokens: getTokens(palette, mode),
    palette,
    mode,
  }), [palette, mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}

// Convenience: just the tokens, when you don't need palette/mode metadata.
export function useTokens(): Tokens {
  return useTheme().tokens;
}
