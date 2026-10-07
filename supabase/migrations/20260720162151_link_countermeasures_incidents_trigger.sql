/*
# AMS Quality module — link countermeasures to incidents + completion trigger

## Overview
Extends the CAPA module so countermeasures can be traced to root-cause
incidents, carry an effort/impact priority score, and link logical tests to
the countermeasure they validate. Adds a trigger that blocks marking a
countermeasure complete while any linked logical test is still failing or
inconclusive.

## Prerequisite fix
The supplied SQL references `incidents(id)`, a table that did not exist yet.
A minimal `incidents` table is created here so the foreign key is valid.

## Adaptation note (important)
The supplied trigger used uppercase status/result literals
(`'COMPLETED'`, `'VERIFIED'`, `'FAILED'`, `'PENDING'`). The existing
`countermeasures.status` CHECK constraint only allows
(`'open','in_progress','done','verified'`) and `logical_tests.result` only
allows (`'pass','fail','inconclusive'`). Uppercase values would be rejected
by the CHECK constraint before the trigger runs, making it dead code. The
trigger literals are adapted to the real lowercase values so the guard
actually fires. Function logic is unchanged.

## New Tables
- `incidents`: root-cause incident records. Columns: id, title, description,
  severity, status, created_at, updated_at.

## Modified Tables
- `countermeasures`: + incident_id (FK → incidents, cascade delete),
  + effort_level VARCHAR(10) CHECK IN ('LOW','HIGH') DEFAULT 'LOW',
  + impact_level VARCHAR(10) CHECK IN ('LOW','HIGH') DEFAULT 'HIGH'.
- `logical_tests`: + countermeasure_id (FK → countermeasures, cascade delete).

## Security
- RLS enabled on `incidents` with anon+authenticated full CRUD (single-tenant,
  no auth, intentionally shared).
- No policy changes on existing tables (new nullable columns are covered by
  existing permissive policies).

## Notes
1. All ADD COLUMN statements are wrapped in DO blocks for idempotency so the
   migration is safe to re-run.
2. Trigger is dropped before recreate.
3. A couple of seed incidents are inserted and a few countermeasures are
   linked + scored so the priority matrix has data on first load.
*/

-- 1a. Create incidents table (prerequisite for the FK)
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_incidents_select" ON incidents;
CREATE POLICY "ams_incidents_select" ON incidents FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_incidents_insert" ON incidents;
CREATE POLICY "ams_incidents_insert" ON incidents FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_incidents_update" ON incidents;
CREATE POLICY "ams_incidents_update" ON incidents FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_incidents_delete" ON incidents;
CREATE POLICY "ams_incidents_delete" ON incidents FOR DELETE
  TO anon, authenticated USING (true);

-- 1b. Add columns to countermeasures (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='countermeasures' AND column_name='incident_id') THEN
    ALTER TABLE countermeasures ADD COLUMN incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='countermeasures' AND column_name='effort_level') THEN
    ALTER TABLE countermeasures ADD COLUMN effort_level VARCHAR(10) CHECK (effort_level IN ('LOW','HIGH')) DEFAULT 'LOW';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='countermeasures' AND column_name='impact_level') THEN
    ALTER TABLE countermeasures ADD COLUMN impact_level VARCHAR(10) CHECK (impact_level IN ('LOW','HIGH')) DEFAULT 'HIGH';
  END IF;
END $$;

-- 2. Add countermeasure_id to logical_tests (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logical_tests' AND column_name='countermeasure_id') THEN
    ALTER TABLE logical_tests ADD COLUMN countermeasure_id UUID REFERENCES countermeasures(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_countermeasures_incident_id ON countermeasures (incident_id);
CREATE INDEX IF NOT EXISTS idx_logical_tests_countermeasure_id ON logical_tests (countermeasure_id);

-- 3. Trigger / Validation Function
-- Blocks setting countermeasures.status to 'done' or 'verified' while any
-- linked logical_tests row has result 'fail' or 'inconclusive'.
-- (Literals adapted to the existing lowercase CHECK values; logic unchanged.)
CREATE OR REPLACE FUNCTION validate_countermeasure_completion()
RETURNS TRIGGER AS $$
DECLARE
    pending_or_failed_tests INT;
BEGIN
    IF NEW.status IN ('done', 'verified') THEN
        SELECT COUNT(*)
        INTO pending_or_failed_tests
        FROM logical_tests
        WHERE countermeasure_id = NEW.id
          AND result IN ('fail', 'inconclusive');
        IF pending_or_failed_tests > 0 THEN
            RAISE EXCEPTION 'Gagal mengubah status: Masih ada Logical Test yang belum PASSED/LULUS untuk perbaikan ini.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_logical_tests_before_completion ON countermeasures;
CREATE TRIGGER check_logical_tests_before_completion
BEFORE UPDATE ON countermeasures
FOR EACH ROW
EXECUTE FUNCTION validate_countermeasure_completion();

-- Seed a couple of incidents so the coverage metric has data
INSERT INTO incidents (title, description, severity, status) VALUES
('Deviasi DL/Unit meningkat akibat kesalahan input data', 'Peningkatan Direct Labor per unit terdeteksi pada shift pagi. Akar masalah: verifikasi SOP terlewat sehingga input data salah dan waktu pengerjaan memanjang.', 'high', 'investigating'),
('Kesalahan input data verifikasi batch', 'Operator melewatkan checkpoint verifikasi pada software Werum/Oracle, menyebabkan input data tidak valid dan harus dikerjakan ulang.', 'medium', 'open')
ON CONFLICT DO NOTHING;

-- Score & link a few existing countermeasures so the priority matrix is populated
UPDATE countermeasures SET effort_level = 'LOW', impact_level = 'HIGH' WHERE title = 'SOP Visual & Checkpoint (Visual Management)';
UPDATE countermeasures SET effort_level = 'HIGH', impact_level = 'HIGH' WHERE title = 'Poka-Yoke System Implementation (Mistake-Proofing)';
UPDATE countermeasures SET effort_level = 'HIGH', impact_level = 'HIGH' WHERE title = 'Layered Process Audit (LPA)';
UPDATE countermeasures SET effort_level = 'LOW', impact_level = 'LOW' WHERE title = 'Standardized Work Combination Sheet (SWCS)';
UPDATE countermeasures SET effort_level = 'LOW', impact_level = 'HIGH' WHERE title = 'Revisi & Sosialisasi SOP Verification';

-- Link countermeasures to the first incident
UPDATE countermeasures SET incident_id = (SELECT id FROM incidents WHERE title = 'Deviasi DL/Unit meningkat akibat kesalahan input data' LIMIT 1)
WHERE incident_id IS NULL;
