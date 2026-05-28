-- Onboarding-completion marker (FR1.3 / CODE_REVIEW_REPORT_3 FR-coverage row).
--
-- FR1.3: "The system shall present a questionnaire upon first login to
-- collect user preferences." The existing onboarding screen (SCOnboarding /
-- onboarding.tsx) writes interest selections through user_interests, but the
-- app has no persistent way to know whether a returning user has *already*
-- completed it. The current behaviour is to detect "no interests" and
-- re-prompt — which mis-routes any user who legitimately cleared all their
-- tags later (FR3.2 lets them edit interests freely).
--
-- Approach: add `profiles.onboarded_at TIMESTAMPTZ NULL`. NULL means
-- "questionnaire has not yet been completed"; a non-NULL timestamp captures
-- when the user pressed Done. This is the single source of truth AuthBootstrap
-- consults to decide whether to route a freshly-signed-in user to the
-- onboarding screen vs. straight to the tabs.
--
-- Why not derive it from user_interests row count: a user who finishes
-- onboarding and then later removes every interest tag is still "onboarded"
-- — they have just chosen to follow nothing. Re-prompting would be wrong.
--
-- No backfill: existing accounts predate this column. Treating them as
-- not-yet-onboarded would re-prompt every current user on next sign-in,
-- which is the opposite of what FR1.3 intends ("upon first login").
-- The frontend's AuthBootstrap will treat a non-empty user_interests set as
-- evidence of prior onboarding and write `now()` to onboarded_at on first
-- sight (a one-shot self-heal). Anyone with no interests AND a NULL
-- onboarded_at sees the questionnaire — the correct first-login behaviour.
--
-- RLS: the existing profile policies in 00011 / 00014 already scope this
-- column. `Public profiles are viewable by everyone` covers SELECT; `Users
-- can update own profile` covers UPDATE. No policy changes needed.
--
-- handle_new_user (00002 / 00019 / 00020 / 00030) is intentionally NOT
-- changed: a brand-new account should start with onboarded_at = NULL so
-- the first sign-in routes to onboarding.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Partial index for the fast "did this user finish onboarding?" check.
-- Most queries will read profiles by user_id (already PK-indexed), so the
-- partial index is only useful for analytics that count completed-onboarding
-- users; cheap to maintain on a sparse column.
CREATE INDEX IF NOT EXISTS idx_profiles_onboarded_at
  ON public.profiles (onboarded_at)
  WHERE onboarded_at IS NOT NULL;
