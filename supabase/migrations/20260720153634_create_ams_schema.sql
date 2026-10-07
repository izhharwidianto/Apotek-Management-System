/*
# Apotek Management System (AMS) — initial schema

## Overview
Single-tenant pharmacy management system. No sign-in screen, so all policies
are scoped to `anon, authenticated` and the data is intentionally shared/public.

## New Tables
- `medicines`: master list of medicines. Columns: id, code, name, category,
  unit, stock, cost_price, sell_price, reorder_point, expiry_date, supplier,
  created_at, updated_at.
- `sales`: a sale/transaction header. Columns: id, invoice_no, customer_name,
  subtotal, tax, discount, total, paid, change, payment_method, created_at.
- `sale_items`: line items for a sale. Columns: id, sale_id, medicine_id,
  medicine_name, quantity, price, subtotal.
- `returns`: returned medicines (retur). Columns: id, sale_id, invoice_no,
  medicine_id, medicine_name, quantity, reason, refund_amount, created_at.
- `expenses`: operational cash outflows. Columns: id, category, description,
  amount, created_at.

## Security
- RLS enabled on every table.
- All tables are intentionally public/shared (no auth) → `TO anon, authenticated`
  with `USING (true)` / `WITH CHECK (true)` for all CRUD verbs.

## Notes
1. `medicines.stock` is decremented by sale creation and restored on return.
2. `sale_items.medicine_id` is nullable so historical sales survive medicine deletion.
3. `sale_items.medicine_name` is denormalized for the same reason.
4. `invoice_no` format: INV-YYYYMMDD-NNN, generated client-side.
*/

CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Umum',
  unit text NOT NULL DEFAULT 'pcs',
  stock integer NOT NULL DEFAULT 0,
  cost_price numeric(14,2) NOT NULL DEFAULT 0,
  sell_price numeric(14,2) NOT NULL DEFAULT 0,
  reorder_point integer NOT NULL DEFAULT 10,
  expiry_date date,
  supplier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_medicines_select" ON medicines;
CREATE POLICY "ams_medicines_select" ON medicines FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_medicines_insert" ON medicines;
CREATE POLICY "ams_medicines_insert" ON medicines FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_medicines_update" ON medicines;
CREATE POLICY "ams_medicines_update" ON medicines FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_medicines_delete" ON medicines;
CREATE POLICY "ams_medicines_delete" ON medicines FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text UNIQUE NOT NULL,
  customer_name text NOT NULL DEFAULT 'Umum',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  paid numeric(14,2) NOT NULL DEFAULT 0,
  "change" numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Tunai',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_sales_select" ON sales;
CREATE POLICY "ams_sales_select" ON sales FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_sales_insert" ON sales;
CREATE POLICY "ams_sales_insert" ON sales FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_sales_update" ON sales;
CREATE POLICY "ams_sales_update" ON sales FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_sales_delete" ON sales;
CREATE POLICY "ams_sales_delete" ON sales FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES medicines(id) ON DELETE SET NULL,
  medicine_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price numeric(14,2) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL DEFAULT 0
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_sale_items_select" ON sale_items;
CREATE POLICY "ams_sale_items_select" ON sale_items FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_sale_items_insert" ON sale_items;
CREATE POLICY "ams_sale_items_insert" ON sale_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_sale_items_update" ON sale_items;
CREATE POLICY "ams_sale_items_update" ON sale_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_sale_items_delete" ON sale_items;
CREATE POLICY "ams_sale_items_delete" ON sale_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  invoice_no text,
  medicine_id uuid REFERENCES medicines(id) ON DELETE SET NULL,
  medicine_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  reason text NOT NULL DEFAULT '',
  refund_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_returns_select" ON returns;
CREATE POLICY "ams_returns_select" ON returns FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_returns_insert" ON returns;
CREATE POLICY "ams_returns_insert" ON returns FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_returns_update" ON returns;
CREATE POLICY "ams_returns_update" ON returns FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_returns_delete" ON returns;
CREATE POLICY "ams_returns_delete" ON returns FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'Operasional',
  description text NOT NULL DEFAULT '',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_expenses_select" ON expenses;
