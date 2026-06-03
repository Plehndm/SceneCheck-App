-- ══════════════════════════════════════════════════════════════
-- Move David's + Maya's events forward so they show on the map again.
--
-- The discovery RPC (`rank_events_query`) only returns events with
-- `start_at > now() - 2h`. Migration 00045 re-stamped the seeded events
-- to `now() + N days`, but that ran in early May — so those rows have
-- since drifted back into the past and dropped off the map. (Migrations
-- run once, so 00045 can't re-fire; this is a fresh re-stamp.)
--
-- This moves the two owners the user verifies with to one week out,
-- preserving each event's clock time and duration:
--   • Maya — the seeded "Morning Ride — Back Bay loop" (fixed UUID from
--     seed-hosted.sql), plus any event explicitly hosted by Maya if
--     seed-hosted-social.sql was applied (creator_id = her UUID).
--   • The davidplehn07@gmail.com account's own events (scoped by email
--     so it catches them wherever they live; no-ops if none exist).
--
-- WHERE-scoped so it never touches another user's event, and it no-ops
-- harmlessly where a target row doesn't exist (fresh DBs, CI).
-- ══════════════════════════════════════════════════════════════

with targets as (
  select id, start_at, end_at
  from public.events
  where
    -- Maya's seeded event (fixed UUID) + any event she explicitly hosts.
    id = '20000000-0000-0000-0000-000000000001'
    or creator_id = '00000000-0000-0000-0000-000000000002'
    -- The davidplehn07@gmail.com account's own events.
    or creator_id = (select id from auth.users where email = 'davidplehn07@gmail.com')
)
update public.events e
set
  -- One week from today (midnight UTC) at the event's original time-of-day.
  start_at = (date_trunc('day', now()) + interval '7 days')
             + (e.start_at - date_trunc('day', e.start_at)),
  -- Preserve the original duration; leave open-ended events open.
  end_at = case
    when e.end_at is null then null
    else (date_trunc('day', now()) + interval '7 days')
         + (e.start_at - date_trunc('day', e.start_at))
         + (e.end_at - e.start_at)
  end
from targets t
where e.id = t.id;
