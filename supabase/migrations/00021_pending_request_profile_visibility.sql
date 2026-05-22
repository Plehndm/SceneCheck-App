-- Let pending friend-request parties see each other's profile.
--
-- The profile SELECT policy (00014) hides a PRIVATE profile from anyone who
-- isn't an accepted friend. But a friend request is exactly the moment you
-- need to see who's asking (or who you asked) BEFORE you're friends — so the
-- requests screen couldn't resolve a private requester's name/avatar, and a
-- single failed `getProfile` blanked the whole incoming list. (Outgoing to a
-- private account had the same gap.)
--
-- Fix: an additional, narrowly-scoped permissive SELECT policy that exposes a
-- profile when there's a PENDING friendship between the viewer and that
-- profile (either direction). RLS policies are OR'd, so this only ever ADDS
-- visibility for a genuine pending request; it never widens public/private
-- rules otherwise. The block guard is preserved.

-- Helper: is there a pending friend request between two users (either way)?
-- SECURITY DEFINER (like are_friends in 00014) so the subquery doesn't recurse
-- through friendships' own RLS.
CREATE OR REPLACE FUNCTION public.has_pending_request(a UUID, b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'pending'
      AND (
        (from_id = a AND to_id = b)
        OR (from_id = b AND to_id = a)
      )
  );
$$;

CREATE POLICY "Pending-request parties can read each other's profile"
  ON profiles FOR SELECT
  USING (
    NOT is_blocked(auth.uid(), user_id)
    AND has_pending_request(auth.uid(), user_id)
  );