CREATE POLICY "ams_expenses_select" ON expenses FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_expenses_insert" ON expenses;
CREATE POLICY "ams_expenses_insert" ON expenses FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_expenses_update" ON expenses;
CREATE POLICY "ams_expenses_update" ON expenses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_expenses_delete" ON expenses;
CREATE POLICY "ams_expenses_delete" ON expenses FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_medicines_name_lower ON medicines (lower(name));
CREATE INDEX IF NOT EXISTS idx_medicines_code_lower ON medicines (lower(code));
CREATE INDEX IF NOT EXISTS idx_medicines_category_lower ON medicines (lower(category));
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_sale_id ON returns (sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses (created_at);

-- Seed sample medicines (idempotent via ON CONFLICT on code)
INSERT INTO medicines (code, name, category, unit, stock, cost_price, sell_price, reorder_point, expiry_date, supplier) VALUES
('MD001', 'Paracetamol 500mg', 'Tablet', 'strip', 120, 800, 1500, 20, '2026-05-01', 'Kimia Farma'),
('MD002', 'Amoxicillin 500mg', 'Kapsul', 'strip', 8, 2500, 4000, 15, '2026-08-15', 'Kalbe Farma'),
('MD003', 'Cetirizine 10mg', 'Tablet', 'strip', 45, 1200, 2000, 20, '2026-03-10', 'Sanbe Farma'),
('MD004', 'Vitamin C 1000mg', 'Tablet', 'tube', 60, 5000, 8000, 15, '2027-01-20', 'Kalbe Farma'),
('MD005', 'OBH Combi 100ml', 'Sirup', 'botol', 25, 7000, 11000, 10, '2025-09-01', 'Indofarma'),
('MD006', 'Loperamide 2mg', 'Tablet', 'strip', 6, 1500, 2500, 15, '2026-11-30', 'Kimia Farma'),
('MD007', 'Ibuprofen 400mg', 'Tablet', 'strip', 80, 2000, 3500, 20, '2026-07-18', 'Sanbe Farma'),
('MD008', 'Antasida Doen 100ml', 'Sirup', 'botol', 15, 6000, 9500, 10, '2025-08-05', 'Indofarma'),
('MD009', 'Ranitidine 150mg', 'Tablet', 'strip', 50, 1800, 3000, 20, '2026-12-01', 'Kalbe Farma'),
('MD010', 'Bisoprolol 5mg', 'Tablet', 'strip', 40, 2200, 3800, 15, '2026-06-15', 'Kimia Farma'),
('MD011', 'Salbutamol 2mg', 'Tablet', 'strip', 30, 1600, 2800, 15, '2026-04-20', 'Sanbe Farma'),
('MD012', 'CTM 4mg', 'Tablet', 'strip', 90, 500, 1000, 20, '2027-03-01', 'Kimia Farma'),
('MD013', 'Mefenamic Acid 500mg', 'Tablet', 'strip', 70, 1900, 3200, 20, '2026-10-10', 'Kalbe Farma'),
('MD014', 'Omeprazole 20mg', 'Kapsul', 'strip', 35, 3000, 5000, 15, '2026-09-25', 'Sanbe Farma'),
('MD015', 'Metformin 500mg', 'Tablet', 'strip', 55, 1700, 2900, 20, '2027-02-14', 'Kalbe Farma'),
('MD016', 'Amlodipine 5mg', 'Tablet', 'strip', 42, 2100, 3600, 15, '2026-08-08', 'Kimia Farma'),
('MD017', 'Cough Syrup 60ml', 'Sirup', 'botol', 18, 5500, 9000, 10, '2025-07-28', 'Indofarma'),
('MD018', 'B-complex Tablet', 'Tablet', 'strip', 100, 900, 1800, 20, '2027-05-01', 'Kimia Farma'),
('MD019', 'Ketoprofen 50mg', 'Kapsul', 'strip', 22, 2400, 4000, 15, '2026-02-18', 'Sanbe Farma'),
('MD020', 'Entrostop Tablet', 'Tablet', 'strip', 38, 2600, 4200, 15, '2026-12-30', 'Kalbe Farma')
ON CONFLICT (code) DO NOTHING;

-- Seed a few expenses so the dashboard is not empty
INSERT INTO expenses (category, description, amount) VALUES
('Operasional', 'Listrik & air bulanan', 750000),
('Gaji', 'Gaji staf apotek', 3500000),
('Pembelian', 'Restock obat minggu ini', 1200000)
ON CONFLICT DO NOTHING;
