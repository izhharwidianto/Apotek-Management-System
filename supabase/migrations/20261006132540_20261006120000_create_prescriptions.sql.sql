/*
# Prescription Management — Resep Dokter

1. New Tables
- `prescriptions` — header for each prescription received
  - id, rx_no (unique nomor resep), patient_name, patient_age, patient_gender,
    doctor_name, doctor_sip (Surat Izin Praktik),
    is_racikan (boolean, apakah racikan),
    racikan_text (text, detail racikan jika ada),
    sale_id (FK nullable, link ke transaksi penjualan jika sudah dijual),
    status (pending/dispensed/cancelled),
    received_date, dispensed_date (nullable),
    notes text, created_at

2. Security
- RLS enabled, 4 CRUD policies for anon+authenticated.
*/

CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rx_no text UNIQUE NOT NULL,
  patient_name text NOT NULL,
  patient_age integer,
  patient_gender text,
  doctor_name text,
  doctor_sip text,
  is_racikan boolean NOT NULL DEFAULT false,
  racikan_text text,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  dispensed_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presc_select" ON prescriptions;
CREATE POLICY "presc_select" ON prescriptions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "presc_insert" ON prescriptions;
CREATE POLICY "presc_insert" ON prescriptions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "presc_update" ON prescriptions;
CREATE POLICY "presc_update" ON prescriptions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "presc_delete" ON prescriptions;
CREATE POLICY "presc_delete" ON prescriptions FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_presc_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_presc_sale ON prescriptions(sale_id);
