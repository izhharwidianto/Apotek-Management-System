'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  TrendingUp,
  DollarSign,
  Scale,
  RefreshCw,
  Download,
  FileText,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { supabase, type Sale, type SaleItem, type Expense, type Medicine, medicinesAll } from '@/lib/supabase';
import { formatIDR, formatIDRPlain, formatDate, esc } from '@/lib/format';
import { cn } from '@/lib/utils';

type Period = 'daily' | 'monthly';

export default function ReportsView() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [period, setPeriod] = useState<Period>('daily');

  const load = async () => {
    setLoading(true);
    const [s, si, e, m] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: true }),
      supabase.from('sale_items').select('*'),
      supabase.from('expenses').select('*').order('created_at', { ascending: true }),
      medicinesAll(),
    ]);
    setSales((s.data as Sale[]) ?? []);
    setSaleItems((si.data as SaleItem[]) ?? []);
    setExpenses((e.data as Expense[]) ?? []);
    setMedicines((m.data as Medicine[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Aggregate by period
  const aggregated = useMemo(() => {
    const map = new Map<string, { label: string; revenue: number; orders: number; expense: number; cogs: number }>();
    const keyOf = (d: Date) =>
      period === 'daily'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const labelOf = (k: string) => {
      if (period === 'daily') {
        const [y, m, d] = k.split('-');
        return formatDate(`${y}-${m}-${d}`);
      }
      const [y, m] = k.split('-');
      const names = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${names[parseInt(m) - 1]} ${y}`;
    };

    sales.forEach((s) => {
      const d = new Date(s.created_at);
      const k = keyOf(d);
      const cur = map.get(k) ?? { label: labelOf(k), revenue: 0, orders: 0, expense: 0, cogs: 0 };
      cur.revenue += Number(s.total);
      cur.orders += 1;
      map.set(k, cur);
    });
    expenses.forEach((ex) => {
      const d = new Date(ex.created_at);
      const k = keyOf(d);
      const cur = map.get(k) ?? { label: labelOf(k), revenue: 0, orders: 0, expense: 0, cogs: 0 };
      cur.expense += Number(ex.amount);
      map.set(k, cur);
    });
    // COGS per sale
    const cogsBySale = new Map<string, number>();
    saleItems.forEach((it) => {
      const med = medicines.find((mm) => mm.id === it.medicine_id);
      const cost = med ? Number(med.cost_price) : 0;
      cogsBySale.set(it.sale_id, (cogsBySale.get(it.sale_id) ?? 0) + cost * it.quantity);
    });
    sales.forEach((s) => {
      const d = new Date(s.created_at);
      const k = keyOf(d);
      const cur = map.get(k);
      if (cur) cur.cogs += cogsBySale.get(s.id) ?? 0;
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ key: k, ...v, profit: v.revenue - v.cogs - v.expense }));
  }, [sales, expenses, saleItems, medicines, period]);

  const totals = useMemo(() => {
    const revenue = aggregated.reduce((a, b) => a + b.revenue, 0);
    const expense = aggregated.reduce((a, b) => a + b.expense, 0);
    const cogs = aggregated.reduce((a, b) => a + b.cogs, 0);
    const orders = aggregated.reduce((a, b) => a + b.orders, 0);
    const profit = revenue - cogs - expense;
    return { revenue, expense, cogs, orders, profit };
  }, [aggregated]);

  // Break-even: fixed costs = total expenses (operational), variable cost = COGS, contribution margin = revenue - COGS
  const breakEven = useMemo(() => {
    const fixedCosts = totals.expense;
    const contribution = totals.revenue - totals.cogs;
    const cmRatio = totals.revenue > 0 ? contribution / totals.revenue : 0;
    const breakEvenRevenue = cmRatio > 0 ? fixedCosts / cmRatio : 0;
    return {
      fixedCosts,
      contribution,
      cmRatio,
      breakEvenRevenue,
      isProfitable: totals.revenue >= breakEvenRevenue,
    };
  }, [totals]);

  const exportReport = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = aggregated
      .map(
        (a) =>
          `<tr><td>${esc(a.label)}</td><td style="text-align:right">${formatIDR(a.revenue)}</td><td style="text-align:right">${formatIDR(a.cogs)}</td><td style="text-align:right">${formatIDR(a.expense)}</td><td style="text-align:right;color:${a.profit >= 0 ? '#16a34a' : '#dc2626'};font-weight:600">${formatIDR(a.profit)}</td><td style="text-align:center">${a.orders}</td></tr>`,
      )
      .join('');
    win.document.write(`<html><head><title>Laporan Keuangan</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}
      h1{font-size:18px;margin:0 0 4px} .sub{color:#64748b;font-size:12px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#0ea5e9;color:#fff;padding:8px;text-align:left;font-size:11px;text-transform:uppercase}
      td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
      .foot{margin-top:20px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body>
      <h1>Apotek Sehat Sentosa</h1>
      <div class="sub">Laporan Keuangan ${period === 'daily' ? 'Harian' : 'Bulanan'} &middot; ${new Date().toLocaleString('id-ID')}</div>
      <table><thead><tr><th>Periode</th><th style="text-align:right">Pendapatan</th><th style="text-align:right">HPP</th><th style="text-align:right">Beban</th><th style="text-align:right">Laba</th><th style="text-align:center">Order</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="foot">Break-even: ${formatIDR(breakEven.breakEvenRevenue)} &middot; Dicetak oleh AMS</div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Memuat laporan…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {(['daily', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
                period === p ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' : 'bg-card border border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              <Calendar className="h-4 w-4" />
              {p === 'daily' ? 'Harian' : 'Bulanan'}
            </button>
          ))}
        </div>
        <button onClick={exportReport} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary press-scale">
          <FileText className="h-4 w-4" /> Cetak Laporan
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="stagger-item" style={{ animationDelay: '0ms' }}>
        <StatCard title="Pendapatan" value={formatIDR(totals.revenue)} icon={TrendingUp} tone="primary" sub={`${totals.orders} order`} />
        </div>
        <div className="stagger-item" style={{ animationDelay: '40ms' }}>
        <StatCard title="HPP (Modal)" value={formatIDR(totals.cogs)} icon={DollarSign} tone="warning" sub="Cost of goods" />
        </div>
        <div className="stagger-item" style={{ animationDelay: '80ms' }}>
        <StatCard title="Beban Operasional" value={formatIDR(totals.expense)} icon={DollarSign} tone="destructive" sub="Biaya tetap" />
        </div>
        <div className="stagger-item" style={{ animationDelay: '120ms' }}>
        <StatCard title="Laba Bersih" value={formatIDR(totals.profit)} icon={Scale} tone={totals.profit >= 0 ? 'success' : 'destructive'} sub={totals.profit >= 0 ? 'Surplus' : 'Defisit'} />
        </div>
      </div>

      {/* Trend chart */}
      <div className="card-hover rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Tren Pendapatan & Laba ({period === 'daily' ? 'Harian' : 'Bulanan'})</h3>
        </div>
        {aggregated.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Belum ada data transaksi.</div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aggregated} margin={{ left: 0, right: 12, top: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', fontSize: 12 }}
                  formatter={(v: number, n) => [formatIDR(v), n === 'revenue' ? 'Pendapatan' : 'Laba']}
                />
                <Legend formatter={(v) => (v === 'revenue' ? 'Pendapatan' : 'Laba')} wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(199, 89%, 48%)" strokeWidth={2} fill="url(#gRev)" />
                <Area type="monotone" dataKey="profit" stroke="hsl(142, 71%, 45%)" strokeWidth={2} fill="url(#gProf)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Break-even + Expense trend */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Break-even */}
        <div className="card-hover rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Break-Even Analysis</h3>
          </div>
          <div className="space-y-3">
            <BEBar label="Pendapatan" value={totals.revenue} max={Math.max(totals.revenue, breakEven.breakEvenRevenue, 1)} color="bg-primary" />
            <BEBar label="Biaya Tetap (Beban)" value={breakEven.fixedCosts} max={Math.max(totals.revenue, breakEven.breakEvenRevenue, 1)} color="bg-destructive" />
            <BEBar label="Margin Kontribusi" value={breakEven.contribution} max={Math.max(totals.revenue, breakEven.breakEvenRevenue, 1)} color="bg-success" />
            <BEBar label="Titik Break-Even" value={breakEven.breakEvenRevenue} max={Math.max(totals.revenue, breakEven.breakEvenRevenue, 1)} color="bg-warning" />
          </div>
          <div className={cn(
            'mt-4 rounded-xl p-4 text-sm font-semibold',
            breakEven.isProfitable ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
          )}>
            {breakEven.isProfitable
              ? `Aplikasi untung. Pendapatan ${formatIDR(totals.revenue)} melebihi break-even ${formatIDR(breakEven.breakEvenRevenue)}.`
              : `Pendapatan (${formatIDR(totals.revenue)}) di bawah break-even (${formatIDR(breakEven.breakEvenRevenue)}). Perlu menambah penjualan.`}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Info label="Rasio Margin Kontribusi" value={`${(breakEven.cmRatio * 100).toFixed(1)}%`} />
            <Info label="Selisih ke Break-Even" value={formatIDR(totals.revenue - breakEven.breakEvenRevenue)} />
          </div>
        </div>

        {/* Expense trend */}
        <div className="card-hover rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-destructive" />
            <h3 className="text-base font-bold text-foreground">Tren Beban Operasional</h3>
          </div>
          {aggregated.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Belum ada data beban.</div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aggregated} margin={{ left: 0, right: 12, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', fontSize: 12 }} formatter={(v: number) => [formatIDR(v), 'Beban']} />
                  <Line type="monotone" dataKey="expense" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Detail table */}
      <div className="card-hover overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold text-foreground">Rincian per Periode</h3>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Periode</th>
                <th className="px-4 py-3 text-right font-semibold">Pendapatan</th>
                <th className="px-4 py-3 text-right font-semibold">HPP</th>
                <th className="px-4 py-3 text-right font-semibold">Beban</th>
                <th className="px-4 py-3 text-right font-semibold">Laba</th>
                <th className="px-4 py-3 text-center font-semibold">Order</th>
              </tr>
            </thead>
            <tbody>
              {aggregated.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Belum ada data.</td></tr>
              ) : (
                aggregated.map((a) => (
                  <tr key={a.key} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{a.label}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatIDR(a.revenue)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatIDR(a.cogs)}</td>
                    <td className="px-4 py-3 text-right text-destructive">{formatIDR(a.expense)}</td>
                    <td className={cn('px-4 py-3 text-right font-semibold', a.profit >= 0 ? 'text-success' : 'text-destructive')}>{formatIDR(a.profit)}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{a.orders}</td>
                  </tr>
                ))
              )}
            </tbody>
            {aggregated.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-bold text-foreground">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{formatIDR(totals.revenue)}</td>
                  <td className="px-4 py-3 text-right">{formatIDR(totals.cogs)}</td>
                  <td className="px-4 py-3 text-right text-destructive">{formatIDR(totals.expense)}</td>
                  <td className={cn('px-4 py-3 text-right', totals.profit >= 0 ? 'text-success' : 'text-destructive')}>{formatIDR(totals.profit)}</td>
                  <td className="px-4 py-3 text-center">{totals.orders}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, tone, sub }: { title: string; value: string; icon: React.ElementType; tone: 'primary' | 'success' | 'destructive' | 'warning'; sub: string }) {
  const tones: Record<string, string> = {
    primary: 'from-primary/15 to-primary/5 text-primary',
    success: 'from-success/15 to-success/5 text-success',
    destructive: 'from-destructive/15 to-destructive/5 text-destructive',
    warning: 'from-warning/15 to-warning/5 text-warning',
  };
  return (
    <div className="card-hover rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br', tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function BEBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{formatIDR(value)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}
