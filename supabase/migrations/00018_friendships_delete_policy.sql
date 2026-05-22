-- Let either party delete a friendship row.
--
-- 00011 gave `friendships` SELECT / INSERT / UPDATE policies but no
-- DELETE. With RLS on, a DELETE with no matching policy simply removes
-- zero rows (no error) — so `api.removeFriend` (unfriend, or cancel a
-- request you sent) silently did nothing in live mode, and account
-- deletion couldn't clear a user's connections. Allow the sender or the
-- recipient to remove the row.
CREATE POLICY "Either party can delete a friendship"
  ON friendships FOR DELETE
  USING (from_id = auth.uid() OR to_id = auth.uid());
