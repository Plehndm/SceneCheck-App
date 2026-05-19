-- Atomic waitlist append. Prevents two concurrent subscribers from being
-- assigned the same position via a per-event advisory lock plus a unique
-- constraint as a belt-and-braces guard against any future caller that
-- bypasses the function.

ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_event_position_unique UNIQUE (event_id, position);

CREATE OR REPLACE FUNCTION public.add_to_waitlist(
  p_event_id UUID,
  p_user_id  UUID
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_position INT;
BEGIN
  -- Serialize concurrent appends for this event for the duration of the
  -- transaction. Different events do not block one another.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));

  SELECT COALESCE(MAX(position), 0) + 1
    INTO v_position
    FROM waitlist
   WHERE event_id = p_event_id;

  INSERT INTO waitlist (event_id, user_id, position)
  VALUES (p_event_id, p_user_id, v_position);

  RETURN v_position;
END;
$$;
