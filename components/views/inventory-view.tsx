'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Download,
  FileText,
  FileSpreadsheet,
  Package,
  RefreshCw,
  Lightbulb,
  X,
  AlertTriangle,
} from 'lucide-react';
import { supabase, type Medicine, DRUG_CLASSIFICATIONS, DOSAGE_FORMS, medicinesAll } from '@/lib/supabase';
import { formatIDR, formatDate, daysUntil, esc } from '@/lib/format';
import { cn } from '@/lib/utils';
import SmartStockDashboard from '@/components/SmartStockDashboard';

const CLASSIFICATION_COLORS: Record<string, string> = {
  'Obat Bebas': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'Obat Bebas Terbatas': 'bg-sky-100 text-sky-700 border-sky-300',
  'Obat Keras': 'bg-amber-100 text-amber-700 border-amber-300',
  'Obat Narkotika': 'bg-rose-100 text-rose-700 border-rose-300',
  'Obat Bahan Alam': 'bg-teal-100 text-teal-700 border-teal-300',
  'Vitamin dan Suplemen': 'bg-violet-100 text-violet-700 border-violet-300',
};

export default function InventoryView() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'expiring'>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await medicinesAll();
    setMedicines((data as Medicine[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return medicines.filter((m) => {
      const matchQ = !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) || (m.generic_name ?? '').toLowerCase().includes(q) || m.drug_classification.toLowerCase().includes(q);
      if (!matchQ) return false;
      if (classificationFilter !== 'all' && m.drug_classification !== classificationFilter) return false;
      if (filter === 'low') return m.stock <= m.reorder_point;
      if (filter === 'expiring') {
        const d = daysUntil(m.expiry_date);
        return d !== null && d <= 30;
      }
      return true;
    });
  }, [medicines, query, filter, classificationFilter]);

  const reorderSuggestions = useMemo(
    () => medicines.filter((m) => m.stock <= m.reorder_point).sort((a, b) => a.stock - b.stock),
    [medicines],
  );

  const handleDelete = async (m: Medicine) => {
    if (!confirm(`Hapus obat "${m.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    await supabase.from('medicines').delete().eq('id', m.id);
    load();
  };

  const exportCSV = () => {
    const headers = ['Kode', 'Nama', 'Generik', 'Klasifikasi', 'Bentuk Sediaan', 'Satuan', 'Stok', 'HPP', 'Harga Jual', 'Reorder Point', 'Kadaluarsa', 'Pemasok'];
    const rows = filtered.map((m) => [
      m.code, m.name, m.generic_name ?? '', m.drug_classification, m.dosage_form, m.unit, m.stock, m.cost_price, m.sell_price, m.reorder_point, m.expiry_date ?? '', m.supplier ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan_stok_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = filtered
      .map((m) => {
        const d = daysUntil(m.expiry_date);
        const expCls = d !== null && d <= 30 ? 'color:#d97706;font-weight:600;' : '';
        const stockCls = m.stock <= m.reorder_point ? 'color:#dc2626;font-weight:600;' : '';
        const clsColor = CLASSIFICATION_COLORS[m.drug_classification] ?? '';
        return `<tr>
          <td>${esc(m.code)}</td><td style="text-align:left">${esc(m.name)}<br/><span style="font-size:10px;color:#64748b">${esc(m.generic_name ?? '')}</span></td>
          <td style="font-size:10px">${esc(m.drug_classification)}</td><td style="font-size:10px">${esc(m.dosage_form)}</td>
          <td style="${stockCls}">${m.stock} ${esc(m.unit)}</td>
          <td>${formatIDR(m.sell_price)}</td>
          <td style="${expCls}">${formatDate(m.expiry_date)}</td>
          <td>${m.reorder_point}</td>
        </tr>`;
      })
      .join('');
    win.document.write(`<html><head><title>Laporan Stok Obat</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}
        h1{font-size:18px;margin:0 0 4px}
        .sub{color:#64748b;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#0ea5e9;color:#fff;padding:8px;text-align:left;font-size:11px;text-transform:uppercase}
        td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center}
        .foot{margin-top:20px;font-size:11px;color:#94a3b8;text-align:center}
      </style></head><body>
      <h1>Apotek Sehat Sentosa</h1>
      <div class="sub">Laporan Stok Obat &middot; ${new Date().toLocaleString('id-ID')}</div>
      <table><thead><tr>
        <th>Kode</th><th style="text-align:left">Nama</th><th>Klasifikasi</th><th>Sediaan</th><th>Stok</th><th>Harga</th><th>Kadaluarsa</th><th>Reorder</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div class="foot">Dicetak oleh AMS &middot; ${filtered.length} item</div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* AI-driven smart stock dashboard */}
      <SmartStockDashboard />
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari obat…"
              className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'low', 'expiring'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-semibold transition',
                  filter === f ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:bg-secondary',
                )}
              >
                {f === 'all' ? 'Semua' : f === 'low' ? 'Stok Rendah' : 'Segera Exp'}
              </button>
            ))}
          </div>
          <select
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
          >
            <option value="all">Semua Klasifikasi</option>
            {DRUG_CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowSuggest(true)} className="flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning hover:bg-warning/15">
            <Lightbulb className="h-4 w-4" /> Reorder ({reorderSuggestions.length})
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button onClick={exportPDF} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Tambah Obat
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Kode</th>
                <th className="px-4 py-3 font-semibold">Nama Obat</th>
                <th className="px-4 py-3 font-semibold">Klasifikasi</th>
                <th className="px-4 py-3 font-semibold">Sediaan</th>
                <th className="px-4 py-3 text-right font-semibold">Stok</th>
                <th className="px-4 py-3 text-right font-semibold">HPP</th>
                <th className="px-4 py-3 text-right font-semibold">Harga Jual</th>
                <th className="px-4 py-3 font-semibold">Kadaluarsa</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-primary" />
                  Memuat…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <Package className="mx-auto mb-2 h-6 w-6 opacity-40" />
                  Tidak ada obat.
                </td></tr>
              ) : (
                filtered.map((m) => {
                  const clsColor = CLASSIFICATION_COLORS[m.drug_classification] ?? 'bg-muted text-muted-foreground border-border';
                  const d = daysUntil(m.expiry_date);
                  const low = m.stock <= m.reorder_point;
                  const expSoon = d !== null && d <= 30;
                  const expired = d !== null && d <= 0;
                  return (
                    <tr key={m.id} className="border-b border-border/60 transition hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.generic_name ?? '-'}</div>
                        <div className="text-[10px] text-muted-foreground/70">{m.supplier ?? '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold', clsColor)}>
                          {m.drug_classification}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{m.dosage_form}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', m.stock <= 0 ? 'bg-destructive/15 text-destructive' : low ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success')}>
                          {m.stock} {m.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatIDR(m.cost_price)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{formatIDR(m.sell_price)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs', expired ? 'text-destructive font-semibold' : expSoon ? 'text-warning font-semibold' : 'text-muted-foreground')}>
                          {formatDate(m.expiry_date)}
                          {d !== null && d > 0 && d <= 30 && ` (${d}h)`}
                          {expired && ' (lewat)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.stock <= 0 ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">HABIS</span>
                        ) : low ? (
                          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">STOK RENDAH</span>
                        ) : expSoon ? (
                          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">EXPIRING</span>
                        ) : (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">AMAN</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => { setEditing(m); setShowForm(true); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(m)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <MedicineForm
          medicine={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {showSuggest && (
        <ReorderModal items={reorderSuggestions} onClose={() => setShowSuggest(false)} />
      )}
    </div>
  );
}

function MedicineForm({ medicine, onClose, onSaved }: { medicine: Medicine | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: medicine?.code ?? '',
    name: medicine?.name ?? '',
    generic_name: medicine?.generic_name ?? '',
    drug_classification: medicine?.drug_classification ?? 'Obat Bebas',
    dosage_form: medicine?.dosage_form ?? 'Tablet',
    unit: medicine?.unit ?? 'pcs',
    stock: medicine?.stock ?? 0,
    cost_price: medicine?.cost_price ?? 0,
    sell_price: medicine?.sell_price ?? 0,
    reorder_point: medicine?.reorder_point ?? 10,
    expiry_date: medicine?.expiry_date ?? '',
    supplier: medicine?.supplier ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('Kode dan nama wajib diisi');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      generic_name: form.generic_name.trim() || null,
      category: form.drug_classification,
      drug_classification: form.drug_classification,
      dosage_form: form.dosage_form,
      unit: form.unit,
      stock: Number(form.stock),
      cost_price: Number(form.cost_price),
      sell_price: Number(form.sell_price),
      reorder_point: Number(form.reorder_point),
      expiry_date: form.expiry_date || null,
      supplier: form.supplier.trim() || null,
      updated_at: new Date().toISOString(),
    };
    let err;
    if (medicine) {
      const r = await supabase.from('medicines').update(payload).eq('id', medicine.id);
      err = r.error;
    } else {
      const r = await supabase.from('medicines').insert(payload);
      err = r.error;
    }
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-card p-5 shadow-2xl animate-fade-in">
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">{medicine ? 'Edit Obat' : 'Tambah Obat'}</h3>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kode Master" required>
            <input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="OBB-001 / OBK-001 / dst." className={inputCls} />
          </Field>
          <Field label="Nama Obat (Brand/Merek)" required>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Nama Generik">
            <input value={form.generic_name} onChange={(e) => set('generic_name', e.target.value)} placeholder="INN / nama generik" className={inputCls} />
          </Field>
          <Field label="Klasifikasi Obat">
            <select value={form.drug_classification} onChange={(e) => set('drug_classification', e.target.value)} className={inputCls}>
              {DRUG_CLASSIFICATIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Bentuk Sediaan">
            <select value={form.dosage_form} onChange={(e) => set('dosage_form', e.target.value)} className={inputCls}>
              {DOSAGE_FORMS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Satuan">
            <input value={form.unit} onChange={(e) => set('unit', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Stok">
            <input type="number" value={form.stock} onChange={(e) => set('stock', parseInt(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Reorder Point">
            <input type="number" value={form.reorder_point} onChange={(e) => set('reorder_point', parseInt(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Harga Modal (HPP)">
            <input type="number" value={form.cost_price} onChange={(e) => set('cost_price', parseInt(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Harga Jual">
            <input type="number" value={form.sell_price} onChange={(e) => set('sell_price', parseInt(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Kadaluarsa">
            <input type="date" value={form.expiry_date ?? ''} onChange={(e) => set('expiry_date', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Pemasok">
            <input value={form.supplier ?? ''} onChange={(e) => set('supplier', e.target.value)} className={inputCls} />
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary">Batal</button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}{required && ' *'}</span>
      {children}
    </label>
  );
}

function ReorderModal({ items, onClose }: { items: Medicine[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-card p-5 shadow-2xl animate-fade-in">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-warning" />
          <h3 className="text-base font-bold text-foreground">Saran Reorder (Restock)</h3>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
            <AlertTriangle className="mb-2 h-6 w-6 opacity-40" />
            <p className="text-sm">Semua stok di atas reorder point.</p>
          </div>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto scrollbar-thin">
            {items.map((m) => {
              const suggested = Math.max(m.reorder_point * 2 - m.stock, m.reorder_point);
              return (
                <div key={m.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.code} &middot; {m.drug_classification} &middot; {m.dosage_form}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">
                      Sisa {m.stock} {m.unit}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-warning/10 px-3 py-2">
                    <span className="text-xs text-muted-foreground">Saran pemesanan</span>
                    <span className="text-sm font-bold text-warning">{suggested} {m.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
