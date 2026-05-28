-- Host analytics: popular event types by city / venue (FR5.3 /
-- CODE_REVIEW_REPORT_3 FR-coverage row).
--
-- FR5.3: "The system shall provide event creators with analytics showing:
-- what types of events are popular in a given city, and what types of events
-- have been hosted at a given location."
--
-- Implementation strategy: two SECURITY DEFINER RPCs that aggregate
-- `events JOIN event_interests JOIN interests` by interest name, filtered
-- either by city or by venue. Both fall back to ILIKE substring matching on
-- `events.location_name` — the events table has no separate `city` column
-- today (geocoding is captured in `geog`, the human-readable string in
-- `location_name`). Substring matching on location_name is good enough for
-- the host-analytics use case ("Irvine", "Verano Place") and avoids a
-- migration to split out a city dimension.
--
-- Status filter: only `published` events count. Drafts and cancelled events
-- shouldn't pollute the trending-interests histogram, and `past` events are
-- explicitly relevant (the spec says "have been hosted at" for the venue
-- variant), so we keep them — but we exclude `draft`/`cancelled`.
-- We accept any non-cancelled non-draft state by filtering on the
-- `published` status because the FR5.4 publish gate flips to past via the
-- `mark-past-events` cron path; published is the only "live or live-was"
-- state we care about. If a future migration adds explicit `past`, this
-- predicate can broaden to `status IN ('published','past')`.
--
-- Why SECURITY DEFINER: the function does not expose any private data —
-- it aggregates published events, which any signed-in user can already
-- SELECT through 00011's `Published events are readable` policy. Marking
-- the function SECURITY DEFINER keeps the analytics shape stable even if
-- a later migration tightens event RLS (e.g. unioning friends-only events).
-- Aggregates of published-only rows remain non-sensitive.
--
-- LIMIT 10: the host UI only renders the top 10. Push the limit into SQL
-- so the wire payload stays tiny and the planner can use the partial sort.
--
-- Empty-input guard: an empty `p_city` / `p_venue` would match every row
-- via ILIKE '%%' and degenerate into a global histogram. Reject empty
-- strings at the RPC boundary so callers get a clean error rather than
-- a misleading payload.

CREATE OR REPLACE FUNCTION public.host_analytics_by_city(
  p_city TEXT
) RETURNS TABLE (
  interest_name TEXT,
  event_count   INT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_city IS NULL OR length(btrim(p_city)) = 0 THEN
    RAISE EXCEPTION 'city must be non-empty' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    SELECT i.name AS interest_name,
           COUNT(DISTINCT e.id)::INT AS event_count
      FROM events e
      JOIN event_interests ei ON ei.event_id = e.id
      JOIN interests i ON i.id = ei.interest_id
     WHERE e.status = 'published'
       AND e.location_name ILIKE '%' || p_city || '%'
     GROUP BY i.name
     ORDER BY event_count DESC, i.name ASC
     LIMIT 10;
END;
$$;

CREATE OR REPLACE FUNCTION public.host_analytics_by_venue(
  p_venue TEXT
) RETURNS TABLE (
  interest_name TEXT,
  event_count   INT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_venue IS NULL OR length(btrim(p_venue)) = 0 THEN
    RAISE EXCEPTION 'venue must be non-empty' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    SELECT i.name AS interest_name,
           COUNT(DISTINCT e.id)::INT AS event_count
      FROM events e
      JOIN event_interests ei ON ei.event_id = e.id
      JOIN interests i ON i.id = ei.interest_id
     WHERE e.status = 'published'
       AND e.location_name ILIKE '%' || p_venue || '%'
     GROUP BY i.name
     ORDER BY event_count DESC, i.name ASC
     LIMIT 10;
END;
$$;

-- Any signed-in user can query — see header for the non-sensitivity argument.
-- (We don't restrict to "users who are event creators" because the spec is
-- about helping *prospective* hosts decide what to throw, so a person with
-- no events yet should still be able to use it.)
GRANT EXECUTE ON FUNCTION public.host_analytics_by_city(TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.host_analytics_by_venue(TEXT) TO authenticated;
