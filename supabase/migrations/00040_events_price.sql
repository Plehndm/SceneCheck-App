-- Price range for events.
--
-- Adds three columns to events:
--   price_min       — lowest ticket price (in price_currency units)
--   price_max       — highest ticket price (in price_currency units)
--   price_currency  — ISO-4217 code (USD / CAD / EUR / …)
--
-- Encoding contract — exhaustively documented because the UI helper
-- (lib/price.ts) and the scraper both rely on it:
--
--   price_min IS NULL AND price_max IS NULL
--     → "price not specified". Display hides any price affordance.
--     Default state for user-created events whose host didn't set one,
--     and for scraped events whose source had no Offer/AggregateOffer.
--
--   price_min = 0 AND price_max = 0
--     → "free". Displays as a FREE badge.
--
--   price_min = price_max AND price_min > 0
--     → "fixed price". Displays as "$X".
--
--   price_min < price_max (both > 0 or min = 0 with max > 0)
--     → "range". Displays as "$X–$Y". The min=0 form covers tiered
--       offerings where the lowest tier is free.
--
-- The CHECK constraint enforces "both set or neither set" + non-negative
-- + max >= min, so an inconsistent partial state (e.g. min set, max NULL)
-- can never reach the DB. Currency defaults to NULL — it only makes
-- sense to record alongside actual numbers, and a NULL currency on a
-- non-NULL price is treated as USD by the format helper (Eventbrite
-- occasionally serves "CAD" for US-located events; the scraper auto-
-- corrects to USD when the source URL is a US listing).

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS price_min      NUMERIC(10, 2) NULL,
  ADD COLUMN IF NOT EXISTS price_max      NUMERIC(10, 2) NULL,
  ADD COLUMN IF NOT EXISTS price_currency TEXT           NULL;

-- "Both set or neither set; max >= min >= 0". The two non-null branches
-- are written separately so a malformed row pinpoints which half failed.
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_price_range_valid;
ALTER TABLE events
  ADD CONSTRAINT events_price_range_valid CHECK (
    (price_min IS NULL AND price_max IS NULL)
    OR (
      price_min IS NOT NULL AND price_max IS NOT NULL
      AND price_min >= 0
      AND price_max >= price_min
    )
  );

COMMENT ON COLUMN events.price_min IS
  'Lowest ticket price in price_currency. NULL = not specified. 0 with price_max=0 = free. Equal to price_max = fixed.';
COMMENT ON COLUMN events.price_max IS
  'Highest ticket price in price_currency. Must be >= price_min. NULL only when price_min is also NULL.';
COMMENT ON COLUMN events.price_currency IS
  'ISO-4217 currency code (USD / CAD / EUR / …). NULL treated as USD by the format helper.';
