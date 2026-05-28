-- Event update notifications (FR10.2 / CODE_REVIEW_REPORT_3 H1 backend).
--
-- When an event's user-visible fields change (title, description, start_at,
-- end_at, location, status), every confirmed subscriber should be notified.
-- The asymmetry between FR10.1 (friend request, already wired) and FR10.2/10.3
-- (event changed, event published) is what the review flagged: the infra is
-- written, the trigger is missing.
--
-- This migration installs an AFTER UPDATE trigger that diffs OLD vs NEW for
-- the meaningful columns, and on any change inserts one `notifications` row
-- per confirmed subscriber. Push fan-out is a separate concern — the
-- `dispatch-notification` Edge Function handles Expo push when invoked
-- explicitly. The in-app notification persistence (FR10.2 minimum) lives
-- here in pure SQL so it can't be bypassed by a future caller editing
-- `events` directly.
--
-- "Meaningful columns": anything an attendee would want to know changed.
-- `geog` is included so a venue move triggers a notification, but
-- subscriber_count is NOT (it changes constantly and would spam). status
-- transitions to 'cancelled' are particularly important to deliver.
--
-- Source-of-update guard: we ONLY fire this trigger for non-scraped events.
-- Today the `ingest-scraped` Edge Function uses an INSERT-or-skip path
-- (dedupe-on-title+start_at, return existing id) so it never UPDATEs an
-- existing event, but a future change to that function (e.g. switching to
-- UPSERT to keep titles fresh) would otherwise spam every confirmed
-- subscriber on every daily scrape. Scraped events have no human host who
-- meaningfully "updates" them in the FR10.2 sense; for now the trigger is
-- scoped to user-created events. If scraped-event change notifications
-- are wanted later, a more nuanced diff + rate-limit lives at that layer.

CREATE OR REPLACE FUNCTION public.notify_event_updated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_changed_fields TEXT[] := '{}';
  v_payload JSONB;
BEGIN
  -- Skip scraped events. Their updates (if any future code path adds them)
  -- are machine-driven re-imports, not host-initiated "I changed the event"
  -- changes; FR10.2 is about the latter.
  IF COALESCE(NEW.source, 'user') = 'scraped' THEN
    RETURN NEW;
  END IF;

  -- Compare each tracked column. `IS DISTINCT FROM` correctly handles NULLs
  -- (unlike `<>` which returns NULL when either side is NULL).
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    v_changed_fields := v_changed_fields || 'title';
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    v_changed_fields := v_changed_fields || 'description';
  END IF;
  IF NEW.start_at IS DISTINCT FROM OLD.start_at THEN
    v_changed_fields := v_changed_fields || 'start_at';
  END IF;
  IF NEW.end_at IS DISTINCT FROM OLD.end_at THEN
    v_changed_fields := v_changed_fields || 'end_at';
  END IF;
  IF NEW.location_name IS DISTINCT FROM OLD.location_name
     OR NEW.geog IS DISTINCT FROM OLD.geog THEN
    v_changed_fields := v_changed_fields || 'location';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_changed_fields := v_changed_fields || 'status';
  END IF;

  -- No meaningful change → no notification (avoids spamming subscribers
  -- on e.g. subscriber_count bumps from the existing 00007 trigger).
  IF array_length(v_changed_fields, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'event_id', NEW.id,
    'deep_link', '/event/' || NEW.id::text,
    'changed_fields', to_jsonb(v_changed_fields),
    'status', NEW.status
  );

  -- One in-app row per confirmed subscriber. We DON'T notify waitlisted users
  -- here (they aren't attendees yet) or the host (they made the change).
  INSERT INTO notifications (user_id, type, payload_json)
  SELECT s.user_id, 'event.updated', v_payload
    FROM event_subscriptions s
   WHERE s.event_id = NEW.id
     AND s.status   = 'confirmed'
     AND s.user_id  <> COALESCE(NEW.creator_id, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_update_notify ON public.events;
CREATE TRIGGER events_update_notify
  AFTER UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_updated();
