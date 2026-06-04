-- ══════════════════════════════════════════════════════════════
-- Event preview/cover images (FR4 polish).
--
-- The FR6 scraper reads schema.org Event JSON-LD, which carries an `image`
-- URL (Eventbrite hosts these on img.evbuc.com). We store that URL on a new
-- nullable `events.image_url` column (hot-linked — not re-hosted) so cards +
-- the event-detail screen can show a preview. NULL for user-created events
-- without an uploaded image; the UI falls back to a placeholder.
--
-- `rank_events_query` returns an explicit column list (not SELECT *), so it
-- must be DROP+CREATE'd to surface `image_url` on the discovery feed — without
-- this the home/map/search cards wouldn't get the image (only the event-detail
-- screen, which selects `*`, would). The arg signature is unchanged; the
-- function body below is migration 00043 verbatim with `image_url` added to the
-- RETURNS TABLE + SELECT (in matching positions — SQL functions map RETURNS
-- TABLE columns to the SELECT by position).
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url TEXT;

DROP FUNCTION IF EXISTS public.rank_events_query(FLOAT, FLOAT, INT, UUID);

CREATE OR REPLACE FUNCTION public.rank_events_query(
  p_lat FLOAT,
  p_lng FLOAT,
  p_radius INT,        -- meters
  p_user_id UUID
) RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  lat FLOAT,
  lng FLOAT,
  location_name TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  capacity INT,
  subscriber_count INT,
  status TEXT,
  source TEXT,
  creator_id UUID,
  image_url TEXT,
  is_friend_creator BOOLEAN,
  is_full BOOLEAN,
  score NUMERIC
) LANGUAGE sql STABLE AS $$
  SELECT
    e.id,
    e.title,
    e.description,
    ST_Y(e.geog::geometry) AS lat,
    ST_X(e.geog::geometry) AS lng,
    e.location_name,
    e.start_at,
    e.end_at,
    e.capacity,
    e.subscriber_count,
    e.status,
    e.source,
    e.creator_id,
    e.image_url,
    -- is_friend_creator: true when the row's creator is an accepted friend
    -- of the viewer. Drives the 'friend' kind + accent pin client-side.
    EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.from_id = p_user_id AND f.to_id = e.creator_id)
          OR (f.to_id = p_user_id AND f.from_id = e.creator_id)
        )
    ) AS is_friend_creator,
    (e.capacity IS NOT NULL AND e.subscriber_count >= e.capacity) AS is_full,
    (
      -- Interest overlap score (0-10): each shared interest tag = +2
      COALESCE((
        SELECT COUNT(*) FROM event_interests ei
        JOIN user_interests ui ON ei.interest_id = ui.interest_id
        WHERE ei.event_id = e.id AND ui.user_id = p_user_id
      ), 0) * 2
      +
      -- Friend attendance score (0-5): each friend going = +1
      COALESCE((
        SELECT COUNT(*) FROM event_subscriptions es
        JOIN friendships f ON (
          (f.from_id = p_user_id AND f.to_id = es.user_id)
          OR (f.to_id = p_user_id AND f.from_id = es.user_id)
        ) AND f.status = 'accepted'
        WHERE es.event_id = e.id AND es.status = 'confirmed'
      ), 0)
      -
      -- Distance penalty (0-1): farther = lower score
      CASE WHEN p_radius > 0
        THEN ST_Distance(e.geog, ST_MakePoint(p_lng, p_lat)::geography) / p_radius
        ELSE 0
      END
    )::NUMERIC AS score
  FROM events e
  WHERE (e.status = 'published' OR e.creator_id = p_user_id)
    AND ST_DWithin(e.geog, ST_MakePoint(p_lng, p_lat)::geography, p_radius)
    AND e.start_at > now() - INTERVAL '2 hours'
  ORDER BY score DESC
  LIMIT 200;
$$;
