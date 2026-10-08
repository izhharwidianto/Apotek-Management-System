/*
# Security hardening — FASE 2: KUNCI AKSES DATABASE

!! JANGAN dijalankan sebelum langkah-langkah di docs/PANDUAN-SETUP.md
!! mencapai bagian "Kunci database". Setelah file ini jalan:
!!   - orang tanpa login tidak bisa baca/tulis apa pun,
!!   - tiap role hanya bisa melakukan yang diizinkan,
!!   - aplikasi versi LAMA berhenti bekerja (versi baru wajib sudah aktif).
!! Kalau ada masalah: jalankan supabase/phase2/rollback_lock_rls.sql

Matriks akses (O = owner, A = apoteker, K = kasir):

tabel                          baca     tulis langsung   hapus
medicines                      O A K    O A              O      (K ubah stok lewat checkout_sale)
sales, sale_items, returns     O A K    -  (lewat fungsi)  -
customers                      O A K    tambah: O A K, ubah: O A   O
expenses                       O A      O A              O
cash_sessions(+_sales)         O A, K=milik sendiri  O A K(milik sendiri)  O
prescriptions                  O A K    O A K            O
suppliers, purchase_orders, po_items   O A    O A        O
stock_opnames(+_items)         O A      O A              O
medicine_batches               O A      O A              O
incidents, countermeasures, logical_tests   O saja       O
inventory_items & tabel analitik            O A    O A    O
app_users                      diri sendiri / O   -  (lewat fungsi set_user_role)
*/

BEGIN;

-- 1. Hapus SEMUA policy lama (yang membuka akses untuk anon) di tabel aplikasi.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename NOT IN ('app_settings', 'audit_log', 'stock_movements', 'void_log', 'invoice_counters')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- 2. Pembantu pembuat policy (dihapus lagi di akhir file).
CREATE OR REPLACE FUNCTION public._mk_policies(
  p_table text, p_read text[], p_write text[], p_delete text[], p_insert text[] DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN RETURN; END IF;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
  IF p_read IS NOT NULL THEN
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.app_role() = ANY (%L::text[]))',
      p_table || '_select', p_table, p_read);
  END IF;
  IF coalesce(p_insert, p_write) IS NOT NULL THEN
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.app_role() = ANY (%L::text[]))',
      p_table || '_insert', p_table, coalesce(p_insert, p_write));
  END IF;
  IF p_write IS NOT NULL THEN
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.app_role() = ANY (%L::text[])) WITH CHECK (public.app_role() = ANY (%L::text[]))',
      p_table || '_update', p_table, p_write, p_write);
  END IF;
  IF p_delete IS NOT NULL THEN
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.app_role() = ANY (%L::text[]))',
      p_table || '_delete', p_table, p_delete);
  END IF;
END $$;

-- 3. Terapkan matriks.
SELECT public._mk_policies('medicines',        ARRAY['owner','apoteker','kasir'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('sales',            ARRAY['owner','apoteker','kasir'], NULL, NULL);
SELECT public._mk_policies('sale_items',       ARRAY['owner','apoteker','kasir'], NULL, NULL);
SELECT public._mk_policies('returns',          ARRAY['owner','apoteker','kasir'], NULL, NULL);
SELECT public._mk_policies('customers',        ARRAY['owner','apoteker','kasir'], ARRAY['owner','apoteker'], ARRAY['owner'], ARRAY['owner','apoteker','kasir']);
SELECT public._mk_policies('expenses',         ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('prescriptions',    ARRAY['owner','apoteker','kasir'], ARRAY['owner','apoteker','kasir'], ARRAY['owner']);
SELECT public._mk_policies('suppliers',        ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('purchase_orders',  ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('po_items',         ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('stock_opnames',    ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('stock_opname_items', ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('medicine_batches', ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('incidents',        ARRAY['owner'], ARRAY['owner'], ARRAY['owner']);
SELECT public._mk_policies('countermeasures',  ARRAY['owner'], ARRAY['owner'], ARRAY['owner']);
SELECT public._mk_policies('logical_tests',    ARRAY['owner'], ARRAY['owner'], ARRAY['owner']);
SELECT public._mk_policies('inventory_items',  ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('inventory_ai_insights',        ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('inventory_consumption_history', ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('demand_forecasts', ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('cost_variances',   ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('cash_flow_projections', ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);
SELECT public._mk_policies('bill_of_materials', ARRAY['owner','apoteker'], ARRAY['owner','apoteker'], ARRAY['owner']);

-- Shift kasir: owner/apoteker lihat semua, kasir hanya miliknya sendiri.
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_sessions_select ON public.cash_sessions FOR SELECT TO authenticated
  USING (public.app_role() IN ('owner','apoteker') OR (public.app_role() = 'kasir' AND opened_by = auth.uid()));
CREATE POLICY cash_sessions_insert ON public.cash_sessions FOR INSERT TO authenticated
  WITH CHECK (public.app_role() IN ('owner','apoteker','kasir') AND opened_by = auth.uid());
CREATE POLICY cash_sessions_update ON public.cash_sessions FOR UPDATE TO authenticated
  USING (public.app_role() IN ('owner','apoteker') OR (public.app_role() = 'kasir' AND opened_by = auth.uid()))
  WITH CHECK (public.app_role() IN ('owner','apoteker') OR (public.app_role() = 'kasir' AND opened_by = auth.uid()));
CREATE POLICY cash_sessions_delete ON public.cash_sessions FOR DELETE TO authenticated
  USING (public.app_role() = 'owner');

ALTER TABLE public.cash_session_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_session_sales_select ON public.cash_session_sales FOR SELECT TO authenticated
  USING (public.app_role() IN ('owner','apoteker') OR EXISTS (
    SELECT 1 FROM public.cash_sessions cs WHERE cs.id = session_id AND cs.opened_by = auth.uid()));
CREATE POLICY cash_session_sales_insert ON public.cash_session_sales FOR INSERT TO authenticated
  WITH CHECK (public.app_role() IN ('owner','apoteker') OR EXISTS (
    SELECT 1 FROM public.cash_sessions cs WHERE cs.id = session_id AND cs.opened_by = auth.uid()));
CREATE POLICY cash_session_sales_delete ON public.cash_session_sales FOR DELETE TO authenticated
  USING (public.app_role() = 'owner');

-- Akun pengguna: lihat diri sendiri (owner lihat semua). Tidak ada tulis langsung.
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_users_select ON public.app_users FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.app_role() = 'owner');

DROP FUNCTION public._mk_policies(text, text[], text[], text[], text[]);

-- 4. Cabut hak akses anonim (tanpa login) dari semua tabel dan urutan.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- 5. Hash password lama (dari password default yang pernah tersebar) dihapus.
UPDATE public.app_users SET password_hash = NULL;

COMMIT;
