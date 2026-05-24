-- Source URL for scraped (App-Created, FR6) events: the original listing page
-- the event was scraped from. NULL for user-created events. The event-detail
-- screen renders a "View original listing" link from this in place of the
-- (absent) host on a scraped event. ingest-scraped writes it; the scraper
-- pulls it from the source's JSON-LD `url`.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_url TEXT;
