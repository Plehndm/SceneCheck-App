-- ══════════════════════════════════════════════════════════════
-- Refresh the demo events' start/end times to be upcoming again.
--
-- The 9 events seeded by `supabase/seed-hosted.sql` use now()-relative
-- start_at / end_at, but those are only recomputed when that seed is
-- RE-RUN (its ON CONFLICT DO UPDATE). On a project that was seeded a
-- while ago the times have drifted into the past, and the discovery RPC
-- (`rank_events_query`) filters `start_at > now() - 2h`, so every one of
-- them — including the events reassigned to the mock host accounts in
-- `seed-hosted-social.sql` (Maya's Morning Ride, the Cooking Club's
-- Dumpling Night, TopOut's climbing nights, Sasha's group run, Theo's
-- yoga) — silently dropped off the map.
--
-- This migration re-stamps each seeded event to the same upcoming offset
-- the seed uses, so applying it makes the friend / org-hosted events show
-- up again. Only the time window is touched: creator_id (host
-- reassignments) and status are left exactly as they are. WHERE-scoped to
-- the fixed seed UUIDs so it never touches a real user-created event, and
-- it no-ops harmlessly on a DB where those rows don't exist (e.g. fresh
-- local resets, CI) since the UPDATEs simply match zero rows.
-- ══════════════════════════════════════════════════════════════
UPDATE public.events SET start_at = now() + interval '2 days',           end_at = now() + interval '2 days 2 hours'            WHERE id = '20000000-0000-0000-0000-000000000001'; -- Morning Ride — Back Bay loop (Maya)
UPDATE public.events SET start_at = now() + interval '3 days',           end_at = now() + interval '3 days 2 hours 30 minutes' WHERE id = '20000000-0000-0000-0000-000000000002'; -- Cooking Club: Dumpling Night (UCI Cooking Club)
UPDATE public.events SET start_at = now() + interval '4 days',           end_at = now() + interval '4 days 2 hours 30 minutes' WHERE id = '20000000-0000-0000-0000-000000000003'; -- Climbing — Beginner Night (TopOut)
UPDATE public.events SET start_at = now() + interval '1 day',            end_at = now() + interval '1 day 2 hours'             WHERE id = '20000000-0000-0000-0000-000000000004'; -- Pickup Soccer @ Aldrich (scraped)
UPDATE public.events SET start_at = now() + interval '5 days',           end_at = now() + interval '5 days 2 hours 30 minutes' WHERE id = '20000000-0000-0000-0000-000000000005'; -- Open Mic — Common Room (scraped)
UPDATE public.events SET start_at = now() + interval '6 days',           end_at = now() + interval '6 days 4 hours'            WHERE id = '20000000-0000-0000-0000-000000000006'; -- Study Block: Finals Week (scraped)
UPDATE public.events SET start_at = now() + interval '4 days 6 hours',   end_at = now() + interval '4 days 8 hours 30 minutes' WHERE id = '20000000-0000-0000-0000-000000000007'; -- Beginner Bouldering Night (TopOut)
UPDATE public.events SET start_at = now() + interval '8 days',           end_at = now() + interval '8 days 1 hour 30 minutes'  WHERE id = '20000000-0000-0000-0000-000000000008'; -- Tuesday Group Run · 5K (Sasha)
UPDATE public.events SET start_at = now() + interval '9 days',           end_at = now() + interval '9 days 1 hour'             WHERE id = '20000000-0000-0000-0000-000000000009'; -- Saturday Sunrise Yoga (Theo)
