# Keamanan ApotekZ

Aturan yang WAJIB dijaga (juga oleh AI coding assistant seperti Bolt):

1. **Jangan pernah membuka RLS.** Tidak boleh ada policy untuk role `anon` dan tidak boleh `USING (true)` pada tabel data.
   Akses diatur lewat `public.app_role()` (lihat `supabase/phase2/lock_rls.sql`).
2. **Transaksi uang/stok lewat fungsi database**, bukan update langsung dari browser:
   `checkout_sale`, `void_sale`, `process_return`, `receive_purchase_order`, `complete_stock_opname`.
3. **Tidak ada rahasia di kode atau browser.** Key AI hanya sebagai secret Edge Function `ai-proxy`.
   Jangan membuat variabel `NEXT_PUBLIC_*` untuk key/secret apa pun (kecuali Supabase URL dan anon key).
4. **Teks dari database yang masuk ke HTML mentah (`document.write`, `dangerouslySetInnerHTML`) wajib di-escape** (`esc()` di `lib/format.ts`).
5. Tidak ada password default di kode, UI, atau dokumentasi.
6. Perubahan skema = file migrasi baru di `supabase/migrations/`, lalu jalankan `scripts/db-test` (`npm test`).

Melaporkan celah: hubungi pemilik apotek/pengelola repo secara langsung, jangan lewat issue publik.
