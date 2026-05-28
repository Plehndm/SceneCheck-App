-- Organisation follows (FR7.1 / CODE_REVIEW_REPORT_3 M10 residual).
--
-- Until this migration, organisation following was purely client state — a
-- Zustand `following: Set<string>` persisted to AsyncStorage. M10's prescribed
-- fix added optimistic-then-commit plumbing in `my-following.tsx` and
-- `profile/[id].tsx`, plus no-op `api.followOrg` / `api.unfollowOrg` stubs.
-- This migration is the backend half: a real `org_follows(user_id, org_id)`
-- table with RLS so each user owns their own list, and a primary key that
-- gives us natural idempotency on re-follow.
--
-- Why a separate table rather than reusing user_interests / friendships:
--   - user_interests is about hashtag-style topics, not org accounts.
--   - friendships is a bidirectional "accepted" relationship; following is
--     one-directional and doesn't need approval.
-- A dedicated table also lets a future trigger maintain a `profiles.followers`
-- count without entangling those other tables.
--
-- Cross-references:
--   AuthBootstrap reads this table and seeds the store's `following` Set on
--   sign-in (so a fresh device reflects the persisted follow graph).
--   `api.followOrg` / `api.unfollowOrg` write to this table from the
--   optimistic-commit pattern in `my-following.tsx` and `profile/[id].tsx`.

CREATE TABLE IF NOT EXISTS public.org_follows (
  user_id    UUID        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  org_id     UUID        NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id),
  -- Don't allow self-follow. The UI never offers it, but the constraint
  -- catches anyone going direct-to-DB and prevents the awkward edge case
  -- where a personal-account profile would appear in their own "following".
  CHECK (user_id <> org_id)
);

-- Lookup-by-org index for the future "X people follow this org" stat row.
CREATE INDEX IF NOT EXISTS org_follows_org_idx ON public.org_follows (org_id);

-- RLS: users own their own follow rows. Reading another user's follow list
-- is intentionally not exposed today — if it's ever needed (e.g. "Who from
-- your friends follows this org?"), a SECURITY DEFINER function should
-- mediate that with explicit friendship/visibility checks rather than a
-- broad SELECT policy.
ALTER TABLE public.org_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own org_follows" ON public.org_follows;
CREATE POLICY "Users read own org_follows"
  ON public.org_follows FOR SELECT
  USING (user_id = auth.uid());

-- INSERT requires the target row to be an org-type profile. This is the
-- structural mirror of the UI's filter on the followable list and prevents
-- a malicious client from following arbitrary personal accounts via this
-- table. (Personal-account "following" is what the friendships table is for.)
DROP POLICY IF EXISTS "Users insert own org_follows" ON public.org_follows;
CREATE POLICY "Users insert own org_follows"
  ON public.org_follows FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = org_id
         AND p.account_type = 'org'
    )
  );

DROP POLICY IF EXISTS "Users delete own org_follows" ON public.org_follows;
CREATE POLICY "Users delete own org_follows"
  ON public.org_follows FOR DELETE
  USING (user_id = auth.uid());
