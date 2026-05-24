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
--
-- ⚠️ Event dates are RELATIVE to now() (e.g. now() + interval '2 days').
--   `rank_events_query` — the discovery RPC behind the Map + Home feed —
--   only returns events with `start_at > now() - 2h`, so hardcoded past
--   dates would make every event invisible. Because the dates are
--   relative, the events INSERT uses ON CONFLICT (id) DO UPDATE (not DO
--   NOTHING) for the time columns + status, so RE-RUNNING this seed
--   refreshes already-inserted events to be upcoming again. creator_id
--   is intentionally NOT overwritten so seed-hosted-social.sql's host
--   reassignments survive a re-run.

-- ═══ INTERESTS ═══
INSERT INTO interests (id, name, description, subscriber_count, similar_tags) VALUES
  ('10000000-0000-0000-0000-000000000001', 'biking', 'Biking is the human-powered, pedal-driven act of riding a bicycle.', 174, ARRAY['cycling','running','spin']),
  ('10000000-0000-0000-0000-000000000002', 'cooking', 'Cooking is the art and science of preparing food using heat.', 32, ARRAY['baking','dinner-club','knife-skills']),
  ('10000000-0000-0000-0000-000000000003', 'golf', 'Golf is a club-and-ball sport played on a course.', 2, ARRAY['driving-range','minigolf','disc-golf']),
  ('10000000-0000-0000-0000-000000000004', 'climbing', 'Climbing is the activity of ascending walls or boulders.', 88, ARRAY['bouldering','hiking','yoga']),
  ('10000000-0000-0000-0000-000000000005', 'study', 'Study sessions are timed, focused work blocks.', 412, ARRAY['library','flashcards','note-taking']),
  ('10000000-0000-0000-0000-000000000006', 'coffee', 'Coffee meetups are short, low-stakes gatherings at a cafe.', 256, ARRAY['tea','breakfast','study']),
  ('10000000-0000-0000-0000-000000000007', 'uci', 'University of California, Irvine.', 18403, ARRAY['anteaters','uci-clubs']),
  ('10000000-0000-0000-0000-000000000008', 'informatics', 'The study of how people interact with information and technology.', 612, ARRAY['hci','ux','cs']),
  ('10000000-0000-0000-0000-000000000009', 'group10', 'Private tag for IN4MATX 43 Group 10.', 5, ARRAY['in4matx-43','team','project']),
  ('10000000-0000-0000-0000-000000000010', 'running', 'Running covers everything from couch-to-5K to ultras.', 198, ARRAY['jogging','5k','trail-running']),
  ('10000000-0000-0000-0000-000000000011', 'music', 'Music events and performances.', 100, ARRAY['acoustic','open-mic']),
  ('10000000-0000-0000-0000-000000000012', 'board-games', 'Board game meetups and tournaments.', 45, ARRAY['catan','strategy','tabletop']),
  ('10000000-0000-0000-0000-000000000013', 'design', 'Design workshops and critiques.', 30, ARRAY['ux','industrial','graphic']),
  ('10000000-0000-0000-0000-000000000014', 'bouldering', 'Indoor bouldering at climbing gyms.', 55, ARRAY['climbing','yoga','fitness']),
  ('10000000-0000-0000-0000-000000000015', 'yoga', 'Yoga classes and sessions.', 75, ARRAY['meditation','fitness','mindfulness']),
  -- Common descriptive event tags — curated so scraped listings match a stable,
  -- readable interest instead of deriving a noisy one-off word.
  ('10000000-0000-0000-0000-000000000016', 'career', 'Career fairs, job hunts, and recruiting.', 0, ARRAY['careers','jobs','hiring','recruiting']),
  ('10000000-0000-0000-0000-000000000017', 'dating', 'Singles mixers, speed dating, and matchmaking.', 0, ARRAY['singles','speed-dating','matchmaking']),
  ('10000000-0000-0000-0000-000000000018', 'business', 'Business, startup, and entrepreneur meetups.', 0, ARRAY['startup','entrepreneur','networking']),
  ('10000000-0000-0000-0000-000000000019', 'dentist', 'Dentistry and dental-care events.', 0, ARRAY['dentistry','dental','orthodontist']),
  ('10000000-0000-0000-0000-000000000020', 'workshop', 'Hands-on workshops, classes, and seminars.', 0, ARRAY['workshops','seminar','class']),
  ('10000000-0000-0000-0000-000000000021', 'concert', 'Live music concerts and performances.', 0, ARRAY['concerts','gig','live-music']),
  ('10000000-0000-0000-0000-000000000022', 'conference', 'Conferences, summits, and expos.', 0, ARRAY['conferences','summit','expo','convention']),
  ('10000000-0000-0000-0000-000000000023', 'cafe', 'Cafes, coffee shops, and espresso bars.', 0, ARRAY['espresso']),
  ('10000000-0000-0000-0000-000000000024', 'choir', 'Choir, chorus, and a cappella singing.', 0, ARRAY['choirs','chorus','acappella']),
  ('10000000-0000-0000-0000-000000000025', 'church', 'Church services and faith gatherings.', 0, ARRAY['worship','faith','congregation']),
  ('10000000-0000-0000-0000-000000000026', 'fair', 'Fairs, festivals, and expos.', 0, ARRAY['fairs','festival']),
  ('10000000-0000-0000-0000-000000000027', 'solar', 'Solar energy and sustainability events.', 0, ARRAY['solarize','renewable']),
  ('10000000-0000-0000-0000-000000000028', 'free', 'Free community events.', 0, ARRAY[]::text[]),
  ('10000000-0000-0000-0000-000000000029', 'digital', 'Digital and tech events.', 0, ARRAY['tech','technology']),
  ('10000000-0000-0000-0000-000000000030', 'virtual', 'Virtual and online events.', 0, ARRAY['online','remote']),
  ('10000000-0000-0000-0000-000000000031', 'networking', 'Professional networking and mixers.', 0, ARRAY['mixer']),
  ('10000000-0000-0000-0000-000000000032', 'wine', 'Wine tastings and vineyards.', 0, ARRAY['wines','vino','vineyard']),
  ('10000000-0000-0000-0000-000000000033', 'games', 'Games, gaming, and tournaments.', 0, ARRAY['gaming','tournament']),
  ('10000000-0000-0000-0000-000000000034', 'india', 'India, Indian culture, and community.', 0, ARRAY['indian','bollywood','desi']),
  ('10000000-0000-0000-0000-000000000035', 'irvine', 'Events in and around Irvine.', 0, ARRAY[]::text[]),
  ('10000000-0000-0000-0000-000000000036', 'executives', 'Executive and leadership events.', 0, ARRAY['executive','leadership']),
  ('10000000-0000-0000-0000-000000000037', 'health', 'Health, wellness, and fitness.', 0, ARRAY['wellness','healthcare']),
  ('10000000-0000-0000-0000-000000000038', 'medicine', 'Medicine and medical events.', 0, ARRAY['medical']),
  ('10000000-0000-0000-0000-000000000039', 'acupuncture', 'Acupuncture and traditional medicine.', 0, ARRAY['acupuncturist'])
