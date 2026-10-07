/*
# Re-seed app_users with bcryptjs-compatible hashes

## Overview
The pgcrypto extension is not available on this Supabase instance, so
password hashing is handled by the verify-login edge function using the
bcryptjs library (Node bcrypt, $2b$ format). This migration re-seeds the
app_users table with pre-generated bcryptjs hashes.

## Default Credentials (change via lib/users.ts or app UI)
- owner    / ApotekZ@Owner2025    (full access)
- apoteker / ApotekZ@Apoteker2025 (dashboard, POS, inventory, limited reports)
- kasir    / ApotekZ@Kasir2025    (POS, inventory only)

## Notes
1. Re-runnable via ON CONFLICT (username) DO UPDATE — keeps hashes in sync.
2. The verify-login edge function compares submitted password against
   password_hash using bcryptjs.compare().
*/

UPDATE app_users SET
  password_hash = '$2b$10$cEFUzzjkO1xyLahjZK3T3eAXUa0t3VwiFCKbLiAlOczbXQ20j5hpu',
  display_name = 'Pemilik Apotek',
  role = 'owner',
  is_active = true,
  updated_at = now()
WHERE username = 'owner';

UPDATE app_users SET
  password_hash = '$2b$10$7q1UntRx9Zx67ePQA5vWG.BI6SQy.EEBCdSVlT4HJ1aEatehcQpEm',
  display_name = 'Apt. Penanggung Jawab',
  role = 'apoteker',
  is_active = true,
  updated_at = now()
WHERE username = 'apoteker';

UPDATE app_users SET
  password_hash = '$2b$10$dnThWt3/JdrBQ9F1ZpYbO.9crg/1uzxi7JU8cVuxqN6BVdaovnL/K',
  display_name = 'Staff Kasir',
  role = 'kasir',
  is_active = true,
  updated_at = now()
WHERE username = 'kasir';

INSERT INTO app_users (username, password_hash, display_name, role) VALUES
  ('owner',    '$2b$10$cEFUzzjkO1xyLahjZK3T3eAXUa0t3VwiFCKbLiAlOczbXQ20j5hpu', 'Pemilik Apotek',               'owner'),
  ('apoteker', '$2b$10$7q1UntRx9Zx67ePQA5vWG.BI6SQy.EEBCdSVlT4HJ1aEatehcQpEm', 'Apt. Penanggung Jawab',        'apoteker'),
  ('kasir',    '$2b$10$dnThWt3/JdrBQ9F1ZpYbO.9crg/1uzxi7JU8cVuxqN6BVdaovnL/K', 'Staff Kasir',                  'kasir')
ON CONFLICT (username) DO NOTHING;
