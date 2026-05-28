-- Capacity-increase auto-promotion (FR5.6 second half).
--
-- FR5.6: "If the limit increases, users currently on the waitlist will
-- automatically be subscribed to the event."
--
-- 00037 covers the DECREASE half via a trigger. The original plan for the
-- INCREASE half assumed the host-side capacity-edit UI would loop
-- `promote_waitlist_atomic` (00028) after each capacity raise — but the UI
-- (components/EditEventSheet.tsx → lib/api.ts updateEvent) just issues a
-- bare `UPDATE events SET capacity = …` with no follow-up call. That left
-- the INCREASE path completely unimplemented: raising capacity wouldn't
-- promote anyone from the waitlist until someone else triggered the
-- atomic-subscribe path.
--
-- "automatically" in the FR is best read as "the system does it without
-- requiring the client to know about waitlist mechanics" — so the right
-- home for this is a database trigger, symmetric to 00037. That also
-- catches the case of a capacity change performed via direct DB edit
-- (admin tooling, future bulk-update RPC, etc.) — the UI is not the
-- only mutator.
--
-- Reuses `promote_waitlist_atomic(NEW.id)` (00028) inside a loop so the
-- promotion semantics (FIFO by waitlist.position, status mutation, in-app
-- notification, advisory lock) stay in one place. The trigger exits when
-- either (a) confirmed count meets the new capacity, or (b) the RPC
-- returns NULL meaning the waitlist is empty.
--
-- Concurrency: `promote_waitlist_atomic` takes the same per-event advisory
-- xact lock as `subscribe_to_event_atomic` (00015/00029) and
-- `handle_capacity_decrease` (00037). pg_advisory_xact_lock is reentrant
-- on the same transaction id, so the trigger can call the locked function
-- safely without deadlocking itself.
--
-- Notifications: each promote call inserts its own `notifications` row via
-- 00028, so promoted users see "you're confirmed" in-app without this
-- migration needing to know about that contract.
--
-- Loop bound: capped at NEW.capacity iterations as a defensive sanity
-- limit — in practice the EXIT conditions fire long before this matters,
-- but a bounded loop is cheap insurance against an unforeseen pathological
-- state (e.g. promote returns the same user repeatedly due to a future
-- bug).

CREATE OR REPLACE FUNCTION public.handle_capacity_increase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_promoted        UUID;
  v_confirmed_count INT;
  v_loop_guard      INT := 0;
BEGIN
  -- Skip uncapped transitions: capacity NULL means "no limit", so there is
  -- no waitlist to promote into (subscribe_to_event_atomic also short-
  -- circuits the waitlist branch when capacity IS NULL).
  IF NEW.capacity IS NULL OR OLD.capacity IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only fire on a real increase. Equal-or-decrease is either a no-op or
  -- 00037's domain.
  IF NEW.capacity <= OLD.capacity THEN
    RETURN NEW;
  END IF;

  LOOP
    -- Pathological-state guard. In practice loop exits earlier via the
    -- two checks below.
    v_loop_guard := v_loop_guard + 1;
    IF v_loop_guard > NEW.capacity THEN
      EXIT;
    END IF;

    SELECT COUNT(*) INTO v_confirmed_count
      FROM event_subscriptions s
     WHERE s.event_id = NEW.id AND s.status = 'confirmed';

    -- New capacity reached: no more headroom to promote into.
    EXIT WHEN v_confirmed_count >= NEW.capacity;

    -- Promote next-in-line. Returns NULL when waitlist is empty.
    SELECT public.promote_waitlist_atomic(NEW.id) INTO v_promoted;
    EXIT WHEN v_promoted IS NULL;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_capacity_increase ON public.events;
CREATE TRIGGER events_capacity_increase
  AFTER UPDATE OF capacity ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_capacity_increase();
