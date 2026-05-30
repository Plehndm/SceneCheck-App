// Unit tests for scrape-price.mjs. Uses node:test (no jest), mirroring
// the layout of scrape-time.test.mjs.
//
//   node --test scripts/scrape-price.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePriceNumber,
  isUsSourceUrl,
  normaliseCurrency,
  extractPriceFromOffers,
} from './scrape-price.mjs';

describe('parsePriceNumber', () => {
  test('parses Eventbrite-style decimal strings', () => {
    assert.equal(parsePriceNumber('33.85'), 33.85);
    assert.equal(parsePriceNumber('0.0'), 0);
    assert.equal(parsePriceNumber('100'), 100);
  });
  test('tolerates currency-suffixed and dollar-prefixed strings', () => {
    assert.equal(parsePriceNumber('33.85 USD'), 33.85);
    assert.equal(parsePriceNumber('$33.85'), 33.85);
    assert.equal(parsePriceNumber('USD 12'), 12);
  });
  test('accepts numbers directly', () => {
    assert.equal(parsePriceNumber(33.85), 33.85);
    assert.equal(parsePriceNumber(0), 0);
  });
  test('rejects unusable shapes', () => {
    assert.equal(parsePriceNumber(null), null);
    assert.equal(parsePriceNumber(undefined), null);
    assert.equal(parsePriceNumber(''), null);
    assert.equal(parsePriceNumber('free'), null);
    assert.equal(parsePriceNumber({}), null);
    assert.equal(parsePriceNumber(NaN), null);
    assert.equal(parsePriceNumber(-1), null); // negative rejected
  });
});

describe('isUsSourceUrl', () => {
  test('matches Eventbrite US city listings', () => {
    assert.equal(isUsSourceUrl('https://www.eventbrite.com/d/ca--irvine/events/'), true);
    assert.equal(isUsSourceUrl('https://www.eventbrite.com/d/ny--new-york/events/'), true);
    assert.equal(isUsSourceUrl('https://www.eventbrite.com/d/tx--austin/events/'), true);
  });
  test('rejects non-US and unrelated URLs', () => {
    assert.equal(isUsSourceUrl('https://www.eventbrite.com/d/on--toronto/events/'), false);
    assert.equal(isUsSourceUrl('https://example.com/x'), false);
    assert.equal(isUsSourceUrl(''), false);
    assert.equal(isUsSourceUrl(null), false);
  });
});

describe('normaliseCurrency', () => {
  test('uppercases and validates ISO-4217 shape', () => {
    assert.equal(normaliseCurrency('usd'), 'USD');
    assert.equal(normaliseCurrency('USD'), 'USD');
    assert.equal(normaliseCurrency(' CAD '), 'CAD');
  });
  test('rejects bad shapes', () => {
    assert.equal(normaliseCurrency('US'), null);   // too short
    assert.equal(normaliseCurrency('USDD'), null); // too long
    assert.equal(normaliseCurrency('us1'), null);  // not all letters
    assert.equal(normaliseCurrency(''), null);
    assert.equal(normaliseCurrency(null), null);
  });
});

describe('extractPriceFromOffers', () => {
  const irvineUrl = 'https://www.eventbrite.com/d/ca--irvine/events/';

  test('reads AggregateOffer low/high with currency', () => {
    const offers = [{
      '@type': 'AggregateOffer',
      lowPrice: '33.85',
      highPrice: '44.52',
      priceCurrency: 'USD',
    }];
    assert.deepEqual(extractPriceFromOffers(offers, irvineUrl), {
      priceMin: 33.85,
      priceMax: 44.52,
      priceCurrency: 'USD',
    });
  });

  test('reads a free AggregateOffer (low=high=0)', () => {
    const offers = [{
      '@type': 'AggregateOffer',
      lowPrice: '0.0',
      highPrice: '0.0',
      priceCurrency: 'USD',
    }];
    assert.deepEqual(extractPriceFromOffers(offers, irvineUrl), {
      priceMin: 0,
      priceMax: 0,
      priceCurrency: 'USD',
    });
  });

  test('overrides Eventbrite CAD bug on US listings', () => {
    // BEIS Warehouse Sale shape from the live page — CA event, JSON-LD
    // reports CAD. App users will read "$0 CAD" and get confused; the
    // helper rewrites currency to USD when the source URL is a US listing.
    const offers = [{
      '@type': 'AggregateOffer',
      lowPrice: '0.0',
      highPrice: '0.0',
      priceCurrency: 'CAD',
    }];
    assert.deepEqual(extractPriceFromOffers(offers, irvineUrl), {
      priceMin: 0,
      priceMax: 0,
      priceCurrency: 'USD',
    });
  });

  test('leaves CAD untouched on non-US listings', () => {
    const offers = [{
      '@type': 'AggregateOffer',
      lowPrice: '20',
      highPrice: '40',
      priceCurrency: 'CAD',
    }];
    assert.deepEqual(extractPriceFromOffers(offers, 'https://www.eventbrite.ca/d/on--toronto/events/'), {
      priceMin: 20,
      priceMax: 40,
      priceCurrency: 'CAD',
    });
  });

  test('reads a single Offer with `price` as both min and max', () => {
    const offers = [{ '@type': 'Offer', price: '15', priceCurrency: 'USD' }];
    assert.deepEqual(extractPriceFromOffers(offers, irvineUrl), {
      priceMin: 15,
      priceMax: 15,
      priceCurrency: 'USD',
    });
  });

  test('reduces an array of tiered Offers to overall min/max', () => {
    const offers = [
      { '@type': 'Offer', price: '15', priceCurrency: 'USD' },
      { '@type': 'Offer', price: '30', priceCurrency: 'USD' },
      { '@type': 'Offer', price: '50', priceCurrency: 'USD' },
    ];
    assert.deepEqual(extractPriceFromOffers(offers, irvineUrl), {
      priceMin: 15,
      priceMax: 50,
      priceCurrency: 'USD',
    });
  });

  test('accepts a single Offer object (not array)', () => {
    const offers = { '@type': 'Offer', price: '10', priceCurrency: 'USD' };
    assert.deepEqual(extractPriceFromOffers(offers, irvineUrl), {
      priceMin: 10,
      priceMax: 10,
      priceCurrency: 'USD',
    });
  });

  test('defaults currency to USD when offer omits it', () => {
    const offers = [{ '@type': 'AggregateOffer', lowPrice: '5', highPrice: '15' }];
    assert.deepEqual(extractPriceFromOffers(offers, irvineUrl), {
      priceMin: 5,
      priceMax: 15,
      priceCurrency: 'USD',
    });
  });

  test('returns null when no offer is usable', () => {
    assert.equal(extractPriceFromOffers(null, irvineUrl), null);
    assert.equal(extractPriceFromOffers([], irvineUrl), null);
    assert.equal(extractPriceFromOffers([{ '@type': 'Offer' }], irvineUrl), null);
    assert.equal(extractPriceFromOffers([{ price: 'tbd' }], irvineUrl), null);
  });

  test('rounds to two decimals', () => {
    const offers = [{
      '@type': 'AggregateOffer',
      lowPrice: 33.84999999,
      highPrice: 44.523456,
      priceCurrency: 'USD',
    }];
    assert.deepEqual(extractPriceFromOffers(offers, irvineUrl), {
      priceMin: 33.85,
      priceMax: 44.52,
      priceCurrency: 'USD',
    });
  });
});
