-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table: one row per user, stores display name and onboarding status
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  warehouse_name text NOT NULL DEFAULT '',
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage their own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Pallets table: each row owned by one user
CREATE TABLE IF NOT EXISTS pallets (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  number integer NOT NULL DEFAULT 0,
  row integer NOT NULL DEFAULT 0,
  col integer NOT NULL DEFAULT 0,
  stack_label text NOT NULL DEFAULT 'A',
  lot text NOT NULL DEFAULT '',
  blend text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 0,
  units text NOT NULL DEFAULT 'bags',
  stack_height integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  tag text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage their own pallets"
  ON pallets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
