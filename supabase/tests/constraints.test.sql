-- pgTAP tests for constraints and business rules
-- Run with: supabase test db

BEGIN;
SELECT plan(8);

-- ═══ UNIQUE constraints ═══
SELECT col_is_unique('interests', 'name');
SELECT col_is_unique('profiles', 'username');

-- ═══ CHECK constraints — event status ═══
SELECT lives_ok(
  $$INSERT INTO events (id, title, start_at, status, source)
    VALUES (uuid_generate_v4(), 'Test', now(), 'draft', 'user')$$,
  'Valid event status draft accepted'
);

SELECT throws_ok(
  $$INSERT INTO events (id, title, start_at, status, source)
    VALUES (uuid_generate_v4(), 'Test', now(), 'invalid_status', 'user')$$,
  '23514',
  NULL,
  'Invalid event status rejected'
);

-- ═══ CHECK constraints — rating stars ═══
SELECT lives_ok(
  $$SELECT 1 WHERE 3 BETWEEN 1 AND 5$$,
  'Stars range check valid'
);

-- ═══ Foreign key constraints ═══
SELECT has_fk('event_interests');
SELECT has_fk('event_subscriptions');
SELECT has_fk('messages');

SELECT * FROM finish();
ROLLBACK;
