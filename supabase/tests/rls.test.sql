-- pgTAP tests for Row-Level Security policies
-- Run with: supabase test db
-- These tests verify that RLS prevents unauthorized access.

BEGIN;
SELECT plan(5);

-- Verify RLS is enabled on critical tables.
-- The SELECT policy was renamed in migration 00014 — the old name leaked
-- private profiles to any non-blocker. See that migration for context.
SELECT policies_are('profiles', ARRAY[
  'Profile visibility respects privacy and blocks',
  'Users can update own profile'
]);

SELECT policies_are('messages', ARRAY[
  'Chat members can read messages',
  'Chat members can send messages',
  'Sender can update own messages',
  'Sender can delete own messages'
]);

-- Verify RLS is enabled
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles'),
  true,
  'RLS is enabled on profiles'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'messages'),
  true,
  'RLS is enabled on messages'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'notifications'),
  true,
  'RLS is enabled on notifications'
);

SELECT * FROM finish();
ROLLBACK;
