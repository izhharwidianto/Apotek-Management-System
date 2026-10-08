'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Receipt,
  TrendingUp,
  Users,
  Phone,
  Award,
  Gift,
  Plus,
  X,
  CheckCircle2,
  ShoppingCart,
  Clock,
  Printer,
  AlertCircle,
  Filter,
  RotateCcw,
  FileText,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase, type Sale, type SaleItem, type Customer, type Medicine } from '@/lib/supabase';
import { formatIDR, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ReceiptPrint, InvoicePrint } from '@/components/printables';

type SaleWithItems = Sale & { items: SaleItem[] };

const LOYALTY_THRESHOLD = 7;
const LOYALTY_MIN_SPEND = 20000;

type StatusFilter = 'all' | 'completed' | 'pending' | 'receipt_not_printed';

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  completed: { label: 'Selesai', badge: 'bg-success/15 text-success', dot: 'bg-success' },
  pending: { label: 'Belum Bayar', badge: 'bg-warning/15 text-warning', dot: 'bg-warning' },
  receipt_not_printed: { label: 'Belum Cetak Struk', badge: 'bg-primary/15 text-primary', dot: 'bg-primary' },
};

export default function SalesHistoryView() {
  const [activeTab, setActiveTab] = useState<'history' | 'customers'>('history');
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'daily' | 'monthly'>('daily');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewSale, setViewSale] = useState<SaleWithItems | null>(null);

  const loadSales = async () => {
    setLoading(true);
    let query = supabase.from('sales').select('*').order('created_at', { ascending: false });
    if (filter === 'daily') {
      const start = new Date(selectedDate + 'T00:00:00');
      const end = new Date(selectedDate + 'T23:59:59');
      query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
    } else {
      const [year, month] = selectedMonth.split('-');
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
    }
    const { data: salesData } = await query;
    if (!salesData || salesData.length === 0) {
      setSales([]);
      setLoading(false);
      return;
    }
    const saleIds = salesData.map((s) => s.id);
    const { data: itemsData } = await supabase
      .from('sale_items')
      .select('*')
      .in('sale_id', saleIds)
      .order('created_at', { ascending: false });
    const itemsBySale = (itemsData ?? []).reduce<Record<string, SaleItem[]>>((acc, item) => {
      const it = item as SaleItem;
      if (!acc[it.sale_id]) acc[it.sale_id] = [];
      acc[it.sale_id].push(it);
      return acc;
    }, {});
    const combined: SaleWithItems[] = (salesData as Sale[]).map((s) => ({
      ...s,
      items: itemsBySale[s.id] ?? [],
    }));
    setSales(combined);
    setLoading(false);
  };

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedDate, selectedMonth]);

  const filteredSales = useMemo(() => {
    let result = sales;
    if (statusFilter !== 'all') {
      result = result.filter((s) => (s.status ?? 'completed') === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.invoice_no.toLowerCase().includes(q) ||
          s.customer_name.toLowerCase().includes(q) ||
          s.items.some((it) => it.medicine_name.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [sales, searchQuery, statusFilter]);

  const summary = useMemo(() => {
    const totalRevenue = filteredSales
      .filter((s) => (s.status ?? 'completed') === 'completed')
      .reduce((a, s) => a + Number(s.total), 0);
    const totalTransactions = filteredSales.length;
    const totalItems = filteredSales.reduce((a, s) => a + s.items.reduce((b, it) => b + it.quantity, 0), 0);
    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const pendingCount = filteredSales.filter((s) => (s.status ?? 'completed') !== 'completed').length;
    return { totalRevenue, totalTransactions, totalItems, avgTransaction, pendingCount };
  }, [filteredSales]);

  // Actions for incomplete transactions
  const markCompleted = async (saleId: string) => {
    setActionLoading(saleId);
    await supabase.rpc('mark_sale_completed', { p_sale_id: saleId });
    setActionLoading(null);
    loadSales();
  };

  const cancelPendingSale = async (sale: SaleWithItems) => {
    const reason = window.prompt(`Alasan membatalkan ${sale.invoice_no}? (wajib, tercatat di log)`, 'Dibatalkan sebelum struk dicetak');
    if (!reason || reason.trim().length < 3) return;
    setActionLoading(sale.id);
    const { error } = await supabase.rpc('void_sale', { p_sale_id: sale.id, p_reason: reason.trim() });
    if (error) window.alert(error.message);
    setActionLoading(null);
    loadSales();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-border bg-card px-4 pt-3">
        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={Receipt} label="Histori Transaksi" />
        <TabButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={Users} label="Pelanggan & Loyalitas" />
      </div>

      {activeTab === 'history' ? (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6">
          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-border bg-card p-1">
              <button
                onClick={() => setFilter('daily')}
                className={cn('rounded-lg px-4 py-1.5 text-sm font-semibold transition', filter === 'daily' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                Harian
              </button>
              <button
                onClick={() => setFilter('monthly')}
                className={cn('rounded-lg px-4 py-1.5 text-sm font-semibold transition', filter === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                Bulanan
              </button>
            </div>
            {filter === 'daily' ? (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
            {/* Status filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">Semua Status</option>
                <option value="completed">Selesai</option>
                <option value="pending">Belum Bayar</option>
                <option value="receipt_not_printed">Belum Cetak Struk</option>
              </select>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari invoice, pelanggan, obat…"
                className="w-full rounded-lg border border-input bg-background py-1.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Summary cards */}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard icon={TrendingUp} label="Pendapatan (Selesai)" value={formatIDR(summary.totalRevenue)} color="primary" />
            <SummaryCard icon={Receipt} label="Jumlah Transaksi" value={String(summary.totalTransactions)} color="success" />
            <SummaryCard icon={ShoppingCart} label="Total Item Terjual" value={String(summary.totalItems)} color="warning" />
            <SummaryCard icon={Clock} label="Transaksi Pending" value={String(summary.pendingCount)} color="accent" />
          </div>

          {/* Sales list */}
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Memuat data…</div>
          ) : filteredSales.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Tidak ada transaksi pada periode ini.</div>
          ) : (
            <div className="space-y-2">
              {filteredSales.map((sale) => {
                const status = sale.status ?? 'completed';
                const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.completed;
                const isIncomplete = status !== 'completed';
                return (
                  <div key={sale.id} className={cn('rounded-xl border bg-card overflow-hidden transition hover:shadow-sm', isIncomplete ? 'border-warning/40' : 'border-border')}>
                    <button
                      onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                      className="flex w-full items-center gap-3 p-3 text-left"
                    >
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', isIncomplete ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary')}>
                        {isIncomplete ? <Clock className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setViewSale(sale); }}
                              className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20"
                            >
                              <Eye className="h-3 w-3" /> Lihat
                            </button>
                            <span className="truncate text-sm font-bold text-foreground">{sale.invoice_no}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', sc.badge)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                              {sc.label}
                            </span>
                            <span className="text-sm font-bold text-primary">{formatIDR(sale.total)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{sale.customer_name}</span>
                          <span>{formatDateTime(sale.created_at)}</span>
                        </div>
                      </div>
                    </button>
                    {expandedSale === sale.id && (
                      <div className="border-t border-border bg-muted/30 p-3">
                        <div className="space-y-1.5">
                          {sale.items.map((it) => (
                            <div key={it.id} className="flex items-center justify-between text-sm">
                              <span className="min-w-0 truncate">
                                <span className="font-medium text-foreground">{it.medicine_name}</span>
                                <span className="text-muted-foreground"> ×{it.quantity}</span>
                              </span>
                              <span className="font-medium text-foreground">{formatIDR(it.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 space-y-1 border-t border-dashed border-border pt-2 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatIDR(sale.subtotal)}</span></div>
                          {Number(sale.discount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span>-{formatIDR(sale.discount)}</span></div>}
                          {Number(sale.tax) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>{formatIDR(sale.tax)}</span></div>}
                          <div className="flex justify-between text-sm font-bold"><span>Total</span><span>{formatIDR(sale.total)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Bayar ({sale.payment_method})</span><span>{formatIDR(sale.paid)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span>{formatIDR(sale.change)}</span></div>
                        </div>

                        {/* Action buttons for incomplete transactions */}
                        {isIncomplete && (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                            {status === 'receipt_not_printed' && (
                              <button
                                onClick={() => markCompleted(sale.id)}
                                disabled={actionLoading === sale.id}
                                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                              >
                                <Printer className="h-3.5 w-3.5" /> Tandai Sudah Cetak
                              </button>
                            )}
                            <button
                              onClick={() => cancelPendingSale(sale)}
                              disabled={actionLoading === sale.id}
                              className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Batalkan & Kembalikan Stok
                            </button>
                            {actionLoading === sale.id && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 animate-spin" /> Memproses…
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <CustomerLoyaltyTab />
      )}

      {/* View modal with invoice/receipt toggle */}
      {viewSale && (
        <SaleViewModal
          sale={viewSale}
          onClose={() => setViewSale(null)}
          onStatusChanged={() => { setViewSale(null); loadSales(); }}
        />
      )}
    </div>
  );
}

function CustomerLoyaltyTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers((data as Customer[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [customers, search]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor telepon…"
            className="w-full rounded-lg border border-input bg-background py-1.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Tambah Pelanggan
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Memuat data…</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Belum ada pelanggan terdaftar.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const progress = Math.min(100, (c.loyalty_points / LOYALTY_THRESHOLD) * 100);
            const eligible = c.loyalty_points >= LOYALTY_THRESHOLD;
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-foreground">{c.name}</h3>
                    {c.phone && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </p>
                    )}
                  </div>
                  {eligible ? (
                    <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                      <Gift className="h-3 w-3" /> Loyalitas
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                      {c.loyalty_points}/{LOYALTY_THRESHOLD}
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Total Kunjungan</span><span className="font-semibold text-foreground">{c.total_visits}x</span></div>
                  <div className="flex justify-between"><span>Total Belanja</span><span className="font-semibold text-foreground">{formatIDR(Number(c.total_spent))}</span></div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Award className="h-3 w-3" /> Progres Loyalitas</span>
                    <span>{c.loyalty_points}/{LOYALTY_THRESHOLD} transaksi</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn('h-full rounded-full transition-all', eligible ? 'bg-success' : 'bg-primary')}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {eligible && (
                    <p className="mt-1.5 text-[10px] font-semibold text-success">
                      Pelanggan eligible untuk reward/potongan!
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onDone={() => { loadCustomers(); setShowAdd(false); }} />}
    </div>
  );
}

function AddCustomerModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) { setError('Nama wajib diisi'); return; }
    setSaving(true);
    const { error: err } = await supabase.from('customers').insert({
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-2xl animate-fade-in">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Tambah Pelanggan</h3>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Nama *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Nama pelanggan" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">No. Telepon</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="08xx-xxxx-xxxx" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="email@contoh.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Alamat</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Alamat pelanggan" />
          </div>
          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={submit} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary">Batal</button>
        </div>
      </div>
    </div>
  );
}

function SaleViewModal({
  sale,
  onClose,
  onStatusChanged,
}: {
  sale: SaleWithItems;
  onClose: () => void;
  onStatusChanged: () => void;
}) {
  const [viewMode, setViewMode] = useState<'receipt' | 'invoice'>('invoice');
  const { user } = useAuth();
  const canVoid = user?.role === 'owner' || user?.role === 'apoteker';

  const voidSale = async () => {
    const reason = window.prompt(`Alasan membatalkan transaksi ${sale.invoice_no}? Stok akan dikembalikan. (wajib, tercatat di log)`);
    if (!reason || reason.trim().length < 3) return;
    const { error } = await supabase.rpc('void_sale', { p_sale_id: sale.id, p_reason: reason.trim() });
    if (error) {
      window.alert(error.message);
      return;
    }
    onStatusChanged();
    onClose();
  };

  const printDocument = async (mode: 'receipt' | 'invoice') => {
    if (sale.status !== 'completed') {
      await supabase.rpc('mark_sale_completed', { p_sale_id: sale.id });
    }
    if (mode === 'invoice') {
      document.body.classList.add('print-invoice-mode');
    } else {
      document.body.classList.remove('print-invoice-mode');
    }
    window.print();
    document.body.classList.remove('print-invoice-mode');
    onStatusChanged();
  };

  return (
    <>
      {/* Hidden print areas */}
      <ReceiptPrint sale={sale} />
      <InvoicePrint sale={sale} />

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-2xl bg-card p-5 shadow-2xl animate-fade-in">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">{sale.invoice_no}</h3>
              <p className="text-xs text-muted-foreground">{sale.customer_name} &middot; {formatDateTime(sale.created_at)}</p>
            </div>
            <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Toggle: Invoice vs Struk */}
          <div className="mb-3 flex rounded-xl border border-border bg-secondary p-1">
            <button
              onClick={() => setViewMode('invoice')}
              className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition', viewMode === 'invoice' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              <FileText className="h-4 w-4" /> Invoice (Arsip)
            </button>
            <button
              onClick={() => setViewMode('receipt')}
              className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition', viewMode === 'receipt' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              <Receipt className="h-4 w-4" /> Struk (Customer)
            </button>
          </div>

          {/* Preview */}
          <div className="mb-4 max-h-[50vh] overflow-y-auto scrollbar-thin rounded-xl border border-border bg-background p-4">
            {viewMode === 'invoice' ? <InvoicePreviewContent sale={sale} /> : <ReceiptPreviewContent sale={sale} />}
          </div>

          {/* Status + actions */}
          <div className="mb-3 flex items-center gap-2">
            <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold', STATUS_CONFIG[sale.status ?? 'completed']?.badge ?? STATUS_CONFIG.completed.badge)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_CONFIG[sale.status ?? 'completed']?.dot ?? STATUS_CONFIG.completed.dot)} />
              {STATUS_CONFIG[sale.status ?? 'completed']?.label ?? 'Selesai'}
            </span>
            {sale.status !== 'completed' && (
              <button
                onClick={() => printDocument(viewMode)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Printer className="h-3.5 w-3.5" /> Cetak & Tandai Selesai
              </button>
            )}
          </div>

          {canVoid && (
            <div className="mb-2 flex justify-end">
              <button onClick={voidSale} className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10">
                Batalkan transaksi (void)
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => printDocument(viewMode)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              <Printer className="h-4 w-4" /> Cetak {viewMode === 'receipt' ? 'Struk' : 'Invoice'}
            </button>
            <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary">
              Tutup
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ReceiptPreviewContent({ sale }: { sale: SaleWithItems }) {
  const subtotalNum = Number(sale.subtotal);
  const discountNum = Number(sale.discount);
  const taxNum = Number(sale.tax);
  const totalNum = Number(sale.total);
  const totalBeforeTax = subtotalNum - discountNum;
  return (
    <div className="mx-auto rounded-lg bg-white p-4 font-mono text-xs text-black" style={{ maxWidth: '300px' }}>
      <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
        <p className="text-sm font-bold">Apotek Sehat Sentosa</p>
        <p className="text-[10px]">Jl. Kesehatan Raya No. 1, Menteng, Jakarta Pusat</p>
        <p className="text-[10px]">Telp: (021) 314-5678</p>
      </div>
      <div className="mb-2 text-[10px]">
        <div className="flex justify-between"><span>No: {sale.invoice_no}</span></div>
        <div className="flex justify-between"><span>Tgl: {formatDateTime(sale.created_at)}</span></div>
        <div className="flex justify-between"><span>Plgn: {sale.customer_name}</span></div>
      </div>
      <div className="border-t border-b border-dashed border-gray-400 py-2">
        {sale.items.map((it) => (
          <div key={it.id} className="mb-1">
            <p className="font-bold">{it.medicine_name}</p>
            <div className="flex justify-between">
              <span>{it.quantity} x {Number(it.price).toLocaleString('id-ID')}</span>
              <span className="font-bold">{Number(it.subtotal).toLocaleString('id-ID')}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="py-2 text-[10px]">
        <div className="flex justify-between"><span>Subtotal</span><span>{subtotalNum.toLocaleString('id-ID')}</span></div>
        {discountNum > 0 && <div className="flex justify-between"><span>Diskon</span><span>-{discountNum.toLocaleString('id-ID')}</span></div>}
        <div className="flex justify-between font-bold border-t border-dashed border-gray-400"><span>Total Sebelum Pajak</span><span>{totalBeforeTax.toLocaleString('id-ID')}</span></div>
        {taxNum > 0 && <div className="flex justify-between"><span>Pajak</span><span>{taxNum.toLocaleString('id-ID')}</span></div>}
        <div className="flex justify-between font-bold text-sm border-y-2 border-black"><span>TOTAL BAYAR</span><span>{totalNum.toLocaleString('id-ID')}</span></div>
        <div className="flex justify-between"><span>Bayar ({sale.payment_method})</span><span>{Number(sale.paid).toLocaleString('id-ID')}</span></div>
        <div className="flex justify-between"><span>Kembali</span><span>{Number(sale.change).toLocaleString('id-ID')}</span></div>
      </div>
      <div className="text-center border-t border-dashed border-gray-400 pt-2 text-[10px]">
        <p className="font-bold">*** Terima Kasih ***</p>
      </div>
    </div>
  );
}

function InvoicePreviewContent({ sale }: { sale: SaleWithItems }) {
  const subtotalNum = Number(sale.subtotal);
  const discountNum = Number(sale.discount);
  const taxNum = Number(sale.tax);
  const totalNum = Number(sale.total);
  const totalBeforeTax = subtotalNum - discountNum;
  return (
    <div className="rounded-lg bg-white p-6 text-black">
      <div className="flex justify-between border-b-2 border-black pb-3 mb-4">
        <div>
          <p className="text-lg font-bold">Apotek Sehat Sentosa</p>
          <p className="text-xs text-gray-600">Jl. Kesehatan Raya No. 1, Menteng, Jakarta Pusat</p>
          <p className="text-xs text-gray-600">Telp: (021) 314-5678</p>
          <p className="text-xs text-gray-600">NPWP: 01.234.567.8-901.000</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold tracking-wider">INVOICE</p>
          <p className="text-xs mt-1">No: <strong>{sale.invoice_no}</strong></p>
          <p className="text-xs">Tgl: {formatDateTime(sale.created_at)}</p>
        </div>
      </div>
      <div className="mb-4">
        <p className="text-[10px] uppercase text-gray-500 font-bold">Ditagihkan Kepada</p>
        <p className="text-sm font-bold">{sale.customer_name}</p>
        <p className="text-xs text-gray-600">Metode: {sale.payment_method}</p>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left py-1.5">No</th>
            <th className="text-left py-1.5">Nama Obat</th>
            <th className="text-center py-1.5">Qty</th>
            <th className="text-right py-1.5">Harga</th>
            <th className="text-right py-1.5">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((it, i) => (
            <tr key={it.id} className="border-b border-gray-300">
              <td className="py-1.5">{i + 1}</td>
              <td className="py-1.5">{it.medicine_name}</td>
              <td className="py-1.5 text-center">{it.quantity}</td>
              <td className="py-1.5 text-right">{Number(it.price).toLocaleString('id-ID')}</td>
              <td className="py-1.5 text-right font-bold">{Number(it.subtotal).toLocaleString('id-ID')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end mt-4">
        <table className="text-xs min-w-[250px]">
          <tbody>
            <tr><td className="px-2 py-1 text-gray-600">Subtotal</td><td className="px-2 py-1 text-right">Rp {subtotalNum.toLocaleString('id-ID')}</td></tr>
            {discountNum > 0 && <tr><td className="px-2 py-1 text-gray-600">Diskon</td><td className="px-2 py-1 text-right">-Rp {discountNum.toLocaleString('id-ID')}</td></tr>}
            <tr className="border-t border-gray-300"><td className="px-2 py-1 font-bold">Total Sebelum Pajak</td><td className="px-2 py-1 text-right font-bold">Rp {totalBeforeTax.toLocaleString('id-ID')}</td></tr>
            {taxNum > 0 && <tr><td className="px-2 py-1 text-gray-600">Pajak</td><td className="px-2 py-1 text-right">Rp {taxNum.toLocaleString('id-ID')}</td></tr>}
            <tr className="border-y-2 border-black"><td className="px-2 py-1.5 text-sm font-bold">TOTAL BAYAR</td><td className="px-2 py-1.5 text-right text-sm font-bold">Rp {totalNum.toLocaleString('id-ID')}</td></tr>
            <tr><td className="px-2 py-1 text-gray-600">Dibayar ({sale.payment_method})</td><td className="px-2 py-1 text-right">Rp {Number(sale.paid).toLocaleString('id-ID')}</td></tr>
            <tr><td className="px-2 py-1 text-gray-600">Kembalian</td><td className="px-2 py-1 text-right">Rp {Number(sale.change).toLocaleString('id-ID')}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="mt-8 flex justify-between text-xs">
        <div>
          <p className="text-gray-500">Diterima oleh,</p>
          <div className="mt-8 border-t border-black w-40 pt-1">( {sale.customer_name} )</div>
        </div>
        <div>
          <p className="text-gray-500">Hormat kami,</p>
          <div className="mt-8 border-t border-black w-40 pt-1">( Admin )</div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition',
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    accent: 'bg-accent/10 text-accent',
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', colorMap[color])}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
