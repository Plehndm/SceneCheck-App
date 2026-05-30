// Unit tests for scrape-time.mjs.
//
// Uses Node's built-in test runner (node --test) so it runs without
// dragging the Expo jest harness into the scripts/ Node CLI world. The
// scraper helpers are pure functions — no network, no DOM — so a
// vanilla `node --test` is the right scope.
//
//   node --test scripts/scrape-time.test.mjs
//
// CI wires this up as a step in .github/workflows/ci.yml alongside the
// Deno suite for the interest-matching analyzer.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  isDateOnly,
  hasTimezone,
  timezoneFromSourceUrl,
  extractFullJsonLdTimestamp,
  timezoneOffsetMinutes,
  dateOnlyToVenueLocalNoonIso,
} from './scrape-time.mjs';

describe('isDateOnly', () => {
  test('detects bare ISO dates', () => {
    assert.equal(isDateOnly('2026-05-29'), true);
    assert.equal(isDateOnly(' 2026-05-29 '), true);
  });
  test('rejects full datetimes', () => {
    assert.equal(isDateOnly('2026-05-29T14:00:00-07:00'), false);
    assert.equal(isDateOnly('2026-05-29T00:00:00Z'), false);
    assert.equal(isDateOnly('2026-05-29T14:00:00'), false);
  });
  test('rejects nullish / non-strings', () => {
    assert.equal(isDateOnly(null), false);
    assert.equal(isDateOnly(undefined), false);
    assert.equal(isDateOnly(''), false);
    assert.equal(isDateOnly(20260529), false);
  });
});

describe('hasTimezone', () => {
  test('detects the Z suffix', () => {
    assert.equal(hasTimezone('2026-05-29T14:00:00Z'), true);
    assert.equal(hasTimezone('2026-05-29T14:00:00.123Z'), true);
  });
  test('detects positive and negative offsets', () => {
    assert.equal(hasTimezone('2026-05-29T14:00:00-07:00'), true);
    assert.equal(hasTimezone('2026-05-29T14:00:00+05:30'), true);
    assert.equal(hasTimezone('2026-05-29T14:00:00+0530'), true);
  });
  test('rejects naive datetimes and date-only', () => {
    assert.equal(hasTimezone('2026-05-29T14:00:00'), false);
    assert.equal(hasTimezone('2026-05-29'), false);
  });
  test('does not confuse the date-hyphen with an offset', () => {
    // The "-29" in the date part must not register as an offset.
    assert.equal(hasTimezone('2026-05-29'), false);
  });
});

describe('timezoneFromSourceUrl', () => {
  test('maps California listings to America/Los_Angeles', () => {
    assert.equal(
      timezoneFromSourceUrl('https://www.eventbrite.com/d/ca--irvine/events/'),
      'America/Los_Angeles',
    );
    assert.equal(
      timezoneFromSourceUrl('https://www.eventbrite.com/d/ca--santa-ana/events/'),
      'America/Los_Angeles',
    );
  });
  test('maps New York listings to America/New_York', () => {
    assert.equal(
      timezoneFromSourceUrl('https://www.eventbrite.com/d/ny--new-york/events/'),
      'America/New_York',
    );
  });
  test('maps Texas to Chicago and Arizona to Phoenix', () => {
    assert.equal(
      timezoneFromSourceUrl('https://www.eventbrite.com/d/tx--austin/events/'),
      'America/Chicago',
    );
    assert.equal(
      timezoneFromSourceUrl('https://www.eventbrite.com/d/az--phoenix/events/'),
      'America/Phoenix',
    );
  });
  test('falls back to America/Los_Angeles for unknown URLs', () => {
    assert.equal(timezoneFromSourceUrl('https://example.com/no-state-here'), 'America/Los_Angeles');
    assert.equal(timezoneFromSourceUrl(''), 'America/Los_Angeles');
    assert.equal(timezoneFromSourceUrl(null), 'America/Los_Angeles');
  });
});

