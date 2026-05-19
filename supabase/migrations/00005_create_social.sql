-- Friendships and blocking

CREATE TABLE public.friendships (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  to_id      UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_id, to_id)
);

CREATE INDEX idx_friendships_to ON friendships (to_id, status);

CREATE TABLE public.blocks (
  blocker_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Helper function: check if two users have a block relationship (either direction)
CREATE OR REPLACE FUNCTION public.is_blocked(a UUID, b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;
