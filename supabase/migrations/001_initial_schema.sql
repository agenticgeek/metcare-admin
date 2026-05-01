-- MET Academy — Full Database Schema
-- Version 1.0 | May 2026
-- Run this migration against your Supabase project

-- ============================================================
-- 1. Create ENUM type for user status
-- ============================================================
CREATE TYPE user_status AS ENUM ('pending', 'active', 'disabled');

-- ============================================================
-- 2. Create tables
-- ============================================================

-- admins table (seeded manually — no signup endpoint)
CREATE TABLE admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- users table (students)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL DEFAULT '',
  status user_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- activation_tokens table
CREATE TABLE activation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- modules table (video modules)
CREATE TABLE modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index integer UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  video_id text,
  duration_seconds integer,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Create indexes for performance
-- ============================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_activation_tokens_token ON activation_tokens(token);
CREATE INDEX idx_activation_tokens_user_id ON activation_tokens(user_id);
CREATE INDEX idx_modules_order_index ON modules(order_index);
CREATE INDEX idx_admins_email ON admins(email);

-- ============================================================
-- 4. Enable RLS on all tables
-- ============================================================
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS Policies
-- ============================================================

-- Block ALL access via anon key on all tables
-- (Our app uses service role key server-side, so these policies
--  primarily protect against direct anon/public access)

-- Students: can only SELECT their own row
CREATE POLICY "students_select_own"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Students: NO insert, update, delete
-- (No policies = no access for non-service-role)

-- Students: can SELECT published modules only
CREATE POLICY "students_select_published_modules"
  ON modules FOR SELECT
  USING (is_published = true);

-- Admin (service role): Full access is implicit via service role key
-- The service role bypasses RLS entirely, so no explicit admin policies needed.
-- All admin operations go through the Node.js backend using the service role key.

-- No public access: deny all for anon on all tables
-- (RLS is enabled + no permissive policies for anon = blocked by default)

-- ============================================================
-- 6. Seed admin account
-- ============================================================
-- Replace with actual credentials before running:
-- Password hash for the admin password (generate with bcrypt, 12 rounds)
-- Example: INSERT INTO admins (email, password_hash) VALUES ('admin@met-academy.com', '$2a$12$...');
-- 
-- DO NOT commit real credentials to version control.
-- Use a separate seed script with environment variables.

-- ============================================================
-- 7. Explicit Grants (Fix for permission denied)
-- ============================================================
GRANT ALL ON TABLE public.admins TO service_role;
GRANT ALL ON TABLE public.users TO service_role;
GRANT ALL ON TABLE public.activation_tokens TO service_role;
GRANT ALL ON TABLE public.modules TO service_role;
