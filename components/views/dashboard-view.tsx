'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CalendarClock,
  PackageX,
  Crown,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { supabase, type Medicine, type Sale, type SaleItem, type Expense, medicinesAll } from '@/lib/supabase';
import { formatIDR, formatIDRPlain, formatDate, daysUntil } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function DashboardView() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  const load = async () => {
    setLoading(true);
    const [s, si, e, m] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('sale_items').select('*'),
      supabase.from('expenses').select('*').order('created_at', { ascending: false }),
      medicinesAll(),
    ]);
    setSales((s.data as Sale[]) ?? []);
    setSaleItems((si.data as SaleItem[]) ?? []);
    setExpenses((e.data as Expense[]) ?? []);
    setMedicines((m.data as Medicine[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const { income, expense, profit } = useMemo(() => {
    const income = sales.reduce((a, b) => a + Number(b.total), 0);
    const expense = expenses.reduce((a, b) => a + Number(b.amount), 0);
    // profit = revenue - cost of goods - operational expenses
    const cogs = saleItems.reduce((sum, it) => {
      const med = medicines.find((mm) => mm.id === it.medicine_id);
      const cost = med ? Number(med.cost_price) : 0;
      return sum + cost * it.quantity;
    }, 0);
    const profit = income - cogs - expense;
    return { income, expense, profit };
  }, [sales, expenses, saleItems, medicines]);

  const top10 = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    saleItems.forEach((it) => {
      const cur = map.get(it.medicine_id ?? it.medicine_name) ?? {
        name: it.medicine_name,
        qty: 0,
        revenue: 0,
      };
      cur.qty += it.quantity;
      cur.revenue += Number(it.subtotal);
      map.set(it.medicine_id ?? it.medicine_name, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [saleItems]);

  const lowStock = useMemo(
    () => medicines.filter((m) => m.stock <= m.reorder_point).sort((a, b) => a.stock - b.stock),
    [medicines],
  );
  const expiringSoon = useMemo(() => {
    return medicines
      .map((m) => ({ m, days: daysUntil(m.expiry_date) }))
      .filter((x) => x.days !== null && x.days <= 30)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  }, [medicines]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Memuat data dashboard…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="stagger-item" style={{ animationDelay: '0ms' }}>
          <SummaryCard
            title="Uang Masuk"
            value={formatIDR(income)}
            icon={TrendingUp}
            tone="success"
            subtitle={`${sales.length} transaksi`}
          />
        </div>
        <div className="stagger-item" style={{ animationDelay: '60ms' }}>
          <SummaryCard
            title="Uang Keluar"
            value={formatIDR(expense)}
            icon={TrendingDown}
            tone="destructive"
            subtitle={`${expenses.length} pencatatan`}
          />
        </div>
        <div className="stagger-item" style={{ animationDelay: '120ms' }}>
          <SummaryCard
            title="Laba Bersih"
            value={formatIDR(profit)}
            icon={DollarSign}
            tone={profit >= 0 ? 'primary' : 'warning'}
            subtitle="Pendapatan − HPP − Beban"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Top 10 chart */}
        <div className="card-hover xl:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-warning" />
              <h3 className="text-base font-bold text-foreground">Top 10 Obat Terlaris</h3>
            </div>
            <span className="text-xs text-muted-foreground">Berdasarkan jumlah terjual</span>
          </div>
          {top10.length === 0 ? (
            <EmptyState text="Belum ada penjualan. Buat transaksi di menu Kasir." />
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="number"
                    dataKey="qty"
                    tickFormatter={(v) => v}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--popover))',
                      fontSize: 12,
                    }}
                    formatter={(v: number, _n, p: any) => [`${v} unit`, p.payload.name]}
                    labelFormatter={() => ''}
                  />
                  <Bar dataKey="qty" radius={[0, 6, 6, 0]} barSize={18}>
                    {top10.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? 'hsl(38, 92%, 50%)' : 'hsl(199, 89%, 48%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {top10.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {top10.slice(0, 5).map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-bold', i === 0 ? 'bg-warning text-warning-foreground' : 'bg-secondary text-secondary-foreground')}>
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-foreground">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">{t.qty} unit</span>
                    <span className="text-sm font-semibold text-foreground">{formatIDR(t.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="space-y-6">
          <NotificationPanel
            title="Stok Minimum"
            icon={PackageX}
            tone="destructive"
            items={lowStock.map((m) => ({
              id: m.id,
              primary: m.name,
              secondary: `Sisa ${m.stock} ${m.unit} \u00b7 reorder ${m.reorder_point}`,
              badge: m.stock === 0 ? 'Habis' : `${m.stock}`,
            }))}
            emptyText="Semua stok aman."
          />
          <NotificationPanel
            title="Kadaluarsa < 30 hari"
            icon={CalendarClock}
            tone="warning"
            items={expiringSoon.map(({ m, days }) => ({
              id: m.id,
              primary: m.name,
              secondary: `Exp ${formatDate(m.expiry_date)}`,
              badge: days! <= 0 ? 'Lewat' : `${days}h`,
            }))}
            emptyText="Tidak ada obat segera kadaluarsa."
          />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  tone: 'success' | 'destructive' | 'primary' | 'warning';
  subtitle: string;
}) {
  const tones: Record<string, string> = {
    success: 'from-success/15 to-success/5 text-success',
    destructive: 'from-destructive/15 to-destructive/5 text-destructive',
    primary: 'from-primary/15 to-primary/5 text-primary',
    warning: 'from-warning/15 to-warning/5 text-warning',
  };
  return (
    <div className="card-hover group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function NotificationPanel({
  title,
  icon: Icon,
  tone,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  tone: 'destructive' | 'warning';
  items: { id: string; primary: string; secondary: string; badge: string }[];
  emptyText: string;
}) {
  const toneCls = tone === 'destructive' ? 'text-destructive bg-destructive/10' : 'text-warning bg-warning/10';
  return (
    <div className="card-hover rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', toneCls)}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {items.length > 0 && (
          <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs font-bold', toneCls)}>{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState text={emptyText} compact />
      ) : (
        <div className="max-h-64 space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{it.primary}</p>
                <p className="text-xs text-muted-foreground">{it.secondary}</p>
              </div>
              <span className={cn('ml-2 shrink-0 rounded-md px-2 py-0.5 text-xs font-bold', toneCls)}>{it.badge}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center text-muted-foreground', compact ? 'py-6' : 'py-12')}>
      <AlertTriangle className="mb-2 h-6 w-6 opacity-40" />
      <p className="text-xs">{text}</p>
    </div>
  );
}
