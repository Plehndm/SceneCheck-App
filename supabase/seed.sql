-- Seed data for SceneCheck — mirrors src/data.jsx mock objects.
-- Uses fixed UUIDs for reproducibility and test assertions.

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
  ('10000000-0000-0000-0000-000000000015', 'yoga', 'Yoga classes and sessions.', 75, ARRAY['meditation','fitness','mindfulness']);

-- ═══ EVENTS (with PostGIS points near UCI, Irvine CA) ═══
-- Coordinates approximate to UCI campus area (~33.6461, -117.8427).
-- start_at / end_at are now()-relative so the events are always upcoming —
-- `rank_events_query` only returns events with `start_at > now() - 2h`, so
-- hardcoded past dates would make discovery (Map + Home feed) return empty.
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
   now() + interval '9 days', now() + interval '9 days 1 hour', 30, 11, 'published', 'user', 3);

-- ═══ EVENT_INTERESTS ═══
INSERT INTO event_interests (event_id, interest_id) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'), -- Morning Ride + biking
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007'), -- Morning Ride + uci
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'), -- Dumpling Night + cooking
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007'), -- Dumpling Night + uci
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004'), -- Climbing + climbing
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000010'), -- Soccer + running
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000007'), -- Soccer + uci
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000011'), -- Open Mic + music
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000005'), -- Study Block + study
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000008'), -- Study Block + informatics
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000004'), -- Bouldering + climbing
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000010'), -- Group Run + running
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000007'), -- Group Run + uci
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000015'), -- Yoga + yoga
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000007'); -- Yoga + uci
