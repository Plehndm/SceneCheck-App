// Price extraction from schema.org JSON-LD `offers`.
//
// Eventbrite (and most schema.org-using publishers) shape ticket pricing
// either as an `Offer` (single price) or an `AggregateOffer` (low/high
// range). The detail page JSON-LD typically looks like:
//
//   "offers": [{
//     "@type": "AggregateOffer",
//     "lowPrice":  "33.85",
//     "highPrice": "44.52",
//     "priceCurrency": "USD"
//   }]
//
// Free events report "0.0" for both bounds. Eventbrite has a long-standing
// bug where US events sometimes carry priceCurrency:"CAD"; the helper
// auto-corrects to USD when the source URL is a US listing so the app
// doesn't show "$33.85 CAD" for a Tustin event.
//
// All helpers are pure (no I/O) — the network round-trip lives in
// scripts/scrape-events.mjs.

// Currency our app stores when the source omits it (or when we override
// Eventbrite's CAD mis-tag for US-located events). Display layer (lib/
// price.ts) treats NULL as USD too.
const DEFAULT_CURRENCY = 'USD';

// Parse "33.85" / "33.85 USD" / 33.85 / "" / null into a non-negative
// float, or null if not interpretable. Schema.org specifies the price
// field can be string or number; Eventbrite uses strings.
export function parsePriceNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number') {
    return Number.isFinite(v) && v >= 0 ? v : null;
  }
  if (typeof v !== 'string') return null;
  // Eventbrite always sends a bare decimal; this also tolerates
  // " 33.85 USD" / "USD 33.85" / "$33.85" shapes other publishers use.
  const m = v.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Decide whether the source listing URL is a US Eventbrite city page
// (`/d/<state-code>--<city>/events/`). Used to override the documented
// Eventbrite CAD mis-tag — if the venue is in the US, the price is
// almost certainly USD regardless of what the JSON-LD claims.
const US_STATE_CODES = new Set([
  'al','ak','az','ar','ca','co','ct','de','dc','fl','ga','hi','id','il',
  'in','ia','ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne',
  'nv','nh','nj','nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd',
  'tn','tx','ut','vt','va','wa','wv','wi','wy',
]);
export function isUsSourceUrl(url) {
  if (typeof url !== 'string') return false;
  const m = url.toLowerCase().match(/\/d\/([a-z]{2})--/);
  return !!m && US_STATE_CODES.has(m[1]);
}

// Normalise a currency code: uppercase, length 3, otherwise null.
export function normaliseCurrency(c) {
  if (typeof c !== 'string') return null;
  const up = c.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(up) ? up : null;
}

// Reduce a single Offer-shaped object to a {min, max, currency} triple,
// or null if nothing usable. AggregateOffer carries low/high; plain
// Offer carries a single `price` we use for both bounds.
function pickFromOneOffer(offer) {
  if (!offer || typeof offer !== 'object') return null;
  const type = String(offer['@type'] || '');
  const currency = normaliseCurrency(offer.priceCurrency);
  if (type === 'AggregateOffer') {
    const low = parsePriceNumber(offer.lowPrice);
    const high = parsePriceNumber(offer.highPrice);
    if (low === null || high === null) return null;
    return { min: Math.min(low, high), max: Math.max(low, high), currency };
  }
  // Offer (or unspecified @type with a `price`): single-price tier.
  const p = parsePriceNumber(offer.price);
  if (p === null) return null;
  return { min: p, max: p, currency };
}

// Extract a price range from a schema.org `offers` value, applying the
// US-source CAD→USD override when the source URL warrants it.
//
// Returns:
//   null  — no usable price information; the row should be stored with
//           price_min = price_max = price_currency = NULL.
//   { priceMin, priceMax, priceCurrency } — normalised ranges. For free
//           events min and max are both 0.
//
// Multiple offers are reduced to the overall min/max (e.g. an array of
// per-tier Offer entries collapses to "$X to $Y"). When tiers carry
// different currencies, the first non-null currency wins — collapsing
// across currencies is an edge case our display doesn't handle and we
// don't want to silently misrepresent.
export function extractPriceFromOffers(offers, sourceUrl) {
  if (offers == null) return null;
  const list = Array.isArray(offers) ? offers : [offers];
  let min = Infinity;
  let max = -Infinity;
  let currency = null;
  for (const o of list) {
    const picked = pickFromOneOffer(o);
    if (!picked) continue;
    if (picked.min < min) min = picked.min;
    if (picked.max > max) max = picked.max;
    if (currency === null && picked.currency) currency = picked.currency;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  // US-source CAD→USD override. The Eventbrite bug is well-known and
  // pretending the dollar sign means CAD on a Tustin event would mislead
  // users far more than just stamping it as USD. Other currency codes
  // pass through untouched.
  if (currency === 'CAD' && isUsSourceUrl(sourceUrl)) currency = 'USD';

  return {
    priceMin: round2(min),
    priceMax: round2(max),
    priceCurrency: currency ?? DEFAULT_CURRENCY,
  };
}

// Two-decimal rounding for cleaner DB storage (NUMERIC(10,2) anyway).
// Avoids "33.849999999…" artifacts when the source ships floating math.
function round2(n) {
  return Math.round(n * 100) / 100;
}
