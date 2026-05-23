// Unit tests for the shared event classifier (lib/events). Color + label
// everywhere derive from eventCategory, so this is the contract that keeps
// the map pins, cards, and labels in agreement.

import { eventCategory, isRecommendedFor, isAlsoRecommended, EVENT_CATEGORY_LABEL } from '@/lib/events';
import { SC_EVENT_BY_ID } from '@/data/mocks';

describe('eventCategory', () => {
  test('your own event → yours (regardless of interests)', () => {
    expect(eventCategory(SC_EVENT_BY_ID.e1, [])).toBe('yours'); // e1 kind: yours
  });

  test("a friend's event → friend (even with no shared interest)", () => {
    expect(eventCategory(SC_EVENT_BY_ID.e2, [])).toBe('friend'); // e2 kind: friend
  });

  test('a non-yours/non-friend event is recommended only when it matches an interest', () => {
    // e4 (scraped) interests ['running','uci']; e9 (org) interests ['yoga','uci'].
    expect(eventCategory(SC_EVENT_BY_ID.e4, ['uci'])).toBe('recommended');
    expect(eventCategory(SC_EVENT_BY_ID.e4, [])).toBe('other');
    expect(eventCategory(SC_EVENT_BY_ID.e9, ['uci'])).toBe('recommended');
    expect(eventCategory(SC_EVENT_BY_ID.e9, ['cooking'])).toBe('other');
  });

  test('label map covers every category', () => {
    expect(EVENT_CATEGORY_LABEL.yours).toBe('YOUR EVENT');
    expect(EVENT_CATEGORY_LABEL.friend).toBe('FRIEND HOSTING');
    expect(EVENT_CATEGORY_LABEL.recommended).toBe('RECOMMENDED');
    expect(EVENT_CATEGORY_LABEL.other).toBe('NEARBY');
  });
});

describe('isRecommendedFor', () => {
  test('false with no interests; true on a shared tag', () => {
    expect(isRecommendedFor(SC_EVENT_BY_ID.e4, [])).toBe(false);
    expect(isRecommendedFor(SC_EVENT_BY_ID.e4, ['running'])).toBe(true);
  });
});

describe('isAlsoRecommended (friend events that also match an interest)', () => {
  // e2 is a friend's event with interests ['cooking','uci'].
  test('true for a friend event sharing an interest', () => {
    expect(isAlsoRecommended(SC_EVENT_BY_ID.e2, ['cooking'])).toBe(true);
  });

  test('false for a friend event with no shared interest / no interests', () => {
    expect(isAlsoRecommended(SC_EVENT_BY_ID.e2, ['music'])).toBe(false);
    expect(isAlsoRecommended(SC_EVENT_BY_ID.e2, [])).toBe(false);
  });

  test('false when the match already makes it its own RECOMMENDED category (other) or YOURS', () => {
    // e4 (not yours/friend) matching an interest is category 'recommended' —
    // the extra badge would be redundant.
    expect(isAlsoRecommended(SC_EVENT_BY_ID.e4, ['uci'])).toBe(false);
    // e1 is your own event; recommendation is moot.
    expect(isAlsoRecommended(SC_EVENT_BY_ID.e1, ['biking'])).toBe(false);
  });
});
