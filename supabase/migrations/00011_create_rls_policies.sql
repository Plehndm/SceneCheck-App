-- Row-Level Security policies for all tables

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- ═══ PROFILES ═══
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (
    visibility = 'public'
    OR user_id = auth.uid()
    OR NOT is_blocked(auth.uid(), user_id)
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- ═══ MANAGED ACCOUNTS ═══
CREATE POLICY "Users see their managed accounts"
  ON managed_accounts FOR SELECT
  USING (owner_id = auth.uid());

-- ═══ INTERESTS ═══
CREATE POLICY "Interests are publicly readable"
  ON interests FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create interests"
  ON interests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ═══ USER_INTERESTS ═══
CREATE POLICY "User interests are readable"
  ON user_interests FOR SELECT USING (true);

CREATE POLICY "Users manage own interests"
  ON user_interests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users remove own interests"
  ON user_interests FOR DELETE
  USING (user_id = auth.uid());

-- ═══ EVENTS ═══
CREATE POLICY "Published events are readable"
  ON events FOR SELECT
  USING (
    status = 'published'
    OR creator_id = auth.uid()
  );

CREATE POLICY "Authenticated users create events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creator can update own events"
  ON events FOR UPDATE
  USING (creator_id = auth.uid());

-- ═══ EVENT_INTERESTS ═══
CREATE POLICY "Event interests are readable"
  ON event_interests FOR SELECT USING (true);

-- ═══ FRIENDSHIPS ═══
CREATE POLICY "Both parties can read friendships"
  ON friendships FOR SELECT
  USING (from_id = auth.uid() OR to_id = auth.uid());

CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT
  WITH CHECK (from_id = auth.uid());

-- Only the recipient may change a friendship row (accept/decline). The sender
-- must not be able to self-accept their own pending request.
CREATE POLICY "Recipient can update friendship status"
  ON friendships FOR UPDATE
  USING (to_id = auth.uid())
  WITH CHECK (to_id = auth.uid());

-- ═══ BLOCKS ═══
CREATE POLICY "Users see own blocks"
  ON blocks FOR SELECT
  USING (blocker_id = auth.uid());

CREATE POLICY "Users can block others"
  ON blocks FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can unblock"
  ON blocks FOR DELETE
  USING (blocker_id = auth.uid());

-- ═══ MESSAGES ═══
CREATE POLICY "Chat members can read messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_id = messages.chat_id AND user_id = auth.uid()
    )
    AND NOT is_blocked(auth.uid(), messages.sender_id)
  );

CREATE POLICY "Chat members can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_id = messages.chat_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Sender can update own messages"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid());

CREATE POLICY "Sender can delete own messages"
  ON messages FOR DELETE
  USING (sender_id = auth.uid());

-- ═══ CHATS + CHAT_MEMBERS ═══
CREATE POLICY "Members see their chats"
  ON chats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_id = chats.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members see chat membership"
  ON chat_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid()
    )
  );

-- ═══ EVENT_SUBSCRIPTIONS ═══
CREATE POLICY "Users see own subscriptions"
  ON event_subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Event creators see attendees"
  ON event_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_subscriptions.event_id
        AND events.creator_id = auth.uid()
    )
  );

-- ═══ NOTIFICATIONS ═══
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users mark own notifications read"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ═══ REPORTS ═══
CREATE POLICY "Users can submit reports"
  ON reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

-- ═══ USER_PREFERENCES ═══
CREATE POLICY "Users manage own preferences"
  ON user_preferences FOR ALL
  USING (user_id = auth.uid());

-- ═══ RATINGS ═══
CREATE POLICY "Ratings are publicly readable"
  ON ratings FOR SELECT USING (true);

CREATE POLICY "Users can rate events they attended"
  ON ratings FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ═══ WAITLIST ═══
CREATE POLICY "Users see own waitlist position"
  ON waitlist FOR SELECT
  USING (user_id = auth.uid());
