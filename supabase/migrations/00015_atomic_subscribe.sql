-- Fix: race condition in subscribe-to-event
--
-- The Edge Function did capacity check + INSERT as two separate
-- statements. Two concurrent subscribers could both pass the check
-- when only one seat remained and both end up status='confirmed',
-- exceeding the cap. This mirrors the same risk that `add_to_waitlist`
-- (migration 00013) already solved for the waitlist side — via a
-- per-event advisory lock.
--
-- This migration adds the analogous atomic function for the confirmed
-- path. The Edge Function now invokes this single RPC and reads its
-- return value to know whether the subscriber was confirmed (seat
-- available) or waitlisted (full).

CREATE OR REPLACE FUNCTION public.subscribe_to_event_atomic(
  p_event_id UUID,
  p_user_id  UUID
) RETURNS TABLE (
  status TEXT,           -- 'confirmed' | 'waitlisted' | 'already'
  waitlist_position INT  -- NULL when not waitlisted
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_capacity INT;
  v_count INT;
  v_existing TEXT;
  v_position INT;
BEGIN
  -- Serialize the seat decision for this event across the transaction.
  -- Different events keep operating concurrently.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));

  -- Idempotency: if the user already has any subscription, return it.
  SELECT s.status INTO v_existing
    FROM event_subscriptions s
   WHERE s.event_id = p_event_id AND s.user_id = p_user_id;

  IF v_existing IS NOT NULL THEN
    -- Pull the waitlist position if relevant so the caller can render it.
    IF v_existing = 'waitlisted' THEN
      SELECT w.position INTO v_position
        FROM waitlist w
       WHERE w.event_id = p_event_id AND w.user_id = p_user_id;
    END IF;
    RETURN QUERY SELECT 'already'::TEXT, v_position;
    RETURN;
  END IF;

  -- Read capacity + current confirmed count under the lock. Counting
  -- subscriptions directly is the source of truth — the materialized
  -- subscriber_count column may lag by a trigger fire.
  SELECT e.capacity INTO v_capacity FROM events e WHERE e.id = p_event_id;
  SELECT COUNT(*) INTO v_count
    FROM event_subscriptions s
   WHERE s.event_id = p_event_id AND s.status = 'confirmed';

  IF v_capacity IS NOT NULL AND v_count >= v_capacity THEN
    -- Full: go on the waitlist (also serialized by the same advisory lock).
    INSERT INTO event_subscriptions (event_id, user_id, status)
    VALUES (p_event_id, p_user_id, 'waitlisted');

    SELECT COALESCE(MAX(w.position), 0) + 1 INTO v_position
      FROM waitlist w WHERE w.event_id = p_event_id;
    INSERT INTO waitlist (event_id, user_id, position)
    VALUES (p_event_id, p_user_id, v_position);

    RETURN QUERY SELECT 'waitlisted'::TEXT, v_position;
  ELSE
    INSERT INTO event_subscriptions (event_id, user_id, status)
    VALUES (p_event_id, p_user_id, 'confirmed');
    RETURN QUERY SELECT 'confirmed'::TEXT, NULL::INT;
  END IF;
END;
$$;
