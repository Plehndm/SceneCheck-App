// CI-only events scraper for FR6 (App-Created Events).
//
// Runs in GitHub Actions (.github/workflows/scrape-events.yml) on a schedule.
// It scrapes a public events source and POSTs each event to the `ingest-scraped`
// Edge Function. That function inserts the row with source='scraped', which is
// what makes the app classify it as "Recommended" (lib/api.ts transformEventRow
// → kind 'recommended'; components/Map/types.ts pinColor → blue "Recommended").
// It also auto-tags the event by matching `description` text against interest
// names, so a description with interest keywords ("climbing", "coffee",
// "running"…) is what later lets a scraped event light up for matching users.
//
// Sources: several public Eventbrite city listings (Irvine + nearby Orange County
// cities), each of which embeds a schema.org `ItemList` of events as JSON-LD
// (<script type="application/ld+json">). Parsing that structured blob is far more
// stable than scraping the DOM and needs no dependencies. Override the set with a
// comma-separated EVENTS_SOURCE_URLS (or the legacy single EVENTS_SOURCE_URL)
// pointing at any Eventbrite location(s) — or any page that publishes event JSON-LD.
//
// Node 22 LTS (uses global fetch). Workflow pins node-version: '22'.
//
// Test without credentials:  DRY_RUN=1 node scripts/scrape-events.mjs
// (scrapes + prints the payloads, skips the POST).

import {
  isDateOnly,
  hasTimezone,
  timezoneFromSourceUrl,
  extractFullJsonLdTimestamp,
  dateOnlyToVenueLocalNoonIso,
} from './scrape-time.mjs';
import { extractPriceFromOffers } from './scrape-price.mjs';

const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL;        // https://<project-ref>.supabase.co
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;   // sb_secret_… (replaces the deprecated service_role key)
const INGEST_TOKEN = process.env.INGEST_TOKEN;        // shared secret the ingest-scraped function matches

if (!DRY_RUN && (!SUPABASE_URL || !SECRET_KEY || !INGEST_TOKEN)) {
  console.error('Missing one of: SUPABASE_URL, SUPABASE_SECRET_KEY, INGEST_TOKEN. (Use DRY_RUN=1 to scrape without ingesting.)');
  process.exit(1);
}

const ENDPOINT = `${SUPABASE_URL}/functions/v1/ingest-scraped`;

// Per-request timeouts (H5). The architecture doc calls out per-fetch timeouts
// as "critical" — without them a host that accepts the TCP connection but
// never responds holds the slot until the job-level timeout-minutes fires,
// starving every later source.
const SCRAPE_FETCH_TIMEOUT_MS = Number(process.env.SCRAPE_FETCH_TIMEOUT_MS || 15_000);
const INGEST_TIMEOUT_MS = Number(process.env.INGEST_TIMEOUT_MS || 10_000);

// Wrap global fetch with an AbortController-backed timeout. The signal is
// passed through, so a caller can still compose its own AbortSignal.
async function fetchWithTimeout(url, options = {}, timeoutMs = SCRAPE_FETCH_TIMEOUT_MS) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: c.signal }); }
  finally { clearTimeout(t); }
}

// Scan a wide range of SoCal cities so the feed isn't all one place. Two
// clusters: Orange County (the app's anchor) + Los Angeles County (the
// adjacent metro most users still drive to). Override the whole set with
// a comma-separated EVENTS_SOURCE_URLS, or the legacy single
// EVENTS_SOURCE_URL. Any Eventbrite "/d/<state>--<city>/events/" page
// works.
const DEFAULT_SOURCES = [
  // OC cluster
  'https://www.eventbrite.com/d/ca--irvine/events/',
  'https://www.eventbrite.com/d/ca--santa-ana/events/',
  'https://www.eventbrite.com/d/ca--costa-mesa/events/',
  'https://www.eventbrite.com/d/ca--newport-beach/events/',
  'https://www.eventbrite.com/d/ca--anaheim/events/',
  'https://www.eventbrite.com/d/ca--huntington-beach/events/',
  'https://www.eventbrite.com/d/ca--fullerton/events/',
  'https://www.eventbrite.com/d/ca--garden-grove/events/',
  // LA cluster
  'https://www.eventbrite.com/d/ca--los-angeles/events/',
  'https://www.eventbrite.com/d/ca--long-beach/events/',
  'https://www.eventbrite.com/d/ca--pasadena/events/',
  'https://www.eventbrite.com/d/ca--santa-monica/events/',
  'https://www.eventbrite.com/d/ca--west-hollywood/events/',
  'https://www.eventbrite.com/d/ca--burbank/events/',
];
const SOURCE_URLS = (process.env.EVENTS_SOURCE_URLS || process.env.EVENTS_SOURCE_URL || DEFAULT_SOURCES.join(','))
  .split(',').map((s) => s.trim()).filter(Boolean);
