/*
# AMS Demand Forecasting — consumption history, forecasts & BOM

## Overview
Adds three tables to support AI demand forecasting: consumption history
(time-series demand), demand forecasts (30/60/90-day projections with
confidence and trend), and a bill of materials (BOM) linking finished
products to raw-material inventory items.

## New Tables
- `inventory_consumption_history`: demand history per item per period.
- `demand_forecasts`: AI forecast results per item (30/60/90 days, trend,
  confidence, scenario notes).
- `bill_of_materials`: BOM rows linking finished product SKU to raw
  material inventory items.

## Security
- RLS enabled on all three new tables.
- Single-tenant, no auth → `TO anon, authenticated` with `USING (true)` /
  `WITH CHECK (true)` for all CRUD verbs.

## Notes
1. All CREATE TABLE use IF NOT EXISTS for idempotency.
2. Seed consumption history (5 monthly periods) for the 4 existing
   inventory_items using jsonb_array_elements_text.
3. Seed BOM rows linking a finished product SKU to raw materials.
4. Re-apply of same logical migration with fixed seed PL/pgSQL block.
*/

-- 1. Consumption history
CREATE TABLE IF NOT EXISTS inventory_consumption_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    period_date DATE NOT NULL,
    qty_consumed INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE inventory_consumption_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_consumption_history_select" ON inventory_consumption_history;
CREATE POLICY "ams_consumption_history_select" ON inventory_consumption_history FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_consumption_history_insert" ON inventory_consumption_history;
CREATE POLICY "ams_consumption_history_insert" ON inventory_consumption_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_consumption_history_update" ON inventory_consumption_history;
CREATE POLICY "ams_consumption_history_update" ON inventory_consumption_history FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_consumption_history_delete" ON inventory_consumption_history;
CREATE POLICY "ams_consumption_history_delete" ON inventory_consumption_history FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_consumption_history_item_id ON inventory_consumption_history (item_id);
CREATE INDEX IF NOT EXISTS idx_consumption_history_period ON inventory_consumption_history (period_date);

-- 2. Demand forecasts
CREATE TABLE IF NOT EXISTS demand_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    forecast_30_days INT NOT NULL,
    forecast_60_days INT NOT NULL,
    forecast_90_days INT NOT NULL,
    growth_trend_percentage DECIMAL(5, 2) DEFAULT 0,
    confidence_score DECIMAL(3, 2) DEFAULT 0.85,
    ai_scenario_notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_demand_forecasts_select" ON demand_forecasts;
CREATE POLICY "ams_demand_forecasts_select" ON demand_forecasts FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_demand_forecasts_insert" ON demand_forecasts;
CREATE POLICY "ams_demand_forecasts_insert" ON demand_forecasts FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_demand_forecasts_update" ON demand_forecasts;
CREATE POLICY "ams_demand_forecasts_update" ON demand_forecasts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_demand_forecasts_delete" ON demand_forecasts;
CREATE POLICY "ams_demand_forecasts_delete" ON demand_forecasts FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_demand_forecasts_item_id ON demand_forecasts (item_id);

-- 3. Bill of Materials
CREATE TABLE IF NOT EXISTS bill_of_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_product_sku VARCHAR(50) NOT NULL,
    raw_material_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    qty_required_per_unit DECIMAL(10, 4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_bill_of_materials_select" ON bill_of_materials;
CREATE POLICY "ams_bill_of_materials_select" ON bill_of_materials FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_bill_of_materials_insert" ON bill_of_materials;
CREATE POLICY "ams_bill_of_materials_insert" ON bill_of_materials FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_bill_of_materials_update" ON bill_of_materials;
CREATE POLICY "ams_bill_of_materials_update" ON bill_of_materials FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_bill_of_materials_delete" ON bill_of_materials;
CREATE POLICY "ams_bill_of_materials_delete" ON bill_of_materials FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_bill_of_materials_parent_sku ON bill_of_materials (parent_product_sku);
CREATE INDEX IF NOT EXISTS idx_bill_of_materials_raw_material ON bill_of_materials (raw_material_item_id);

-- Seed consumption history (5 monthly periods) for the 4 existing items.
-- Builds the array from jsonb_array_elements_text to avoid jsonb→int[] cast.
DO $$
DECLARE
  i RECORD;
  periods DATE[] := ARRAY[
    (date_trunc('month', NOW() - INTERVAL '4 months'))::date,
    (date_trunc('month', NOW() - INTERVAL '3 months'))::date,
    (date_trunc('month', NOW() - INTERVAL '2 months'))::date,
    (date_trunc('month', NOW() - INTERVAL '1 month'))::date,
    (date_trunc('month', NOW()))::date
  ];
  usage_map JSONB := '{
    "RM-PHARM-01": [100, 110, 115, 130, 140],
    "PK-BOT-250": [1000, 1200, 1100, 1300, 1450],
    "LBL-LINE2-B": [1200, 1250, 1300, 1400, 1500],
    "RM-SOLV-09": [300, 280, 310, 290, 320]
  }';
  qty_arr INT[];
  q text;
  idx INT := 1;
BEGIN
  FOR i IN SELECT sku, id FROM inventory_items WHERE sku IN ('RM-PHARM-01','PK-BOT-250','LBL-LINE2-B','RM-SOLV-09') LOOP
    idx := 1;
    FOR q IN SELECT jsonb_array_elements_text(usage_map->i.sku) LOOP
      qty_arr[idx] := q::int;
      idx := idx + 1;
    END LOOP;
    FOR idx IN 1..array_length(qty_arr, 1) LOOP
      INSERT INTO inventory_consumption_history (item_id, period_date, qty_consumed)
      VALUES (i.id, periods[idx], qty_arr[idx])
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Seed BOM rows linking finished product SKU to raw materials
INSERT INTO bill_of_materials (parent_product_sku, raw_material_item_id, qty_required_per_unit)
SELECT 'OBAT-A', i.id, 0.05 FROM inventory_items i WHERE i.sku = 'RM-PHARM-01'
ON CONFLICT DO NOTHING;

INSERT INTO bill_of_materials (parent_product_sku, raw_material_item_id, qty_required_per_unit)
SELECT 'OBAT-A', i.id, 1.0 FROM inventory_items i WHERE i.sku = 'PK-BOT-250'
ON CONFLICT DO NOTHING;
