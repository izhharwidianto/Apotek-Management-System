/**
 * ApotekZ — Peran pengguna (hanya tipe dan label tampilan).
 *
 * Akun dan password dikelola di Supabase Authentication (BUKAN di kode ini).
 * Cara membuat/mengubah akun: lihat docs/PANDUAN-SETUP.md.
 * Hak akses sebenarnya ditegakkan di database (RLS), bukan di file ini;
 * daftar role di UI hanya mengatur menu apa yang tampil.
 */

export type UserRole = 'owner' | 'apoteker' | 'kasir';

export type AppUser = {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Pemilik',
  apoteker: 'Apoteker PJ',
  kasir: 'Kasir/Staff',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: 'Akses penuh ke seluruh modul aplikasi',
  apoteker: 'Dashboard, POS, inventori, laporan keuangan terbatas',
  kasir: 'Kasir/POS dan stok inventori',
};

export const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  owner: 'bg-amber-100 text-amber-700 border-amber-200',
  apoteker: 'bg-sky-100 text-sky-700 border-sky-200',
  kasir: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};