// Raised from 40 → 120 alongside the LA expansion so the wider source set
// can actually deliver more events into the feed instead of being clipped
// by the global cap. With 14 default sources, that's ~9 events per city
// before the per-source cap bites — enough to give each city visible
// representation without one busy listing flooding the rest out.
const MAX_EVENTS = Number(process.env.MAX_EVENTS || 120);
// Per-city cap so one busy city can't crowd the rest out before the global cap.
const MAX_PER_SOURCE = Math.max(1, Number(process.env.MAX_PER_SOURCE || Math.ceil(MAX_EVENTS / SOURCE_URLS.length)));

// Used ONLY by DRY_RUN when the live source returns nothing — e.g.
// Eventbrite served a bot-check page to the runner's datacenter IP.
// Real Irvine coordinates + interest keywords in the description so
// auto-tagging behaviour is still demonstrable in the local DRY_RUN.
//
// In LIVE mode an empty live result no longer falls back to POSTing
// these — every CI run would have written a fresh copy under a drifting
// start_at and NULL source_url (dedup miss on both keys), which left
// the feed cluttered with multiple "Beginner Bouldering Night" etc.
// rows. Migration 00042 cleans the legacy dupes; the live path now
// exits with code 2 and no ingest.
const FALLBACK_EVENTS = [
  { title: 'Beginner Bouldering Night', description: 'Intro climbing and bouldering meetup for all levels.', location: { lat: 33.6846, lng: -117.8265 }, location_name: 'Irvine', price_min: 0, price_max: 0, price_currency: 'USD' },
  { title: 'Aldrich Park Morning Run', description: 'Easy 5k running group, all paces, coffee after.', location: { lat: 33.6461, lng: -117.8427 }, location_name: 'Aldrich Park, UCI', price_min: 0, price_max: 0, price_currency: 'USD' },
  { title: 'Common Room Coffee Meetup', description: 'Casual coffee and study session.', location: { lat: 33.6512, lng: -117.8417 }, location_name: 'Common Room Coffee', price_min: 0, price_max: 0, price_currency: 'USD' },
].map((e, i) => ({
  ...e,
  start_at: new Date(Date.now() + (i + 2) * 86_400_000).toISOString(),
  end_at: null,
  capacity: 30,
  // No per-event page exists for hand-rolled fallback seeds. Leave source_url
  // NULL so the partial unique index on events(source_url) WHERE source='scraped'
  // (migration 00033) doesn't collide every time the fallback path fires —
  // three seed events all sharing the listing URL was the original cause of
  // that index failing to create.
  source_url: null,
}));

// Pull every JSON-LD <script> block from the page and collect the events out of
// any schema.org ItemList among them.
function extractJsonLdEvents(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const items = [];
  for (const rawBlock of blocks) {
    // Some campus calendars wrap their JSON-LD in CDATA (legal in XHTML
    // serializations); JSON.parse rejects the literal "<![CDATA[ … ]]>"
    // wrapper. Strip it before parsing so those sources don't get dropped.
    const block = rawBlock.trim().replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
    let parsed;
    try { parsed = JSON.parse(block); } catch { continue; }
    const list = Array.isArray(parsed?.itemListElement) ? parsed.itemListElement : [];
    for (const el of list) {
      const it = el?.item ?? el;
      if (it && String(it['@type'] || '').includes('Event')) items.push(it);
    }
  }
  return items;
}

// schema.org `image` is loosely typed: a URL string, an array of URLs, or an
// ImageObject ({ url }) — Eventbrite emits a single img.evbuc.com URL string.
// Return the first usable http(s) URL, or null. We DON'T rewrite the URL's
// size params: Eventbrite signs the transform with an `s=` hash, so changing
// `w`/`h` would invalidate the signature and 403 the image.
function normalizeImageUrl(image) {
  const pick = (v) => {
    if (typeof v === 'string') return v.trim();
    if (v && typeof v === 'object' && typeof v.url === 'string') return v.url.trim();
    return null;
  };
  const first = Array.isArray(image)
    ? image.map(pick).find(Boolean) ?? null
    : pick(image);
  return first && /^https?:\/\//i.test(first) ? first : null;
}

