-- PostgreSQL functions for complex queries and business logic

-- ══════════════════════════════════════════════════════════════
-- rank_events_query: Core spatial ranking query for event discovery
-- Uses PostGIS ST_DWithin for radius filtering and a composite score
-- based on interest overlap, friend attendance, and distance.
-- ══════════════════════════════════════════════════════════════
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
  WHERE e.status = 'published'
    AND ST_DWithin(e.geog, ST_MakePoint(p_lng, p_lat)::geography, p_radius)
    AND e.start_at > now() - INTERVAL '2 hours'
  ORDER BY score DESC
  LIMIT 200;
$$;

-- ══════════════════════════════════════════════════════════════
-- check_publish_gate: Transition event from 'draft' to 'published'
-- when subscriber_count reaches min_subscribers threshold (FR5.4)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_publish_gate(p_event_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status TEXT;
  v_subs INT;
  v_min INT;
BEGIN
  SELECT status, subscriber_count, min_subscribers
  INTO v_status, v_subs, v_min
  FROM events WHERE id = p_event_id;

  IF v_status = 'draft' AND v_subs >= v_min THEN
    UPDATE events SET status = 'published' WHERE id = p_event_id;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- rollup_host_rating: Recompute a host's avg_rating from all their
-- events' ratings. Called after a new rating is inserted.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rollup_host_rating(p_host_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET avg_rating = COALESCE((
    SELECT ROUND(AVG(r.stars)::numeric, 1)
    FROM ratings r
    JOIN events e ON r.event_id = e.id
    WHERE e.creator_id = p_host_id
  ), 0)
  WHERE user_id = p_host_id;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- Realtime: enable CDC on messages table for chat subscriptions
-- ══════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
