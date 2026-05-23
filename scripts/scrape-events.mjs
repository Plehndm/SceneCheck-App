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
// Source: Eventbrite's public "events in Irvine" listing, which embeds a
// schema.org `ItemList` of events as JSON-LD (<script type="application/ld+json">).
// Parsing that structured blob is far more stable than scraping the DOM and needs
// no dependencies. Point EVENTS_SOURCE_URL at a different Eventbrite location (or
// any page that publishes event JSON-LD) to change the source.
//
// Node 20+ only (uses global fetch).
//
// Test without credentials:  DRY_RUN=1 node scripts/scrape-events.mjs
// (scrapes + prints the payloads, skips the POST).

const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL;        // https://<project-ref>.supabase.co
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;   // sb_secret_… (replaces the deprecated service_role key)
const INGEST_TOKEN = process.env.INGEST_TOKEN;        // shared secret the ingest-scraped function matches

if (!DRY_RUN && (!SUPABASE_URL || !SECRET_KEY || !INGEST_TOKEN)) {
  console.error('Missing one of: SUPABASE_URL, SUPABASE_SECRET_KEY, INGEST_TOKEN. (Use DRY_RUN=1 to scrape without ingesting.)');
  process.exit(1);
}

const ENDPOINT = `${SUPABASE_URL}/functions/v1/ingest-scraped`;
const SOURCE_URL = process.env.EVENTS_SOURCE_URL || 'https://www.eventbrite.com/d/ca--irvine/events/';
const MAX_EVENTS = Number(process.env.MAX_EVENTS || 40); // cap so one run can't flood the table

// Pull every JSON-LD <script> block from the page and collect the events out of
// any schema.org ItemList among them.
function extractJsonLdEvents(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const items = [];
  for (const block of blocks) {
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

/**
 * Scrape SOURCE_URL and return events in the `ingest-scraped` payload shape:
 *   { title, start_at, location: { lat, lng },          // REQUIRED
 *     description?, location_name?, end_at?, capacity? } // optional
 * `start_at` / `end_at` are normalized to ISO 8601. Events without a usable
 * title/start/geo are skipped (ingest-scraped requires a valid lat/lng).
 */
async function scrapeEvents() {
  const res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (SceneCheck events scraper; +FR6)' },
  });
  if (!res.ok) throw new Error(`Source fetch failed: ${res.status} ${SOURCE_URL}`);
  const html = await res.text();

  const events = [];
  const seen = new Set(); // Eventbrite lists some events twice (featured + regular)
  for (const it of extractJsonLdEvents(html)) {
    const geo = it.location?.geo;
    const lat = geo ? Number(geo.latitude) : NaN;
    const lng = geo ? Number(geo.longitude) : NaN;
    const start = it.startDate ? new Date(it.startDate) : null;
    const end = it.endDate ? new Date(it.endDate) : null;
    // Required by ingest-scraped: title, valid start, and a real lat/lng
    // (skips online/location-less events).
    if (!it.name || !start || Number.isNaN(+start) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = `${it.name}|${start.toISOString()}|${lat},${lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({
      title: String(it.name).trim(),
      description: (it.description || '').toString().trim(),
      start_at: start.toISOString(),
      end_at: end && !Number.isNaN(+end) ? end.toISOString() : null,
      location: { lat, lng },
      location_name: it.location?.name || '',
      capacity: null,
    });
  }
  return events.slice(0, MAX_EVENTS);
}

async function ingest(event) {
  const res = await fetch(ENDPOINT, {
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
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

const events = await scrapeEvents();
console.log(`Scraped ${events.length} event(s) from ${SOURCE_URL}`);

if (DRY_RUN) {
  // No credentials needed — just show what would be ingested.
  for (const e of events) {
    console.log(`• ${e.title} | ${e.start_at} | ${e.location.lat},${e.location.lng} | ${e.location_name}`);
  }
  console.log(`DRY_RUN: ${events.length} event(s) would be ingested (nothing POSTed).`);
  process.exit(0);
}

let ingested = 0;
let failed = 0;

for (const event of events) {
  try {
    const r = await ingest(event);
    if (r.ok) {
      ingested++;
      console.log(`✓ ${event.title} → ${r.body.event_id}`);
    } else {
      // FR6.4: a bad/duplicate row is logged + skipped, not fatal.
      failed++;
      console.warn(`✗ ${event.title} → ${r.status} ${JSON.stringify(r.body)}`);
    }
  } catch (err) {
    failed++;
    console.warn(`✗ ${event.title} → ${err}`);
  }
}

console.log(`Done: ${ingested} ingested, ${failed} skipped of ${events.length}.`);

// Surface a hard failure (so the run goes red) only if nothing got through —
// individual skips are expected and shouldn't fail the job.
if (events.length > 0 && ingested === 0) process.exit(1);
