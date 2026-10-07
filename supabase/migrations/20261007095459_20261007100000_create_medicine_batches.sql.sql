/*
# Tracking Batch/Lot Obat

1. New Tables
- `medicine_batches` — pelacakan batch/lot per obat
  - id, medicine_id (FK ke medicines),
    batch_no (text, nomor batch dari pabrik),
    quantity (integer, stok di batch ini),
    received_date (date, tanggal masuk),
    expiry_date (date, tanggal kadaluarsa batch),
    manufacturer (text, nama pabrik farmasi),
    status (active/recalled/expired/depleted),
    notes text, created_at, updated_at

  Satu obat bisa punya multiple batch dengan tanggal kadaluarsa berbeda.
  Stok total di medicines tetap menjadi aggregate, tapi per batch dilacak terpisah.
  Penting untuk recall BPOM — bisa tahu batch mana yang harus ditarik.

2. Security
- RLS enabled, 4 CRUD policies for anon+authenticated (single-tenant app).
*/

CREATE TABLE IF NOT EXISTS medicine_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  batch_no text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  received_date date DEFAULT CURRENT_DATE,
  expiry_date date,
  manufacturer text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE medicine_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mb_select" ON medicine_batches;
CREATE POLICY "mb_select" ON medicine_batches FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "mb_insert" ON medicine_batches;
CREATE POLICY "mb_insert" ON medicine_batches FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "mb_update" ON medicine_batches;
CREATE POLICY "mb_update" ON medicine_batches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "mb_delete" ON medicine_batches;
CREATE POLICY "mb_delete" ON medicine_batches FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_mb_medicine ON medicine_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_mb_batch ON medicine_batches(batch_no);
CREATE INDEX IF NOT EXISTS idx_mb_status ON medicine_batches(status);
CREATE INDEX IF NOT EXISTS idx_mb_expiry ON medicine_batches(expiry_date);
