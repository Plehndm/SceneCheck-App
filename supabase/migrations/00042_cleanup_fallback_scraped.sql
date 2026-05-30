-- Cleanup of FALLBACK_EVENTS duplicates.
--
-- Background. scripts/scrape-events.mjs ships a small fixture list
-- (Beginner Bouldering Night / Aldrich Park Morning Run / Common Room
-- Coffee Meetup) that the live ingest path used to POST whenever the
-- Eventbrite scrape returned zero events (bot-checks on CI runner IPs
-- were the common cause). The fixtures had:
--
--   start_at = Date.now() + (i + 2) * 86_400_000   (drifts every CI run)
--   source_url = null                              (exempt from the
--                                                   00033 partial unique
--                                                   index on source_url)
--
-- Combined, those two properties guaranteed a new row on every CI fallback
-- run — both the title+start_at composite (different start_at each run)
-- AND the source_url path (NULL excluded from the unique index) missed.
-- Multi-week buildup left the home feed cluttered with multiple copies
-- of each fixture title.
--
-- This migration deletes ALL scraped rows with source_url IS NULL. The
-- filter is broader than "fixture titles" by design — anything in the
-- `events` table marked `source='scraped'` without a real source URL is
-- by definition not a real Eventbrite event we can verify or link back
-- to, so the same cleanup catches:
--
--   * the FALLBACK_EVENTS duplicates the user reported,
--   * any pre-`source_url`-tracking-era rows that survived 00041 because
--     they happened to land on a non-midnight start_at,
--   * any future similar drift if a fallback path is reintroduced.
--
-- The scraper change shipped alongside this migration STOPS the live
-- ingest path from POSTing fallback events going forward — they remain
-- visible in DRY_RUN output but never reach the DB. The cleanup is a
-- one-shot pair with that change.
--
-- Cascade behaviour. Same as 00041: FKs to events(id) from
-- event_interests / event_subscriptions / event_waitlist / ratings are
-- ON DELETE CASCADE; chats.event_id and reports.target_event_id are ON
-- DELETE SET NULL. No orphan risk.
--
-- Idempotent: re-running is a no-op once the rows are gone. DO block
-- surfaces the deleted count in the migration log.

DO $$
DECLARE
  removed BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM events
    WHERE source = 'scraped'
      AND source_url IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO removed FROM deleted;
  RAISE NOTICE 'Removed % fallback scraped event(s) (source_url IS NULL).', removed;
END
$$;
