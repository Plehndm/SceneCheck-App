// Time-resolution helpers for the FR6 scraper.
//
// Background. Eventbrite city listing pages (and similar sources) emit
// JSON-LD with DATE-ONLY `startDate` strings ("2026-05-29") — no time, no
// offset. Per the ECMAScript Date Time String Format spec, date-only ISO
// forms are interpreted as UTC midnight. So `new Date("2026-05-29")` →
// `2026-05-29T00:00:00.000Z`, which a North American user then sees in
// their local timezone as the *previous day* in the late evening (5pm
// PDT, etc.) — a real, very visible bug for our California-anchored app.
//
// The detail page for each listing carries the precise time with a real
// offset ("2026-05-29T14:00:00-07:00"), so the scraper follows the URL
// when it sees a date-only listing value. This module factors out the
// pure pieces — detection, extraction, fallback — so they're trivially
// unit-testable without touching the network.
//
// All helpers exported are pure (no I/O); the network round-trip stays
// in scripts/scrape-events.mjs.

// Detect bare ISO date strings like "2026-05-29" (no T component, no
// offset). These are the values that misbehave under `new Date(…)`.
export function isDateOnly(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

// Detect strings that already carry timezone information — either a "Z"
// UTC marker or an explicit +HH:MM / -HH:MM offset. These can be passed
// to `new Date(…)` and `.toISOString()` safely (the wall-clock instant
// is preserved, only the textual representation changes).
export function hasTimezone(s) {
  if (typeof s !== 'string') return false;
  if (/Z$/.test(s)) return true;
  // Look only at the time portion. A naked "-" in the date part
  // (2026-05-29) must not register as a negative offset.
  const t = s.split('T')[1];
  return !!t && /[+-]\d{2}:?\d{2}$/.test(t);
}

// Eventbrite city URLs look like `/d/<state>--<city>/events/`. Map the
// state code to an IANA timezone so we have a sensible local-noon
// anchor when the detail-page fetch fails. Default is the project's
// own anchor (Pacific) so unknown sources don't surprise.
const US_STATE_TZ = {
  ca: 'America/Los_Angeles', or: 'America/Los_Angeles', wa: 'America/Los_Angeles', nv: 'America/Los_Angeles',
  az: 'America/Phoenix',
  ut: 'America/Denver', co: 'America/Denver', nm: 'America/Denver',
  mt: 'America/Denver', wy: 'America/Denver', id: 'America/Denver',
  tx: 'America/Chicago', ok: 'America/Chicago', ks: 'America/Chicago', ne: 'America/Chicago',
  sd: 'America/Chicago', nd: 'America/Chicago', mn: 'America/Chicago', ia: 'America/Chicago',
  mo: 'America/Chicago', ar: 'America/Chicago', la: 'America/Chicago', wi: 'America/Chicago',
  il: 'America/Chicago', tn: 'America/Chicago', ms: 'America/Chicago', al: 'America/Chicago',
  ky: 'America/New_York', oh: 'America/New_York', mi: 'America/New_York', in: 'America/New_York',
  ga: 'America/New_York', fl: 'America/New_York', sc: 'America/New_York', nc: 'America/New_York',
  va: 'America/New_York', wv: 'America/New_York', dc: 'America/New_York', md: 'America/New_York',
  pa: 'America/New_York', nj: 'America/New_York', ny: 'America/New_York', ct: 'America/New_York',
  ri: 'America/New_York', ma: 'America/New_York', vt: 'America/New_York', nh: 'America/New_York',
  me: 'America/New_York', de: 'America/New_York',
  ak: 'America/Anchorage', hi: 'Pacific/Honolulu',
};
const DEFAULT_TZ = 'America/Los_Angeles';

export function timezoneFromSourceUrl(url) {
  if (typeof url !== 'string') return DEFAULT_TZ;
  const m = url.toLowerCase().match(/\/d\/([a-z]{2})--/);
  if (!m) return DEFAULT_TZ;
  return US_STATE_TZ[m[1]] || DEFAULT_TZ;
}

// Pull the FIRST full-datetime `<field>` from a page's JSON-LD blob. A
// detail page typically has a top-level Event with the precise time
// alongside breadcrumb / list-item entries that re-emit the same field
// in date-only form — we want the precise one, so we filter to values
// that include a 'T'. Returns null when only date-only forms exist
// (signalling: the detail page didn't help; fall back).
export function extractFullJsonLdTimestamp(html, field) {
  if (typeof html !== 'string') return null;
  const pattern = new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`, 'g');
  for (const m of html.matchAll(pattern)) {
    const v = m[1];
    if (v.includes('T')) return v;
  }
  return null;
}

// Offset between `tz` and UTC at a given instant, in minutes. Negative
// for zones west of UTC. PDT → -420, PST → -480, UTC → 0. Implemented
// via `Intl.DateTimeFormat` because that's the only built-in that
// understands IANA zones across Node / RN / browsers — and DST-aware
// without an external dependency.
export function timezoneOffsetMinutes(tz, instant) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(instant).reduce((acc, p) => {
    acc[p.type] = p.value; return acc;
  }, {});
  // `Intl` emits "24" for midnight in some locales; normalise to "00".
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((wallAsUtc - instant.getTime()) / 60_000);
}

// Convert a date-only string to an ISO timestamp anchored to NOON in
// `tz`. Used as a fallback when the detail page can't be fetched — at
// least the calendar day will display correctly in the venue's local
// timezone instead of slipping back a day under UTC midnight. Noon
// (rather than midnight) reads as a neutral placeholder; the events
// listing also shows /unk capacity in that case, so the user has the
// signal that this is approximate data.
export function dateOnlyToVenueLocalNoonIso(dateStr, tz) {
  if (!isDateOnly(dateStr)) return null;
  // Trial UTC instant for the requested day at 12:00Z. Whatever offset
  // `tz` has at that instant lets us bias the UTC milliseconds so the
  // resulting instant lands on the venue's local noon.
  const trial = new Date(`${dateStr.trim()}T12:00:00Z`);
  const offsetMin = timezoneOffsetMinutes(tz, trial);
  // offsetMin is negative for west-of-UTC zones, so subtracting it
  // (i.e. adding |offsetMin| minutes) moves the UTC instant later —
  // which is exactly the direction needed for noon in those zones.
  const venueLocalNoonMs = trial.getTime() - offsetMin * 60_000;
  return new Date(venueLocalNoonMs).toISOString();
}
