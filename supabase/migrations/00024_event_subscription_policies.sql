-- Let users manage their own event_subscriptions rows.
--
-- 00011 gave event_subscriptions only SELECT policies — no INSERT/UPDATE/
-- DELETE. Subscribing goes through the `subscribe_to_event_atomic` RPC
-- (SECURITY DEFINER, so it bypasses RLS), but *cancelling* is a direct
-- `UPDATE … SET status='cancelled'` from the client (api.cancelSubscription).
-- With RLS on and no UPDATE policy, that update silently matched zero rows, so
-- leaving an event didn't persist (the event reappeared as joined on reload).
--
-- Add own-row write policies so cancel works (and a direct subscribe could too,
-- though the capacity/waitlist path still uses the RPC).

CREATE POLICY "Users insert own subscriptions"
  ON event_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own subscriptions"
  ON event_subscriptions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own subscriptions"
  ON event_subscriptions FOR DELETE
  USING (user_id = auth.uid());
