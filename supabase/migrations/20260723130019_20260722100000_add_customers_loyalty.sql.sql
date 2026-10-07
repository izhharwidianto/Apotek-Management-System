/*
# Add customers table + loyalty tracking + customer_id on sales

1. New Tables
- `customers`
  - id (uuid PK)
  - name (text, not null)
  - phone (text, unique, nullable — for contact/loyalty lookup)
  - email (text, nullable)
  - address (text, nullable)
  - loyalty_points (integer, default 0 — running tally of qualifying transactions)
  - total_visits (integer, default 0 — count of all transactions)
  - total_spent (numeric, default 0 — cumulative spend)
  - created_at, updated_at (timestamps)

2. Modified Tables
- `sales`
  - Add `customer_id` (uuid, nullable, FK to customers)
  - Existing `customer_name` stays as fallback/free-text

3. Security
- RLS enabled on `customers` with anon+authenticated full CRUD (single-tenant app pattern, matching `sales` policies)
- `sales` already has RLS; the new column inherits existing policies automatically

4. Notes
- Loyalty threshold: 7 transactions with minimum Rp 20.000 each → eligible for reward
- `loyalty_points` increments only for qualifying transactions (total >= 20000)
- `total_visits` increments for every transaction regardless of amount
- `total_spent` accumulates the `total` field from each sale
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text UNIQUE,
  email text,
  address text,
  loyalty_points integer NOT NULL DEFAULT 0,
  total_visits integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers FOR DELETE
  TO anon, authenticated USING (true);

-- Add customer_id column to sales (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE sales ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for customer lookup by phone (common search pattern)
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at DESC);
