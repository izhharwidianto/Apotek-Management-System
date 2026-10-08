'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  ClipboardCheck,
  X,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Package,
  Save,
  Lock,
} from 'lucide-react';
import { supabase, type Medicine, type StockOpname, type StockOpnameItem, medicinesAll } from '@/lib/supabase';
import { formatDate, esc } from '@/lib/format';
import { cn } from '@/lib/utils';

function genOpnameNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 900) + 100;
  return `SO-${ymd}-${rand}`;
}

type OpnameWithItems = StockOpname & { items: (StockOpnameItem & { medicine?: Medicine })[] };

export default function StockOpnameView() {
  const [opnames, setOpnames] = useState<OpnameWithItems[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingOpname, setEditingOpname] = useState<OpnameWithItems | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [soRes, medRes] = await Promise.all([
      supabase.from('stock_opnames').select('*').order('created_at', { ascending: false }),
      medicinesAll(),
    ]);
    const soList = (soRes.data as StockOpname[]) ?? [];
    const medList = (medRes.data as Medicine[]) ?? [];

    if (soList.length > 0) {
      const { data: items } = await supabase.from('stock_opname_items').select('*').in('opname_id', soList.map((s) => s.id));
      const itemsMap = ((items as StockOpnameItem[]) ?? []).reduce<Record<string, StockOpnameItem[]>>((acc, it) => {
        if (!acc[it.opname_id]) acc[it.opname_id] = [];
        acc[it.opname_id].push(it);
        return acc;
      }, {});
      setOpnames(soList.map((s) => ({
        ...s,
        items: (itemsMap[s.id] ?? []).map((it) => ({
          ...it,
          medicine: medList.find((m) => m.id === it.medicine_id),
        })),
      })));
    } else {
      setOpnames([]);
    }
    setMedicines(medList);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return opnames.filter((o) => !q || o.opname_no.toLowerCase().includes(q));
  }, [opnames, query]);

  const stats = useMemo(() => {
    const draft = opnames.filter((o) => o.status === 'draft').length;
    const completed = opnames.filter((o) => o.status === 'completed').length;
    const totalAdjustments = opnames.reduce((a, o) => a + o.items.filter((it) => it.difference !== null && it.difference !== 0).length, 0);
    return { total: opnames.length, draft, completed, totalAdjustments };
  }, [opnames]);

  const handleDelete = async (o: StockOpname) => {
    if (!confirm(`Hapus sesi opname "${o.opname_no}"?`)) return;
    await supabase.from('stock_opnames').delete().eq('id', o.id);
    loadData();
  };

  const handleComplete = async (opname: OpnameWithItems) => {
    if (!confirm(`Selesaikan opname "${opname.opname_no}"? Semua stok akan di-adjust sesuai hasil hitung fisik dan tidak bisa diubah lagi.`)) return;

    const { error } = await supabase.rpc('complete_stock_opname', { p_opname_id: opname.id });
    if (error) window.alert(error.message);
    loadData();
  };

  const printOpname = (opname: OpnameWithItems) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = opname.items.map((it) => `<tr>
      <td>${esc(it.medicine?.code ?? '-')}</td>
      <td style="text-align:left">${esc(it.medicine?.name ?? '-')}</td>
      <td style="text-align:center">${it.system_stock}</td>
      <td style="text-align:center">${it.physical_stock ?? '-'}</td>
      <td style="text-align:center;font-weight:bold;color:${it.difference && it.difference !== 0 ? '#dc2626' : '#16a34a'}">${it.difference !== null ? (it.difference > 0 ? '+' + it.difference : String(it.difference)) : '-'}</td>
      <td style="text-align:center">${it.adjusted ? 'Ya' : '-'}</td>
    </tr>`).join('');
    win.document.write(`<html><head><title>Stok Opname ${esc(opname.opname_no)}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}
        h1{font-size:18px;margin:0 0 4px} h2{font-size:12px;margin:0 0 16px;color:#64748b}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th{background:#0ea5e9;color:#fff;padding:6px;text-align:left}
        td{padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:center}
        .foot{margin-top:20px;font-size:10px;color:#94a3b8;text-align:center}
      </style></head><body>
      <h1>Laporan Stok Opname</h1>
      <h2>${esc(opname.opname_no)} — ${formatDate(opname.opname_date)}</h2>
      <table><thead><tr><th style="text-align:left">Kode</th><th style="text-align:left">Nama Obat</th><th>Sistem</th><th>Fisik</th><th>Selisih</th><th>Adjusted</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="foot">Dicetak oleh ApotekZ — ${new Date().toLocaleString('id-ID')}</div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Opname" value={String(stats.total)} icon={ClipboardCheck} tone="primary" />
        <StatCard label="Draft" value={String(stats.draft)} icon={Package} tone="amber" />
        <StatCard label="Selesai" value={String(stats.completed)} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Total Adjust" value={String(stats.totalAdjustments)} icon={AlertTriangle} tone="sky" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nomor opname..."
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          onClick={() => { setEditingOpname(null); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Mulai Opname
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <ClipboardCheck className="h-8 w-8 opacity-40" />
            <p className="text-sm">Belum ada sesi stok opname. Klik "Mulai Opname" untuk mulai.</p>
          </div>
        ) : (
          filtered.map((o) => {
            const mismatches = o.items.filter((it) => it.physical_stock !== null && it.physical_stock !== it.system_stock).length;
            const uncounted = o.items.filter((it) => it.physical_stock === null).length;
            return (
              <div key={o.id} className="rounded-xl border border-border bg-card shadow-sm">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      o.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
                    )}>
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">{o.opname_no}</span>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold',
                          o.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
                        )}>
                          {o.status === 'completed' ? 'SELESAI' : 'DRAFT'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(o.opname_date)} · {o.items.length} item
                        {mismatches > 0 && <span className="ml-2 font-semibold text-amber-600">· {mismatches} selisih</span>}
                        {uncounted > 0 && <span className="ml-2 font-semibold text-muted-foreground">· {uncounted} belum dihitung</span>}
                      </p>
                      {o.notes && <p className="mt-0.5 text-xs text-muted-foreground">{o.notes}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {o.status === 'draft' && (
                      <>
                        <button
                          onClick={() => { setEditingOpname(o); setShowForm(true); }}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          <ClipboardCheck className="h-4 w-4" /> Input Hitung
                        </button>
                        <button
                          onClick={() => handleComplete(o)}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                        >
                          <Lock className="h-4 w-4" /> Selesaikan
                        </button>
                        <button
                          onClick={() => handleDelete(o)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {o.status === 'completed' && (
                      <button
                        onClick={() => printOpname(o)}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                      >
                        <Printer className="h-4 w-4" /> Cetak
                      </button>
                    )}
                  </div>
                </div>

                {o.status === 'draft' && o.items.length > 0 && (
                  <div className="overflow-x-auto border-t border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold">Kode</th>
                          <th className="px-4 py-2 text-left font-semibold">Nama</th>
                          <th className="px-4 py-2 text-center font-semibold">Sistem</th>
                          <th className="px-4 py-2 text-center font-semibold">Fisik</th>
                          <th className="px-4 py-2 text-center font-semibold">Selisih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.items.slice(0, 5).map((it) => (
                          <tr key={it.id} className="border-t border-border/40">
                            <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{it.medicine?.code ?? '-'}</td>
                            <td className="px-4 py-2 text-foreground">{it.medicine?.name ?? '-'}</td>
                            <td className="px-4 py-2 text-center text-muted-foreground">{it.system_stock}</td>
                            <td className="px-4 py-2 text-center">{it.physical_stock ?? '-'}</td>
                            <td className="px-4 py-2 text-center">
                              {it.difference === null ? <span className="text-muted-foreground">-</span> :
                               it.difference === 0 ? <span className="text-emerald-600">0</span> :
                               <span className="font-semibold text-amber-600">{it.difference > 0 ? '+' : ''}{it.difference}</span>}
                            </td>
                          </tr>
                        ))}
                        {o.items.length > 5 && (
                          <tr><td colSpan={5} className="px-4 py-2 text-center text-xs text-muted-foreground">+{o.items.length - 5} item lainnya...</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <OpnameForm
          medicines={medicines}
          editingOpname={editingOpname}
          onClose={() => { setShowForm(false); setEditingOpname(null); }}
          onSaved={() => { setShowForm(false); setEditingOpname(null); loadData(); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: string }) {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
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

// ── Opname Form ────────────────────────────────────────────────────────────

function OpnameForm({ medicines, editingOpname, onClose, onSaved }: {
  medicines: Medicine[];
  editingOpname: OpnameWithItems | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [opnameDate, setOpnameDate] = useState(editingOpname?.opname_date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(editingOpname?.notes ?? '');
  const [items, setItems] = useState<{ medicine_id: string; medicine: Medicine; system_stock: number; physical_stock: string }[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingOpname) {
      setItems(editingOpname.items.map((it) => ({
        medicine_id: it.medicine_id,
        medicine: it.medicine ?? medicines.find((m) => m.id === it.medicine_id) ?? ({} as Medicine),
        system_stock: it.system_stock,
        physical_stock: it.physical_stock !== null ? String(it.physical_stock) : '',
      })));
    } else {
      setItems(medicines.map((m) => ({
        medicine_id: m.id,
        medicine: m,
        system_stock: m.stock,
        physical_stock: '',
      })));
    }
  }, [editingOpname, medicines]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.medicine.name.toLowerCase().includes(q) || it.medicine.code.toLowerCase().includes(q));
  }, [items, search]);

  const updatePhysical = (medicineId: string, val: string) => {
    setItems(items.map((it) => it.medicine_id === medicineId ? { ...it, physical_stock: val } : it));
  };

  const counted = items.filter((it) => it.physical_stock !== '').length;
  const mismatches = items.filter((it) => {
    if (it.physical_stock === '') return false;
    return Number(it.physical_stock) !== it.system_stock;
  }).length;

  const handleSave = async () => {
    setSaving(true);
    if (editingOpname) {
      // Update existing items
      for (const it of items) {
        const existing = editingOpname.items.find((i) => i.medicine_id === it.medicine_id);
        if (existing) {
          const phys = it.physical_stock === '' ? null : Number(it.physical_stock);
          const diff = phys !== null ? phys - it.system_stock : null;
          await supabase.from('stock_opname_items').update({
            physical_stock: phys,
            difference: diff,
          }).eq('id', existing.id);
        }
      }
      await supabase.from('stock_opnames').update({
        opname_date: opnameDate,
        notes: notes.trim() || null,
      }).eq('id', editingOpname.id);
    } else {
      const opnameNo = genOpnameNo();
      const { data: soData, error } = await supabase.from('stock_opnames').insert({
        opname_no: opnameNo,
        opname_date: opnameDate,
        status: 'draft',
        notes: notes.trim() || null,
      }).select().single();
      if (error || !soData) { setSaving(false); return; }
      const opnameId = (soData as StockOpname).id;
      await supabase.from('stock_opname_items').insert(
        items.map((it) => ({
          opname_id: opnameId,
          medicine_id: it.medicine_id,
          system_stock: it.system_stock,
          physical_stock: it.physical_stock === '' ? null : Number(it.physical_stock),
          difference: it.physical_stock === '' ? null : Number(it.physical_stock) - it.system_stock,
          adjusted: false,
        })),
      );
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">{editingOpname ? 'Input Hasit Fisik' : 'Mulai Stok Opname'}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Tanggal Opname</label>
            <input type="date" value={opnameDate} onChange={(e) => setOpnameDate(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Sudah Dihitung</label>
            <div className="flex h-[42px] items-center rounded-xl border border-border bg-muted/20 px-3 text-sm font-semibold text-foreground">
              {counted} / {items.length}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Selisih</label>
            <div className={cn(
              'flex h-[42px] items-center rounded-xl border px-3 text-sm font-bold',
              mismatches > 0 ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400' : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400',
            )}>
              {mismatches} item
            </div>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari obat untuk input cepat..."
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="max-h-[40vh] overflow-y-auto overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Kode</th>
                <th className="px-3 py-2 text-left font-semibold">Nama Obat</th>
                <th className="px-3 py-2 text-center font-semibold">Sistem</th>
                <th className="px-3 py-2 text-center font-semibold">Fisik</th>
                <th className="px-3 py-2 text-center font-semibold">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => {
                const phys = it.physical_stock === '' ? null : Number(it.physical_stock);
                const diff = phys !== null ? phys - it.system_stock : null;
                return (
                  <tr key={it.medicine_id} className="border-t border-border/40">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{it.medicine.code}</td>
                    <td className="px-3 py-2 text-foreground">{it.medicine.name}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{it.system_stock}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        value={it.physical_stock}
                        onChange={(e) => updatePhysical(it.medicine_id, e.target.value)}
                        className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm outline-none focus:border-primary"
                        placeholder="-"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {diff === null ? <span className="text-muted-foreground">-</span> :
                       diff === 0 ? <span className="text-emerald-600">0</span> :
                       <span className="font-bold text-amber-600">{diff > 0 ? '+' : ''}{diff}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Catatan</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Catatan untuk sesi opname ini..." />
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary">Tutup</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
