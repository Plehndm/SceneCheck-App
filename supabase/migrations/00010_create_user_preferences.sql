-- User notification and discovery preferences

CREATE TABLE public.user_preferences (
  user_id               UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  push_enabled          BOOLEAN NOT NULL DEFAULT true,
  home_location         geography(Point, 4326),
  notification_radius_m INT NOT NULL DEFAULT 8047,  -- ~5 miles
  push_token            TEXT,
  notif_messages        BOOLEAN DEFAULT true,
  notif_friend_requests BOOLEAN DEFAULT true,
  notif_org_events      BOOLEAN DEFAULT true,
  notif_event_reminders BOOLEAN DEFAULT true,
  notif_friend_activity BOOLEAN DEFAULT false,
  notif_weekly_digest   BOOLEAN DEFAULT false
);
