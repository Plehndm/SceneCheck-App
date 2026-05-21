-- Allow a signed-in user to INSERT their own profiles row.
--
-- migration 00002 creates profiles rows via the SECURITY DEFINER
-- `handle_new_user` trigger, which bypasses RLS — so there was never a
-- client-facing INSERT policy on `profiles`. The consequence: an account
-- created BEFORE that trigger existed (or added straight from the
-- dashboard's "Add user") has an `auth.users` row but no matching
-- `profiles` row, and the client cannot create one (RLS denies INSERT
-- when no policy matches). That's why such accounts "don't show up in the
-- profiles table" and why a profile edit (an UPDATE) silently matched
-- zero rows.
--
-- This policy lets the app self-heal the gap: AuthBootstrap upserts a
-- skeleton row on sign-in, and api.updateProfile upserts on save — both
-- keyed on `user_id = auth.uid()`, so a user can only ever write their
-- own row. SELECT/UPDATE policies are unchanged (00011 / 00014).
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());
