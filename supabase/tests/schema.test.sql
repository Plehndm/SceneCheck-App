-- pgTAP tests for database schema validation
-- Run with: supabase test db

BEGIN;
SELECT plan(20);

-- ═══ Table existence ═══
SELECT has_table('profiles');
SELECT has_table('managed_accounts');
SELECT has_table('interests');
SELECT has_table('user_interests');
SELECT has_table('events');
SELECT has_table('event_interests');
SELECT has_table('friendships');
SELECT has_table('blocks');
SELECT has_table('chats');
SELECT has_table('chat_members');
SELECT has_table('messages');
SELECT has_table('event_subscriptions');
SELECT has_table('waitlist');
SELECT has_table('ratings');
SELECT has_table('notifications');
SELECT has_table('reports');
SELECT has_table('user_preferences');

-- ═══ PostGIS column ═══
SELECT has_column('events', 'geog');

-- ═══ Critical indexes ═══
SELECT has_index('events', 'idx_events_geog');
SELECT has_index('events', 'idx_events_start');

SELECT * FROM finish();
ROLLBACK;
