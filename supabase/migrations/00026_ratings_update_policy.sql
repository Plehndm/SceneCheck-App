-- Let a user change a rating they already left.
--
-- 00011 gave `ratings` only SELECT (public) + INSERT (own row) policies. The
-- table's PK is (event_id, user_id) — one rating per user per event — so the
-- rating UI upserts. Without an UPDATE policy, re-rating an event (the ON
-- CONFLICT … DO UPDATE path) is blocked by RLS. Allow a user to update (and
-- delete) their own rating.

CREATE POLICY "Users update their own ratings"
  ON ratings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own ratings"
  ON ratings FOR DELETE
  USING (user_id = auth.uid());
