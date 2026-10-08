# ApotekZ — Apotek Management System

Aplikasi manajemen apotek: kasir/POS, stok & batch, purchase order, stok opname, resep, shift kasir,
laporan keuangan, dan analitik AI. Next.js 14 + Supabase (Postgres, Auth, Edge Functions) + Netlify.

## Keamanan (baca dulu)
- Setup/penguncian: [`docs/PANDUAN-SETUP.md`](docs/PANDUAN-SETUP.md)
- Aturan pengembangan: [`SECURITY.md`](SECURITY.md)

## Struktur
- `app/`, `components/`, `lib/` — aplikasi (UI di `components/views/`)
- `supabase/migrations/` — skema + fungsi transaksi (fase 1)
- `supabase/phase2/` — penguncian akses (`lock_rls.sql`) dan rollback darurat
- `supabase/functions/ai-proxy/` — AI lewat server (key tidak ke browser)
- `scripts/db-test/` — uji otomatis database (`npm install && npm test`, tidak menyentuh Supabase asli)

## Menjalankan lokal
```bash
cp .env.example .env.local   # isi URL & anon key Supabase
npm install
npm run dev
```
Checks: `npm run typecheck`, `cd scripts/db-test && npm test`.

## Peran
| Role | Akses |
|---|---|
| owner | semua modul, pengaturan, audit |
| apoteker | dashboard, POS, stok, PO, opname, batch, resep, laporan |
| kasir | POS, riwayat, stok (baca), shift sendiri, resep |
