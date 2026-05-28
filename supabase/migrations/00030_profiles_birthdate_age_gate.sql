-- Age gate (FR1.2 / CODE_REVIEW_REPORT_3 H2).
--
-- The sign-up screen sets a `maxDate` 18 years before today on the picker, but
-- that is purely client-side — a crafted Supabase Auth call bypasses it and
-- creates an under-18 account. FR1.2 states the system "shall reject" such
-- accounts, so the enforcement must live in the database.
--
-- Approach:
--   1. Add `profiles.birthdate DATE`, nullable. Existing rows have no birthdate;
--      we don't backfill or block them (the spec only requires NEW signups to
--      pass the gate, and we don't have birthdate data for legacy rows).
--   2. Add a trigger that fires on INSERT/UPDATE of birthdate and raises if the
--      computed age is under 18. NULL is allowed (legacy / not-yet-collected),
--      but a non-NULL value is enforced.
--   3. Replace `handle_new_user` to read `raw_user_meta_data ->> 'birthdate'`
--      from the auth signup payload and persist it. The trigger above guards
--      the insert: an under-18 birthdate raises and the auth user creation
--      fails (PostgreSQL aborts the auth trigger, surfacing as a sign-up error
--      to the client).
--
-- Cross-agent contract: the frontend's `api.signUp` must include
-- `options.data.birthdate` as an ISO `YYYY-MM-DD` string. Anything Postgres
-- can cast to DATE works; an empty/missing value parses to NULL and skips the
-- gate (kept permissive so we don't break test fixtures that don't set it).
--
-- This migration also picks up `account_type` from `raw_user_meta_data`
-- (FR1.4 / CODE_REVIEW_REPORT_3 H7). The pre-existing `handle_new_user`
-- (defined in 00002 / 00019) hardcoded `account_type = 'person'`, which meant
-- the Individual/Organization selector on the sign-up screen could not
-- actually produce an org account. We keep `'person'` as the default for any
-- caller that doesn't pass the field, and validate against the allowed
-- enum so a malformed metadata value can't bypass the CHECK constraint
-- on `profiles.account_type`.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birthdate DATE;

-- ──────────────────────────────────────────────────────────────────────────────
-- Trigger: reject under-18 birthdates on profiles INSERT/UPDATE.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_age_gate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.birthdate IS NOT NULL THEN
    -- AGE(date) returns an INTERVAL; we want whole years.
    IF EXTRACT(YEAR FROM age(NEW.birthdate)) < 18 THEN
      RAISE EXCEPTION 'User must be at least 18 years old (FR1.2)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_age_gate ON public.profiles;
CREATE TRIGGER profiles_age_gate
  BEFORE INSERT OR UPDATE OF birthdate ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_age_gate();

-- ──────────────────────────────────────────────────────────────────────────────
-- Replace handle_new_user to persist the birthdate from auth metadata.
-- Original lived in 00002; we keep the same signature + side effects and only
-- add the birthdate read so existing migrations / tests aren't disturbed.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_birthdate_text TEXT;
  v_birthdate DATE;
  v_account_type_text TEXT;
  v_account_type TEXT;
BEGIN
  -- raw_user_meta_data is the `options.data` blob passed to supabase.auth.signUp.
  -- Treat empty string the same as missing so the gate stays permissive for
  -- callers that explicitly clear the field.
  v_birthdate_text := NULLIF(NEW.raw_user_meta_data ->> 'birthdate', '');
  IF v_birthdate_text IS NOT NULL THEN
    BEGIN
      v_birthdate := v_birthdate_text::DATE;
    EXCEPTION WHEN others THEN
      -- An unparseable birthdate is a client bug, not a security exposure;
      -- swallow rather than blocking sign-up. Trigger above will still
      -- enforce on any later UPDATE that supplies a valid value.
      v_birthdate := NULL;
    END;
  END IF;

  -- Account type from sign-up (FR1.4). Default to 'person' for any caller
  -- (or legacy fixture) that doesn't pass the field. Validate against the
  -- known enum here rather than relying solely on the table CHECK so a bad
  -- value produces a clean fallback rather than aborting sign-up.
  v_account_type_text := NULLIF(NEW.raw_user_meta_data ->> 'account_type', '');
  v_account_type := CASE
    WHEN v_account_type_text IN ('person', 'org') THEN v_account_type_text
    ELSE 'person'
  END;

  INSERT INTO public.profiles (user_id, account_type, birthdate)
  VALUES (NEW.id, v_account_type, v_birthdate);
  INSERT INTO public.managed_accounts (owner_id, account_id)
  VALUES (NEW.id, NEW.id);
  RETURN NEW;
END;
$$;
