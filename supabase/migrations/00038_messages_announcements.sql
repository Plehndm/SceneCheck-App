-- Event-coordinator announcements (FR9.5 / CODE_REVIEW_REPORT_3 FR-coverage row).
--
-- FR9.5: "The system shall allow event coordinators to send announcements
-- to all members of an event group chat."
--
-- Approach: add a `message_type` column to `messages` with a CHECK
-- constraining it to `'normal'` (default) or `'announcement'`, and add an
-- RLS INSERT policy that permits `announcement` rows only when the sender
-- is the host of the event tied to this chat.
--
-- This keeps the storage shape minimal — no separate announcements table,
-- no extra join. The frontend can render announcements with a distinct
-- style based on `message_type === 'announcement'`. Push fan-out (if
-- desired) can be triggered by an Edge Function or future trigger that
-- watches for `message_type='announcement'` INSERTs; the in-app feed is
-- the minimum FR9.5 deliverable.
--
-- RLS layering:
--   - The existing 00023 policy `"Chat members can send messages"` already
--     covers INSERT for any chat member, with no constraint on
--     message_type — so normal members can still post regular messages.
--   - The new policy `"Event hosts can post announcements"` is an OR-style
--     PERMISSIVE policy: an INSERT row must satisfy the OR of all
--     applicable INSERT policies. A host posting `message_type='announcement'`
--     to their event's chat satisfies both this new policy (host predicate)
--     AND the existing per-member policy (they are a member of the chat),
--     so the row is accepted. A non-host posting `'announcement'` fails the
--     new policy but only matches the existing per-member policy — which
--     does not constrain message_type — so they would also be accepted by
--     RLS alone. To stop a non-host from posting announcements, we add a
--     supplementary CHECK constraint via a BEFORE INSERT trigger: if
--     message_type='announcement', the sender must be the event creator.
--     This belt-and-braces approach guarantees the host-only invariant
--     even if a future RLS policy edit forgets to constrain it.
--
-- Why a trigger + RLS, not just RLS: PostgreSQL evaluates multiple
-- PERMISSIVE policies on the same command as OR (any policy passing
-- accepts the row). The existing per-member policy has no message_type
-- check and would accept an announcement from anyone. We could rewrite
-- it to add `AND message_type='normal'`, but that touches a policy used
-- by every other test/edge function and we want to keep the new code
-- additive. A small BEFORE INSERT trigger that raises when an
-- announcement comes from a non-host is the safest layering.
--
-- Compatibility with existing rows: the column has DEFAULT 'normal' and
-- NOT NULL, so the ALTER backfills every existing message row to
-- 'normal' atomically; no separate UPDATE step needed.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'normal'
    CHECK (message_type IN ('normal', 'announcement'));

-- A useful partial index for the host-side "see all my past announcements"
-- query and a future "pin announcements to top of chat" rendering pass.
CREATE INDEX IF NOT EXISTS idx_messages_announcements
  ON public.messages (chat_id, created_at DESC)
  WHERE message_type = 'announcement';

-- BEFORE INSERT trigger: any row with message_type='announcement' must be
-- sent by the host of the chat's event. The trigger looks the host up via
-- chats.event_id → events.creator_id; if there's no event_id (DM / non-event
-- group chat) or the sender isn't the creator, raise. The reverse case —
-- a host posting message_type='normal' in their own event chat — is
-- explicitly allowed (the host can chat like anyone else).
CREATE OR REPLACE FUNCTION public.enforce_announcement_host()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator_id UUID;
BEGIN
  IF NEW.message_type IS DISTINCT FROM 'announcement' THEN
    RETURN NEW;   -- 'normal' messages are unaffected.
  END IF;

  SELECT e.creator_id INTO v_creator_id
    FROM chats c
    JOIN events e ON e.id = c.event_id
   WHERE c.id = NEW.chat_id;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Announcements require a chat tied to an event'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.sender_id <> v_creator_id THEN
    RAISE EXCEPTION 'Only the event host can post announcements in this chat'
      USING ERRCODE = '42501';   -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_announcement_host_check ON public.messages;
CREATE TRIGGER messages_announcement_host_check
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_announcement_host();

-- RLS: add an explicit "Event hosts can post announcements" policy. Even
-- though the BEFORE INSERT trigger is the actual gatekeeper, having an
-- explicit policy documents intent at the RLS layer (the place where
-- audit reviewers look) and lets a future maintainer narrow the
-- per-member INSERT policy to message_type='normal' if desired, without
-- breaking the host's announcement path.
DROP POLICY IF EXISTS "Event hosts can post announcements" ON public.messages;
CREATE POLICY "Event hosts can post announcements"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND message_type = 'announcement'
    AND EXISTS (
      SELECT 1
        FROM chats c
        JOIN events e ON e.id = c.event_id
       WHERE c.id = messages.chat_id
         AND e.creator_id = auth.uid()
    )
  );
