/*
# Stock Opname (Stok Fisik) — Audit & Adjustment

1. New Tables
- `stock_opnames` — header for each stock opname session
  - id, opname_no (unique), opname_date (date),
    status (draft/completed),
    notes text, created_at, completed_at (nullable)

- `stock_opname_items` — line items: per-medicine physical count
  - id, opname_id (FK), medicine_id (FK),
    system_stock (stok di sistem saat opname),
    physical_stock (hasil hitung fisik),
    difference (physical - system),
    adjusted (boolean, apakah stok sudah di-adjust)

2. Security
- RLS enabled on both tables, 4 CRUD policies each for anon+authenticated.
*/

CREATE TABLE IF NOT EXISTS stock_opnames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_no text UNIQUE NOT NULL,
  opname_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE stock_opnames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "so_select" ON stock_opnames;
CREATE POLICY "so_select" ON stock_opnames FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "so_insert" ON stock_opnames;
CREATE POLICY "so_insert" ON stock_opnames FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "so_update" ON stock_opnames;
CREATE POLICY "so_update" ON stock_opnames FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "so_delete" ON stock_opnames;
CREATE POLICY "so_delete" ON stock_opnames FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS stock_opname_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id uuid NOT NULL REFERENCES stock_opnames(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  system_stock integer NOT NULL DEFAULT 0,
  physical_stock integer,
  difference integer,
  adjusted boolean NOT NULL DEFAULT false
);

ALTER TABLE stock_opname_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "soi_select" ON stock_opname_items;
CREATE POLICY "soi_select" ON stock_opname_items FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "soi_insert" ON stock_opname_items;
CREATE POLICY "soi_insert" ON stock_opname_items FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "soi_update" ON stock_opname_items;
CREATE POLICY "soi_update" ON stock_opname_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "soi_delete" ON stock_opname_items;
CREATE POLICY "soi_delete" ON stock_opname_items FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_so_items_opname ON stock_opname_items(opname_id);
CREATE INDEX IF NOT EXISTS idx_so_items_medicine ON stock_opname_items(medicine_id);
CREATE INDEX IF NOT EXISTS idx_so_status ON stock_opnames(status);
