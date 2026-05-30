-- ══════════════════════════════════════════════════════════════
-- rank_events_query v2 — surface friend-hosted + own events on the map
--
-- Two gaps this fixes (FR4.4 pin color-coding + FR5 user-created events):
--
--   1. FRIEND COLORING. The previous signature returned `creator_id` but
--      no relationship flag, so `transformEventRow` (lib/api.ts) had no way
--      to tell a friend's event from a stranger's and bucketed every
--      non-own, non-scraped row as 'other' (grey "NEARBY" pin). The
--      "Friends" map filter was therefore always empty. We add an
--      `is_friend_creator` boolean (an EXISTS against accepted friendships)
--      so the client can emit kind='friend' and color the pin / fill the
--      bucket.
--
--   2. OWN-EVENT VISIBILITY. User-created events start life as 'draft'
--      (create-event edge fn) and only flip to 'published' once
--      subscriber_count >= min_subscribers (check_publish_gate, FR5.4).
--      The old WHERE clause filtered `status = 'published'`, so a host
--      never saw their own freshly-created event on the map — a
--      chicken-and-egg gap (nobody can subscribe to an event they can't
--      see). We widen the predicate to `status = 'published' OR
--      creator_id = p_user_id` so a creator always sees their own events
--      (drafts included) while everyone else still only sees published
--      ones. The publish gate for *other* people's drafts is unchanged.
--
-- Everything else (the spatial radius filter, the start-time window, and
-- the composite interest/friend/distance score) is carried over verbatim
-- from migration 00012.
--
-- We DROP before CREATE: adding `is_friend_creator` to the RETURNS TABLE
-- changes the function's return type, which `CREATE OR REPLACE` alone
-- rejects ("cannot change return type of existing function"). The arg
-- signature is unchanged, so the drop targets the existing 4-arg overload.
-- ══════════════════════════════════════════════════════════════
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
