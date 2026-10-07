/*
# Add status column to sales for transaction lifecycle tracking

1. Modified Tables
- `sales`
  - Add `status` (text, default 'completed')
    Values: 'completed' (paid + receipt printed), 'pending' (not yet paid), 'receipt_not_printed' (paid but receipt not printed)

2. Notes
- Existing sales default to 'completed' since they were already processed
- New sales created during checkout start as 'pending' until payment is confirmed
- After payment, status moves to 'receipt_not_printed' until receipt is printed
- After receipt print, status becomes 'completed'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'status'
  ) THEN
    ALTER TABLE sales ADD COLUMN status text NOT NULL DEFAULT 'completed';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_status ON sales (status);
