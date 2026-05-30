-- ══════════════════════════════════════════════════════════════
-- Fix notify_event_updated() — malformed-array crash on event UPDATE.
--
-- The FR10.2 trigger from migration 00032 builds a TEXT[] of changed
-- columns with `v_changed_fields := v_changed_fields || 'start_at'`.
-- With a `text[]` on the left and a bare unknown-type string literal on
-- the right, Postgres resolves the `||` operator to `anyarray ||
-- anyarray` and tries to parse 'start_at' AS an array literal, which
-- throws at runtime:
--
--   ERROR: malformed array literal: "start_at" (SQLSTATE 22P02)
--   Array value must start with "{" or dimension information.
--
-- `CREATE OR REPLACE FUNCTION` never executes the body, so this stayed
-- latent since 00032 — it only fires when an UPDATE actually changes one
-- of the tracked columns. That means BOTH the host "edit event" flow
-- (changing title / start_at / end_at / location / status) and any
-- maintenance UPDATE on those columns (e.g. the seed-time refresh in
-- 00045) hit it.
--
-- Fix: use `array_append(...)`, which is unambiguously
-- `anyarray + anyelement`, so the literal is treated as a text element
-- instead of an array. Function body is otherwise identical to 00032;
-- the existing `events_update_notify` trigger keeps pointing at it (a
-- CREATE OR REPLACE swaps the body in place).
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.notify_event_updated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_changed_fields TEXT[] := '{}';
  v_payload JSONB;
BEGIN
  -- Skip scraped events (machine re-imports, not host-initiated edits).
  IF COALESCE(NEW.source, 'user') = 'scraped' THEN
    RETURN NEW;
  END IF;

  -- Compare each tracked column. `IS DISTINCT FROM` correctly handles NULLs.
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    v_changed_fields := array_append(v_changed_fields, 'title');
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    v_changed_fields := array_append(v_changed_fields, 'description');
  END IF;
  IF NEW.start_at IS DISTINCT FROM OLD.start_at THEN
    v_changed_fields := array_append(v_changed_fields, 'start_at');
  END IF;
  IF NEW.end_at IS DISTINCT FROM OLD.end_at THEN
    v_changed_fields := array_append(v_changed_fields, 'end_at');
  END IF;
  IF NEW.location_name IS DISTINCT FROM OLD.location_name
     OR NEW.geog IS DISTINCT FROM OLD.geog THEN
    v_changed_fields := array_append(v_changed_fields, 'location');
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_changed_fields := array_append(v_changed_fields, 'status');
  END IF;

  -- No meaningful change → no notification.
  IF array_length(v_changed_fields, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'event_id', NEW.id,
    'deep_link', '/event/' || NEW.id::text,
    'changed_fields', to_jsonb(v_changed_fields),
    'status', NEW.status
  );

  -- One in-app row per confirmed subscriber (not waitlisted, not the host).
  INSERT INTO notifications (user_id, type, payload_json)
  SELECT s.user_id, 'event.updated', v_payload
    FROM event_subscriptions s
   WHERE s.event_id = NEW.id
     AND s.status   = 'confirmed'
     AND s.user_id  <> COALESCE(NEW.creator_id, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN NEW;
END;
$$;
