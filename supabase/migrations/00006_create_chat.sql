-- Chat system: direct messages, group chats, event-tied chats

CREATE TABLE public.chats (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type       TEXT NOT NULL CHECK (type IN ('dm', 'group')),
  event_id   UUID REFERENCES events(id) ON DELETE SET NULL,
  title      TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_members (
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE public.messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id    UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  edited     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_chat ON messages (chat_id, created_at DESC);