/**
 * Scrape SOURCE_URL and return events in the `ingest-scraped` payload shape:
 *   { title, start_at, location: { lat, lng },          // REQUIRED
 *     description?, location_name?, end_at?, capacity? } // optional
 * `start_at` / `end_at` are normalized to ISO 8601. Events without a usable
 * title/start/geo are skipped (ingest-scraped requires a valid lat/lng).
 */
// Real browser User-Agents — Eventbrite serves a bot-check page (or 403/405s)
// to obviously-automated agents, which from a CI runner's datacenter IP would
// otherwise yield 0 events. We rotate UA across retries since the block is
// intermittent (a run can 405 while the next succeeds).
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

// Fetch one URL with a few retries (rotating UA + backoff). Throws after
// the last attempt so the caller can skip that source/detail and continue
// with the rest. `verbose=false` silences the per-attempt warn line so
// detail-page fetches don't flood the log on intermittent failures.
async function fetchSourceHtml(url, { attempts: attemptsOverride, verbose = true } = {}) {
  const attempts = Math.max(1, Number(attemptsOverride ?? process.env.SCRAPE_RETRIES ?? 3));
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': USER_AGENTS[i % USER_AGENTS.length],
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }, SCRAPE_FETCH_TIMEOUT_MS);
      if (res.ok) return await res.text();
      lastErr = new Error(`Source fetch failed: ${res.status} ${url}`);
    } catch (err) {
      // An AbortError here means the SCRAPE_FETCH_TIMEOUT_MS budget was used
      // up; it's a normal retryable failure, not a crash.
      lastErr = err;
    }
    if (i < attempts - 1) {
      const delayMs = 2000 * (i + 1);
      if (verbose) {
        console.warn(`Scrape attempt ${i + 1}/${attempts} failed (${lastErr}); retrying in ${delayMs}ms…`);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// Follow an event's detail URL to recover precise time + price data.
// Two reasons we hit the detail page:
//
//   1. Eventbrite listing JSON-LD emits date-only `startDate` shapes
//      ("2026-05-29") that `new Date()` mis-parses as UTC midnight; the
//      detail page carries the real timezone-aware value
//      ("2026-05-29T14:00:00-07:00").
//   2. Listing JSON-LD rarely includes `offers` (Eventbrite omits it
//      from city pages entirely), so price is only available from the
//      detail page.
//
// Returns whatever fields could be recovered (start_at / end_at / price
// fields); each is null when missing. The caller picks which to use
// based on what the listing already provided: a listing with a clean
// full datetime keeps its time and just takes price from here.
//
// `sourceListingUrl` is the URL of the listing page the scraper is
// iterating (e.g. /d/ca--irvine/events/). The price helper's US→CAD
// override keys off the state-code in /d/<state>--<city>/ URLs — the
// per-event detail URL (/e/<slug>-tickets-<id>) doesn't carry that
// information, so passing it would silently leak Eventbrite's CAD
// mis-tag through onto US events.
async function enrichFromDetailPage(detailUrl, sourceListingUrl) {
  try {
    // 1 retry for detail pages — the listing already succeeded, so most
    // failures are intermittent block-page responses that won't be cured
    // by hammering. Keeps total wall-clock per source bounded.
    const html = await fetchSourceHtml(detailUrl, { attempts: 1, verbose: false });
    const startFull = extractFullJsonLdTimestamp(html, 'startDate');
    const endFull = extractFullJsonLdTimestamp(html, 'endDate');
    // Price extraction needs the structured Event object so the nested
    // `offers` value is accessible — the per-field regex used for the
    // timestamps can't reach into nested objects safely. Re-parse the
    // JSON-LD blocks, find the first Event with a usable offer, and
    // hand it to the helper alongside the listing URL.
    let price = null;
    for (const it of extractJsonLdEventObjects(html)) {
      const got = extractPriceFromOffers(it.offers, sourceListingUrl);
      if (got) { price = got; break; }
    }
    return {
      start_at: startFull,
      end_at: endFull,
      price_min: price?.priceMin ?? null,
      price_max: price?.priceMax ?? null,
      price_currency: price?.priceCurrency ?? null,
    };
  } catch {
    return null;
  }
}

// Parse every JSON-LD <script> block and yield each Event-shaped object
// inside. Unlike extractJsonLdEvents (which only walks top-level
// `itemListElement` lists used on listing pages), this also accepts
// single top-level Events — the shape detail pages use — so the
// `offers` block is reachable on either page type.
function extractJsonLdEventObjects(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const out = [];
  for (const rawBlock of blocks) {
    const block = rawBlock.trim().replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
    let parsed;
    try { parsed = JSON.parse(block); } catch { continue; }
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const c of candidates) {
      if (c && String(c['@type'] || '').includes('Event')) out.push(c);
      const list = Array.isArray(c?.itemListElement) ? c.itemListElement : [];
      for (const el of list) {
        const it = el?.item ?? el;
        if (it && String(it['@type'] || '').includes('Event')) out.push(it);
      }
    }
  }
  return out;
}

// Resolve time + price for one schema.org Event into a payload-ready
// triple the ingest function can store losslessly.
//
// Time input shapes:
//   1. Full datetime with offset  ("2026-05-29T14:00:00-07:00")
//      → use as-is; new Date() parses correctly.
//   2. Date-only                  ("2026-05-29")
//      → follow the detail URL for the precise time; fall back to the
//        venue's local noon when the detail fetch fails.
//   3. Naive datetime (no offset) ("2026-05-29T14:00:00")
//      → would otherwise be interpreted as runner-local time (UTC on
//        CI), so we treat it as venue-local by appending the venue's
//        current UTC offset.
//
// Price: tried listing-side first (extractPriceFromOffers on it.offers),
// then via the detail page when listing has none. A detail-page fetch
// runs once per event when either time or price needs it — the same
// fetch satisfies both.
//
// Returns ISO strings + price fields (each null when unresolved) plus
// a `tag` describing the time path taken — useful for the CI log.
async function resolveEventFields(it, venueTz, sourceListingUrl) {
  const rawStart = typeof it.startDate === 'string' ? it.startDate.trim() : '';
  const rawEnd = typeof it.endDate === 'string' ? it.endDate.trim() : '';
  const url = typeof it.url === 'string' ? it.url.trim() : '';

  // Listing-side time, if it's already fully qualified. The common case
  // for richer sources (campus calendars, custom feeds). No round trip
  // needed for time, but we may still need one for price.
  let startAt = hasTimezone(rawStart) ? new Date(rawStart).toISOString() : null;
  let endAt = (startAt && hasTimezone(rawEnd)) ? new Date(rawEnd).toISOString() : null;
  let tag = startAt ? 'listing' : null;

  // Listing-side price. Most Eventbrite listings omit `offers` entirely
  // (only the detail page has it), but other sources may carry it.
  // Pass sourceListingUrl so the CAD→USD override fires when applicable
  // — the per-event detail URL doesn't encode US-ness.
  let price = extractPriceFromOffers(it.offers, sourceListingUrl);

  // Detail-page fetch when either time or price is still missing AND we
  // have a URL to follow. ONE round-trip serves both needs.
  if (url && (!startAt || !price)) {
    const detail = await enrichFromDetailPage(url, sourceListingUrl);
    if (detail) {
      if (!startAt && hasTimezone(detail.start_at || '')) {
        startAt = new Date(detail.start_at).toISOString();
        endAt = detail.end_at && hasTimezone(detail.end_at)
          ? new Date(detail.end_at).toISOString()
          : null;
        tag = 'detail';
      }
      if (!price && detail.price_min !== null) {
        price = {
          priceMin: detail.price_min,
          priceMax: detail.price_max,
          priceCurrency: detail.price_currency,
        };
      }
    }
  }

  // Time fallback: date-only listing whose detail fetch didn't yield a
  // full timestamp. Anchor to the venue's local noon so the calendar day
  // doesn't slip back a day under UTC midnight.
  if (!startAt && isDateOnly(rawStart)) {
    const fbStart = dateOnlyToVenueLocalNoonIso(rawStart, venueTz);
    if (fbStart) {
      startAt = fbStart;
      endAt = isDateOnly(rawEnd) ? dateOnlyToVenueLocalNoonIso(rawEnd, venueTz) : null;
      tag = 'noon-fallback';
    }
  }

  // Naive datetime — treat as venue-local by stamping the venue's
  // current UTC offset onto the string.
  if (!startAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rawStart)) {
    const dayInstant = new Date(`${rawStart.slice(0, 10)}T12:00:00Z`);
    const offsetMin = -venueOffsetMinutesAt(venueTz, dayInstant);
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    const off = `${sign}${hh}:${mm}`;
    const start = new Date(`${rawStart}${off}`);
    if (!Number.isNaN(+start)) {
      const end = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rawEnd)
        ? new Date(`${rawEnd}${off}`)
        : null;
      startAt = start.toISOString();
      endAt = end && !Number.isNaN(+end) ? end.toISOString() : null;
      tag = 'naive-localized';
    }
  }

  // Last resort: pass to new Date(). May be wrong if the source is a
  // naive datetime; the tag flags it for the log.
  if (!startAt && rawStart) {
    const start = new Date(rawStart);
    if (!Number.isNaN(+start)) {
      const end = rawEnd ? new Date(rawEnd) : null;
      startAt = start.toISOString();
      endAt = end && !Number.isNaN(+end) ? end.toISOString() : null;
      tag = 'raw';
    }
  }

  return {
    start_at: startAt,
    end_at: endAt,
    price_min: price?.priceMin ?? null,
    price_max: price?.priceMax ?? null,
    price_currency: price?.priceCurrency ?? null,
    tag: tag ?? 'unresolved',
  };
}

