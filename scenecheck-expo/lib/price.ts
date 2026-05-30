// Price-range display helpers.
//
// The DB encodes ticket pricing as three nullable columns on `events`
// (migration 00040): price_min, price_max, price_currency. The encoding
// contract is enforced by the CHECK constraint:
//
//   priceMin === null AND priceMax === null   → "not specified"  (hidden)
//   priceMin === 0   AND priceMax === 0       → "free"           (FREE)
//   priceMin === priceMax                     → "fixed price"    ($N)
//   priceMin < priceMax                       → "range"          ($X–$Y)
//
// Currency defaults to USD when null — Eventbrite occasionally mis-tags
// US events as CAD; the scraper auto-corrects on US-listing URLs and we
// treat the rest of the world as opt-in (whatever ISO code is stored).
//
// Two helpers — `priceState` for the conditional rendering branches a
// component needs (badge vs. text), and `formatPrice` for the actual
// label. Kept in one module so both stay in lockstep with the encoding.

import type { SCEvent } from '@/types/domain';

export type PriceState = 'none' | 'free' | 'fixed' | 'range';

export interface PriceFields {
  priceMin?: number | null;
  priceMax?: number | null;
  priceCurrency?: string | null;
}

// Classify what kind of display the event warrants. Used by the UI to
// pick between hidden / FREE-badge / number string.
export function priceState(e: PriceFields | null | undefined): PriceState {
  if (!e) return 'none';
  const min = e.priceMin;
  const max = e.priceMax;
  if (min == null || max == null) return 'none';
  if (min === 0 && max === 0) return 'free';
  if (min === max) return 'fixed';
  return 'range';
}

// Symbol for currency. Falls back to the ISO code when we don't have a
// short symbol. Kept tiny on purpose — the app primarily shows USD; an
// unrecognised currency renders as "USD 15" / "EUR 15–25" rather than
// silently dropping the unit.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CAD: 'CA$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  MXN: 'MX$',
};

function symbolFor(code: string | null | undefined): { prefix: string; needsSpace: boolean } {
  const c = (code ?? 'USD').toUpperCase();
  const sym = CURRENCY_SYMBOLS[c];
  if (sym) return { prefix: sym, needsSpace: false };
  // Unknown ISO code: render as "USD 15" with a trailing space.
  return { prefix: c, needsSpace: true };
}

// Strip a trailing ".00" but keep "$12.50" intact. Eventbrite ships its
// prices as "33.85" / "0.0" decimals; the migration stores NUMERIC(10,2)
// so we always get a number with at most 2 decimals back.
function fmtNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // toFixed(2) catches "12.5" → "12.50". A pre-rounded scrape value of
  // 33.85 round-trips to "33.85"; an ad-hoc 12.5 becomes "12.50".
  return n.toFixed(2);
}

// Format a single price into the currency-aware label. Used for both
// fixed and range states.
export function formatPriceAmount(n: number, currency: string | null | undefined): string {
  const { prefix, needsSpace } = symbolFor(currency);
  return needsSpace ? `${prefix} ${fmtNumber(n)}` : `${prefix}${fmtNumber(n)}`;
}

// Top-level: convert an event's price fields into the display string
// the UI shows. Returns null when nothing should render (priceState
// 'none' → caller hides the affordance entirely). 'free' returns the
// literal "FREE" so the caller doesn't have to special-case the badge
// vs. text branch — but the badge tinting still keys off priceState
// === 'free' because color/contrast tokens differ from money labels.
export function formatPrice(e: PriceFields | null | undefined): string | null {
  const s = priceState(e);
  switch (s) {
    case 'none': return null;
    case 'free': return 'FREE';
    case 'fixed': return formatPriceAmount(e!.priceMin!, e!.priceCurrency);
    case 'range':
      return `${formatPriceAmount(e!.priceMin!, e!.priceCurrency)}–${formatPriceAmount(e!.priceMax!, e!.priceCurrency)}`;
  }
}

// Convenience: full-event variant. The hooks pass a whole SCEvent so
// they don't have to destructure for display.
export function formatEventPrice(event: SCEvent | null | undefined): string | null {
  return formatPrice(event ?? null);
}