describe('extractFullJsonLdTimestamp', () => {
  test('returns the full datetime and skips date-only stragglers', () => {
    // Mirrors the live Eventbrite detail-page shape: one full Event
    // entry, plus breadcrumb / list-item entries that re-emit the same
    // field in date-only form.
    const html = `
      <script type="application/ld+json">
        {"startDate":"2026-05-29T14:00:00-07:00","endDate":"2026-05-29T15:00:00-07:00"}
      </script>
      <script type="application/ld+json">
        {"startDate":"2026-05-29","endDate":"2026-05-29"}
      </script>
    `;
    assert.equal(extractFullJsonLdTimestamp(html, 'startDate'), '2026-05-29T14:00:00-07:00');
    assert.equal(extractFullJsonLdTimestamp(html, 'endDate'), '2026-05-29T15:00:00-07:00');
  });
  test('returns null when only date-only forms exist', () => {
    const html = `{"startDate":"2026-05-29","endDate":"2026-05-29"}`;
    assert.equal(extractFullJsonLdTimestamp(html, 'startDate'), null);
    assert.equal(extractFullJsonLdTimestamp(html, 'endDate'), null);
  });
  test('returns null on missing field or non-string input', () => {
    assert.equal(extractFullJsonLdTimestamp('{"name":"x"}', 'startDate'), null);
    assert.equal(extractFullJsonLdTimestamp(null, 'startDate'), null);
    assert.equal(extractFullJsonLdTimestamp(undefined, 'endDate'), null);
  });
  test('matches when the JSON has whitespace around the colon', () => {
    const html = `{"startDate" : "2026-05-29T14:00:00-07:00"}`;
    assert.equal(extractFullJsonLdTimestamp(html, 'startDate'), '2026-05-29T14:00:00-07:00');
  });
});

describe('timezoneOffsetMinutes', () => {
  test('reports PDT as -420 minutes in summer', () => {
    const summer = new Date('2026-07-04T12:00:00Z');
    assert.equal(timezoneOffsetMinutes('America/Los_Angeles', summer), -420);
  });
  test('reports PST as -480 minutes in winter', () => {
    const winter = new Date('2026-01-15T12:00:00Z');
    assert.equal(timezoneOffsetMinutes('America/Los_Angeles', winter), -480);
  });
  test('reports UTC as 0', () => {
    assert.equal(timezoneOffsetMinutes('UTC', new Date('2026-05-29T12:00:00Z')), 0);
  });
  test('reports EDT as -240 in summer', () => {
    assert.equal(
      timezoneOffsetMinutes('America/New_York', new Date('2026-07-04T12:00:00Z')),
      -240,
    );
  });
});

describe('dateOnlyToVenueLocalNoonIso', () => {
  test('anchors a summer date to noon PDT (19:00 UTC)', () => {
    const iso = dateOnlyToVenueLocalNoonIso('2026-05-29', 'America/Los_Angeles');
    assert.equal(iso, '2026-05-29T19:00:00.000Z');
    // Cross-check via Intl: that instant is May 29 in LA.
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const parts = fmt.formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    assert.equal(`${parts.year}-${parts.month}-${parts.day}`, '2026-05-29');
    // The day match is the important part — it would be 2026-05-28
    // under the broken `new Date("2026-05-29")` UTC-midnight path.
  });
  test('anchors a winter date to noon PST (20:00 UTC)', () => {
    const iso = dateOnlyToVenueLocalNoonIso('2026-01-15', 'America/Los_Angeles');
    assert.equal(iso, '2026-01-15T20:00:00.000Z');
  });
  test('anchors against America/New_York correctly', () => {
    const iso = dateOnlyToVenueLocalNoonIso('2026-07-04', 'America/New_York');
    // EDT is UTC-4 in July; noon EDT = 16:00 UTC.
    assert.equal(iso, '2026-07-04T16:00:00.000Z');
  });
  test('returns null when input is not date-only', () => {
    assert.equal(
      dateOnlyToVenueLocalNoonIso('2026-05-29T14:00:00-07:00', 'America/Los_Angeles'),
      null,
    );
    assert.equal(dateOnlyToVenueLocalNoonIso('', 'America/Los_Angeles'), null);
    assert.equal(dateOnlyToVenueLocalNoonIso(null, 'America/Los_Angeles'), null);
  });
});