// Cached wrapper around timezoneOffsetMinutes — called once per event
// in the naive-datetime path. The Intl.DateTimeFormat construction
// is not free; one cache entry per (tz, yyyy-mm-dd) is plenty.
const tzOffsetCache = new Map();
function venueOffsetMinutesAt(tz, instant) {
  const day = instant.toISOString().slice(0, 10);
  const key = `${tz}|${day}`;
  if (tzOffsetCache.has(key)) return tzOffsetCache.get(key);
  // Reuse the helper imported above (scrape-time.mjs) for parity with
  // the unit tests. Inline import path is awkward — instead we recreate
  // the computation here to avoid an extra module call in the hot loop.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(instant).reduce((acc, p) => {
    acc[p.type] = p.value; return acc;
  }, {});
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const wallAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(hour), Number(parts.minute), Number(parts.second),
  );
  const offset = Math.round((wallAsUtc - instant.getTime()) / 60_000);
  tzOffsetCache.set(key, offset);
  return offset;
}

// Scrape one listing URL into payload-shaped events (capped at MAX_PER_SOURCE).
async function scrapeOneSource(url) {
  const html = await fetchSourceHtml(url);
  // Eventbrite listing JSON-LD often has date-only `startDate`; the venue
  // timezone (inferred from the source URL's state code) anchors the
  // fallback when we can't reach the detail page for the real time.
  const venueTz = timezoneFromSourceUrl(url);

  const events = [];
  const seen = new Set(); // Eventbrite lists some events twice (featured + regular)
  // Counters for the per-source log so a glance at CI output tells us how
  // many events needed a detail-page round-trip vs. came clean, and how
  // many ended up with usable price data.
  const counts = { listing: 0, detail: 0, 'noon-fallback': 0, 'naive-localized': 0, raw: 0, unresolved: 0 };
  let priceCount = 0;
  let freeCount = 0;
  for (const it of extractJsonLdEvents(html)) {
    const geo = it.location?.geo;
    const lat = geo ? Number(geo.latitude) : NaN;
    const lng = geo ? Number(geo.longitude) : NaN;
    if (!it.name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    // Resolve time + price BEFORE the dedup key, so two listings of the
    // same event don't dedup based on a placeholder UTC-midnight and then
    // diverge after the detail-page lookup. The single detail-page fetch
    // inside resolveEventFields satisfies both needs. Pass the listing
    // URL so the CAD→USD override has the state-code it needs.
    const resolved = await resolveEventFields(it, venueTz, url);
    counts[resolved.tag] = (counts[resolved.tag] || 0) + 1;
    if (!resolved.start_at) continue;
    const start = new Date(resolved.start_at);
    const end = resolved.end_at ? new Date(resolved.end_at) : null;
    if (Number.isNaN(+start)) continue;

    const key = `${it.name}|${start.toISOString()}|${lat},${lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Capacity isn't always published. schema.org Event exposes it as
    // `maximumAttendeeCapacity` — use it when present + positive, otherwise leave
    // null so the app shows "/unk" and lets anyone join. (We only trust the
    // explicit max; `remainingAttendeeCapacity` is seats-left, not the total.)
    const maxCap = Number(it.maximumAttendeeCapacity);
    const capacity = Number.isFinite(maxCap) && maxCap > 0 ? Math.floor(maxCap) : null;
    events.push({
      title: String(it.name).trim(),
      description: (it.description || '').toString().trim(),
      start_at: start.toISOString(),
      end_at: end && !Number.isNaN(+end) ? end.toISOString() : null,
      location: { lat, lng },
      location_name: it.location?.name || '',
      capacity,
      // Price triple. Either all three fields are non-null (free shows
      // as 0/0/USD, fixed shows as N/N/CCC, range shows as L/H/CCC) or
      // all three are null. The migration's CHECK enforces the same
      // "both set or neither set" invariant at the DB level.
      price_min: resolved.price_min,
      price_max: resolved.price_max,
      price_currency: resolved.price_currency,
      // The original listing page — ingest-scraped stores it as source_url and
      // the event-detail screen links to it in place of a host.
      source_url: it.url ? String(it.url).trim() : null,
      // Cover image from the source's schema.org `image` (Eventbrite hosts
      // these on img.evbuc.com). Hot-linked as-is; null when absent.
      image_url: normalizeImageUrl(it.image),
    });
    if (resolved.price_min !== null) {
      priceCount++;
      if (resolved.price_min === 0 && resolved.price_max === 0) freeCount++;
    }
    if (events.length >= MAX_PER_SOURCE) break;
  }
  // Surface the resolution mix in CI logs (only the non-zero buckets, so
  // the common "all listing" case stays a one-liner).
  const tagSummary = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([tag, n]) => `${tag}:${n}`)
    .join(' ');
  if (tagSummary) console.log(`    time-resolution: ${tagSummary}`);
  if (events.length > 0) {
    console.log(`    price: ${priceCount}/${events.length} with prices (${freeCount} free)`);
  }
  return events;
}

// Scrape every source, then round-robin merge so the feed mixes cities rather
// than filling up from whichever one is listed first. A source that fails
// (bot-check / markup change) is logged and skipped — the others still
// contribute. Returns up to MAX_EVENTS events, de-duped across cities
// (Eventbrite cross-lists some events under neighboring cities).
async function scrapeEvents() {
  // Parallelize per-source fetches so one slow host can't block the others
  // (H5). The per-request timeout caps each source's wall-clock cost; we use
  // allSettled so a rejection is just a skipped source. The original input
  // order is preserved across results, which keeps the round-robin merge
  // deterministic (city A before city B every run).
  const results = await Promise.allSettled(SOURCE_URLS.map((url) => scrapeOneSource(url)));
  const lists = [];
  results.forEach((r, idx) => {
    const url = SOURCE_URLS[idx];
    if (r.status === 'fulfilled') {
      const evs = r.value;
      console.log(`  ${url} → ${evs.length} event(s)`);
      if (evs.length) lists.push(evs);
    } else {
      console.warn(`  ${url} → skipped (${r.reason})`);
    }
  });

  const merged = [];
  const seen = new Set();
  const depth = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < depth && merged.length < MAX_EVENTS; i++) {
    for (const list of lists) {
      if (i >= list.length) continue;
      const e = list[i];
      // M6: prefer the source's own canonical URL as the dedup key. Two
      // listings with the same title+start+coords are sometimes genuinely
      // distinct (recurring series, rounded coords); the source_url is the
      // stable per-event identity from Eventbrite's JSON-LD. Fall back to the
      // old composite when source_url is missing (e.g. malformed JSON-LD).
      // A partial unique index on events.source_url WHERE source='scraped'
      // enforces the same identity at the DB.
      const key = e.source_url
        ? `url:${e.source_url}`
        : `composite:${e.title}|${e.start_at}|${e.location.lat},${e.location.lng}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(e);
      if (merged.length >= MAX_EVENTS) break;
    }
  }
  return merged;
}

