// CI-only events scraper for FR6 (App-Created Events).
//
// Runs in GitHub Actions (.github/workflows/scrape-events.yml) on a schedule.
// It scrapes an events source and POSTs each event to the `ingest-scraped`
// Edge Function. That function inserts the row with source='scraped', which is
// what makes the app classify it as "Recommended" (lib/api.ts transformEventRow
// → kind 'recommended'; components/Map/types.ts pinColor → blue "Recommended").
// It also auto-tags the event by matching `description` text against interest
// names, so a good description is what later lets a scraped event light up for
// users who share those interests.
//
// Node 20+ only (uses global fetch). No dependencies for the POST itself; add
// cheerio / Playwright in the workflow if you parse real HTML.

const SUPABASE_URL = process.env.SUPABASE_URL;        // https://<project-ref>.supabase.co
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;   // sb_secret_… (replaces the deprecated service_role key)
const INGEST_TOKEN = process.env.INGEST_TOKEN;        // shared secret the ingest-scraped function matches

if (!SUPABASE_URL || !SECRET_KEY || !INGEST_TOKEN) {
  console.error('Missing one of: SUPABASE_URL, SUPABASE_SECRET_KEY, INGEST_TOKEN.');
  process.exit(1);
}

const ENDPOINT = `${SUPABASE_URL}/functions/v1/ingest-scraped`;

/**
 * Scrape your source and return events in the `ingest-scraped` payload shape:
 *   { title, start_at, location: { lat, lng },          // REQUIRED
 *     description?, location_name?, end_at?, capacity? } // optional
 *
 * - `start_at` / `end_at` must be ISO 8601 strings.
 * - `description` drives auto-tagging: include interest keywords (e.g.
 *   "climbing", "coffee", "running") so the event gets `event_interests` rows.
 *
 * Replace the stub below with real scraping. For a static page:
 *   const html = await (await fetch(url)).text();
 *   const $ = cheerio.load(html);  // import cheerio at the top
 *   ...map DOM nodes to the shape above.
 * For a JS-rendered page, drive it with Playwright instead.
 */
async function scrapeEvents() {
  // TODO: replace with real scraping of your target site.
  return [
    {
      title: 'Free Climbing Intro Night',
      description: 'Beginner-friendly bouldering and climbing meetup downtown.',
      start_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      end_at: null,
      location: { lat: 33.6405, lng: -117.8443 },
      location_name: 'Irvine Spectrum',
      capacity: 40,
    },
  ];
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
