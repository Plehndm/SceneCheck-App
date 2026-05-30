// Unit tests for lib/price.ts. The price-encoding contract is shared
// with migration 00040 and the scraper — these tests guard the four
// branches (none / free / fixed / range) and the currency handling.

import { priceState, formatPrice, formatPriceAmount } from '@/lib/price';

describe('priceState', () => {
  it('returns "none" when either bound is null', () => {
    expect(priceState({ priceMin: null, priceMax: null })).toBe('none');
    expect(priceState({ priceMin: 10, priceMax: null })).toBe('none');
    expect(priceState({ priceMin: null, priceMax: 20 })).toBe('none');
    expect(priceState(null)).toBe('none');
    expect(priceState(undefined)).toBe('none');
    expect(priceState({})).toBe('none');
  });
  it('returns "free" for 0/0', () => {
    expect(priceState({ priceMin: 0, priceMax: 0 })).toBe('free');
  });
  it('returns "fixed" when min === max and non-zero', () => {
    expect(priceState({ priceMin: 15, priceMax: 15 })).toBe('fixed');
    expect(priceState({ priceMin: 0.99, priceMax: 0.99 })).toBe('fixed');
  });
  it('returns "range" when min < max', () => {
    expect(priceState({ priceMin: 10, priceMax: 25 })).toBe('range');
    expect(priceState({ priceMin: 0, priceMax: 25 })).toBe('range'); // tiered: free → paid
  });
});

describe('formatPrice', () => {
  it('returns null for the unspecified state', () => {
    expect(formatPrice({ priceMin: null, priceMax: null })).toBeNull();
    expect(formatPrice(null)).toBeNull();
  });
  it('returns the FREE sentinel for 0/0', () => {
    expect(formatPrice({ priceMin: 0, priceMax: 0, priceCurrency: 'USD' })).toBe('FREE');
  });
  it('formats a fixed USD price', () => {
    expect(formatPrice({ priceMin: 15, priceMax: 15, priceCurrency: 'USD' })).toBe('$15');
    expect(formatPrice({ priceMin: 33.85, priceMax: 33.85, priceCurrency: 'USD' })).toBe('$33.85');
  });
  it('formats a USD price range', () => {
    expect(formatPrice({ priceMin: 33.85, priceMax: 44.52, priceCurrency: 'USD' }))
      .toBe('$33.85–$44.52');
  });
  it('formats a "starts free" tiered range', () => {
    expect(formatPrice({ priceMin: 0, priceMax: 25, priceCurrency: 'USD' }))
      .toBe('$0–$25');
  });
  it('uses the right symbol for non-USD currencies', () => {
    expect(formatPrice({ priceMin: 12, priceMax: 12, priceCurrency: 'EUR' })).toBe('€12');
    expect(formatPrice({ priceMin: 20, priceMax: 40, priceCurrency: 'CAD' })).toBe('CA$20–CA$40');
    expect(formatPrice({ priceMin: 500, priceMax: 500, priceCurrency: 'JPY' })).toBe('¥500');
  });
  it('defaults to USD when currency is null', () => {
    expect(formatPrice({ priceMin: 10, priceMax: 10, priceCurrency: null })).toBe('$10');
  });
  it('falls back to ISO code for unrecognised currencies', () => {
    expect(formatPrice({ priceMin: 15, priceMax: 30, priceCurrency: 'XYZ' }))
      .toBe('XYZ 15–XYZ 30');
  });
  it('strips trailing zeros for integers but preserves cents', () => {
    expect(formatPriceAmount(15, 'USD')).toBe('$15');
    expect(formatPriceAmount(15.5, 'USD')).toBe('$15.50');
    expect(formatPriceAmount(15.99, 'USD')).toBe('$15.99');
  });
});
