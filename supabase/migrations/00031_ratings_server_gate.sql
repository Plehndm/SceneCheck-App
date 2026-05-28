-- Server-side rating gate (FR5.11 / CODE_REVIEW_REPORT_3 H3).
--
-- FR5.11: a user may rate an event ONLY IF (a) they attended (confirmed
-- subscription), (b) the event has ended (`end_at < now()`), and (c) it has
-- ended within the last 24 hours. The existing UNIQUE(event_id, user_id) PK
-- on `ratings` already enforces once-per-attendee; this migration adds the
-- attendance + window check at the DB so non-attendees and out-of-window
-- raters are rejected even if the client (or a future API caller) skips
-- its own gate.
--
-- Implementation: a BEFORE INSERT trigger on `ratings` that consults
-- `event_subscriptions` and `events`. We use a trigger (not a CHECK
-- constraint) because the gate references other tables, which CHECK can't
-- do. The trigger raises a clean exception; rollup-rating's existing
-- `catch (ratingErr)` path surfaces it as an error response.
--
-- The trigger is intentionally tolerant of events with NULL end_at: many
-- mock/legacy events have only start_at, so we treat `end_at IS NULL` as
-- "ended at start_at" (a reasonable best-effort). If both are NULL the
-- gate fails closed.

CREATE OR REPLACE FUNCTION public.enforce_rating_gate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_attended BOOLEAN;
  v_end TIMESTAMPTZ;
BEGIN
  -- (a) Attendance check: a `confirmed` subscription is required. `attended`
  -- isn't a status (the schema uses confirmed/waitlisted/removed/cancelled),
  -- so "attended" == "was confirmed for this event."
  SELECT EXISTS (
    SELECT 1 FROM event_subscriptions s
     WHERE s.event_id = NEW.event_id
       AND s.user_id  = NEW.user_id
       AND s.status   = 'confirmed'
  ) INTO v_attended;

  IF NOT v_attended THEN
    RAISE EXCEPTION 'Only confirmed attendees may rate this event (FR5.11)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Determine the effective end time. NULL end_at -> fall back to start_at;
  -- both NULL -> can't gate, refuse.
  SELECT COALESCE(e.end_at, e.start_at) INTO v_end
    FROM events e WHERE e.id = NEW.event_id;

  IF v_end IS NULL THEN
    RAISE EXCEPTION 'Event has no end time; cannot rate (FR5.11)'
      USING ERRCODE = 'check_violation';
  END IF;

  -- (b) Event must have ended.
  IF v_end > now() THEN
    RAISE EXCEPTION 'Cannot rate an event that has not ended yet (FR5.11)'
      USING ERRCODE = 'check_violation';
  END IF;

  -- (c) Within 24h of the end.
  IF now() - v_end > INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Rating window has closed (24h after end) (FR5.11)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ratings_gate ON public.ratings;
CREATE TRIGGER ratings_gate
  BEFORE INSERT OR UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rating_gate();