async function ingest(event) {
  const res = await fetchWithTimeout(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The new secret key is the project key for the gateway. The function is
      // deployed with --no-verify-jwt because sb_secret_… is NOT a JWT (so it
      // can't satisfy the default JWT gate the legacy service_role key did).
      apikey: SECRET_KEY,
      // Actual authorization: the function matches this against its own
      // INGEST_TOKEN secret — independent of Supabase's anon/service_role →
      // publishable/secret key migration.
      'x-ingest-token': INGEST_TOKEN,
    },
    body: JSON.stringify(event),
  }, INGEST_TIMEOUT_MS);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  let events = [];
  try {
    events = await scrapeEvents();
  } catch (err) {
    // The source blocked the runner (datacenter IP → 403/405) or changed its
    // markup. Don't hard-fail the whole pipeline — fall through to the seed
    // fallback below so the ingest path still runs (loudly logged). To get the
    // real listings, re-run (the block is intermittent) or run from a
    // non-datacenter IP. `DRY_RUN=1 node scripts/scrape-events.mjs` inspects locally.
    console.error(`Scrape failed after retries: ${err}`);
    console.error('Source likely blocked the CI runner (datacenter IP) or changed markup; falling back to seed events.');
    events = [];
  }

  console.log(`Scraped ${events.length} event(s) across ${SOURCE_URLS.length} source(s).`);

  // Zero-event fallback: the live source returned nothing (bot-check page
  // from the CI IP, markup change, etc.). FALLBACK_EVENTS exists to keep
  // the DRY_RUN demo working so the scraper can be inspected locally
  // without credentials, but we DO NOT POST these to live anymore — the
  // fixture rows used to drift between CI runs (start_at = Date.now()
  // + N days, source_url = NULL → dedup miss on both keys), which left
  // the home feed cluttered with duplicate copies of "Beginner Bouldering
  // Night" / "Aldrich Park Morning Run" / "Common Room Coffee Meetup".
  // Migration 00042 cleans up the existing dupes; the live skip below
  // prevents new ones.
  if (events.length === 0) {
    console.warn('No parseable events from the live source (bot-check / markup change / fetch error).');
    // M8: surface a degraded run in CI without hard-failing the workflow.
    // process.exitCode = 2 is distinct from a successful 0 and a hard-fail
    // 1, so the GitHub Actions log shows the pipeline ran but produced
    // nothing live-worthy.
    process.exitCode = 2;
    if (DRY_RUN) {
      console.warn('DRY_RUN: showing FALLBACK_EVENTS fixtures for pipeline inspection (NOT what would ingest).');
      events = FALLBACK_EVENTS;
    } else {
      console.warn('Skipping ingest — fixture seed events are no longer POSTed to live to avoid duplicate buildup.');
      return;
    }
  }

  if (DRY_RUN) {
    // No credentials needed — just show what would be ingested.
    for (const e of events) {
      // Compact price token: "$10-$25" / "$15" / "FREE" / "—".
      const p = e.price_min == null
        ? '—'
        : (e.price_min === 0 && e.price_max === 0)
          ? 'FREE'
          : (e.price_min === e.price_max)
            ? `$${e.price_min}`
            : `$${e.price_min}-$${e.price_max}`;
      console.log(`• ${e.title} | ${e.start_at} | ${e.location.lat},${e.location.lng} | ${e.location_name} | ${p}`);
    }
    console.log(`DRY_RUN: ${events.length} event(s) would be ingested (nothing POSTed).`);
    return;
  }

  let created = 0;
  let deduped = 0;
  let failed = 0;
  for (const event of events) {
    try {
      const r = await ingest(event);
      if (r.ok && r.body.deduped) {
        // Already in the table from a previous run — expected in steady state.
        deduped++;
        console.log(`↺ ${event.title} (already present)`);
      } else if (r.ok) {
        created++;
        console.log(`✓ ${event.title} → ${r.body.event_id}`);
      } else {
        // FR6.4: a bad row is logged + skipped, not fatal per-event.
        failed++;
        console.warn(`✗ ${event.title} → ${r.status} ${JSON.stringify(r.body)}`);
      }
    } catch (err) {
      failed++;
      console.warn(`✗ ${event.title} → ${err}`);
    }
  }

  console.log(`Done: ${created} new, ${deduped} already present, ${failed} failed of ${events.length}.`);
  // Hard-fail only if EVERYTHING errored — a steady-state run where all events
  // are already present (created + deduped both account for them) is a success.
  if (created === 0 && deduped === 0) {
    console.error('Every ingest failed. Most likely: 401 (the INGEST_TOKEN GitHub secret ' +
      'does not match the function\'s INGEST_TOKEN secret), or ingest-scraped is not deployed ' +
      'with --no-verify-jwt. See the ✗ status codes above.');
    process.exit(1);
  }
}

await main();
