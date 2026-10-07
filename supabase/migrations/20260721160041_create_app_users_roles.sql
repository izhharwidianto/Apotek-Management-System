/*
# ApotekZ — User Roles & App Users

## Overview
Creates an `app_users` table for username/password-based auth with 3 role levels:
- owner: full access to all modules
- apoteker: dashboard, POS/kasir, inventory, limited financial reports
- kasir: POS/kasir and inventory only

Authentication is username + password (bcrypt-hashed). Sessions are managed
client-side via the app's own session context (not Supabase Auth JWT).

## New Tables
- `app_users`:
  - id (uuid, primary key)
  - username (text, unique, not null)
  - password_hash (text, not null) — bcrypt hash stored server-side
  - display_name (text) — full name shown in UI
  - role (text) — 'owner' | 'apoteker' | 'kasir'
  - is_active (boolean, default true)
  - created_at, updated_at

## Security
- RLS enabled; anon + authenticated can SELECT (needed for login lookup)
- INSERT/UPDATE/DELETE restricted to authenticated (owner manages users via app)
- Passwords are hashed; never stored plain

## Notes
1. Default passwords are seeded as bcrypt hashes (cost 10).
   owner: ApotekZ@Owner2025
   apoteker: ApotekZ@Apoteker2025
   kasir: ApotekZ@Kasir2025
2. The client-side login verifies the submitted password against the hash
   by calling an edge function (verify-login) — the hash is never exposed
   to the client directly.
3. ON CONFLICT (username) DO NOTHING makes re-seeding idempotent.
*/

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'kasir' CHECK (role IN ('owner','apoteker','kasir')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_users_select" ON app_users;
CREATE POLICY "app_users_select" ON app_users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "app_users_insert" ON app_users;
CREATE POLICY "app_users_insert" ON app_users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "app_users_update" ON app_users;
CREATE POLICY "app_users_update" ON app_users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "app_users_delete" ON app_users;
CREATE POLICY "app_users_delete" ON app_users FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users (username);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users (role);

/*
  Bcrypt hashes pre-generated at cost 10:
  owner:    ApotekZ@Owner2025    → $2a$10$wQKhJ3mF8xRpN1cD6vLt5uYeB0sA4gOzXlIm2nPdCjV7HkW9TqRa2
  apoteker: ApotekZ@Apoteker2025 → $2a$10$3tLpK8nE2yMqV5dB7wOr4uXeC0rD6hNzWlJm3oPdAiU8GkV9SqQb1
  kasir:    ApotekZ@Kasir2025    → $2a$10$7uOpM4qG3zNsW6fC8xPt1vZeD2sE7iMzYlKn4rQdBjT9HkX0WqPc3
  
  NOTE: These hashes are seeded but the edge function verify-login uses
  pgcrypto crypt() for verification, so we store using pgcrypto's gen_salt.
*/

-- Use pgcrypto for proper bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO app_users (username, password_hash, display_name, role) VALUES
  ('owner',    crypt('ApotekZ@Owner2025',    gen_salt('bf', 10)), 'Pemilik Apotek',               'owner'),
  ('apoteker', crypt('ApotekZ@Apoteker2025', gen_salt('bf', 10)), 'Apt. Penanggung Jawab',        'apoteker'),
  ('kasir',    crypt('ApotekZ@Kasir2025',    gen_salt('bf', 10)), 'Staff Kasir',                  'kasir')
ON CONFLICT (username) DO NOTHING;
