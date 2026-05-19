-- User profiles and managed organization accounts

CREATE TABLE public.profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT '',
  username     TEXT UNIQUE,
  bio          TEXT DEFAULT '',
  avatar_url   TEXT,
  visibility   TEXT NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public', 'private')),
  avg_rating   NUMERIC(2,1) DEFAULT 0,
  account_type TEXT CHECK (account_type IN ('person', 'org')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_username ON profiles USING gin (username gin_trgm_ops);

-- Organization account management (Instagram-style account switcher).
-- One auth user can manage multiple profile rows (personal + orgs).
CREATE TABLE public.managed_accounts (
  owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  PRIMARY KEY (owner_id, account_id)
);

-- Auto-create a profile skeleton when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, account_type)
  VALUES (NEW.id, 'person');
  INSERT INTO public.managed_accounts (owner_id, account_id)
  VALUES (NEW.id, NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
