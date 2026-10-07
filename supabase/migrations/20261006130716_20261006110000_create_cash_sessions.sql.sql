/*
# Cashier Shift / Cash Session Management

1. New Tables
- `cash_sessions` — tracks open/close of a cashier's shift
  - id, session_no, operator_name, role,
    opening_cash (numeric, modal awal), 
    closing_cash (numeric, nullable, diisi saat tutup),
    expected_cash (numeric, nullable, dihitung saat tutup),
    cash_difference (numeric, nullable),
    status (open/closed),
    opened_at (timestamptz), closed_at (timestamptz, nullable),
    notes text
- `cash_session_sales` — link table: which sales belong to which session
  - id, session_id (FK), sale_id (FK), created_at

2. Security
- RLS enabled on both tables, 4 CRUD policies each for anon+authenticated.
*/

CREATE TABLE IF NOT EXISTS cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_no text UNIQUE NOT NULL,
  operator_name text NOT NULL,
  operator_role text NOT NULL DEFAULT 'kasir',
  opening_cash numeric(14,2) NOT NULL DEFAULT 0,
  closing_cash numeric(14,2),
  expected_cash numeric(14,2),
  cash_difference numeric(14,2),
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  notes text
);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_sessions_select" ON cash_sessions;
CREATE POLICY "cash_sessions_select" ON cash_sessions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "cash_sessions_insert" ON cash_sessions;
CREATE POLICY "cash_sessions_insert" ON cash_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cash_sessions_update" ON cash_sessions;
CREATE POLICY "cash_sessions_update" ON cash_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cash_sessions_delete" ON cash_sessions;
CREATE POLICY "cash_sessions_delete" ON cash_sessions FOR DELETE TO anon, authenticated USING (true);

-- Link table: sales → session
CREATE TABLE IF NOT EXISTS cash_session_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cash_session_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "css_select" ON cash_session_sales;
CREATE POLICY "css_select" ON cash_session_sales FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "css_insert" ON cash_session_sales;
CREATE POLICY "css_insert" ON cash_session_sales FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "css_update" ON cash_session_sales;
CREATE POLICY "css_update" ON cash_session_sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "css_delete" ON cash_session_sales;
CREATE POLICY "css_delete" ON cash_session_sales FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_css_session ON cash_session_sales(session_id);
CREATE INDEX IF NOT EXISTS idx_css_sale ON cash_session_sales(sale_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status);
