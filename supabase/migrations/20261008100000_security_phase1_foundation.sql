/*
# Security hardening — FASE 1 (fondasi, aman dijalankan kapan saja)

Fase ini hanya MENAMBAH. Tidak ada policy lama yang dihapus dan tidak ada
data yang diubah, jadi aplikasi versi lama tetap jalan setelah file ini
dijalankan. Penguncian akses (RLS) ada di fase 2:
  supabase/phase2/lock_rls.sql   (JANGAN dijalankan sebelum panduan bilang)

Isi fase 1:
1. Login lewat Supabase Auth: kolom app_users.auth_user_id + trigger yang
   menautkan akun Auth (email username@apotekz.local) ke baris app_users.
2. app_role(): fungsi yang menjawab "role user yang sedang login apa?".
3. Tabel baru: app_settings, audit_log, stock_movements (kartu stok),
   void_log, invoice_counters.
4. Kolom pencatat siapa melakukan apa (cashier_id, created_by, opened_by).
5. Fungsi atomik (satu transaksi, anti-race, dicek role di server):
   checkout_sale, void_sale, mark_sale_completed, process_return,
   receive_purchase_order, complete_stock_opname, set_user_role,
   set_user_active.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Tautan app_users <-> Supabase Auth
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Hash lama tidak dipakai lagi (login pindah ke Supabase Auth). Kolom dibuat
-- boleh kosong; isinya baru dihapus di fase 2.
ALTER TABLE public.app_users ALTER COLUMN password_hash DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.app_users
  WHERE auth_user_id = auth.uid() AND is_active
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.app_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_role() TO authenticated;

-- Dipanggil otomatis saat akun baru dibuat di Authentication > Users.
-- Hanya email berakhiran @apotekz.local yang diproses.
-- Username yang sudah ada (owner/apoteker/kasir) ditautkan ke akun Auth
-- dan tetap memakai role-nya. Username baru dibuat sebagai 'kasir' yang
-- NONAKTIF: owner harus mengaktifkannya (select set_user_active('nama', true))
-- supaya akun yang tidak sengaja/ilegal tidak otomatis punya akses.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  IF new.email IS NULL OR new.email NOT LIKE '%@apotekz.local' THEN
    RETURN new;
  END IF;
  v_username := lower(split_part(new.email, '@', 1));
  INSERT INTO public.app_users (username, password_hash, display_name, role, is_active, auth_user_id)
  VALUES (v_username, NULL, v_username, 'kasir', false, new.id)
  ON CONFLICT (username) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id, updated_at = now()
    WHERE public.app_users.auth_user_id IS NULL;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Pengecek role dipakai internal oleh fungsi-fungsi di bawah.
CREATE OR REPLACE FUNCTION public._require_role(p_roles text[])
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v text := public.app_role();
BEGIN
  IF v IS NULL OR NOT (v = ANY (p_roles)) THEN
    RAISE EXCEPTION 'Tidak diizinkan untuk peran ini' USING ERRCODE = '42501';
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public._require_role(text[]) FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Tabel baru
-- ───────────────────────────────────────────────────────────────────────────

-- Pengaturan yang dulu bisa diubah siapa saja di layar kasir.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (key, value) VALUES
  ('tax_rate', '0'),                    -- 0 = tanpa pajak, 0.11 = 11%
  ('max_cashier_discount_pct', '10')    -- batas diskon yang boleh diberi kasir
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_settings_select ON public.app_settings;
CREATE POLICY app_settings_select ON public.app_settings FOR SELECT
  TO authenticated USING (public.app_role() IS NOT NULL);
DROP POLICY IF EXISTS app_settings_owner_write ON public.app_settings;
CREATE POLICY app_settings_owner_write ON public.app_settings FOR ALL
  TO authenticated USING (public.app_role() = 'owner') WITH CHECK (public.app_role() = 'owner');
REVOKE ALL ON public.app_settings FROM anon;

-- Jejak audit: siapa mengubah apa, kapan. Tidak bisa diubah/dihapus dari app.
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor uuid,
  actor_role text,
  table_name text NOT NULL,
  op text NOT NULL,
  row_id text,
  old_data jsonb,
  new_data jsonb
);
CREATE INDEX IF NOT EXISTS idx_audit_log_at ON public.audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log (table_name, at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_owner_select ON public.audit_log;
CREATE POLICY audit_log_owner_select ON public.audit_log FOR SELECT
  TO authenticated USING (public.app_role() = 'owner');
REVOKE ALL ON public.audit_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated;

CREATE OR REPLACE FUNCTION public.audit_row()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
BEGIN
  v_row := CASE WHEN tg_op = 'DELETE' THEN to_jsonb(old) ELSE to_jsonb(new) END;
  INSERT INTO public.audit_log (actor, actor_role, table_name, op, row_id, old_data, new_data)
  VALUES (
    auth.uid(),
    public.app_role(),
    tg_table_name,
    tg_op,
    v_row ->> 'id',
    CASE WHEN tg_op IN ('UPDATE', 'DELETE') THEN to_jsonb(old) - 'password_hash' END,
    CASE WHEN tg_op IN ('INSERT', 'UPDATE') THEN to_jsonb(new) - 'password_hash' END
  );
  RETURN coalesce(new, old);
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'medicines', 'sales', 'returns', 'customers', 'app_users', 'purchase_orders',
    'stock_opnames', 'cash_sessions', 'prescriptions', 'medicine_batches',
    'expenses', 'suppliers', 'app_settings'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.audit_row()', t);
    END IF;
  END LOOP;
END $$;

-- Kartu stok: setiap perubahan medicines.stock tercatat (alasan + siapa).
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  medicine_id uuid REFERENCES public.medicines(id) ON DELETE SET NULL,
  medicine_name text,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  reason text NOT NULL,   -- sale | void | return | po_receive | opname | manual
  ref_id text,
  actor uuid
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_med ON public.stock_movements (medicine_id, at DESC);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_movements_select ON public.stock_movements;
CREATE POLICY stock_movements_select ON public.stock_movements FOR SELECT
  TO authenticated USING (public.app_role() IN ('owner', 'apoteker'));
REVOKE ALL ON public.stock_movements FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stock_movements FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_stock_movement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stock_movements (medicine_id, medicine_name, delta, balance_after, reason, ref_id, actor)
  VALUES (
    new.id, new.name, new.stock - old.stock, new.stock,
    coalesce(nullif(current_setting('app.stock_reason', true), ''), 'manual'),
    nullif(current_setting('app.stock_ref', true), ''),
    auth.uid()
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_medicines_stock_movement ON public.medicines;
CREATE TRIGGER trg_medicines_stock_movement
  AFTER UPDATE OF stock ON public.medicines
  FOR EACH ROW WHEN (old.stock IS DISTINCT FROM new.stock)
  EXECUTE FUNCTION public.log_stock_movement();

-- Arsip transaksi yang dibatalkan (pengganti DELETE tanpa jejak).
CREATE TABLE IF NOT EXISTS public.void_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid,
  invoice_no text,
  sale_data jsonb NOT NULL,
  items_data jsonb NOT NULL,
  reason text NOT NULL,
  voided_by uuid,
  voided_by_role text,
  voided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.void_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS void_log_select ON public.void_log;
CREATE POLICY void_log_select ON public.void_log FOR SELECT
  TO authenticated USING (public.app_role() IN ('owner', 'apoteker'));
REVOKE ALL ON public.void_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.void_log FROM authenticated;

-- Penomoran invoice berurutan per hari (zona waktu Jakarta).
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  day date PRIMARY KEY,
  last_no integer NOT NULL DEFAULT 0
);
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_counters FROM anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Kolom pencatat pelaku
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cashier_id uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cashier_name text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS rx_no text;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS opened_by uuid DEFAULT auth.uid();
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Fungsi atomik
-- ───────────────────────────────────────────────────────────────────────────

-- p_items: [{"medicine_id": "<uuid>", "qty": 2}, ...]
-- Harga, stok, pajak, batas diskon dan nomor invoice SEMUA ditentukan server.
CREATE OR REPLACE FUNCTION public.checkout_sale(
  p_customer_name text,
  p_customer_phone text,
  p_discount numeric,
  p_paid numeric,
  p_payment_method text,
  p_items jsonb,
  p_rx_no text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public._require_role(ARRAY['owner', 'apoteker', 'kasir']);
  v_tax_rate numeric := coalesce((SELECT value::numeric FROM public.app_settings WHERE key = 'tax_rate'), 0);
  v_max_disc numeric := coalesce((SELECT value::numeric FROM public.app_settings WHERE key = 'max_cashier_discount_pct'), 10);
  v_discount numeric := coalesce(p_discount, 0);
  v_paid numeric := coalesce(p_paid, 0);
  v_name text := nullif(btrim(coalesce(p_customer_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_customer_phone, '')), '');
  v_rx_no text := nullif(btrim(coalesce(p_rx_no, '')), '');
  v_subtotal numeric := 0;
  v_tax numeric;
  v_total numeric;
  v_customer_id uuid;
  v_sale public.sales;
  v_rx public.prescriptions;
  v_day date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_no integer;
  v_found integer := 0;
  v_expected integer;
  v_has_narc boolean := false;
  v_has_keras boolean := false;
  v_cashier text;
  r record;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Keranjang kosong';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) e
    WHERE coalesce((e ->> 'qty')::int, 0) <= 0 OR (e ->> 'medicine_id') IS NULL
  ) THEN
    RAISE EXCEPTION 'Item keranjang tidak valid';
  END IF;

  SELECT count(DISTINCT (e ->> 'medicine_id')::uuid) INTO v_expected FROM jsonb_array_elements(p_items) e;

  -- Pass 1: kunci baris obat, cek stok, hitung subtotal.
  FOR r IN
    SELECT m.id, m.name, m.sell_price, m.stock, m.drug_classification, i.qty
    FROM (
      SELECT (e ->> 'medicine_id')::uuid AS mid, sum((e ->> 'qty')::int) AS qty
      FROM jsonb_array_elements(p_items) e GROUP BY 1
    ) i
    JOIN public.medicines m ON m.id = i.mid
    ORDER BY m.id
    FOR UPDATE OF m
  LOOP
    v_found := v_found + 1;
    IF r.stock < r.qty THEN
      RAISE EXCEPTION 'Stok % tidak cukup (tersedia %, diminta %)', r.name, r.stock, r.qty;
    END IF;
    v_subtotal := v_subtotal + r.sell_price * r.qty;
    IF r.drug_classification = 'Obat Narkotika' THEN v_has_narc := true; END IF;
    IF r.drug_classification = 'Obat Keras' THEN v_has_keras := true; END IF;
  END LOOP;
  IF v_found <> v_expected THEN
    RAISE EXCEPTION 'Ada obat di keranjang yang tidak ditemukan';
  END IF;

  -- Aturan obat berpengawasan.
  IF v_has_narc THEN
    IF v_role = 'kasir' THEN
      RAISE EXCEPTION 'Obat Narkotika hanya boleh diserahkan oleh Apoteker/Owner';
    END IF;
    IF v_rx_no IS NULL THEN
      RAISE EXCEPTION 'Obat Narkotika wajib disertai nomor resep';
    END IF;
  ELSIF v_has_keras AND v_rx_no IS NULL AND v_role = 'kasir' THEN
    RAISE EXCEPTION 'Obat Keras wajib disertai nomor resep (atau diserahkan Apoteker)';
  END IF;
  IF v_rx_no IS NOT NULL THEN
    SELECT * INTO v_rx FROM public.prescriptions WHERE rx_no = v_rx_no FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Resep % tidak ditemukan', v_rx_no; END IF;
    IF v_rx.status = 'cancelled' THEN RAISE EXCEPTION 'Resep % sudah dibatalkan', v_rx_no; END IF;
    IF v_rx.sale_id IS NOT NULL THEN RAISE EXCEPTION 'Resep % sudah dipakai di transaksi lain', v_rx_no; END IF;
  END IF;

  -- Diskon dan pajak.
  IF v_discount < 0 OR v_discount > v_subtotal THEN
    RAISE EXCEPTION 'Diskon tidak valid';
  END IF;
  IF v_role = 'kasir' AND v_discount > v_subtotal * v_max_disc / 100 THEN
    RAISE EXCEPTION 'Diskon melebihi batas kasir (% persen). Minta Apoteker/Owner.', v_max_disc;
  END IF;
  v_tax := round(v_subtotal * v_tax_rate);
  v_total := greatest(0, v_subtotal - v_discount + v_tax);
  IF v_paid < v_total THEN
    RAISE EXCEPTION 'Pembayaran kurang dari total';
  END IF;

  -- Pelanggan (opsional).
  IF v_name IS NOT NULL AND v_phone IS NOT NULL THEN
    SELECT id INTO v_customer_id FROM public.customers WHERE phone = v_phone;
    IF v_customer_id IS NULL THEN
      INSERT INTO public.customers (name, phone) VALUES (v_name, v_phone) RETURNING id INTO v_customer_id;
    END IF;
  ELSIF v_name IS NOT NULL THEN
    SELECT id INTO v_customer_id FROM public.customers WHERE lower(name) = lower(v_name) ORDER BY created_at LIMIT 1;
  END IF;

  SELECT display_name INTO v_cashier FROM public.app_users WHERE auth_user_id = auth.uid();

  INSERT INTO public.invoice_counters (day, last_no) VALUES (v_day, 1)
  ON CONFLICT (day) DO UPDATE SET last_no = public.invoice_counters.last_no + 1
  RETURNING last_no INTO v_no;

  INSERT INTO public.sales (
    invoice_no, customer_name, customer_id, status, subtotal, tax, discount, total,
    paid, "change", payment_method, cashier_id, cashier_name, rx_no
  ) VALUES (
    'INV-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_no::text, 4, '0'),
    coalesce(v_name, 'Umum'), v_customer_id, 'receipt_not_printed', v_subtotal, v_tax, v_discount, v_total,
    v_paid, v_paid - v_total, coalesce(nullif(btrim(p_payment_method), ''), 'Tunai'),
    auth.uid(), v_cashier, v_rx_no
  ) RETURNING * INTO v_sale;

  PERFORM set_config('app.stock_reason', 'sale', true);
  PERFORM set_config('app.stock_ref', v_sale.id::text, true);

  -- Pass 2: tulis item dan kurangi stok.
  FOR r IN
    SELECT m.id, m.name, m.sell_price, i.qty
    FROM (
      SELECT (e ->> 'medicine_id')::uuid AS mid, sum((e ->> 'qty')::int) AS qty
      FROM jsonb_array_elements(p_items) e GROUP BY 1
    ) i
    JOIN public.medicines m ON m.id = i.mid
    ORDER BY m.id
  LOOP
    INSERT INTO public.sale_items (sale_id, medicine_id, medicine_name, quantity, price, subtotal)
    VALUES (v_sale.id, r.id, r.name, r.qty, r.sell_price, r.sell_price * r.qty);
    UPDATE public.medicines SET stock = stock - r.qty, updated_at = now() WHERE id = r.id;
  END LOOP;

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers SET
      total_visits = total_visits + 1,
      total_spent = total_spent + v_total,
      loyalty_points = loyalty_points + CASE WHEN v_total >= 20000 THEN 1 ELSE 0 END,
      updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  IF v_rx_no IS NOT NULL THEN
    UPDATE public.prescriptions
    SET sale_id = v_sale.id, status = 'dispensed', dispensed_date = coalesce(dispensed_date, v_day)
    WHERE id = v_rx.id;
  END IF;

  RETURN jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'items', coalesce((SELECT jsonb_agg(to_jsonb(si)) FROM public.sale_items si WHERE si.sale_id = v_sale.id), '[]'::jsonb)
  );
END;
$$;

-- Batalkan transaksi: stok kembali, transaksi diarsipkan ke void_log (bukan hilang).
CREATE OR REPLACE FUNCTION public.void_sale(p_sale_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public._require_role(ARRAY['owner', 'apoteker', 'kasir']);
  v_reason text := btrim(coalesce(p_reason, ''));
  v_sale public.sales;
  r record;
BEGIN
  IF length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi';
  END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;
  IF v_role = 'kasir' AND NOT (
    v_sale.status IN ('pending', 'receipt_not_printed') AND v_sale.cashier_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Kasir hanya boleh membatalkan transaksi sendiri yang belum dicetak';
  END IF;
  IF EXISTS (SELECT 1 FROM public.returns WHERE sale_id = p_sale_id) THEN
    RAISE EXCEPTION 'Transaksi sudah memiliki retur dan tidak bisa dibatalkan';
  END IF;

  PERFORM set_config('app.stock_reason', 'void', true);
  PERFORM set_config('app.stock_ref', p_sale_id::text, true);
  FOR r IN
    SELECT medicine_id, sum(quantity) AS qty FROM public.sale_items
    WHERE sale_id = p_sale_id AND medicine_id IS NOT NULL
    GROUP BY medicine_id ORDER BY medicine_id
  LOOP
    UPDATE public.medicines SET stock = stock + r.qty, updated_at = now() WHERE id = r.medicine_id;
  END LOOP;

  IF v_sale.customer_id IS NOT NULL THEN
    UPDATE public.customers SET
      total_visits = greatest(0, total_visits - 1),
      total_spent = greatest(0, total_spent - v_sale.total),
      loyalty_points = greatest(0, loyalty_points - CASE WHEN v_sale.total >= 20000 THEN 1 ELSE 0 END),
      updated_at = now()
    WHERE id = v_sale.customer_id;
  END IF;

  UPDATE public.prescriptions
  SET sale_id = NULL, status = 'pending', dispensed_date = NULL
  WHERE sale_id = p_sale_id;

  INSERT INTO public.void_log (sale_id, invoice_no, sale_data, items_data, reason, voided_by, voided_by_role)
  VALUES (
    v_sale.id, v_sale.invoice_no, to_jsonb(v_sale),
    coalesce((SELECT jsonb_agg(to_jsonb(si)) FROM public.sale_items si WHERE si.sale_id = p_sale_id), '[]'::jsonb),
    v_reason, auth.uid(), v_role
  );

  DELETE FROM public.sales WHERE id = p_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_sale_completed(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._require_role(ARRAY['owner', 'apoteker', 'kasir']);
  UPDATE public.sales SET status = 'completed' WHERE id = p_sale_id AND status <> 'completed';
END;
$$;

-- Retur: dicek tidak boleh melebihi jumlah yang dibeli (termasuk retur sebelumnya).
CREATE OR REPLACE FUNCTION public.process_return(p_sale_item_id uuid, p_qty integer, p_reason text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := btrim(coalesce(p_reason, ''));
  v_item public.sale_items;
  v_invoice text;
  v_returned integer;
  v_id uuid;
BEGIN
  PERFORM public._require_role(ARRAY['owner', 'apoteker', 'kasir']);
  IF p_qty IS NULL OR p_qty < 1 THEN RAISE EXCEPTION 'Jumlah retur tidak valid'; END IF;
  IF length(v_reason) < 3 THEN RAISE EXCEPTION 'Alasan retur wajib diisi'; END IF;

  SELECT * INTO v_item FROM public.sale_items WHERE id = p_sale_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item transaksi tidak ditemukan'; END IF;
  SELECT invoice_no INTO v_invoice FROM public.sales WHERE id = v_item.sale_id;

  SELECT coalesce(sum(quantity), 0) INTO v_returned FROM public.returns
  WHERE sale_id = v_item.sale_id AND medicine_name = v_item.medicine_name
    AND medicine_id IS NOT DISTINCT FROM v_item.medicine_id;
  IF p_qty + v_returned > v_item.quantity THEN
    RAISE EXCEPTION 'Jumlah retur melebihi pembelian (dibeli %, sudah diretur %)', v_item.quantity, v_returned;
  END IF;

  INSERT INTO public.returns (sale_id, invoice_no, medicine_id, medicine_name, quantity, reason, refund_amount)
  VALUES (v_item.sale_id, v_invoice, v_item.medicine_id, v_item.medicine_name, p_qty, v_reason, v_item.price * p_qty)
  RETURNING id INTO v_id;

  IF v_item.medicine_id IS NOT NULL THEN
    PERFORM set_config('app.stock_reason', 'return', true);
    PERFORM set_config('app.stock_ref', v_id::text, true);
    UPDATE public.medicines SET stock = stock + p_qty, updated_at = now() WHERE id = v_item.medicine_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_po_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po public.purchase_orders;
  r record;
BEGIN
  PERFORM public._require_role(ARRAY['owner', 'apoteker']);
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  IF v_po.status IN ('received', 'cancelled') THEN
    RAISE EXCEPTION 'PO sudah berstatus %', v_po.status;
  END IF;

  PERFORM set_config('app.stock_reason', 'po_receive', true);
  PERFORM set_config('app.stock_ref', p_po_id::text, true);
  FOR r IN SELECT id, medicine_id, quantity - received_qty AS delta FROM public.po_items WHERE po_id = p_po_id ORDER BY id LOOP
    IF r.medicine_id IS NOT NULL AND r.delta > 0 THEN
      UPDATE public.medicines SET stock = stock + r.delta, updated_at = now() WHERE id = r.medicine_id;
    END IF;
    UPDATE public.po_items SET received_qty = quantity WHERE id = r.id;
  END LOOP;

  UPDATE public.purchase_orders
  SET status = 'received', received_date = (now() AT TIME ZONE 'Asia/Jakarta')::date, updated_at = now()
  WHERE id = p_po_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_stock_opname(p_opname_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op public.stock_opnames;
  r record;
BEGIN
  PERFORM public._require_role(ARRAY['owner', 'apoteker']);
  SELECT * INTO v_op FROM public.stock_opnames WHERE id = p_opname_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesi opname tidak ditemukan'; END IF;
  IF v_op.status = 'completed' THEN RAISE EXCEPTION 'Opname sudah selesai'; END IF;

  PERFORM set_config('app.stock_reason', 'opname', true);
  PERFORM set_config('app.stock_ref', p_opname_id::text, true);
  FOR r IN
    SELECT id, medicine_id, system_stock, physical_stock FROM public.stock_opname_items
    WHERE opname_id = p_opname_id AND physical_stock IS NOT NULL AND physical_stock <> system_stock AND NOT adjusted
    ORDER BY medicine_id
  LOOP
    UPDATE public.medicines SET stock = r.physical_stock, updated_at = now() WHERE id = r.medicine_id;
    UPDATE public.stock_opname_items SET difference = r.physical_stock - r.system_stock, adjusted = true WHERE id = r.id;
  END LOOP;

  UPDATE public.stock_opnames SET status = 'completed', completed_at = now() WHERE id = p_opname_id;
END;
$$;

-- Manajemen user (hanya owner). Dipanggil lewat SQL Editor atau UI nanti.
CREATE OR REPLACE FUNCTION public.set_user_role(p_username text, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._require_role(ARRAY['owner']);
  IF p_role NOT IN ('owner', 'apoteker', 'kasir') THEN RAISE EXCEPTION 'Role tidak valid'; END IF;
  IF p_role <> 'owner'
     AND (SELECT role FROM public.app_users WHERE username = lower(p_username)) = 'owner'
     AND (SELECT count(*) FROM public.app_users WHERE role = 'owner' AND is_active) <= 1 THEN
    RAISE EXCEPTION 'Tidak boleh menghapus owner terakhir';
  END IF;
  UPDATE public.app_users SET role = p_role, updated_at = now() WHERE username = lower(p_username);
  IF NOT FOUND THEN RAISE EXCEPTION 'User % tidak ditemukan', p_username; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_active(p_username text, p_active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._require_role(ARRAY['owner']);
  IF NOT p_active
     AND (SELECT role FROM public.app_users WHERE username = lower(p_username)) = 'owner'
     AND (SELECT count(*) FROM public.app_users WHERE role = 'owner' AND is_active) <= 1 THEN
    RAISE EXCEPTION 'Tidak boleh menonaktifkan owner terakhir';
  END IF;
  UPDATE public.app_users SET is_active = p_active, updated_at = now() WHERE username = lower(p_username);
  IF NOT FOUND THEN RAISE EXCEPTION 'User % tidak ditemukan', p_username; END IF;
END;
$$;

-- Hak eksekusi: hanya user yang sudah login, tidak untuk anonim.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'checkout_sale(text,text,numeric,numeric,text,jsonb,text)',
    'void_sale(uuid,text)',
    'mark_sale_completed(uuid)',
    'process_return(uuid,integer,text)',
    'receive_purchase_order(uuid)',
    'complete_stock_opname(uuid)',
    'set_user_role(text,text)',
    'set_user_active(text,boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
