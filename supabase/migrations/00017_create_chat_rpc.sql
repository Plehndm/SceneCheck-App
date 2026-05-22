-- create_chat: start (or reopen) a conversation.
--
-- The `chats` / `chat_members` tables have only SELECT policies (00011) —
-- no client-facing INSERT — so a direct insert from the app was blocked by
-- RLS and the "new chat" button appeared to do nothing. Adding INSERT
-- policies is awkward (a chat_members policy that lets the creator add
-- others has to reference chat_members, risking RLS recursion), so chat
-- creation goes through this SECURITY DEFINER function instead, which runs
-- with the owner's privileges.
--
-- It also DEDUPES: if a chat of the same type already exists with exactly
-- the same member set (caller + invitees), its id is returned rather than
-- creating a duplicate. So:
--   • starting a DM with someone you already DM reopens that thread, and
--   • a group with the same members as an existing group is reused.
--
-- `p_member_ids` is the invitees (the caller is added automatically).
CREATE OR REPLACE FUNCTION public.create_chat(
  p_member_ids UUID[],
  p_type       TEXT,
  p_title      TEXT DEFAULT ''
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me       UUID := auth.uid();
  members  UUID[];
  existing UUID;
  new_id   UUID;
  m        UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Target member set: caller + invitees, de-duplicated and sorted so it
  -- can be compared as an ordered array.
  SELECT array_agg(uid ORDER BY uid)
    INTO members
  FROM (SELECT DISTINCT unnest(array_append(p_member_ids, me)) AS uid) s;

  -- Reuse an existing chat of the same type whose member set is exactly
  -- `members` (none extra, none missing).
  SELECT c.id INTO existing
  FROM chats c
  WHERE c.type = p_type
    AND (
      SELECT array_agg(cm.user_id ORDER BY cm.user_id)
      FROM chat_members cm
      WHERE cm.chat_id = c.id
    ) = members
  LIMIT 1;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO chats (type, title) VALUES (p_type, p_title)
  RETURNING id INTO new_id;

  FOREACH m IN ARRAY members LOOP
    INSERT INTO chat_members (chat_id, user_id) VALUES (new_id, m);
  END LOOP;

  RETURN new_id;
END;
$$;
