/*
# DARURAT: kembalikan akses database ke kondisi lama (TERBUKA)

Jalankan HANYA kalau setelah lock_rls.sql aplikasi tidak bisa dipakai dan
Anda butuh jalan keluar cepat. Ini MEMBUKA kembali database untuk siapa pun
yang punya anon key. Setelah masalah beres, kunci lagi dengan lock_rls.sql.
*/

BEGIN;

DO $$
DECLARE
  p record;
  t text;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename NOT IN ('app_settings', 'audit_log', 'stock_movements', 'void_log', 'invoice_counters')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'medicines','sales','sale_items','returns','customers','expenses','prescriptions',
    'suppliers','purchase_orders','po_items','stock_opnames','stock_opname_items',
    'medicine_batches','incidents','countermeasures','logical_tests','inventory_items',
    'inventory_ai_insights','inventory_consumption_history','demand_forecasts','cost_variances',
    'cash_flow_projections','bill_of_materials','cash_sessions','cash_session_sales','app_users'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)', t || '_select', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', t || '_insert', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t || '_update', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO anon, authenticated USING (true)', t || '_delete', t);
      EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

COMMIT;
