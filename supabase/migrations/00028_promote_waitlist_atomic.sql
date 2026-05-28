-- Atomic, race-free waitlist promotion (CODE_REVIEW_REPORT_3 C2).
--
-- The previous `promote-waitlist` Edge Function did the promotion in three
-- separate statements (subscription UPDATE, waitlist DELETE, notification
-- INSERT) with no transaction or lock. Two concurrent invocations could
-- both pick the same waitlist head row and double-promote — or, with the
-- capacity check absent entirely, push the event past `capacity`.
--
-- This RPC mirrors the pattern already established by 00013 (`add_to_waitlist`)
-- and 00015 (`subscribe_to_event_atomic`): take a per-event advisory transaction
-- lock, re-read state under the lock, and do every mutation in one statement
-- block so either everything commits or nothing does.
--
-- Why SECURITY DEFINER: callers are server-side Edge Functions running with the
-- service role (the Edge Function also enforces the organizer-only check before
-- invoking this — see promote-waitlist/index.ts). Using SECURITY DEFINER keeps
-- the function callable even if we ever tighten RLS on `event_subscriptions`,
-- `waitlist`, or `notifications` further; the function itself does its own
-- capacity gate.

CREATE OR REPLACE FUNCTION public.promote_waitlist_atomic(
  p_event_id UUID
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id  UUID;
  v_capacity INT;
  v_count    INT;
BEGIN
  -- Serialize promotion + concurrent subscribe for the same event. The
  -- subscribe path (00015) uses the same hash so they cannot race each
  -- other for the last seat.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));

  -- Re-check capacity under the lock. If the event has no capacity cap,
  -- promotion is always allowed (an uncapped event with a non-empty
  -- waitlist is a strange state but we still drain it FIFO).
  SELECT e.capacity INTO v_capacity FROM events e WHERE e.id = p_event_id;

  SELECT COUNT(*) INTO v_count
    FROM event_subscriptions s
   WHERE s.event_id = p_event_id AND s.status = 'confirmed';

  IF v_capacity IS NOT NULL AND v_count >= v_capacity THEN
    -- Still full — nothing to promote.
    RETURN NULL;
  END IF;

  -- Pick the next waitlist row FIFO (lowest position) and lock it so
  -- a concurrent promotion attempt waits behind us.
  SELECT w.user_id
    INTO v_user_id
    FROM waitlist w
   WHERE w.event_id = p_event_id
   ORDER BY w.position ASC
   LIMIT 1
   FOR UPDATE;

  IF v_user_id IS NULL THEN
    -- Waitlist is empty.
    RETURN NULL;
  END IF;

  -- Promote: flip the subscription row to confirmed.
  UPDATE event_subscriptions
     SET status = 'confirmed'
   WHERE event_id = p_event_id
     AND user_id = v_user_id;

  -- Remove the waitlist entry. The subscribe path uses MAX(position)+1
  -- when assigning new waitlist slots, so a gap left by this DELETE is
  -- fine — positions are advisory ordering, not contiguous indexes.
  DELETE FROM waitlist
   WHERE event_id = p_event_id
     AND user_id = v_user_id;

  -- In-app notification for the promoted user (FR10.2-ish: an event
  -- membership change). The push-fan-out path can be triggered by the
  -- caller via dispatch-notification if/when wired.
  INSERT INTO notifications (user_id, type, payload_json)
  VALUES (
    v_user_id,
    'waitlist_promotion',
    jsonb_build_object('event_id', p_event_id, 'deep_link', '/event/' || p_event_id::text)
  );

  RETURN v_user_id;
END;
$$;
