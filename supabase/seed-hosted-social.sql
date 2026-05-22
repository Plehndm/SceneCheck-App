-- ============================================================================
-- SceneCheck — social seed for the HOSTED project (people, orgs, ratings,
-- chats). Run AFTER `supabase/seed-hosted.sql` (which seeds interests +
-- the 9 events). Idempotent: every INSERT is ON CONFLICT-guarded.
--
-- HOW TO RUN
--   Hosted dashboard → SQL Editor → New query → paste this whole file → Run.
--
-- WHAT IT CREATES
--   • 6 auth.users + profiles: 4 people + 2 orgs, each with a known login
--     password so you can sign in AS them to verify social features.
--   • Their interest subscriptions.
--   • Reassigns several of the seeded events to these hosts (so "events
--     hosted" lists populate) — some events are left rating-less on purpose
--     so you can see the "No ratings yet" state.
--   • Ratings on a few of those events (dynamic averages on the profile).
--   • Friendships + a DM + a group chat AMONG the mock users.
--
-- WHY "sign in as a mock user" to verify chats/friends
--   Row-Level Security scopes chats + friendships to `auth.uid()`. Seeded
--   social rows between mock users are only visible to a session that IS
--   one of those users. So to see Maya's friends + chats, sign in as
--   maya@scenecheck.dev / scenecheck123. Your own freshly-created account
--   won't see this seeded social graph (that's RLS doing its job) — to wire
--   data to YOUR account, use the OPTIONAL block at the very bottom.
--
-- ⚠️ auth.users direct-insert caveat
--   Inserting into auth.users by hand is version-sensitive (GoTrue adds
--   columns over time). The column set below works on current Supabase.
--   If an INSERT errors on a missing/extra column, add/remove it to match
--   your project's auth.users schema (Table Editor → schema `auth` → users).
-- ============================================================================

-- pgcrypto provides crypt() / gen_salt() for the bcrypt password hash.
create extension if not exists pgcrypto;

