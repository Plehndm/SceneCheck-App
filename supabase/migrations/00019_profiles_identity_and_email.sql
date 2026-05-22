-- Sign-up identity + stored email.
--
-- Two gaps this fixes:
--   1. handle_new_user (00002) inserted only (user_id, account_type), leaving
--      profiles.name = '' and username = NULL. A separate client-side write in
--      api.signUp tried to set the name but could race the hydrate, so users
--      showed up with their email prefix and never got a username at all.
--   2. The email lived only in auth.users — there was no public column for it,
--      so nothing that reads `profiles` could see it.
--
-- Now the trigger stamps name (from the display_name metadata api.signUp
-- already sets), a UNIQUE username derived from the email local-part with a
-- numeric fallback on collision, and the email itself.

-- ── 1. Add the email column (nullable; NOT unique) ──────────────────────────
-- auth.users.email already enforces uniqueness. This is a denormalized copy;
-- keeping it non-unique avoids collisions with the deletion placeholder /
-- tombstoned addresses in 00020.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- ── 2. Populate name / username / email on sign-up ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    split_part(NEW.email, '@', 1)
  );
  v_base text := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  v_user text;
  v_n    int := 0;
BEGIN
  IF v_base = '' THEN v_base := 'user'; END IF;
  v_user := v_base;
  -- Append a numeric suffix until the username is free (username is UNIQUE).
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_user) LOOP
    v_n := v_n + 1;
    v_user := v_base || v_n::text;
  END LOOP;

  INSERT INTO public.profiles (user_id, name, username, email, account_type)
  VALUES (NEW.id, v_name, v_user, NEW.email, 'person');

  INSERT INTO public.managed_accounts (owner_id, account_id)
  VALUES (NEW.id, NEW.id);
  RETURN NEW;
END;
$$;

-- ── 3. Backfill existing rows ───────────────────────────────────────────────
-- Email for every profile missing it.
UPDATE public.profiles p
   SET email = u.email
  FROM auth.users u
 WHERE u.id = p.user_id AND p.email IS NULL;

-- Name where blank: prefer the display_name metadata, else the email prefix.
UPDATE public.profiles p
   SET name = COALESCE(
        NULLIF(trim(u.raw_user_meta_data->>'display_name'), ''),
        split_part(u.email, '@', 1)
      )
  FROM auth.users u
 WHERE u.id = p.user_id AND COALESCE(trim(p.name), '') = '';

-- Username where missing: same slug logic, made unique with a row-number
-- suffix scoped to the slug. (Existing seeded usernames are left untouched.)
WITH need AS (
  SELECT p.user_id,
         lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_]', '', 'g')) AS base,
         row_number() OVER (
           PARTITION BY lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_]', '', 'g'))
           ORDER BY p.created_at
         ) AS rn
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
   WHERE p.username IS NULL
)
UPDATE public.profiles p
   SET username = CASE WHEN n.rn = 1 THEN NULLIF(n.base, '')
                       ELSE NULLIF(n.base, '') || n.rn::text END
  FROM need n
 WHERE p.user_id = n.user_id
   AND NULLIF(n.base, '') IS NOT NULL
   -- don't collide with an already-taken username
   AND NOT EXISTS (
     SELECT 1 FROM public.profiles x
      WHERE x.username = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || n.rn::text END
   );
