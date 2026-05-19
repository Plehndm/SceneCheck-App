-- Fix: profile visibility RLS policy leaked private profiles
--
-- The original policy in migration 00011 read:
--
--   USING (
--     visibility = 'public'
--     OR user_id = auth.uid()
--     OR NOT is_blocked(auth.uid(), user_id)
--   )
--
-- The third clause is too permissive: it grants SELECT to anyone who is
-- not in a block relationship with the owner — including total strangers
-- — regardless of the owner's `visibility = 'private'` setting. The
-- intended behavior (and the one the requirements doc + product copy
-- describe) is:
--
--   - Public profiles: visible to anyone NOT blocked by the owner.
--   - Private profiles: visible ONLY to the owner and accepted friends,
--     and never to anyone in a block relationship.
--
-- This migration installs an `are_friends(a, b)` helper and replaces the
-- profile SELECT policy with the corrected predicate.

-- Helper: do two users have an accepted friendship (either direction)?
CREATE OR REPLACE FUNCTION public.are_friends(a UUID, b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND (
        (from_id = a AND to_id = b)
        OR (from_id = b AND to_id = a)
      )
  );
$$;

-- Replace the leaky policy.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

CREATE POLICY "Profile visibility respects privacy and blocks"
  ON profiles FOR SELECT
  USING (
    -- Always: never expose to a blocker (either direction).
    NOT is_blocked(auth.uid(), user_id)
    AND (
      -- Owners see themselves.
      user_id = auth.uid()
      -- Public profiles are open.
      OR visibility = 'public'
      -- Private profiles are visible to accepted friends only.
      OR (visibility = 'private' AND are_friends(auth.uid(), user_id))
    )
  );
