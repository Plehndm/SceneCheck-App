-- Events with PostGIS spatial column and interest tagging

CREATE TABLE public.events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id       UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT DEFAULT '',
  geog             geography(Point, 4326),
  location_name    TEXT DEFAULT '',
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ,
  capacity         INT,
  subscriber_count INT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'published', 'cancelled', 'past')),
  source           TEXT NOT NULL DEFAULT 'user'
                   CHECK (source IN ('user', 'scraped')),
  min_subscribers  INT DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GiST index on geography column for ST_DWithin spatial queries
CREATE INDEX idx_events_geog ON events USING GIST (geog);
CREATE INDEX idx_events_start ON events (start_at);
CREATE INDEX idx_events_creator ON events (creator_id);
CREATE INDEX idx_events_status ON events (status);

CREATE TABLE public.event_interests (
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, interest_id)
);
