'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  Package,
  Layers,
  ShieldAlert,
  Calendar,
  Building2,
  CheckCircle2,
  Printer,
} from 'lucide-react';
import { supabase, type Medicine, type MedicineBatch } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  recalled: 'bg-destructive/15 text-destructive',
  expired: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  depleted: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  recalled: 'Ditarik (Recall)',
  expired: 'Kadaluarsa',
  depleted: 'Habis',
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryTone(days: number | null): { color: string; label: string } {
  if (days === null) return { color: 'text-muted-foreground', label: 'Tgl Expired belum diisi' };
  if (days < 0) return { color: 'text-destructive', label: 'Sudah Kadaluarsa' };
  if (days <= 30) return { color: 'text-destructive', label: `Exp ${days} hari lagi!` };
  if (days <= 90) return { color: 'text-amber-600 dark:text-amber-400', label: `Exp ${days} hari lagi` };
  if (days <= 180) return { color: 'text-sky-600 dark:text-sky-400', label: `Exp ${days} hari lagi` };
  return { color: 'text-emerald-600', label: `Exp ${days} hari lagi` };
}

type BatchWithMed = MedicineBatch & { medicine?: Medicine };

export default function BatchTrackingView() {
  const [batches, setBatches] = useState<BatchWithMed[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expiryFilter, setExpiryFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [showRecall, setShowRecall] = useState<BatchWithMed | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [bRes, mRes] = await Promise.all([
      supabase.from('medicine_batches').select('*').order('created_at', { ascending: false }),
      supabase.from('medicines').select('*').order('name', { ascending: true }),
    ]);
    const medList = (mRes.data as Medicine[]) ?? [];
    setMedicines(medList);
    setBatches(((bRes.data as MedicineBatch[]) ?? []).map((b) => ({
      ...b,
      medicine: medList.find((m) => m.id === b.medicine_id),
    })));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return batches.filter((b) => {
      const matchQ = !q ||
        b.batch_no.toLowerCase().includes(q) ||
        (b.medicine?.name ?? '').toLowerCase().includes(q) ||
        (b.medicine?.code ?? '').toLowerCase().includes(q) ||
        (b.manufacturer ?? '').toLowerCase().includes(q);
      if (!matchQ) return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (expiryFilter !== 'all') {
        const days = b.expiry_date ? daysUntil(b.expiry_date) : null;
        if (expiryFilter === 'expired' && (days === null || days >= 0)) return false;
        if (expiryFilter === '30' && (days === null || days < 0 || days > 30)) return false;
        if (expiryFilter === '90' && (days === null || days < 0 || days > 90)) return false;
        if (expiryFilter === 'safe' && (days === null || days <= 90)) return false;
      }
      return true;
    });
  }, [batches, query, statusFilter, expiryFilter]);

  const stats = useMemo(() => {
    const active = batches.filter((b) => b.status === 'active').length;
    const recalled = batches.filter((b) => b.status === 'recalled').length;
    const expiringSoon = batches.filter((b) => {
      if (!b.expiry_date || b.status !== 'active') return false;
      const d = daysUntil(b.expiry_date);
      return d >= 0 && d <= 90;
    }).length;
    const expiredCount = batches.filter((b) => {
      if (!b.expiry_date) return false;
      return daysUntil(b.expiry_date) < 0 || b.status === 'expired';
    }).length;
    return { total: batches.length, active, recalled, expiringSoon, expiredCount };
  }, [batches]);

  const handleDelete = async (b: MedicineBatch) => {
    if (!confirm(`Hapus batch "${b.batch_no}"?`)) return;
    await supabase.from('medicine_batches').delete().eq('id', b.id);
    loadData();
  };

  const handleRecall = async (batch: BatchWithMed, action: 'recalled' | 'active') => {
    await supabase.from('medicine_batches').update({
      status: action,
      updated_at: new Date().toISOString(),
    }).eq('id', batch.id);
    setShowRecall(null);
    loadData();
  };

  const printBatchReport = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = filtered.map((b) => {
      const days = b.expiry_date ? daysUntil(b.expiry_date) : null;
      const exp = b.expiry_date ? formatDate(b.expiry_date) : '-';
      const expLabel = days !== null ? (days < 0 ? 'EXPIRED' : `${days} hari`) : '-';
      return `<tr>
        <td>${b.medicine?.code ?? '-'}</td>
        <td style="text-align:left">${b.medicine?.name ?? '-'}</td>
        <td style="text-align:center">${b.batch_no}</td>
        <td style="text-align:center">${b.quantity}</td>
        <td style="text-align:center">${exp}</td>
        <td style="text-align:center;font-weight:bold;color:${days !== null && days <= 90 ? '#dc2626' : '#16a34a'}">${expLabel}</td>
        <td style="text-align:center">${b.manufacturer ?? '-'}</td>
        <td style="text-align:center">${STATUS_LABELS[b.status]}</td>
      </tr>`;
    }).join('');
    win.document.write(`<html><head><title>Laporan Batch/Lot Obat</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}
        h1{font-size:18px;margin:0 0 4px} h2{font-size:12px;margin:0 0 16px;color:#64748b}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th{background:#0ea5e9;color:#fff;padding:6px;text-align:center}
        th:first-child,th:nth-child(2){text-align:left}
        td{padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:center}
        .foot{margin-top:20px;font-size:10px;color:#94a3b8;text-align:center}
      </style></head><body>
      <h1>Laporan Tracking Batch/Lot Obat</h1>
      <h2>ApotekZ — Dicetak ${new Date().toLocaleString('id-ID')}</h2>
      <table><thead><tr><th style="text-align:left">Kode</th><th style="text-align:left">Nama Obat</th><th>Batch No</th><th>Qty</th><th>Tgl Expired</th><th>Status Exp</th><th>Pabrik</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="foot">ApotekZ — ${new Date().toLocaleString('id-ID')}</div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Batch" value={String(stats.total)} icon={Layers} tone="primary" />
        <StatCard label="Batch Aktif" value={String(stats.active)} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Expiring Soon" value={String(stats.expiringSoon)} icon={Calendar} tone="amber" />
        <StatCard label="Recall / Expired" value={String(stats.recalled + stats.expiredCount)} icon={ShieldAlert} tone="destructive" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari batch / nama obat / kode / pabrik..."
              className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-semibold text-muted-foreground outline-none focus:border-primary"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="recalled">Ditarik</option>
            <option value="expired">Kadaluarsa</option>
            <option value="depleted">Habis</option>
          </select>
          <select
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-semibold text-muted-foreground outline-none focus:border-primary"
          >
            <option value="all">Semua Expiry</option>
            <option value="expired">Sudah Expired</option>
            <option value="30">Exp ≤ 30 hari</option>
            <option value="90">Exp ≤ 90 hari</option>
            <option value="safe">Exp &gt; 90 hari</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={printBatchReport}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            <Printer className="h-4 w-4" /> Cetak
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Tambah Batch
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Layers className="h-8 w-8 opacity-40" />
            <p className="text-sm">Belum ada batch tercatat. Klik "Tambah Batch" untuk mulai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Obat</th>
                  <th className="px-4 py-3 font-semibold">Batch No</th>
                  <th className="px-4 py-3 text-center font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">Tgl Expired</th>
                  <th className="px-4 py-3 font-semibold">Pabrik</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const days = b.expiry_date ? daysUntil(b.expiry_date) : null;
                  const exp = expiryTone(days);
                  return (
                    <tr key={b.id} className="border-b border-border/60 transition hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{b.medicine?.name ?? 'Unknown'}</div>
                        <div className="text-[10px] text-muted-foreground">{b.medicine?.code ?? '-'} · {b.medicine?.category ?? '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-foreground">{b.batch_no}</span>
                        <div className="text-[10px] text-muted-foreground">Masuk: {formatDate(b.received_date)}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('font-bold', b.quantity === 0 ? 'text-muted-foreground' : 'text-foreground')}>{b.quantity}</span>
                        <span className="text-[10px] text-muted-foreground"> {b.medicine?.unit ?? 'pcs'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-foreground">{b.expiry_date ? formatDate(b.expiry_date) : '-'}</div>
                        <div className={cn('text-[10px] font-semibold', exp.color)}>{exp.label}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{b.manufacturer ?? '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_STYLES[b.status])}>
                          {STATUS_LABELS[b.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {b.status === 'active' && (
                            <button
                              onClick={() => setShowRecall(b)}
                              className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
                              title="Tandai recall BPOM"
                            >
                              <ShieldAlert className="h-3.5 w-3.5" /> Recall
                            </button>
                          )}
                          {b.status === 'recalled' && (
                            <button
                              onClick={() => handleRecall(b, 'active')}
                              className="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400"
                              title="Kembalikan ke aktif"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Aktifkan
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(b)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recall confirmation modal */}
      {showRecall && (
        <RecallModal
          batch={showRecall}
          onClose={() => setShowRecall(null)}
          onConfirm={() => handleRecall(showRecall, 'recalled')}
        />
      )}

      {showForm && (
        <BatchForm
          medicines={medicines}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadData(); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: string }) {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
    destructive: 'bg-destructive/15 text-destructive',
  };
  return (
    <div className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ── Recall Modal ────────────────────────────────────────────────────────────

function RecallModal({ batch, onClose, onConfirm }: {
  batch: BatchWithMed;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Recall Batch</h3>
            <p className="text-xs text-muted-foreground">Tandai batch sebagai ditarik BPOM</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1.5">
            <Row label="Obat" value={batch.medicine?.name ?? '-'} />
            <Row label="Batch No" value={batch.batch_no} />
            <Row label="Qty" value={`${batch.quantity} ${batch.medicine?.unit ?? 'pcs'}`} />
            <Row label="Pabrik" value={batch.manufacturer ?? '-'} />
            <Row label="Tgl Expired" value={batch.expiry_date ? formatDate(batch.expiry_date) : '-'} />
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-xs text-destructive">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              Batch yang ditarik tidak bisa dijual. Stok batch ini akan ditandai sebagai recalled. Pastikan obat dari batch ini sudah dikeluarkan dari rak penjualan.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary">Batal</button>
            <button onClick={onConfirm} className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-white hover:bg-destructive/90">
              Konfirmasi Recall
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

// ── Batch Form ──────────────────────────────────────────────────────────────

function BatchForm({ medicines, onClose, onSaved }: {
  medicines: Medicine[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    medicine_id: '',
    batch_no: '',
    quantity: '',
    received_date: new Date().toISOString().slice(0, 10),
    expiry_date: '',
    manufacturer: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const selectedMed = medicines.find((m) => m.id === form.medicine_id);

  const handleSave = async () => {
    if (!form.medicine_id || !form.batch_no.trim()) return;
    setSaving(true);
    await supabase.from('medicine_batches').insert({
      medicine_id: form.medicine_id,
      batch_no: form.batch_no.trim(),
      quantity: Number(form.quantity) || 0,
      received_date: form.received_date,
      expiry_date: form.expiry_date || null,
      manufacturer: form.manufacturer.trim() || null,
      notes: form.notes.trim() || null,
      status: 'active',
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Tambah Batch/Lot Obat</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Pilih Obat <span className="text-destructive">*</span></label>
            <select
              value={form.medicine_id}
              onChange={(e) => setForm({ ...form, medicine_id: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="">— Pilih obat —</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
              ))}
            </select>
            {selectedMed && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Stok sistem saat ini: {selectedMed.stock} {selectedMed.unit} · Kategori: {selectedMed.category}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nomor Batch" value={form.batch_no} onChange={(v) => setForm({ ...form, batch_no: v })} required placeholder="Contoh: BN2026A001" />
            <Field label="Jumlah (Qty)" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} type="number" placeholder="0" />
            <Field label="Tanggal Masuk" value={form.received_date} onChange={(v) => setForm({ ...form, received_date: v })} type="date" />
            <Field label="Tanggal Kadaluarsa" value={form.expiry_date} onChange={(v) => setForm({ ...form, expiry_date: v })} type="date" />
            <div className="sm:col-span-2">
              <Field label="Pabrik Farmasi" value={form.manufacturer} onChange={(v) => setForm({ ...form, manufacturer: v })} placeholder="Contoh: Kimia Farma, Kalbe, Sanbe..." />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Catatan</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Catatan tambahan..." />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary">Batal</button>
            <button onClick={handleSave} disabled={saving || !form.medicine_id || !form.batch_no.trim()} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan Batch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
