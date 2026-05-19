-- Event subscriptions, waitlist, and ratings

CREATE TABLE public.event_subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'confirmed'
             CHECK (status IN ('confirmed', 'waitlisted', 'removed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_subscriptions_user ON event_subscriptions (user_id);
CREATE INDEX idx_subscriptions_event ON event_subscriptions (event_id, status);

CREATE TABLE public.waitlist (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  position INT NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE public.ratings (
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  stars      SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  text       TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Auto-update event subscriber_count on subscription changes
CREATE OR REPLACE FUNCTION public.update_event_subscriber_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE events SET subscriber_count = (
    SELECT COUNT(*) FROM event_subscriptions
    WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
      AND status = 'confirmed'
  ) WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE OR DELETE ON event_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_event_subscriber_count();
