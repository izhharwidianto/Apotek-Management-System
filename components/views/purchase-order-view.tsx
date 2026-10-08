'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Package,
  RefreshCw,
  Truck,
  FileText,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronRight,
  Printer,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import {
  supabase,
  type Medicine,
  type Supplier,
  type PurchaseOrder,
  type PoItem, medicinesAll } from '@/lib/supabase';
import { formatIDR, formatDate, esc } from '@/lib/format';
import { cn } from '@/lib/utils';

type PoWithItems = PurchaseOrder & { supplier?: Supplier | null; items: PoItem[] };

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  received: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  cancelled: 'bg-destructive/15 text-destructive',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Dikirim',
  partial: 'Diterima Sebagian',
  received: 'Diterima',
  cancelled: 'Dibatalkan',
};

function genPoNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 900) + 100;
  return `PO-${ymd}-${rand}`;
}

export default function PurchaseOrderView() {
  const [pos, setPos] = useState<PoWithItems[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [poRes, supRes, medRes] = await Promise.all([
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name', { ascending: true }),
      medicinesAll(),
    ]);
    const poList = (poRes.data as PurchaseOrder[]) ?? [];
    const supList = (supRes.data as Supplier[]) ?? [];
    const medList = (medRes.data as Medicine[]) ?? [];

    if (poList.length > 0) {
      const { data: items } = await supabase.from('po_items').select('*').in('po_id', poList.map((p) => p.id));
      const itemsMap = ((items as PoItem[]) ?? []).reduce<Record<string, PoItem[]>>((acc, it) => {
        if (!acc[it.po_id]) acc[it.po_id] = [];
        acc[it.po_id].push(it);
        return acc;
      }, {});
      setPos(poList.map((p) => ({
        ...p,
        supplier: supList.find((s) => s.id === p.supplier_id) ?? null,
        items: itemsMap[p.id] ?? [],
      })));
    } else {
      setPos([]);
    }
    setSuppliers(supList);
    setMedicines(medList);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pos.filter((p) => {
      const matchQ = !q || p.po_no.toLowerCase().includes(q) || (p.supplier?.name ?? '').toLowerCase().includes(q);
      if (!matchQ) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });
  }, [pos, query, statusFilter]);

  const stats = useMemo(() => {
    const total = pos.length;
    const draft = pos.filter((p) => p.status === 'draft').length;
    const sent = pos.filter((p) => p.status === 'sent').length;
    const received = pos.filter((p) => p.status === 'received' || p.status === 'partial').length;
    const totalValue = pos.reduce((a, b) => a + Number(b.total_cost), 0);
    return { total, draft, sent, received, totalValue };
  }, [pos]);

  const toggleExpand = (id: string) => setExpanded(expanded === id ? null : id);

  const handleDeletePo = async (p: PurchaseOrder) => {
    if (!confirm(`Hapus PO "${p.po_no}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    await supabase.from('purchase_orders').delete().eq('id', p.id);
    loadData();
  };

  const handleReceivePo = async (po: PoWithItems) => {
    if (!confirm(`Tandai semua item PO "${po.po_no}" sebagai diterima? Stok obat akan bertambah otomatis.`)) return;

    const { error } = await supabase.rpc('receive_purchase_order', { p_po_id: po.id });
    if (error) window.alert(error.message);
    loadData();
  };

  const handleCancelPo = async (po: PurchaseOrder) => {
    if (!confirm(`Batalkan PO "${po.po_no}"?`)) return;
    await supabase.from('purchase_orders').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', po.id);
    loadData();
  };

  const printPo = (po: PoWithItems) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = po.items.map((it) => `<tr>
      <td>${esc(it.medicine_name)}</td>
      <td style="text-align:center">${it.quantity}</td>
      <td style="text-align:right">${formatIDR(it.unit_cost)}</td>
      <td style="text-align:right">${formatIDR(it.subtotal)}</td>
    </tr>`).join('');
    win.document.write(`<html><head><title>${esc(po.po_no)}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}
        h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:0 0 12px}
        .info{display:flex;gap:40px;margin-bottom:16px;font-size:12px}
        .info b{display:inline-block;width:80px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#0ea5e9;color:#fff;padding:8px;text-align:left}
        td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
        .total{margin-top:12px;text-align:right;font-size:16px;font-weight:bold}
        .foot{margin-top:20px;font-size:11px;color:#94a3b8;text-align:center}
      </style></head><body>
      <h1>Purchase Order</h1>
      <h2>${esc(po.po_no)}</h2>
      <div class="info">
        <div><b>Pemasok:</b> ${esc(po.supplier?.name ?? '-')}<br/><b>Tgl Order:</b> ${formatDate(po.order_date)}<br/><b>Estimasi:</b> ${formatDate(po.expected_date)}</div>
        <div><b>Status:</b> ${STATUS_LABELS[po.status]}<br/><b>Catatan:</b> ${esc(po.notes ?? '-')}</div>
      </div>
      <table><thead><tr><th style="text-align:left">Obat</th><th>Qty</th><th style="text-align:right">Harga</th><th style="text-align:right">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="total">Total: ${formatIDR(po.total_cost)}</div>
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
        <StatCard label="Total PO" value={String(stats.total)} icon={FileText} tone="primary" />
        <StatCard label="Draft" value={String(stats.draft)} icon={Pencil} tone="muted" />
        <StatCard label="Dikirim" value={String(stats.sent)} icon={Truck} tone="sky" />
        <StatCard label="Nilai Total" value={formatIDR(stats.totalValue)} icon={CheckCircle2} tone="emerald" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari PO / pemasok..."
              className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['all', 'draft', 'sent', 'partial', 'received', 'cancelled'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-semibold transition',
                  statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:bg-secondary',
                )}
              >
                {s === 'all' ? 'Semua' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingSupplier(null); setShowSupplierForm(true); }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            <Truck className="h-4 w-4" /> Pemasok
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Buat PO
          </button>
        </div>
      </div>

      {/* Supplier list quick view */}
      {suppliers.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/20 p-3">
          <span className="text-xs font-semibold text-muted-foreground">Pemasok terdaftar:</span>
          {suppliers.map((s) => (
            <button
              key={s.id}
              onClick={() => { setEditingSupplier(s); setShowSupplierForm(true); }}
              className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground transition hover:border-primary/40 hover:bg-primary/5"
            >
              {s.name}
              {s.phone && <span className="ml-1 text-muted-foreground">· {s.phone}</span>}
            </button>
          ))}
        </div>
      )}

      {/* PO List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Package className="h-8 w-8 opacity-40" />
            <p className="text-sm">Belum ada Purchase Order. Klik "Buat PO" untuk mulai.</p>
          </div>
        ) : (
          filtered.map((po) => (
            <div key={po.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <button
                onClick={() => toggleExpand(po.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/30"
              >
                {expanded === po.id ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-foreground">{po.po_no}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_STYLES[po.status])}>
                      {STATUS_LABELS[po.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {po.supplier?.name ?? 'Tanpa pemasok'} · {formatDate(po.order_date)} · {po.items.length} item
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-foreground">{formatIDR(po.total_cost)}</span>
              </button>

              {expanded === po.id && (
                <div className="border-t border-border bg-muted/10 p-4">
                  <div className="mb-3 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                    <Info label="Pemasok" value={po.supplier?.name ?? '-'} />
                    <Info label="Tgl Order" value={formatDate(po.order_date)} />
                    <Info label="Estimasi Tiba" value={formatDate(po.expected_date)} />
                    <Info label="Tgl Diterima" value={formatDate(po.received_date)} />
                  </div>
                  {po.notes && (
                    <p className="mb-3 rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground">
                      <AlertCircle className="mr-1 inline h-3 w-3" /> {po.notes}
                    </p>
                  )}
                  <table className="mb-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 font-semibold">Obat</th>
                        <th className="py-2 text-center font-semibold">Qty</th>
                        <th className="py-2 text-center font-semibold">Diterima</th>
                        <th className="py-2 text-right font-semibold">Harga</th>
                        <th className="py-2 text-right font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.items.map((it) => (
                        <tr key={it.id} className="border-b border-border/40">
                          <td className="py-2 text-foreground">{it.medicine_name}</td>
                          <td className="py-2 text-center text-muted-foreground">{it.quantity}</td>
                          <td className="py-2 text-center">
                            <span className={cn('text-xs font-semibold', it.received_qty >= it.quantity ? 'text-emerald-600' : 'text-amber-600')}>
                              {it.received_qty}/{it.quantity}
                            </span>
                          </td>
                          <td className="py-2 text-right text-muted-foreground">{formatIDR(it.unit_cost)}</td>
                          <td className="py-2 text-right font-semibold text-foreground">{formatIDR(it.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex flex-wrap gap-2">
                    {po.status !== 'received' && po.status !== 'cancelled' && (
                      <>
                        <button
                          onClick={() => handleReceivePo(po)}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Terima & Update Stok
                        </button>
                        {po.status === 'draft' && (
                          <button
                            onClick={async () => {
                              await supabase.from('purchase_orders').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', po.id);
                              loadData();
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
                          >
                            <Truck className="h-4 w-4" /> Tandai Dikirim
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => printPo(po)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                    >
                      <Printer className="h-4 w-4" /> Cetak
                    </button>
                    {po.status !== 'received' && (
                      <button
                        onClick={() => handleCancelPo(po)}
                        className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20"
                      >
                        <X className="h-4 w-4" /> Batalkan
                      </button>
                    )}
                    {po.status === 'draft' && (
                      <button
                        onClick={() => handleDeletePo(po)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Hapus
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showForm && (
        <PoForm
          suppliers={suppliers}
          medicines={medicines}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadData(); }}
        />
      )}
      {showSupplierForm && (
        <SupplierForm
          supplier={editingSupplier}
          onClose={() => setShowSupplierForm(false)}
          onSaved={() => { setShowSupplierForm(false); loadData(); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: string }) {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    muted: 'bg-muted text-muted-foreground',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

// ── PO Form ────────────────────────────────────────────────────────────────

function PoForm({ suppliers, medicines, onClose, onSaved }: {
  suppliers: Supplier[];
  medicines: Medicine[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ medicine_id: string; medicine_name: string; quantity: number; unit_cost: number }[]>([]);
  const [selMed, setSelMed] = useState('');
  const [saving, setSaving] = useState(false);

  const addItem = () => {
    if (!selMed) return;
    const med = medicines.find((m) => m.id === selMed);
    if (!med) return;
    if (items.find((i) => i.medicine_id === med.id)) return;
    setItems([...items, {
      medicine_id: med.id,
      medicine_name: med.name,
      quantity: 1,
      unit_cost: Number(med.cost_price),
    }]);
    setSelMed('');
  };

  const updateItem = (idx: number, field: 'quantity' | 'unit_cost', val: number) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: val, } : it));
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const total = items.reduce((a, b) => a + b.quantity * b.unit_cost, 0);

  const handleSave = async () => {
    if (items.length === 0) return;
    setSaving(true);
    const poNo = genPoNo();
    const { data: poData, error: poErr } = await supabase
      .from('purchase_orders')
      .insert({
        po_no: poNo,
        supplier_id: supplierId || null,
        status: 'draft',
        order_date: new Date().toISOString().slice(0, 10),
        expected_date: expectedDate || null,
        total_cost: total,
        notes: notes.trim() || null,
      })
      .select()
      .single();
    if (poErr || !poData) { setSaving(false); return; }
    const poId = (poData as PurchaseOrder).id;
    await supabase.from('po_items').insert(
      items.map((it) => ({
        po_id: poId,
        medicine_id: it.medicine_id,
        medicine_name: it.medicine_name,
        quantity: it.quantity,
        unit_cost: it.unit_cost,
        subtotal: it.quantity * it.unit_cost,
      })),
    );
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Buat Purchase Order</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Pemasok</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
                <option value="">— Tanpa pemasok —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Estimasi Tiba</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Tambah Obat</label>
            <div className="flex gap-2">
              <select value={selMed} onChange={(e) => setSelMed(e.target.value)} className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
                <option value="">Pilih obat...</option>
                {medicines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
              </select>
              <button onClick={addItem} disabled={!selMed} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Obat</th>
                    <th className="px-3 py-2 text-center font-semibold">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold">Harga Beli</th>
                    <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-t border-border/40">
                      <td className="px-3 py-2 text-foreground">{it.medicine_name}</td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', Math.max(1, Number(e.target.value)))} className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm outline-none focus:border-primary" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" min={0} value={it.unit_cost} onChange={(e) => updateItem(idx, 'unit_cost', Math.max(0, Number(e.target.value)))} className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-right text-sm outline-none focus:border-primary" />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-foreground">{formatIDR(it.quantity * it.unit_cost)}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeItem(idx)} className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Catatan</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Catatan untuk pemasok..." />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm font-bold text-foreground">Total: {formatIDR(total)}</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary">Batal</button>
              <button onClick={handleSave} disabled={saving || items.length === 0} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan PO (Draft)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Supplier Form ──────────────────────────────────────────────────────────

function SupplierForm({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    contact_person: supplier?.contact_person ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (supplier) {
      await supabase.from('suppliers').update(form).eq('id', supplier.id);
    } else {
      await supabase.from('suppliers').insert(form);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">{supplier ? 'Edit Pemasok' : 'Tambah Pemasok'}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Nama Pemasok" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Kontak Person" value={form.contact_person} onChange={(v) => setForm({ ...form, contact_person: v })} />
          <Field label="Telepon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Alamat" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label="Catatan" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary">Batal</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
    </div>
  );
}
