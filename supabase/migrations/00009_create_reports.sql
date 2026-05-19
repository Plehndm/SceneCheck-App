-- User/event reports for moderation

CREATE TABLE public.reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  target_user_id  UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  target_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  reason          TEXT NOT NULL,
  details         TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (target_user_id IS NOT NULL OR target_event_id IS NOT NULL)
);
