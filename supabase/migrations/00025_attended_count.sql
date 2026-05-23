-- Public "events attended" count for any user.
--
-- The other-profile screen shows a hosted / attended / rating stat row for
-- people, but event_subscriptions' SELECT RLS only lets you see your OWN rows
-- (00011), so a viewer can't count someone else's attended events directly.
-- This SECURITY DEFINER function returns just the COUNT of a user's confirmed
-- subscriptions (no row details), so the stat is available without exposing
-- which events they joined.

CREATE OR REPLACE FUNCTION public.attended_count(p_user uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int
  FROM event_subscriptions
  WHERE user_id = p_user AND status = 'confirmed';
$$;

GRANT EXECUTE ON FUNCTION public.attended_count(uuid) TO anon, authenticated;
