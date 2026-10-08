# Panduan Setup Keamanan ApotekZ (untuk non-programmer)

Panduan ini mengaktifkan perbaikan keamanan di branch `hardening`. Ikuti **berurutan**.
Perkiraan waktu: 45–60 menit. Siapkan: akun Supabase, akun GitHub, dan password baru yang kuat
(minimal 12 karakter, beda untuk tiap orang, simpan di password manager).

> Kenapa berurutan? Aplikasi lama jalan karena database dibiarkan terbuka. Langkah akhir
> (Langkah 7) menutupnya. Kalau ditutup sebelum aplikasi baru aktif dan akun dibuat, aplikasi berhenti.

---

## Langkah 0 — Cadangkan data dulu
1. Buka Supabase → pilih project → **Database → Backups**. Kalau ada tombol backup/restore, catat tanggal backup terbaru.
2. Kalau paket Anda tidak punya backup: buka **Table Editor**, untuk tabel `medicines`, `customers`, `sales`, `sale_items`, `prescriptions` klik **Export → CSV** dan simpan filenya.

## Langkah 1 — Matikan pendaftaran publik
Supabase → **Authentication → Sign In / Providers** (atau *Settings*) → matikan **Allow new users to sign up** → Save.
(Ini penting: tanpa ini orang asing bisa mendaftar sendiri.)

## Langkah 2 — Jalankan SQL fase 1 (aman, hanya menambah)
1. Supabase → **SQL Editor → New query**.
2. Buka file `supabase/migrations/20261008100000_security_phase1_foundation.sql` di GitHub (tombol **Raw**, pilih semua, salin).
3. Tempel ke SQL Editor → **Run**. Harus muncul "Success. No rows returned".
   Jika error, jangan lanjut; kirim pesan errornya ke Claude.

Setelah ini aplikasi lama masih jalan seperti biasa.

## Langkah 3 — Buat akun login baru (password baru!)
Supabase → **Authentication → Users → Add user → Create new user**. Buat tiga akun, centang **Auto Confirm User**:

| Email | Role (otomatis) |
|---|---|
| `owner@apotekz.local` | owner (pemilik) |
| `apoteker@apotekz.local` | apoteker |
| `kasir@apotekz.local` | kasir |

Isi password **baru** (bukan password lama `ApotekZ@...`, itu sudah bocor di repo).
Di aplikasi, login memakai bagian depan email saja: username `owner`, `apoteker`, `kasir`.

Menambah karyawan baru nanti: buat user `namabaru@apotekz.local` seperti di atas, lalu di SQL Editor jalankan
(ganti `namabaru`, dan role bila perlu):
```sql
select public.set_user_role('namabaru', 'kasir');   -- owner | apoteker | kasir
select public.set_user_active('namabaru', true);    -- akun baru default NONAKTIF
```
Karyawan berhenti: `select public.set_user_active('namabaru', false);` lalu hapus di Authentication → Users.

## Langkah 4 — (Opsional) Aktifkan AI dengan aman
Fitur Forecast/AI CFO memakai AI. Key AI sekarang disimpan di server, bukan di browser.
1. Supabase → **Edge Functions → Deploy a new function → Via Editor**. Nama: `ai-proxy`.
2. Hapus isi contoh, tempel isi file `supabase/functions/ai-proxy/index.ts`, lalu **Deploy**.
3. **Edge Functions → Secrets → Add new secret**: isi `AI_API_KEY` = key AI Anda
   (buat key BARU di penyedia AI; key lama yang pernah diketik di aplikasi anggap bocor dan hapus/revoke).
   Opsional: `AI_MODEL` (default `gpt-4o-mini`), `AI_BASE_URL`
   (OpenRouter: `https://openrouter.ai/api/v1/chat/completions`, Groq: `https://api.groq.com/openai/v1/chat/completions`).
4. Hapus function lama `verify-login` di Edge Functions (sudah tidak dipakai).

Dilewati pun tidak apa-apa: fitur tetap jalan dengan analisis statistik lokal.

## Langkah 5 — Aktifkan aplikasi versi baru
1. GitHub → tab **Pull requests** → buka PR dari `hardening` → baca ringkasannya → **Merge pull request**.
2. Bolt akan menarik perubahan sendiri (±30 detik). **Jangan edit lewat chat Bolt selama proses ini.**
3. Netlify otomatis deploy ulang. Cek di Netlify → *Environment variables*:
   - `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` harus ada.
   - Jika ada `NEXT_PUBLIC_OPENROUTER_API_KEY`: **hapus** dan revoke key itu di OpenRouter.
4. Ubah repo GitHub menjadi **Private** (Settings → General → paling bawah *Danger Zone → Change visibility*).

## Langkah 6 — Tes aplikasi baru (database belum dikunci)
- Login sebagai `kasir`: lakukan satu penjualan kecil. Struk keluar, stok berkurang.
- Login sebagai `apoteker` dan `owner`: menu sesuai peran terbuka.
- Halaman login **tidak** lagi menampilkan password.
Kalau ada yang gagal, berhenti di sini dan kirim pesan error/tangkapan layar ke Claude.

## Langkah 7 — Kunci database (langkah penentu)
1. SQL Editor → New query → tempel isi `supabase/phase2/lock_rls.sql` → **Run**.
2. Tes lagi seperti Langkah 6 (login 3 peran, satu penjualan).
3. Pemeriksaan: jalankan
   ```sql
   select count(*) from pg_policies where schemaname='public' and roles::text like '%anon%';
   ```
   Hasil harus **0**.

**Jika aplikasi bermasalah setelah dikunci:** jalankan `supabase/phase2/rollback_lock_rls.sql` (membuka kembali
sementara), lalu kabari Claude. Jangan biarkan terbuka lama.

## Langkah 8 — Pengaturan rutin (SQL Editor, hanya owner)
```sql
-- Pajak (0 = tanpa pajak, 0.11 = 11%)
update public.app_settings set value = '0' where key = 'tax_rate';
-- Batas diskon kasir (persen dari subtotal)
update public.app_settings set value = '10' where key = 'max_cashier_discount_pct';
```
Melihat jejak audit / kartu stok / transaksi yang dibatalkan (owner):
```sql
select at, actor_role, table_name, op, row_id from public.audit_log order by id desc limit 100;
select at, medicine_name, delta, balance_after, reason from public.stock_movements order by id desc limit 100;
select voided_at, invoice_no, reason, voided_by_role from public.void_log order by voided_at desc;
```

---

## Aturan baru yang perlu diketahui tim
- **Obat Narkotika**: hanya Apoteker/Owner yang bisa menjual, wajib nomor resep yang sudah dicatat di menu Resep Dokter.
- **Obat Keras**: kasir wajib nomor resep; Apoteker/Owner boleh tanpa resep (mis. OWA). Sesuaikan SOP apotek Anda.
- **Diskon kasir** dibatasi (default 10%). **Pajak** hanya diatur pemilik.
- **Batal transaksi**: kasir hanya bisa membatalkan transaksinya sendiri yang belum dicetak; yang sudah dicetak hanya Apoteker/Owner, wajib alasan. Transaksi batal diarsipkan, tidak hilang.
- **Retur** tidak bisa melebihi jumlah yang dibeli.
- Login otomatis keluar setelah 60 menit tidak aktif.
