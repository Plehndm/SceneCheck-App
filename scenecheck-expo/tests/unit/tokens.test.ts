// Theme-token invariants. These guard the dark-mode contrast bug we fixed:
// active pills/filters fill with `ink` and draw their label in `surface`, and
// the gold review button draws its star in `warnInk` — all must stay legible in
// both modes (in dark mode `ink` flips to near-white, so hardcoded 'white' text
// on it vanished).

import { getTokens, type PaletteName, type Mode } from '@/theme/tokens';

const NAMES: PaletteName[] = ['sunset', 'cobalt', 'lime'];
const MODES: Mode[] = ['light', 'dark'];

describe('theme token invariants', () => {
  test('warnInk is a constant dark ink in every palette + mode', () => {
    for (const n of NAMES) {
      for (const m of MODES) {
        expect(getTokens(n, m).warnInk).toBe('#1A1205');
      }
    }
  });

  test('surface always differs from ink (active-pill label stays visible)', () => {
    for (const n of NAMES) {
      for (const m of MODES) {
        const t = getTokens(n, m);
        expect(t.surface).not.toBe(t.ink);
      }
    }
  });
});
