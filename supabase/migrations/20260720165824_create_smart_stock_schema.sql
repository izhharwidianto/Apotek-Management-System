/*
# AMS Smart Stock — inventory items, AI insights & stock-health view

## Overview
Adds an AI-driven inventory module: a master item table with lead time and
average daily usage, an AI insights table for dynamic ROP/safety-stock
recommendations, and a `v_stock_health` view that computes dynamic reorder
points, safety stock, holding value, and stock status (CRITICAL_REORDER /
DEAD_STOCK / OPTIMAL).

## New Tables
- `inventory_items`: master inventory rows. Columns: id, sku (unique), name,
  category, unit, current_stock, unit_cost, lead_time_days,
  avg_daily_usage, last_movement_date, created_at.
- `inventory_ai_insights`: AI-generated recommendations per item. Columns:
  id, item_id (FK → inventory_items, cascade), calculated_rop,
  calculated_safety_stock, is_dead_stock, dead_stock_value,
  ai_recommendation, updated_at.

## New Views
- `v_stock_health`: read-only view computing estimated_safety_stock,
  dynamic_rop, total_holding_value, and stock_status per item.

## Security
- RLS enabled on both new tables.
- Single-tenant, no auth → `TO anon, authenticated` with `USING (true)` /
  `WITH CHECK (true)` for all CRUD verbs (data intentionally shared).

## Notes
1. The view is created with `OR REPLACE` for idempotency.
2. Seed data mirrors the component's INITIAL_ITEMS so the dashboard is
   populated on first load.
3. `last_movement_date` is seeded relative to now() to produce realistic
   daysUnmoved values (including >60d dead stock).
*/

-- 1. Master inventory items
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(20) DEFAULT 'pcs',
    current_stock INT NOT NULL DEFAULT 0,
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
    lead_time_days INT NOT NULL DEFAULT 7,
    avg_daily_usage DECIMAL(10, 2) DEFAULT 0,
    last_movement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_inventory_items_select" ON inventory_items;
CREATE POLICY "ams_inventory_items_select" ON inventory_items FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_inventory_items_insert" ON inventory_items;
CREATE POLICY "ams_inventory_items_insert" ON inventory_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_inventory_items_update" ON inventory_items;
CREATE POLICY "ams_inventory_items_update" ON inventory_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_inventory_items_delete" ON inventory_items;
CREATE POLICY "ams_inventory_items_delete" ON inventory_items FOR DELETE
  TO anon, authenticated USING (true);

-- 2. AI insights
CREATE TABLE IF NOT EXISTS inventory_ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    calculated_rop INT NOT NULL,
    calculated_safety_stock INT NOT NULL,
    is_dead_stock BOOLEAN DEFAULT FALSE,
    dead_stock_value DECIMAL(12, 2) DEFAULT 0,
    ai_recommendation TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE inventory_ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_inventory_ai_insights_select" ON inventory_ai_insights;
CREATE POLICY "ams_inventory_ai_insights_select" ON inventory_ai_insights FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ams_inventory_ai_insights_insert" ON inventory_ai_insights;
CREATE POLICY "ams_inventory_ai_insights_insert" ON inventory_ai_insights FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ams_inventory_ai_insights_update" ON inventory_ai_insights;
CREATE POLICY "ams_inventory_ai_insights_update" ON inventory_ai_insights FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ams_inventory_ai_insights_delete" ON inventory_ai_insights;
CREATE POLICY "ams_inventory_ai_insights_delete" ON inventory_ai_insights FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_inventory_ai_insights_item_id ON inventory_ai_insights (item_id);

-- 3. Stock health view
CREATE OR REPLACE VIEW v_stock_health AS
SELECT
    i.id,
    i.sku,
    i.name,
    i.category,
    i.current_stock,
    i.unit_cost,
    (i.current_stock * i.unit_cost) AS total_holding_value,
    i.lead_time_days,
    i.avg_daily_usage,
    ROUND(i.avg_daily_usage * i.lead_time_days * 0.5) AS estimated_safety_stock,
    ROUND((i.avg_daily_usage * i.lead_time_days) + (i.avg_daily_usage * i.lead_time_days * 0.5)) AS dynamic_rop,
    CASE
        WHEN i.current_stock <= ROUND((i.avg_daily_usage * i.lead_time_days) + (i.avg_daily_usage * i.lead_time_days * 0.5)) THEN 'CRITICAL_REORDER'
        WHEN i.last_movement_date < NOW() - INTERVAL '60 days' THEN 'DEAD_STOCK'
        ELSE 'OPTIMAL'
    END AS stock_status
FROM inventory_items i;

-- Seed data (idempotent via ON CONFLICT on sku)
INSERT INTO inventory_items (sku, name, category, unit, current_stock, unit_cost, lead_time_days, avg_daily_usage, last_movement_date) VALUES
('RM-PHARM-01', 'Bahan Baku Active A', 'Raw Material', 'kg', 120, 150000, 10, 15, NOW() - INTERVAL '5 days'),
('PK-BOT-250', 'Botol HDPE 250ml', 'Packaging', 'pcs', 80, 3500, 7, 50, NOW() - INTERVAL '75 days'),
('LBL-LINE2-B', 'Label Cetak Line 2', 'Label', 'pcs', 200, 1200, 5, 100, NOW() - INTERVAL '12 days'),
('RM-SOLV-09', 'Pelarut Grade B', 'Raw Material', 'L', 500, 85000, 14, 10, NOW() - INTERVAL '90 days')
ON CONFLICT (sku) DO NOTHING;
