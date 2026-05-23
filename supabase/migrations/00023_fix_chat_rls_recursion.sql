-- Fix: infinite recursion in the chat RLS policies (chats couldn't load and
-- messages couldn't be sent in live mode).
--
-- 00011's `chat_members` SELECT policy references `chat_members` inside its own
-- USING clause:
--
--   USING (EXISTS (SELECT 1 FROM chat_members cm
--                  WHERE cm.chat_id = chat_members.chat_id
--                    AND cm.user_id = auth.uid()))
--
-- Evaluating that policy requires reading chat_members, which re-applies the
-- same policy → Postgres aborts with "infinite recursion detected in policy
-- for relation chat_members". Because the `chats` SELECT and `messages`
-- SELECT/INSERT policies all sub-query `chat_members`, that recursion broke the
-- chat list, message reads, AND message sends (the failing insert surfaced as
-- the "couldn't send" / failed-retry indicator).
--
-- Fix: a SECURITY DEFINER helper that checks membership while bypassing RLS
-- (so it can't recurse), used by all four policies. Same access semantics, no
-- recursion. This is the recommended Supabase pattern for self-referential
-- membership tables.

CREATE OR REPLACE FUNCTION public.is_chat_member(p_chat uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_id = p_chat AND user_id = p_user
  );
$$;

-- chat_members: a member can see the membership rows of any chat they're in.
DROP POLICY IF EXISTS "Members see chat membership" ON chat_members;
CREATE POLICY "Members see chat membership"
  ON chat_members FOR SELECT
  USING (is_chat_member(chat_id, auth.uid()));

-- chats: a member can see their chats.
DROP POLICY IF EXISTS "Members see their chats" ON chats;
CREATE POLICY "Members see their chats"
  ON chats FOR SELECT
  USING (is_chat_member(id, auth.uid()));

-- messages: members can read (unless blocked) …
DROP POLICY IF EXISTS "Chat members can read messages" ON messages;
CREATE POLICY "Chat members can read messages"
  ON messages FOR SELECT
  USING (
    is_chat_member(chat_id, auth.uid())
    AND NOT is_blocked(auth.uid(), sender_id)
  );

-- … and send to chats they belong to.
DROP POLICY IF EXISTS "Chat members can send messages" ON messages;
CREATE POLICY "Chat members can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_chat_member(chat_id, auth.uid())
  );