ON CONFLICT (id) DO NOTHING;

-- ═══ EVENTS (with PostGIS points near UCI, Irvine CA) ═══
-- start_at / end_at are now()-relative so the events are always upcoming
-- (see the ⚠️ note in the header for why hardcoded dates broke discovery).
INSERT INTO events (id, creator_id, title, description, geog, location_name, start_at, end_at, capacity, subscriber_count, status, source, min_subscribers) VALUES
  ('20000000-0000-0000-0000-000000000001', NULL, 'Morning Ride — Back Bay loop',
   'Easy 14-mile loop around the Back Bay trail. Casual pace. Bring water. Coffee at Common Room after.',
   ST_MakePoint(-117.86, 33.64)::geography, 'Anteater Plaza → Back Bay',
   now() + interval '2 days', now() + interval '2 days 2 hours', 12, 6, 'published', 'user', 3),
  ('20000000-0000-0000-0000-000000000002', NULL, 'Cooking Club: Dumpling Night',
   'We fold, we steam, we eat. $5 to cover ingredients. All skill levels.',
   ST_MakePoint(-117.83, 33.65)::geography, 'Mesa Court Kitchen',
   now() + interval '3 days', now() + interval '3 days 2 hours 30 minutes', 16, 14, 'published', 'user', 3),
  ('20000000-0000-0000-0000-000000000003', NULL, 'Climbing — Beginner Night',
   'First-timers welcome. Jordan will show you the basics.',
   ST_MakePoint(-117.88, 33.63)::geography, 'TopOut Irvine',
   now() + interval '4 days', now() + interval '4 days 2 hours 30 minutes', 20, 9, 'published', 'user', 3),
  ('20000000-0000-0000-0000-000000000004', NULL, 'Pickup Soccer @ Aldrich',
   'Open pickup, 5v5 rotating. Cleats not required.',
   ST_MakePoint(-117.84, 33.645)::geography, 'Aldrich Park East Field',
   now() + interval '1 day', now() + interval '1 day 2 hours', 30, 22, 'published', 'scraped', 1),
  ('20000000-0000-0000-0000-000000000005', NULL, 'Open Mic — Common Room',
   'Acoustic, poetry, comedy — all welcome.',
   ST_MakePoint(-117.82, 33.645)::geography, 'Common Room Coffee',
   now() + interval '5 days', now() + interval '5 days 2 hours 30 minutes', 25, 11, 'published', 'scraped', 1),
  ('20000000-0000-0000-0000-000000000006', NULL, 'Study Block: Finals Week',
   'Quiet pomodoros, 50/10 cycles. Bring your own laptop and snacks.',
   ST_MakePoint(-117.84, 33.65)::geography, 'Langson Library, 4F',
   now() + interval '6 days', now() + interval '6 days 4 hours', 60, 38, 'published', 'scraped', 1),
  ('20000000-0000-0000-0000-000000000007', NULL, 'Beginner Bouldering Night',
   'Free top-rope intro. Day pass + rentals $18.',
   ST_MakePoint(-117.88, 33.635)::geography, 'TopOut Irvine',
   now() + interval '4 days 6 hours', now() + interval '4 days 8 hours 30 minutes', 40, 28, 'published', 'user', 3),
  ('20000000-0000-0000-0000-000000000008', NULL, 'Tuesday Group Run · 5K',
   'Couch-to-5K pace group + open pace group. Stretch + boba after.',
   ST_MakePoint(-117.845, 33.646)::geography, 'Aldrich Park flagpole',
   now() + interval '8 days', now() + interval '8 days 1 hour 30 minutes', 50, 17, 'published', 'user', 3),
  ('20000000-0000-0000-0000-000000000009', NULL, 'Saturday Sunrise Yoga',
   '60-minute all-levels flow on the lawn. Bring a mat.',
   ST_MakePoint(-117.845, 33.645)::geography, 'Aldrich Park lawn',
   now() + interval '9 days', now() + interval '9 days 1 hour', 30, 11, 'published', 'user', 3)
ON CONFLICT (id) DO UPDATE SET
  -- Refresh only the time window + publish state so a re-run un-stales
  -- the demo events. creator_id is deliberately omitted so the host
  -- reassignments in seed-hosted-social.sql aren't clobbered.
  start_at = EXCLUDED.start_at,
  end_at   = EXCLUDED.end_at,
  status   = EXCLUDED.status;

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
