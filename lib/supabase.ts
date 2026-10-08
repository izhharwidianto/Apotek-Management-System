import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi. Lihat docs/PANDUAN-SETUP.md.',
  );
}

// Sesi login dikelola Supabase Auth (token berumur pendek, diperbarui otomatis,
// diverifikasi server). Hak akses sebenarnya ditegakkan oleh RLS di database.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'apotekz-auth' },
});

/**
 * Ambil SEMUA baris walau lebih dari 1000 (batas bawaan Supabase).
 * Contoh:
 *   fetchAll<Medicine>((a, b) => supabase.from('medicines').select('*').order('name').order('id').range(a, b))
 * Wajib ada .order() yang stabil supaya halaman tidak tumpang tindih.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

export type Medicine = {
  id: string;
  code: string;
  name: string;
  generic_name: string | null;
  category: string;
  drug_classification: string;
  dosage_form: string;
  unit: string;
  stock: number;
  cost_price: number;
  sell_price: number;
  reorder_point: number;
  expiry_date: string | null;
  supplier: string | null;
  created_at: string;
  updated_at: string;
};

export const DRUG_CLASSIFICATIONS = [
  'Obat Bebas',
  'Obat Bebas Terbatas',
  'Obat Keras',
  'Obat Narkotika',
  'Obat Bahan Alam',
  'Vitamin dan Suplemen',
] as const;

export const DOSAGE_FORMS = [
  'Tablet',
  'Kaplet',
  'Kapsul',
  'Sirup',
  'Suspensi',
  'Salep',
  'Krim',
  'Tetes',
  'Injeksi',
  'Suppositoria',
  'Granul',
  'Oles',
  'Inhalasi',
] as const;

export type Sale = {
  id: string;
  invoice_no: string;
  customer_name: string;
  customer_id: string | null;
  status: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  payment_method: string;
  cashier_id?: string | null;
  cashier_name?: string | null;
  rx_no?: string | null;
  created_at: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  loyalty_points: number;
  total_visits: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  medicine_id: string | null;
  medicine_name: string;
  quantity: number;
  price: number;
  subtotal: number;
};

export type ReturnRow = {
  id: string;
  sale_id: string | null;
  invoice_no: string | null;
  medicine_id: string | null;
  medicine_name: string;
  quantity: number;
  reason: string;
  refund_amount: number;
  created_at: string;
};

export type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  created_at: string;
};

export type Incident = {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
};

export type Countermeasure = {
  id: string;
  title: string;
  category: 'immediate' | 'preventive';
  action_type: 'sop' | 'visual' | 'poka_yoke' | 'audit' | 'swcs' | 'other';
  description: string;
  owner: string;
  status: 'open' | 'in_progress' | 'done' | 'verified';
  due_date: string | null;
  incident_id: string | null;
  effort_level: 'LOW' | 'HIGH';
  impact_level: 'LOW' | 'HIGH';
  created_at: string;
  updated_at: string;
};

export type LogicalTest = {
  id: string;
  test_type: 'if_then' | 'causation' | 'mece' | 'sanity';
  title: string;
  premise: string;
  conclusion: string;
  result: 'pass' | 'fail' | 'inconclusive';
  notes: string;
  countermeasure_id: string | null;
  created_at: string;
  updated_at: string;
};

// ── Purchase Order types ────────────────────────────────────────────────────

export type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type PurchaseOrder = {
  id: string;
  po_no: string;
  supplier_id: string | null;
  status: 'draft' | 'sent' | 'received' | 'partial' | 'cancelled';
  order_date: string;
  expected_date: string | null;
  received_date: string | null;
  total_cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PoItem = {
  id: string;
  po_id: string;
  medicine_id: string | null;
  medicine_name: string;
  quantity: number;
  received_qty: number;
  unit_cost: number;
  subtotal: number;
};

// ── Cash Session types ──────────────────────────────────────────────────────

export type CashSession = {
  id: string;
  session_no: string;
  operator_name: string;
  operator_role: string;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
};

export type CashSessionSale = {
  id: string;
  session_id: string;
  sale_id: string;
  created_at: string;
};

// ── Prescription types ──────────────────────────────────────────────────────

export type Prescription = {
  id: string;
  rx_no: string;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string | null;
  doctor_name: string | null;
  doctor_sip: string | null;
  is_racikan: boolean;
  racikan_text: string | null;
  sale_id: string | null;
  status: 'pending' | 'dispensed' | 'cancelled';
  received_date: string;
  dispensed_date: string | null;
  notes: string | null;
  created_at: string;
};

// ── Stock Opname types ──────────────────────────────────────────────────────

export type StockOpname = {
  id: string;
  opname_no: string;
  opname_date: string;
  status: 'draft' | 'completed';
  notes: string | null;
  created_at: string;
  completed_at: string | null;
};

export type StockOpnameItem = {
  id: string;
  opname_id: string;
  medicine_id: string;
  system_stock: number;
  physical_stock: number | null;
  difference: number | null;
  adjusted: boolean;
};

// ── Medicine Batch / Lot types ──────────────────────────────────────────────

export type MedicineBatch = {
  id: string;
  medicine_id: string;
  batch_no: string;
  quantity: number;
  received_date: string;
  expiry_date: string | null;
  manufacturer: string | null;
  status: 'active' | 'recalled' | 'expired' | 'depleted';
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Semua obat (lebih dari 1000 baris pun), bentuk hasil sama seperti query Supabase. */
export async function medicinesAll(): Promise<{ data: Medicine[]; error: null }> {
  const data = await fetchAll<Medicine>((a, b) =>
    supabase.from('medicines').select('*').order('name', { ascending: true }).order('id').range(a, b),
  );
  return { data, error: null };
}
