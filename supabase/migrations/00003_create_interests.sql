-- Interest tags, user subscriptions, and tag relatedness

CREATE TABLE public.interests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL UNIQUE,
  description      TEXT DEFAULT '',
  subscriber_count INT NOT NULL DEFAULT 0,
  similar_tags     TEXT[] DEFAULT '{}'
);

CREATE INDEX idx_interests_name ON interests USING gin (name gin_trgm_ops);

CREATE TABLE public.user_interests (
  user_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, interest_id)
);

-- Tag relatedness weights for FR3.4 (related/similar matching)
CREATE TABLE public.tag_relations (
  source_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  weight    NUMERIC(4,3) DEFAULT 0.5,
  PRIMARY KEY (source_id, target_id)
);

-- Auto-update subscriber_count on user_interests changes
CREATE OR REPLACE FUNCTION public.update_interest_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE interests SET subscriber_count = subscriber_count + 1
    WHERE id = NEW.interest_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE interests SET subscriber_count = GREATEST(0, subscriber_count - 1)
    WHERE id = OLD.interest_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_user_interest_change
  AFTER INSERT OR DELETE ON user_interests
  FOR EACH ROW EXECUTE FUNCTION public.update_interest_count();