-- ── 1. auth.users (4 people + 2 orgs) ───────────────────────────────────────
-- Fixed UUIDs match the app's ID_MAP (lib/api.ts), so toMockId() resolves
-- them back to p1..p4 / orgA / orgB and profile routes round-trip cleanly.
-- All share the password: scenecheck123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'maya@scenecheck.dev',
   crypt('scenecheck123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Maya Chen"}',
   false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'jordan@scenecheck.dev',
   crypt('scenecheck123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Jordan Park"}',
   false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'sasha@scenecheck.dev',
   crypt('scenecheck123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Sasha Williams"}',
   false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005',
   'authenticated', 'authenticated', 'theo@scenecheck.dev',
   crypt('scenecheck123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Theo Nakamura"}',
   false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000021',
   'authenticated', 'authenticated', 'topout@scenecheck.dev',
   crypt('scenecheck123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"TopOut Climbing"}',
   false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000022',
   'authenticated', 'authenticated', 'ucicooks@scenecheck.dev',
   crypt('scenecheck123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"UCI Cooking Club"}',
   false, '', '', '', '')
on conflict (id) do nothing;

-- The `handle_new_user` trigger (migration 00002) inserts a skeleton
-- profiles row (+ managed_accounts) for each auth.users row above. If the
-- trigger is disabled on your project, uncomment the fallback inserts:
-- insert into public.profiles (user_id, account_type) values
--   ('00000000-0000-0000-0000-000000000002','person'),
--   ('00000000-0000-0000-0000-000000000003','person'),
--   ('00000000-0000-0000-0000-000000000004','person'),
--   ('00000000-0000-0000-0000-000000000005','person'),
--   ('00000000-0000-0000-0000-000000000021','org'),
--   ('00000000-0000-0000-0000-000000000022','org')
-- on conflict (user_id) do nothing;

-- ── 2. Flesh out the profiles ────────────────────────────────────────────────
update public.profiles set
  name = 'Maya Chen', username = 'mayac', account_type = 'person', visibility = 'public',
  bio = 'Industrial design senior. I bring extra helmets to morning rides.'
  where user_id = '00000000-0000-0000-0000-000000000002';
update public.profiles set
  name = 'Jordan Park', username = 'jp_park', account_type = 'person', visibility = 'private',
  bio = 'Climbing route-setter at TopOut. Trying to learn Rust on the side.'
  where user_id = '00000000-0000-0000-0000-000000000003';
update public.profiles set
  name = 'Sasha Williams', username = 'sashaw', account_type = 'person', visibility = 'public',
  bio = 'Cooking club president. I will feed you. I will also crush you at Catan.'
  where user_id = '00000000-0000-0000-0000-000000000004';
update public.profiles set
  name = 'Theo Nakamura', username = 'theonk', account_type = 'person', visibility = 'private',
  bio = 'Long runs, longer playlists. CS grad. Currently obsessed with golf.'
  where user_id = '00000000-0000-0000-0000-000000000005';
update public.profiles set
  name = 'TopOut Climbing', username = 'topoutirvine', account_type = 'org', visibility = 'public',
  bio = 'Bouldering + ropes in Irvine. Beginner nights every Friday.'
  where user_id = '00000000-0000-0000-0000-000000000021';
update public.profiles set
  name = 'UCI Cooking Club', username = 'ucicooks', account_type = 'org', visibility = 'public',
  bio = 'We cook, we eat, we wash dishes together. Mesa Court Kitchen, weekly.'
  where user_id = '00000000-0000-0000-0000-000000000022';

-- ── 3. Interest subscriptions ────────────────────────────────────────────────
insert into public.user_interests (user_id, interest_id) values
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'), -- Maya: biking
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006'), -- Maya: coffee
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004'), -- Jordan: climbing
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002'), -- Sasha: cooking
  ('00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000010'), -- Theo: running
  ('00000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000004'), -- TopOut: climbing
  ('00000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000002')  -- UCICooks: cooking
on conflict (user_id, interest_id) do nothing;

-- ── 4. Assign event hosts ────────────────────────────────────────────────────
-- The base seed left creator_id = NULL on every event. Point a few at the
-- mock hosts so their "events hosted" lists populate. e7/e8/e9 are
-- deliberately left WITHOUT ratings below so the per-event + summary
-- "No ratings yet" states are demonstrable.
update public.events set creator_id = '00000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000001'; -- Morning Ride → Maya
update public.events set creator_id = '00000000-0000-0000-0000-000000000022' where id = '20000000-0000-0000-0000-000000000002'; -- Dumpling Night → UCI Cooking Club
update public.events set creator_id = '00000000-0000-0000-0000-000000000021' where id = '20000000-0000-0000-0000-000000000003'; -- Climbing Beginner Night → TopOut
update public.events set creator_id = '00000000-0000-0000-0000-000000000021' where id = '20000000-0000-0000-0000-000000000007'; -- Bouldering Night → TopOut
update public.events set creator_id = '00000000-0000-0000-0000-000000000004' where id = '20000000-0000-0000-0000-000000000008'; -- Group Run → Sasha
update public.events set creator_id = '00000000-0000-0000-0000-000000000005' where id = '20000000-0000-0000-0000-000000000009'; -- Sunrise Yoga → Theo

-- ── 5. Ratings ────────────────────────────────────────────────────────────────
-- ratings PK is (event_id, user_id). These drive the dynamic averages.
-- Morning Ride (Maya) gets 3 reviews; Climbing (TopOut) 2; Dumpling (UCICooks) 1.
insert into public.ratings (event_id, user_id, stars, text, created_at) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 5, 'Chill pace, great regroup at the bridge. Easiest 14 miles I''ve done.', now() - interval '6 days'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 5, 'Coffee stop made it. Would join again.', now() - interval '6 days'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 4, 'Solid ride, slightly chilly start.', now() - interval '5 days'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 5, 'Jordan is a patient teacher. First-timer friendly.', now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 4, 'Fun intro, gym was a bit crowded.', now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 5, 'Folded 40 dumplings, ate 41. Worth the $5.', now() - interval '2 days')
on conflict (event_id, user_id) do nothing;

-- ── 6. Friendships among the mock users ──────────────────────────────────────
-- Sign in as one of these to see a populated friends list. friendships PK is
-- the row id; UNIQUE (from_id, to_id) prevents dupes.
insert into public.friendships (id, from_id, to_id, status, created_at) values
  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'accepted', now() - interval '20 days'),
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'accepted', now() - interval '15 days'),
  ('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'pending',  now() - interval '2 days')
on conflict (id) do nothing;

-- ── 7. A DM + a group chat among the mock users ──────────────────────────────
-- chats / chat_members / messages. Sign in as Maya (or a listed member) to
-- see these. Fixed UUIDs keep the seed idempotent.
insert into public.chats (id, type, event_id, title, created_at) values
  ('c0000000-0000-0000-0000-000000000001', 'dm', null, '', now() - interval '4 days'),
  ('c0000000-0000-0000-0000-000000000002', 'group', '20000000-0000-0000-0000-000000000001', 'Morning Ride crew', now() - interval '5 days')
on conflict (id) do nothing;

insert into public.chat_members (chat_id, user_id) values
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005')
on conflict (chat_id, user_id) do nothing;

insert into public.messages (id, chat_id, sender_id, body, created_at) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'hey! you doing the back bay loop saturday?', now() - interval '4 days'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'yeah, 7am at Anteater Plaza. bring water', now() - interval '4 days' + interval '5 minutes'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'reminder: coffee at Common Room after the ride ☕', now() - interval '1 day')
on conflict (id) do nothing;

-- ── 8. Additional people + orgs (live de-mock parity with data/mocks.ts) ─────
-- The app no longer reads hardcoded SC_* fixtures for display in live mode, so
-- every person/org the UI can surface must exist as a real profile. The block
-- above seeded p1–p4 + orgA/orgB; this adds the remaining fixtures (p5 Priya,
-- p6 Marco, orgC Common Room Coffee, orgD Anteater Run Club). Fixed UUIDs match
-- ID_MAP (lib/api.ts) so profile routes round-trip. Password: scenecheck123.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000006',
   'authenticated', 'authenticated', 'priya@scenecheck.dev',
   crypt('scenecheck123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Priya Iyer"}',
   false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000007',
   'authenticated', 'authenticated', 'marco@scenecheck.dev',
   crypt('scenecheck123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Marco Rossi"}',
   false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000023',
   'authenticated', 'authenticated', 'commonroom@scenecheck.dev',
   crypt('scenecheck123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Common Room Coffee"}',
   false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000024',
   'authenticated', 'authenticated', 'anteaterrun@scenecheck.dev',
   crypt('scenecheck123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Anteater Run Club"}',
   false, '', '', '', '')
on conflict (id) do nothing;

update public.profiles set
  name = 'Priya Iyer', username = 'priya.i', account_type = 'person', visibility = 'public',
  bio = 'Carnatic violinist + study group regular. Trade me for snacks.'
  where user_id = '00000000-0000-0000-0000-000000000006';
update public.profiles set
  name = 'Marco Rossi', username = 'rossi_m', account_type = 'person', visibility = 'public',
  bio = 'New to Irvine. Looking for a Saturday riding group with chill vibes.'
  where user_id = '00000000-0000-0000-0000-000000000007';
update public.profiles set
  name = 'Common Room Coffee', username = 'commonroom', account_type = 'org', visibility = 'public',
  bio = 'Cafe + open-mic venue. Acoustic Thursdays, latte art Saturdays.'
  where user_id = '00000000-0000-0000-0000-000000000023';
update public.profiles set
  name = 'Anteater Run Club', username = 'anteaterrun', account_type = 'org', visibility = 'public',
  bio = 'Group runs from the Aldrich flagpole, Tuesday 6pm. Couch-to-5K cohort each quarter.'
  where user_id = '00000000-0000-0000-0000-000000000024';

-- ── OPTIONAL: wire this graph to YOUR own account ────────────────────────────
-- The seeded chats/friends are only visible to the mock users (RLS). To see
-- them from the account YOU signed up with, replace YOUR_EMAIL below and run
-- just this block. It befriends Maya + adds you to the Morning Ride crew chat.
--
-- friendships.from_id and chat_members.user_id are FKs to profiles(user_id),
-- so your account needs a profiles row FIRST. The handle_new_user trigger
-- (migration 00002) creates it at sign-up, but accounts made before that
-- migration — or added straight from the dashboard's "Add user" — can be
-- missing it. That gap is exactly the
--   "friendships_from_id_fkey ... is not present in table profiles"
-- error. The first statement below makes this block self-sufficient by
-- ensuring the profiles row exists before the friendship/chat inserts.
--
-- with me as (select id from auth.users where email = 'YOUR_EMAIL')
-- insert into public.profiles (user_id, account_type)
--   select id, 'person' from me on conflict (user_id) do nothing;
-- with me as (select id from auth.users where email = 'YOUR_EMAIL')
-- insert into public.friendships (from_id, to_id, status)
--   select id, '00000000-0000-0000-0000-000000000002', 'accepted' from me
--   on conflict (from_id, to_id) do nothing;
-- with me as (select id from auth.users where email = 'YOUR_EMAIL')
-- insert into public.chat_members (chat_id, user_id)
--   select 'c0000000-0000-0000-0000-000000000002', id from me
--   on conflict (chat_id, user_id) do nothing;
