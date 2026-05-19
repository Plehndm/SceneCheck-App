-- Idempotent variant of supabase/seed.sql for the HOSTED project.
-- Safe to re-run: every INSERT has an ON CONFLICT clause, so the
-- script does nothing if the rows already exist (no PK violation).
--
-- How to apply:
--   1. Open the hosted Supabase dashboard
--      (https://supabase.com/dashboard/project/kmlecodmifljbtzaqahm)
--   2. SQL Editor → New query → paste the whole file → Run
--   3. Confirm rows landed via Table Editor on `interests` and `events`
--
-- This populates:
--   - 15 interest rows in `public.interests`
--   - 9 events in `public.events` (PostGIS points near UCI;
--     status='published', creator_id=NULL so they appear to all
--     authenticated readers via RLS without belonging to any user)
--   - 15 event_interests join rows
--
-- It does NOT populate profiles, friendships, chats, ratings, or
-- subscriptions — those come from real user activity once you sign
-- up in the app.

-- ═══ INTERESTS ═══
INSERT INTO interests (id, name, description, subscriber_count, similar_tags) VALUES
  ('10000000-0000-0000-0000-000000000001', 'biking', 'Biking is the human-powered, pedal-driven act of riding a bicycle.', 174, ARRAY['cycling','running','spin']),
  ('10000000-0000-0000-0000-000000000002', 'cooking', 'Cooking is the art and science of preparing food using heat.', 32, ARRAY['baking','dinner-club','knife-skills']),
  ('10000000-0000-0000-0000-000000000003', 'golf', 'Golf is a club-and-ball sport played on a course.', 2, ARRAY['driving-range','minigolf','disc-golf']),
  ('10000000-0000-0000-0000-000000000004', 'climbing', 'Climbing is the activity of ascending walls or boulders.', 88, ARRAY['bouldering','hiking','yoga']),
  ('10000000-0000-0000-0000-000000000005', 'study', 'Study sessions are timed, focused work blocks.', 412, ARRAY['library','flashcards','note-taking']),
  ('10000000-0000-0000-0000-000000000006', 'coffee', 'Coffee meetups are short, low-stakes gatherings at a cafe.', 256, ARRAY['tea','breakfast','study']),
  ('10000000-0000-0000-0000-000000000007', 'uci', 'University of California, Irvine.', 18403, ARRAY['anteaters','uci-clubs','irvine']),
  ('10000000-0000-0000-0000-000000000008', 'informatics', 'The study of how people interact with information and technology.', 612, ARRAY['hci','ux','cs']),
  ('10000000-0000-0000-0000-000000000009', 'group10', 'Private tag for IN4MATX 43 Group 10.', 5, ARRAY['in4matx-43','team','project']),
  ('10000000-0000-0000-0000-000000000010', 'running', 'Running covers everything from couch-to-5K to ultras.', 198, ARRAY['jogging','5k','trail-running']),
  ('10000000-0000-0000-0000-000000000011', 'music', 'Music events and performances.', 100, ARRAY['acoustic','live','open-mic']),
  ('10000000-0000-0000-0000-000000000012', 'board-games', 'Board game meetups and tournaments.', 45, ARRAY['catan','strategy','tabletop']),
  ('10000000-0000-0000-0000-000000000013', 'design', 'Design workshops and critiques.', 30, ARRAY['ux','industrial','graphic']),
  ('10000000-0000-0000-0000-000000000014', 'bouldering', 'Indoor bouldering at climbing gyms.', 55, ARRAY['climbing','yoga','fitness']),
  ('10000000-0000-0000-0000-000000000015', 'yoga', 'Yoga classes and sessions.', 75, ARRAY['meditation','fitness','mindfulness'])
ON CONFLICT (id) DO NOTHING;

-- ═══ EVENTS (with PostGIS points near UCI, Irvine CA) ═══
INSERT INTO events (id, creator_id, title, description, geog, location_name, start_at, end_at, capacity, subscriber_count, status, source, min_subscribers) VALUES
  ('20000000-0000-0000-0000-000000000001', NULL, 'Morning Ride — Back Bay loop',
   'Easy 14-mile loop around the Back Bay trail. Casual pace. Bring water. Coffee at Common Room after.',
   ST_MakePoint(-117.86, 33.64)::geography, 'Anteater Plaza → Back Bay',
   '2026-05-09 14:00:00+00', '2026-05-09 16:00:00+00', 12, 6, 'published', 'user', 3),
  ('20000000-0000-0000-0000-000000000002', NULL, 'Cooking Club: Dumpling Night',
   'We fold, we steam, we eat. $5 to cover ingredients. All skill levels.',
   ST_MakePoint(-117.83, 33.65)::geography, 'Mesa Court Kitchen',
   '2026-05-09 01:30:00+00', '2026-05-10 04:00:00+00', 16, 14, 'published', 'user', 3),
  ('20000000-0000-0000-0000-000000000003', NULL, 'Climbing — Beginner Night',
   'First-timers welcome. Jordan will show you the basics.',
   ST_MakePoint(-117.88, 33.63)::geography, 'TopOut Irvine',
   '2026-05-09 02:00:00+00', '2026-05-09 04:30:00+00', 20, 9, 'published', 'user', 3),
  ('20000000-0000-0000-0000-000000000004', NULL, 'Pickup Soccer @ Aldrich',
   'Open pickup, 5v5 rotating. Cleats not required.',
   ST_MakePoint(-117.84, 33.645)::geography, 'Aldrich Park East Field',
   '2026-05-07 00:00:00+00', '2026-05-07 02:00:00+00', 30, 22, 'published', 'scraped', 1),
  ('20000000-0000-0000-0000-000000000005', NULL, 'Open Mic — Common Room',
   'Acoustic, poetry, comedy — all welcome.',
   ST_MakePoint(-117.82, 33.645)::geography, 'Common Room Coffee',
   '2026-05-08 03:00:00+00', '2026-05-08 05:30:00+00', 25, 11, 'published', 'scraped', 1),
  ('20000000-0000-0000-0000-000000000006', NULL, 'Study Block: Finals Week',
   'Quiet pomodoros, 50/10 cycles. Bring your own laptop and snacks.',
   ST_MakePoint(-117.84, 33.65)::geography, 'Langson Library, 4F',
   '2026-05-11 20:00:00+00', '2026-05-12 00:00:00+00', 60, 38, 'published', 'scraped', 1),
  ('20000000-0000-0000-0000-000000000007', NULL, 'Beginner Bouldering Night',
   'Free top-rope intro. Day pass + rentals $18.',
   ST_MakePoint(-117.88, 33.635)::geography, 'TopOut Irvine',
   '2026-05-09 02:30:00+00', '2026-05-09 05:00:00+00', 40, 28, 'published', 'user', 3),
  ('20000000-0000-0000-0000-000000000008', NULL, 'Tuesday Group Run · 5K',
   'Couch-to-5K pace group + open pace group. Stretch + boba after.',
   ST_MakePoint(-117.845, 33.646)::geography, 'Aldrich Park flagpole',
   '2026-05-13 01:00:00+00', '2026-05-13 02:30:00+00', 50, 17, 'published', 'user', 3),
  ('20000000-0000-0000-0000-000000000009', NULL, 'Saturday Sunrise Yoga',
   '60-minute all-levels flow on the lawn. Bring a mat.',
   ST_MakePoint(-117.845, 33.645)::geography, 'Aldrich Park lawn',
   '2026-05-09 15:00:00+00', '2026-05-09 16:00:00+00', 30, 11, 'published', 'user', 3)
ON CONFLICT (id) DO NOTHING;

-- ═══ EVENT_INTERESTS ═══
INSERT INTO event_interests (event_id, interest_id) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000010'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000007'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000011'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000005'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000008'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000010'),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000007'),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000015'),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000007')
ON CONFLICT (event_id, interest_id) DO NOTHING;
