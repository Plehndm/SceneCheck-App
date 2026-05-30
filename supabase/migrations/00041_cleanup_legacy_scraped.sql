-- One-shot cleanup of legacy scraped events.
--
-- Background. Two earlier scraper bugs left duplicate / wrong rows in
-- `events`:
--
--   1. Time bug — Eventbrite listing JSON-LD ships date-only `startDate`
--      ("2026-05-29") which `new Date()` parses as UTC midnight. The
--      scraper stored that midnight UTC instant, which displays a day
--      early in any North American timezone. Fixed by the scrape-time
--      module + detail-page enrichment in the FR6 scraper.
--
--   2. Price bug — `events` had no price columns before migration 00040,
--      so every scraped row prior had NULL price fields.
--
-- The ingest function's self-heal patches BOTH (it UPDATEs start_at,
-- end_at, and the price triple in place when a re-scrape finds a
-- matching `source_url`). But Eventbrite rotates per-event listing URLs
-- periodically — old rows whose URLs have since changed don't match
-- today's scrape's URLs, so the self-heal can't reach them. They sit
-- in the table alongside the correct new rows, polluting the feed.
--
-- The combination "scraped AND price IS NULL AND start_at lands on
-- UTC midnight exactly" reliably identifies the legacy class:
--   - `source='scraped'`            scopes to scraped events only
--   - `price_min IS NULL`           today's scraper always writes a
--                                    price triple (FREE = 0/0/USD when
--                                    Eventbrite reports no offer); a
--                                    NULL price means the row predates
--                                    migration 00040 and is stale
--   - `start_at::time = '00:00:00'` the UTC-midnight fingerprint of the
--                                    date-only-parsed-as-UTC path
--
-- A genuine event at exact UTC midnight is rare in absolute terms and
-- vanishingly rare in the conjunction with "scraped AND no price" —
-- Eventbrite always emits an offer block, so a real midnight event
-- would have non-null price fields after today's scrape and be excluded.
--
-- Cascade behaviour. All FKs to events(id) are either ON DELETE CASCADE
-- (event_interests, event_subscriptions, event_waitlist, ratings) or
-- ON DELETE SET NULL (chats.event_id, reports.target_event_id), so a
-- DELETE here is structurally safe — it tears down the auto-tag rows
-- and any orphaned subscriptions, and detaches chats/reports without
-- losing them.
--
-- Idempotent: re-running the migration is a no-op once the cleanup
-- has run (the matching rows are gone). DO block surfaces the count
-- in the migration log so the magnitude is visible without a follow-up
-- query.

DO $$
DECLARE
  removed BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM events
    WHERE source = 'scraped'
      AND price_min IS NULL
      AND start_at::time = '00:00:00'
    RETURNING 1
  )
  SELECT COUNT(*) INTO removed FROM deleted;
  RAISE NOTICE 'Removed % legacy scraped event(s) (date-only-UTC + null price).', removed;
END
$$;
