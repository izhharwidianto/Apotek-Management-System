'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  RefreshCw,
  Clock,
  Wallet,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  X,
  Printer,
  Lock,
  Unlock,
  Calendar,
  DollarSign,
  Receipt,
} from 'lucide-react';
import {
  supabase,
  type CashSession,
  type Sale,
} from '@/lib/supabase';
import { formatIDR, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

function genSessionNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 900) + 100;
  return `S-${ymd}-${rand}`;
}

type SessionWithSales = CashSession & { sales: Sale[] };

export default function CashSessionView() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionWithSales[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<SessionWithSales | null>(null);
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState<SessionWithSales | null>(null);

  const loadData = async () => {
    setLoading(true);
    const { data: sessData } = await supabase.from('cash_sessions').select('*').order('opened_at', { ascending: false });
    const sessList = (sessData as CashSession[]) ?? [];

    if (sessList.length > 0) {
      const { data: cssData } = await supabase
        .from('cash_session_sales')
        .select('session_id, sale_id')
        .in('session_id', sessList.map((s) => s.id));

      const saleIds = ((cssData as { session_id: string; sale_id: string }[]) ?? []).map((c) => c.sale_id);
      let salesMap: Record<string, Sale> = {};
      if (saleIds.length > 0) {
        const { data: salesData } = await supabase.from('sales').select('*').in('id', saleIds);
        (salesData as Sale[])?.forEach((s) => { salesMap[s.id] = s; });
      }

      const cssMap = ((cssData as { session_id: string; sale_id: string }[]) ?? []).reduce<Record<string, string[]>>((acc, c) => {
        if (!acc[c.session_id]) acc[c.session_id] = [];
        acc[c.session_id].push(c.sale_id);
        return acc;
      }, {});

      const combined = sessList.map((s) => ({
        ...s,
        sales: (cssMap[s.id] ?? []).map((sid) => salesMap[sid]).filter(Boolean),
      }));
      setSessions(combined);
      const active = combined.find((s) => s.status === 'open');
      setActiveSession(active ?? null);
    } else {
      setSessions([]);
      setActiveSession(null);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const stats = useMemo(() => {
    const open = sessions.filter((s) => s.status === 'open').length;
    const closed = sessions.filter((s) => s.status === 'closed').length;
    const totalSales = sessions.reduce((a, s) => a + s.sales.length, 0);
    const totalRevenue = sessions.reduce((a, s) => a + s.sales.reduce((sa, sl) => sa + Number(sl.total), 0), 0);
    return { open, closed, totalSales, totalRevenue };
  }, [sessions]);

  const handleCloseSession = async (session: CashSession, closingCash: number, notes: string, closedAt: string) => {
    // Calculate expected cash = opening + all cash sales
    const sessWithSales = sessions.find((s) => s.id === session.id);
    const cashSales = (sessWithSales?.sales ?? []).filter((s) => s.payment_method === 'cash');
    const cashRevenue = cashSales.reduce((a, s) => a + Number(s.total), 0);
    const expected = Number(session.opening_cash) + cashRevenue;
    const diff = closingCash - expected;

    await supabase.from('cash_sessions').update({
      status: 'closed',
      closing_cash: closingCash,
      expected_cash: expected,
      cash_difference: diff,
      closed_at: closedAt,
      notes: notes.trim() || null,
    }).eq('id', session.id);

    setShowClose(null);
    loadData();
  };

  const printSessionReport = (session: SessionWithSales) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = session.sales.map((s) => `<tr>
      <td>${s.invoice_no}</td>
      <td>${formatDateTime(s.created_at)}</td>
      <td>${s.customer_name}</td>
      <td style="text-align:center">${s.payment_method}</td>
      <td style="text-align:right">${formatIDR(Number(s.total))}</td>
    </tr>`).join('');
    const cashSales = session.sales.filter((s) => s.payment_method === 'cash');
    const cashRev = cashSales.reduce((a, s) => a + Number(s.total), 0);
    const nonCashRev = session.sales.filter((s) => s.payment_method !== 'cash').reduce((a, s) => a + Number(s.total), 0);
    win.document.write(`<html><head><title>Laporan Shift ${session.session_no}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}
        h1{font-size:18px;margin:0 0 4px} h2{font-size:12px;margin:0 0 16px;color:#64748b}
        .summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:12px}
        .summary div{padding:8px;border:1px solid #e2e8f0;border-radius:6px}
        .summary b{display:block;font-size:10px;color:#64748b;margin-bottom:2px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th{background:#0ea5e9;color:#fff;padding:6px;text-align:left}
        td{padding:4px 6px;border-bottom:1px solid #e2e8f0}
        .diff{margin-top:12px;padding:10px;border-radius:6px;font-weight:bold;font-size:14px}
        .foot{margin-top:20px;font-size:10px;color:#94a3b8;text-align:center}
      </style></head><body>
      <h1>Laporan Shift Kasir</h1>
      <h2>${session.session_no} — ${session.operator_name}</h2>
      <div class="summary">
        <div><b>Buka Shift</b>${formatDateTime(session.opened_at)}</div>
        <div><b>Tutup Shift</b>${formatDateTime(session.closed_at)}</div>
        <div><b>Modal Awal</b>${formatIDR(Number(session.opening_cash))}</div>
        <div><b>Kas Tutup</b>${formatIDR(Number(session.closing_cash ?? 0))}</div>
        <div><b>Kas Expected</b>${formatIDR(Number(session.expected_cash ?? 0))}</div>
        <div><b>Selisih</b>${formatIDR(Number(session.cash_difference ?? 0))}</div>
        <div><b>Penjualan Cash</b>${formatIDR(cashRev)}</div>
        <div><b>Penjualan Non-Cash</b>${formatIDR(nonCashRev)}</div>
      </div>
      <table><thead><tr><th>Invoice</th><th>Waktu</th><th>Pelanggan</th><th>Bayar</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="foot">Dicetak oleh ApotekZ — ${new Date().toLocaleString('id-ID')}</div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Active session banner */}
      {activeSession ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Unlock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Shift Aktif: {activeSession.session_no}</p>
              <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70">
                {activeSession.operator_name} · Buka {formatDateTime(activeSession.opened_at)} · Modal {formatIDR(Number(activeSession.opening_cash))}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowClose(activeSession)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Lock className="h-4 w-4" /> Tutup Shift
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Tidak ada shift aktif</p>
              <p className="text-xs text-muted-foreground">Buka shift baru untuk mulai mencatat transaksi kasir.</p>
            </div>
          </div>
          <button
            onClick={() => setShowOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
          >
            <Unlock className="h-4 w-4" /> Buka Shift
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Shift Aktif" value={String(stats.open)} icon={Clock} tone="emerald" />
        <StatCard label="Shift Selesai" value={String(stats.closed)} icon={CheckCircle2} tone="primary" />
        <StatCard label="Total Transaksi" value={String(stats.totalSales)} icon={Receipt} tone="sky" />
        <StatCard label="Total Omzet" value={formatIDR(stats.totalRevenue)} icon={DollarSign} tone="amber" />
      </div>

      {/* Session history */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-foreground">Riwayat Shift Kasir</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Clock className="h-8 w-8 opacity-40" />
            <p className="text-sm">Belum ada shift kasir.</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">No. Shift</th>
                  <th className="px-4 py-3 font-semibold">Operator</th>
                  <th className="px-4 py-3 font-semibold">Waktu</th>
                  <th className="px-4 py-3 text-right font-semibold">Modal</th>
                  <th className="px-4 py-3 text-right font-semibold">Kas Tutup</th>
                  <th className="px-4 py-3 text-right font-semibold">Selisih</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const diff = s.cash_difference !== null ? Number(s.cash_difference) : null;
                  return (
                    <tr key={s.id} className="border-b border-border/60 transition hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">{s.session_no}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{s.operator_name}</div>
                        <div className="text-[10px] text-muted-foreground">{s.operator_role}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{formatDateTime(s.opened_at)}</div>
                        {s.closed_at && <div className="text-muted-foreground/70">— {formatDateTime(s.closed_at)}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatIDR(Number(s.opening_cash))}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{s.closing_cash !== null ? formatIDR(Number(s.closing_cash)) : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        {diff === null ? (
                          <span className="text-muted-foreground">-</span>
                        ) : diff === 0 ? (
                          <span className="font-semibold text-emerald-600">Rp 0</span>
                        ) : diff > 0 ? (
                          <span className="font-semibold text-sky-600">+{formatIDR(diff)}</span>
                        ) : (
                          <span className="font-semibold text-destructive">-{formatIDR(Math.abs(diff))}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.status === 'open' ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">AKTIF</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">SELESAI</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => printSessionReport(s)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
                          title="Cetak laporan"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showOpen && (
        <OpenSessionForm
          operatorName={user?.display_name ?? 'Kasir'}
          operatorRole={user?.role ?? 'kasir'}
          onClose={() => setShowOpen(false)}
          onSaved={() => { setShowOpen(false); loadData(); }}
        />
      )}
      {showClose && (
        <CloseSessionForm
          session={showClose}
          onClose={() => setShowClose(null)}
          onConfirm={(cash, notes, closedAt) => handleCloseSession(showClose, cash, notes, closedAt)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: string }) {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
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

// ── Open Session Form ──────────────────────────────────────────────────────

function OpenSessionForm({ operatorName, operatorRole, onClose, onSaved }: {
  operatorName: string;
  operatorRole: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [openingCash, setOpeningCash] = useState('');
  const [openedAt, setOpenedAt] = useState(() => {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const sessionNo = genSessionNo();
    await supabase.from('cash_sessions').insert({
      session_no: sessionNo,
      operator_name: operatorName,
      operator_role: operatorRole,
      opening_cash: Number(openingCash) || 0,
      status: 'open',
      opened_at: openedAt ? new Date(openedAt).toISOString() : new Date().toISOString(),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-foreground">Buka Shift Kasir</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground"><span className="font-semibold">Operator:</span> {operatorName} ({operatorRole})</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Jam Mulai Shift</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="datetime-local"
                value={openedAt}
                onChange={(e) => setOpenedAt(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Jam saat shift dimulai. Bisa diisi mundur kalau baru sempat input setelah mulai.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Modal Awal Kas (Cash)</label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="number"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Jumlah uang tunai yang disiapkan di laci kasir.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Membuka...' : 'Buka Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Close Session Form ─────────────────────────────────────────────────────

function CloseSessionForm({ session, onClose, onConfirm }: {
  session: SessionWithSales;
  onClose: () => void;
  onConfirm: (closingCash: number, notes: string, closedAt: string) => void;
}) {
  const cashSales = session.sales.filter((s) => s.payment_method === 'cash');
  const cashRevenue = cashSales.reduce((a, s) => a + Number(s.total), 0);
  const expected = Number(session.opening_cash) + cashRevenue;
  const [closingCash, setClosingCash] = useState('');
  const [closedAt, setClosedAt] = useState(() => {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState('');
  const diff = (Number(closingCash) || 0) - expected;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-bold text-foreground">Tutup Shift Kasir</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1.5">
            <Row label="No. Shift" value={session.session_no} />
            <Row label="Operator" value={session.operator_name} />
            <Row label="Buka Shift" value={formatDateTime(session.opened_at)} />
            <Row label="Modal Awal" value={formatIDR(Number(session.opening_cash))} />
            <Row label="Penjualan Cash" value={formatIDR(cashRevenue)} />
            <Row label="Jumlah Transaksi" value={String(session.sales.length)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Jam Selesai Shift</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="datetime-local"
                value={closedAt}
                onChange={(e) => setClosedAt(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Jam saat shift berakhir. Bisa diisi mundur kalau baru sempat tutup setelah shift selesai.</p>
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
            <p className="text-xs text-sky-700 dark:text-sky-300">
              <span className="font-semibold">Kas Expected:</span> {formatIDR(expected)}
            </p>
            <p className="mt-0.5 text-[11px] text-sky-600/70 dark:text-sky-400/70">
              Modal awal + total penjualan cash
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Uang Tunai di Laci (Hitung Fisik)</label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="number"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
            </div>
          </div>

          {closingCash && (
            <div className={cn(
              'rounded-lg border p-3',
              diff === 0 ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' :
              diff > 0 ? 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30' :
              'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
            )}>
              <p className={cn(
                'text-sm font-bold',
                diff === 0 ? 'text-emerald-700 dark:text-emerald-300' :
                diff > 0 ? 'text-sky-700 dark:text-sky-300' :
                'text-amber-700 dark:text-amber-300',
              )}>
                {diff === 0 ? 'Kas平衡 — Tidak ada selisih' :
                 diff > 0 ? `Selisih Lebih: +${formatIDR(diff)}` :
                 `Selisih Kurang: -${formatIDR(Math.abs(diff))}`}
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Catatan (opsional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Catatan untuk shift ini..." />
          </div>

          <button
            onClick={() => onConfirm(Number(closingCash) || 0, notes, closedAt ? new Date(closedAt).toISOString() : new Date().toISOString())}
            disabled={!closingCash}
            className="w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            Tutup & Rekonsiliasi
          </button>
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
