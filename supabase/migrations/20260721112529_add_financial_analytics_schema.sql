/*
# AMS Financial Analytics — cost variances & cash flow projections

## Overview
Adds two tables for the AI CFO Agent: cost variance tracking (standard vs
actual unit cost per item, with generated variance amount/percentage) and
cash flow projections (pending accounts payable / receivable with status).

## New Tables
- `cost_variances`: per-item cost variance rows. Columns: id, item_id (FK →
  inventory_items, cascade), standard_unit_cost, actual_unit_cost,
  variance_amount (generated stored), variance_percentage (generated
  stored), effective_date, created_at.
- `cash_flow_projections`: pending inflow/outflow rows. Columns: id,
  transaction_type (CHECK INFLOW/OUTFLOW), description, amount, due_date,
  status (PENDING/COMPLETED/OVERDUE), created_at.

## Security
- RLS enabled on both new tables.
- Single-tenant, no auth → `TO anon, authenticated` with `USING (true)` /
  `WITH CHECK (true)` for all CRUD verbs.

## Notes
1. Generated columns compute variance_amount and variance_percentage
   automatically from standard vs actual unit cost.
2. Seed data mirrors the component's SAMPLE_FINANCIAL_DATA so the CFO
   dashboard is populated on first load (2 cost variances + 4 cash flow
   rows matching the sample).
3. Re-apply of same logical migration with DELETE policy typo fixed
   (cost_varances → cost_variances).
*/

-- 1. Cost variances
CREATE TABLE IF NOT EXISTS cost_variances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    standard_unit_cost DECIMAL(12, 2) NOT NULL,
    actual_unit_cost DECIMAL(12, 2) NOT NULL,
    variance_amount DECIMAL(12, 2) GENERATED ALWAYS AS (actual_unit_cost - standard_unit_cost) STORED,
    variance_percentage DECIMAL(5, 2) GENERATED ALWAYS AS (((actual_unit_cost - standard_unit_cost) / standard_unit_cost) * 100) STORED,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cost_variances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_cost_variances_select" ON cost_variances;
CREATE POLICY "ams_cost_variances_select" ON cost_variances FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_cost_variances_insert" ON cost_variances;
CREATE POLICY "ams_cost_variances_insert" ON cost_variances FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_cost_variances_update" ON cost_variances;
CREATE POLICY "ams_cost_variances_update" ON cost_variances FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_cost_variances_delete" ON cost_variances;
CREATE POLICY "ams_cost_variances_delete" ON cost_variances FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_cost_variances_item_id ON cost_variances (item_id);
CREATE INDEX IF NOT EXISTS idx_cost_variances_effective_date ON cost_variances (effective_date);

-- 2. Cash flow projections
CREATE TABLE IF NOT EXISTS cash_flow_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type VARCHAR(10) CHECK (transaction_type IN ('INFLOW', 'OUTFLOW')),
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cash_flow_projections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_cash_flow_projections_select" ON cash_flow_projections;
CREATE POLICY "ams_cash_flow_projections_select" ON cash_flow_projections FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_cash_flow_projections_insert" ON cash_flow_projections;
CREATE POLICY "ams_cash_flow_projections_insert" ON cash_flow_projections FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_cash_flow_projections_update" ON cash_flow_projections;
CREATE POLICY "ams_cash_flow_projections_update" ON cash_flow_projections FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_cash_flow_projections_delete" ON cash_flow_projections;
CREATE POLICY "ams_cash_flow_projections_delete" ON cash_flow_projections FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_cash_flow_projections_due_date ON cash_flow_projections (due_date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_projections_status ON cash_flow_projections (status);

-- Seed cost variances for RM-PHARM-01 and RM-SOLV-09
INSERT INTO cost_variances (item_id, standard_unit_cost, actual_unit_cost, effective_date)
SELECT i.id, 135000, 150000, CURRENT_DATE FROM inventory_items i WHERE i.sku = 'RM-PHARM-01'
ON CONFLICT DO NOTHING;
INSERT INTO cost_variances (item_id, standard_unit_cost, actual_unit_cost, effective_date)
SELECT i.id, 80000, 85000, CURRENT_DATE FROM inventory_items i WHERE i.sku = 'RM-SOLV-09'
ON CONFLICT DO NOTHING;

-- Seed cash flow projections (pending inflows & outflows)
INSERT INTO cash_flow_projections (transaction_type, description, amount, due_date, status)
VALUES
  ('INFLOW',  'Tagihan PT Farmasi Utama',           180000000, (CURRENT_DATE + INTERVAL '20 days')::date, 'PENDING'),
  ('INFLOW',  'Penjualan Batch 4 Line 2',           95000000,  (CURRENT_DATE + INTERVAL '35 days')::date, 'PENDING'),
  ('OUTFLOW', 'PO Bahan Baku Solvent',               130000000, (CURRENT_DATE + INTERVAL '15 days')::date, 'PENDING'),
  ('OUTFLOW', 'Gaji Direct Labor & Operasional',    120000000, (CURRENT_DATE + INTERVAL '38 days')::date, 'PENDING')
ON CONFLICT DO NOTHING;
