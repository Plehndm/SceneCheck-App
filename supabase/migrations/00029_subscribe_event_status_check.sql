-- subscribe_to_event_atomic: reject non-published events (CODE_REVIEW_REPORT_3 H10).
--
-- 00015's version checks capacity but never reads `events.status`. FR5.4 defines
-- a publish gate: events live as `draft` until `min_subscribers` is reached, and
-- only `published` events are discoverable. Allowing subscription to a `draft`,
-- `cancelled`, or `past` event undercuts that lifecycle (a draft would be filled
-- by anyone who happened to know the id; a cancelled event would silently
-- re-accumulate members).
--
-- This migration replaces the function in-place (same signature) so the existing
-- Edge Function caller — and any pgTAP / direct callers — pick up the new check
-- with no code change. The status is read under the same advisory lock as the
-- seat decision, so a status flip (e.g. organizer cancels) races correctly with
-- a concurrent subscribe.
--
-- Idempotency for already-confirmed subscribers is preserved: we short-circuit
-- on existing subscriptions BEFORE the status check, so an already-confirmed
-- attendee on a cancelled event still gets the 'already' response (no spurious
-- failure if the client re-issues the call).

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
  v_event_status TEXT;
BEGIN
  -- Serialize the seat decision for this event across the transaction.
  -- Different events keep operating concurrently.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));

  -- Idempotency: if the user already has any subscription, return it.
  -- Done BEFORE the status gate so a previously-confirmed attendee on a
  -- now-cancelled event still gets a benign 'already' rather than an error.
  SELECT s.status INTO v_existing
    FROM event_subscriptions s
   WHERE s.event_id = p_event_id AND s.user_id = p_user_id;

  IF v_existing IS NOT NULL THEN
    IF v_existing = 'waitlisted' THEN
      SELECT w.position INTO v_position
        FROM waitlist w
       WHERE w.event_id = p_event_id AND w.user_id = p_user_id;
    END IF;
    RETURN QUERY SELECT 'already'::TEXT, v_position;
    RETURN;
  END IF;

  -- Read capacity AND status under the lock. A NULL status means the event
  -- doesn't exist (or was just deleted) — treat as not subscribable.
  SELECT e.capacity, e.status
    INTO v_capacity, v_event_status
    FROM events e
   WHERE e.id = p_event_id;

  -- FR5.4 publish gate: only `published` events are subscribable. Draft
  -- events are pre-publish; cancelled/past events should not accept new
  -- members. The Edge Function maps this exception into a 4xx response.
  IF v_event_status IS NULL THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_event_status <> 'published' THEN
    RAISE EXCEPTION 'Event is not open for subscription (status=%)', v_event_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Counting subscriptions directly is the source of truth — the materialized
  -- subscriber_count column may lag by a trigger fire.
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
