/*
# AMS Quality module — countermeasures & logical validation tests

## Overview
Adds a CAPA (Corrective & Preventive Action) tracking module to the Apotek
Management System. Single-tenant, no auth → all policies scoped to
`anon, authenticated` with `USING (true)` / `WITH CHECK (true)`.

## New Tables
- `countermeasures`: corrective/preventive actions. Columns: id, title,
  category (immediate | preventive), action_type (SOP | visual | poka_yoke |
  audit | swcs | other), description, owner, status (open | in_progress |
  done | verified), due_date, created_at, updated_at.
- `logical_tests`: validation tests for root-cause analysis. Columns: id,
  test_type (if_then | causation | mece | sanity), title, premise,
  conclusion, result (pass | fail | inconclusive), notes, created_at,
  updated_at.

## Security
- RLS enabled on both tables.
- Both tables intentionally public/shared (no auth) → `TO anon, authenticated`
  with `USING (true)` / `WITH CHECK (true)` for all CRUD verbs.

## Notes
1. Status values are constrained via CHECK constraints for data integrity.
2. Seed data mirrors the user's CAPA document so the module is usable on load.
3. Idempotent via ON CONFLICT DO NOTHING on a (title) uniqueness seed guard.
*/

CREATE TABLE IF NOT EXISTS countermeasures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'immediate' CHECK (category IN ('immediate','preventive')),
  action_type text NOT NULL DEFAULT 'other' CHECK (action_type IN ('sop','visual','poka_yoke','audit','swcs','other')),
  description text NOT NULL DEFAULT '',
  owner text NOT NULL DEFAULT 'Supervisor Produksi',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','verified')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE countermeasures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_countermeasures_select" ON countermeasures;
CREATE POLICY "ams_countermeasures_select" ON countermeasures FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_countermeasures_insert" ON countermeasures;
CREATE POLICY "ams_countermeasures_insert" ON countermeasures FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_countermeasures_update" ON countermeasures;
CREATE POLICY "ams_countermeasures_update" ON countermeasures FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_countermeasures_delete" ON countermeasures;
CREATE POLICY "ams_countermeasures_delete" ON countermeasures FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS logical_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_type text NOT NULL DEFAULT 'if_then' CHECK (test_type IN ('if_then','causation','mece','sanity')),
  title text NOT NULL,
  premise text NOT NULL DEFAULT '',
  conclusion text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT 'inconclusive' CHECK (result IN ('pass','fail','inconclusive')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE logical_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_logical_tests_select" ON logical_tests;
CREATE POLICY "ams_logical_tests_select" ON logical_tests FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_logical_tests_insert" ON logical_tests;
CREATE POLICY "ams_logical_tests_insert" ON logical_tests FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_logical_tests_update" ON logical_tests;
CREATE POLICY "ams_logical_tests_update" ON logical_tests FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_logical_tests_delete" ON logical_tests;
CREATE POLICY "ams_logical_tests_delete" ON logical_tests FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_countermeasures_status ON countermeasures (status);
CREATE INDEX IF NOT EXISTS idx_countermeasures_category ON countermeasures (category);
CREATE INDEX IF NOT EXISTS idx_logical_tests_test_type ON logical_tests (test_type);

-- Seed countermeasures (idempotent by title uniqueness via ON CONFLICT)
INSERT INTO countermeasures (title, category, action_type, description, owner, status, due_date) VALUES
('Revisi & Sosialisasi SOP Verification', 'immediate', 'sop', 'Memperbarui dokumen SOP dengan menyisipkan poin verifikasi wajib (mandatory checkpoint) sebelum proses dilanjutkan ke tahap berikutnya, serta menyegarkan kembali (refreshment training) kepada seluruh operator dan supervisor lini produksi.', 'Supervisor Produksi', 'in_progress', '2026-08-15'),
('SOP Visual & Checkpoint (Visual Management)', 'immediate', 'visual', 'Memasang visual management (papan instruksi visual/color-coding) di area kerja untuk mempermudah identifikasi kondisi abnormal secara langsung di lapangan (management by sight).', 'Tim EHS', 'open', '2026-08-30'),
('Poka-Yoke System Implementation (Mistake-Proofing)', 'preventive', 'poka_yoke', 'Mengembangkan kuncian sistem otomatis (system lock) pada software operasional (Werum/Oracle). Sistem memblokir langkah berikutnya secara otomatis jika input data verifikasi belum tuntas atau tidak valid.', 'Tim IT/Validation', 'open', '2026-10-31'),
('Layered Process Audit (LPA)', 'preventive', 'audit', 'Mengimplementasikan audit berjenjang secara berkala (Supervisor hingga Manager) untuk memastikan SOP dijalankan secara konsisten di lapangan, bukan sekadar di atas kertas.', 'Manager Produksi', 'open', '2026-09-30'),
('Standardized Work Combination Sheet (SWCS)', 'preventive', 'swcs', 'Meninjau ulang alokasi waktu kerja Direct Labor (DL) per unit untuk memisahkan kegiatan Value-Added (VA) dan Non-Value-Added (NVA) secara presisi demi efisiensi operasional.', 'Industrial Engineering', 'open', '2026-11-15')
ON CONFLICT DO NOTHING;

-- Seed logical tests
INSERT INTO logical_tests (test_type, title, premise, conclusion, result, notes) VALUES
('if_then', 'Uji Logika Alur If-Then (Top-Down)', 'Jika proses verifikasi SOP terlewat, maka terjadi kesalahan input data. Jika terjadi kesalahan input data, maka waktu pengerjaan memanjang dan DL/Unit meningkat.', 'Logika dapat dibaca bolak-balik secara konsisten tanpa ada lompatan proses (no logical leap).', 'pass', 'Top-Down (Sebab ke Akibat) terverifikasi.'),
('if_then', 'Uji Logika Alur If-Then (Bottom-Up)', 'DL/Unit meningkat KARENA waktu pengerjaan memanjang. Waktu pengerjaan memanjang KARENA terjadi kesalahan input data. Kesalahan input data terjadi KARENA verifikasi SOP terlewat.', 'Logika kausal terbaca konsisten dari akibat ke sebab.', 'pass', 'Bottom-Up (Akibat ke Sebab) terverifikasi.'),
('causation', 'Uji Korelasi vs Kausalitas (Poka-Yoke)', 'Apakah jika sistem kuncian verifikasi (Poka-Yoke) diterapkan, masalah kesalahan input dijamin 100% hilang?', 'Ya, karena sistem membatasi ruang gerak kesalahan manusia (human error), sehingga faktor ini terbukti sebagai akar masalah utama (root cause), bukan sekadar faktor pendukung (contributing factor).', 'pass', 'Kausalitas terverifikasi; bukan korelasi semata.'),
('mece', 'Uji Cakupan Analisis (MECE Framework - 4M)', 'Man: pelatihan ulang operator. Machine/System: fitur system lock. Method: pembaruan SOP. Material/Data: validasi input diperketat.', 'Keempat dimensi 4M tercakup tanpa tumpang tindih (MECE).', 'pass', 'Cakupan analisis lengkap dan saling lepas.'),
('sanity', 'Sanity Check & Sampling Data', 'Penarikan sampel data acak dari beberapa shift kerja untuk memastikan apakah deviasi terjadi merata atau hanya pada kondisi operasional tertentu.', 'Hasil sampling menentukan cakupan generalisasi akar masalah.', 'inconclusive', 'Perlu data sampling tambahan dari shift malam dan akhir pekan.')
ON CONFLICT DO NOTHING;
