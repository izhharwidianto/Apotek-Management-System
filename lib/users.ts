/**
 * ApotekZ — User & Role Configuration
 *
 * Default credentials for the 3 user levels. Passwords are stored as
 * bcrypt hashes in the Supabase `app_users` table and verified by the
 * `verify-login` edge function. This file documents the default plaintext
 * passwords so the owner can change them later via the app UI or by
 * updating the database directly.
 *
 * ┌───────────┬──────────────────────────┬─────────────────────────────┐
 * │ Username  │ Password                 │ Role & Access               │
 * ├───────────┼──────────────────────────┼─────────────────────────────┤
 * │ owner     │ ApotekZ@Owner2025         │ Full access (all modules)   │
 * │ apoteker  │ ApotekZ@Apoteker2025     │ Dashboard, POS, Inventory,  │
 * │           │                          │ limited financial reports   │
 * │ kasir     │ ApotekZ@Kasir2025        │ POS & inventory only        │
 * └───────────┴──────────────────────────┴─────────────────────────────┘
 *
 * To add a new user (owner only):
 * 1. Generate a bcrypt hash: node -e "console.log(require('bcryptjs').hashSync('NewPass',10))"
 * 2. INSERT INTO app_users (username, password_hash, display_name, role)
 *      VALUES ('newuser', '<hash>', 'Display Name', 'kasir');
 *
 * To change a password:
 * UPDATE app_users SET password_hash='<new hash>' WHERE username='kasir';
 */

export type UserRole = 'owner' | 'apoteker' | 'kasir';

export type AppUser = {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
};

export const DEFAULT_CREDENTIALS: { username: string; password: string; role: UserRole; displayName: string }[] = [
  { username: 'owner', password: 'ApotekZ@Owner2025', role: 'owner', displayName: 'Pemilik Apotek' },
  { username: 'apoteker', password: 'ApotekZ@Apoteker2025', role: 'apoteker', displayName: 'Apt. Penanggung Jawab' },
  { username: 'kasir', password: 'ApotekZ@Kasir2025', role: 'kasir', displayName: 'Staff Kasir' },
];

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
