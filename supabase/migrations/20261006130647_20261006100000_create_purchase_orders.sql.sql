/*
# Purchase Order Management — Suppliers, POs, and PO Items

1. New Tables
- `suppliers` — master data for medicine suppliers/distributors
  - id, name, contact_person, phone, email, address, notes, created_at
- `purchase_orders` — header for each PO sent to a supplier
  - id, po_no, supplier_id (FK), status (draft/sent/received/partial/cancelled),
    order_date, expected_date, received_date, total_cost, notes, created_at, updated_at
- `po_items` — line items belonging to a purchase order
  - id, po_id (FK), medicine_id (FK, nullable), medicine_name, quantity, unit_cost, subtotal

2. Security
- All tables: RLS enabled, 4 CRUD policies each for anon+authenticated (app uses anon key, no per-user isolation for operational data).
*/

-- ── Suppliers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_suppliers_select" ON suppliers;
CREATE POLICY "po_suppliers_select" ON suppliers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "po_suppliers_insert" ON suppliers;
CREATE POLICY "po_suppliers_insert" ON suppliers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "po_suppliers_update" ON suppliers;
CREATE POLICY "po_suppliers_update" ON suppliers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "po_suppliers_delete" ON suppliers;
CREATE POLICY "po_suppliers_delete" ON suppliers FOR DELETE TO anon, authenticated USING (true);

-- ── Purchase Orders ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_no text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  received_date date,
  total_cost numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_select" ON purchase_orders;
CREATE POLICY "po_select" ON purchase_orders FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "po_insert" ON purchase_orders;
CREATE POLICY "po_insert" ON purchase_orders FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "po_update" ON purchase_orders;
CREATE POLICY "po_update" ON purchase_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "po_delete" ON purchase_orders;
CREATE POLICY "po_delete" ON purchase_orders FOR DELETE TO anon, authenticated USING (true);

-- ── PO Items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS po_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES medicines(id) ON DELETE SET NULL,
  medicine_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  received_qty integer NOT NULL DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL DEFAULT 0
);

ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_items_select" ON po_items;
CREATE POLICY "po_items_select" ON po_items FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "po_items_insert" ON po_items;
CREATE POLICY "po_items_insert" ON po_items FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "po_items_update" ON po_items;
CREATE POLICY "po_items_update" ON po_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "po_items_delete" ON po_items;
CREATE POLICY "po_items_delete" ON po_items FOR DELETE TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_medicine ON po_items(medicine_id);
