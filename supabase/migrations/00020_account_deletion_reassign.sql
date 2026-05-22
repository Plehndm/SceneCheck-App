-- Account deletion: reassign content to a placeholder, then delete the row.
--
-- Old behavior (delete-account Edge Function) anonymized the profile in place
-- and tombstoned the login. New behavior: the user's events + reviews are
-- re-pointed to a shared "[deleted user]" placeholder profile, then the user's
-- real profiles row is deleted (cascading their personal relations), and the
-- Edge Function deletes the auth user outright — freeing the email and leaving
-- no identifying row behind, while their contributed content survives.
--
-- This migration provides the two pieces the Edge Function needs:
--   • the placeholder profile (a fixed UUID), and
--   • a SECURITY DEFINER function that does the conflict-aware reassignment +
--     delete in one transaction (PostgREST can't express ON CONFLICT on UPDATE).

create extension if not exists pgcrypto;  -- crypt() / gen_salt() for the hash

-- ── 1. The "[deleted user]" placeholder ─────────────────────────────────────
-- profiles.user_id → auth.users(id), so the placeholder needs an auth row too.
-- Fixed UUID so the Edge Function + RPC can reference it deterministically.
-- (auth.users direct insert is version-sensitive; this column set matches
-- supabase/seed-hosted-social.sql, which is known to work on current Supabase.)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000ff',
  'authenticated', 'authenticated', 'deleted-user@scenecheck.invalid',
  crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{"display_name":"[deleted user]"}',
  false, '', '', '', ''
) on conflict (id) do nothing;

-- The handle_new_user trigger (00019) creates the skeleton profile from the
-- insert above. Upsert to force the placeholder's final shape — and to be
-- self-sufficient if the trigger is disabled on this project.
insert into public.profiles (user_id, name, username, email, visibility, account_type)
values (
  '00000000-0000-0000-0000-0000000000ff', '[deleted user]', null,
  'deleted-user@scenecheck.invalid', 'private', 'person'
) on conflict (user_id) do update set
  name = '[deleted user]', username = null,
  visibility = 'private', account_type = 'person';

-- ── 2. Reassign-then-delete function ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reassign_then_delete_account(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ph uuid := '00000000-0000-0000-0000-0000000000ff';
BEGIN
  -- events.creator_id is ON DELETE SET NULL; re-point to the placeholder so
  -- the event keeps a (non-identifying) host instead of going orphaned.
  UPDATE public.events SET creator_id = v_ph WHERE creator_id = p_user;

  -- ratings PK is (event_id, user_id). Drop any rating that would collide with
  -- one the placeholder already holds for that event, then re-point the rest.
  DELETE FROM public.ratings r
   WHERE r.user_id = p_user
     AND EXISTS (SELECT 1 FROM public.ratings p
                  WHERE p.event_id = r.event_id AND p.user_id = v_ph);
  UPDATE public.ratings SET user_id = v_ph WHERE user_id = p_user;

  -- Delete the real profile. CASCADE clears user_interests / friendships /
  -- chat_members / messages / event_subscriptions / waitlist / blocks for this
  -- user. events + ratings now belong to the placeholder, so they survive.
  DELETE FROM public.profiles WHERE user_id = p_user;
END;
$$;

-- SECURITY DEFINER + a user-id parameter would let any caller delete anyone, so
-- lock execution down to the service role (the Edge Function's credential).
REVOKE EXECUTE ON FUNCTION public.reassign_then_delete_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reassign_then_delete_account(uuid) TO service_role;
