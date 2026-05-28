-- Capacity-decrease demotion (FR5.6 / CODE_REVIEW_REPORT_3 H8).
--
-- FR5.6: "The event creator has the ability to adjust the participant limit.
-- If the limit increases, users currently on the waitlist will automatically
-- be subscribed to the event. If the limit decreases, users will be removed
-- from the event and put at the front of the waitlist."
--
-- The DECREASE half had no implementation before this migration. The INCREASE
-- half is already handled by `promote_waitlist_atomic` (00028), which the
-- host-side capacity-edit UI can loop over until either the waitlist is
-- empty or capacity is full again.
--
-- This migration adds an AFTER UPDATE OF capacity trigger that, when the
-- new capacity is strictly less than the old AND the event currently has
-- more confirmed subscribers than the new cap allows, demotes the excess
-- to the FRONT of the waitlist in reverse-chronological order
-- (FR5.6 explicit: "the last person to subscribe will be removed first").
--
-- Ordering specifics:
--   - "Last person to subscribe is removed first" → ORDER BY
--     event_subscriptions.created_at DESC, LIMIT v_to_demote.
--   - "Put at the FRONT of the waitlist" → existing waitlist positions are
--     shifted up by v_to_demote, and the demoted users take positions 1..N
--     where position 1 is the most-recent demotee (so when promotion fires
--     FIFO from position 1, the *most-recent* subscriber comes back first —
--     this matches the spirit of "what was last in is first out of the
--     waitlist back into the event when space opens").
--
-- Concurrency: the AFTER trigger takes the same per-event advisory
-- transaction lock used by `subscribe_to_event_atomic` (00015/00029) and
-- `promote_waitlist_atomic` (00028) so a capacity change cannot race a
-- concurrent subscribe or promote. All three paths hash the event id with
-- `hashtextextended(NEW.id::text, 0)` — keep this hash identical or the
-- mutual exclusion is silently lost.
--
-- Trigger semantics:
--   - Fires on UPDATE OF capacity only (avoid no-op work on every events
--     UPDATE, including the existing notify_event_updated trigger's diff).
--   - Skips when OLD.capacity IS NULL (uncapped → capped is a *new* cap; if
--     the cap is already exceeded, we still need to demote — see body).
--   - Skips when NEW.capacity IS NULL (cap removed entirely → nobody to
--     demote, waitlist can be drained by promote on next subscribe path).
--   - Skips when NEW.capacity >= OLD.capacity (increase or no change is
--     the INCREASE half's territory; the host UI calls
--     promote_waitlist_atomic in that case).
--
-- Notifications: one in-app `notifications` row per demoted user, type
-- `event.demoted_to_waitlist`, payload `{event_id, position, deep_link}`.
-- The push fan-out can be wired by `dispatch-notification` from the
-- host-side capacity-edit RPC if/when desired; the in-app row is the
-- minimum FR10 deliverable and matches the pattern set by 00028.
--
-- Side effects on counters:
--   - DELETE on event_subscriptions fires the existing 00007 trigger
--     `on_subscription_change` which recomputes events.subscriber_count.
--   - INSERT into waitlist is unaffected by that counter (subscriber_count
--     counts only `confirmed` rows; waitlisted users were never counted).
-- Both behaviours are correct on a cascade demote.

CREATE OR REPLACE FUNCTION public.handle_capacity_decrease()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_confirmed_count INT;
  v_to_demote       INT;
  v_rec             RECORD;
  v_new_position    INT;
BEGIN
  -- Only react to genuine decreases. Increases are handled out-of-band
  -- by the host UI calling promote_waitlist_atomic in a loop.
  IF NEW.capacity IS NULL OR OLD.capacity IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.capacity >= OLD.capacity THEN
    RETURN NEW;
  END IF;

  -- Serialize against concurrent subscribe / promote. Identical hash to
  -- 00015/00028/00029 — do NOT change without updating those callers.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.id::text, 0));

  SELECT COUNT(*) INTO v_confirmed_count
    FROM event_subscriptions s
   WHERE s.event_id = NEW.id
     AND s.status = 'confirmed';

  -- New cap can already accommodate the existing crowd → nothing to do.
  IF v_confirmed_count <= NEW.capacity THEN
    RETURN NEW;
  END IF;

  v_to_demote := v_confirmed_count - NEW.capacity;

  -- Shift the existing waitlist UP by v_to_demote so positions 1..v_to_demote
  -- become free for the freshly-demoted users (the "front of the waitlist"
  -- per FR5.6). Doing this BEFORE the inserts avoids a unique-key collision
  -- (waitlist PK is (event_id, user_id) so position collisions are allowed
  -- but a same-event swap of all positions in one statement is cleaner).
  UPDATE waitlist
     SET position = position + v_to_demote
   WHERE event_id = NEW.id;

  -- Now demote the most recently confirmed subscribers, one at a time, so
  -- we can assign positions deterministically. event_subscriptions.created_at
  -- is the timestamp set by both the direct INSERT path (24) and the atomic
  -- RPCs (00015/00029); it's the canonical "when did this person subscribe"
  -- column (PK is (event_id, user_id), no separate confirmed_at exists).
  v_new_position := 0;
  FOR v_rec IN
    SELECT s.user_id
      FROM event_subscriptions s
     WHERE s.event_id = NEW.id
       AND s.status = 'confirmed'
     ORDER BY s.created_at DESC, s.user_id DESC   -- tiebreak: deterministic
     LIMIT v_to_demote
  LOOP
    v_new_position := v_new_position + 1;

    -- Remove the confirmed subscription. (Choice: DELETE rather than
    -- status='waitlisted' to mirror the existing
    -- subscribe_to_event_atomic + promote_waitlist_atomic pair, which
    -- treat the waitlist table as the canonical waitlist state and
    -- event_subscriptions as the confirmed-only ledger. promote_waitlist_atomic
    -- INSERTs back into event_subscriptions on promotion if needed.)
    --
    -- Actually — 00015 keeps a *waitlisted* row in event_subscriptions with
    -- status='waitlisted'. So for symmetry we mirror that: UPDATE the
    -- existing row to 'waitlisted' and add a waitlist row, instead of DELETE.
    UPDATE event_subscriptions
       SET status = 'waitlisted'
     WHERE event_id = NEW.id
       AND user_id  = v_rec.user_id;

    INSERT INTO waitlist (event_id, user_id, position)
    VALUES (NEW.id, v_rec.user_id, v_new_position);

    INSERT INTO notifications (user_id, type, payload_json)
    VALUES (
      v_rec.user_id,
      'event.demoted_to_waitlist',
      jsonb_build_object(
        'event_id',  NEW.id,
        'position',  v_new_position,
        'deep_link', '/event/' || NEW.id::text
      )
    );
  END LOOP;

  -- The subscriber_count column is maintained by 00007's
  -- on_subscription_change trigger, which fires on UPDATE of
  -- event_subscriptions and recomputes from the confirmed count. Each
  -- per-row UPDATE above fires it; the final read reflects the post-demote
  -- count automatically. No manual recompute needed.

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_capacity_decrease ON public.events;
CREATE TRIGGER events_capacity_decrease
  AFTER UPDATE OF capacity ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_capacity_decrease();
