'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Menu,
  X,
  LogOut,
  Loader2,
  History,
  Truck,
  Clock,
  FileText,
  ClipboardCheck,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { type UserRole, ROLE_LABELS, ROLE_BADGE_COLORS } from '@/lib/users';
import LoginPage from '@/components/LoginPage';
import DashboardView from '@/components/views/dashboard-view';
import PosView from '@/components/views/pos-view';
import InventoryView from '@/components/views/inventory-view';
import ReportsView from '@/components/views/reports-view';
import QualityView from '@/components/views/quality-view';
import SalesHistoryView from '@/components/views/sales-history-view';
import PurchaseOrderView from '@/components/views/purchase-order-view';
import CashSessionView from '@/components/views/cash-session-view';
import PrescriptionView from '@/components/views/prescription-view';
import StockOpnameView from '@/components/views/stock-opname-view';
import BatchTrackingView from '@/components/views/batch-tracking-view';
import DemandForecastingDashboard from '@/components/DemandForecastingDashboard';
import FinancialCfoDashboard from '@/components/FinancialCfoDashboard';

type ViewId = 'dashboard' | 'pos' | 'inventory' | 'reports' | 'quality' | 'forecast' | 'finance' | 'sales-history' | 'po' | 'cash-session' | 'prescription' | 'stock-opname' | 'batch-tracking';

type NavItem = { id: ViewId; label: string; icon: React.ElementType; desc: string; roles: UserRole[] };

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Ringkasan & notifikasi', roles: ['owner', 'apoteker'] },
  { id: 'pos', label: 'Kasir / POS', icon: ShoppingCart, desc: 'Transaksi penjualan', roles: ['owner', 'apoteker', 'kasir'] },
  { id: 'sales-history', label: 'Histori Penjualan', icon: History, desc: 'Riwayat transaksi & pelanggan', roles: ['owner', 'apoteker', 'kasir'] },
  { id: 'inventory', label: 'Stok & Inventori', icon: Package, desc: 'Manajemen obat', roles: ['owner', 'apoteker', 'kasir'] },
  { id: 'po', label: 'Purchase Order', icon: Truck, desc: 'Pembelian ke pemasok', roles: ['owner', 'apoteker'] },
  { id: 'cash-session', label: 'Shift Kasir', icon: Clock, desc: 'Sesi & rekonsiliasi kas', roles: ['owner', 'apoteker', 'kasir'] },
  { id: 'prescription', label: 'Resep Dokter', icon: FileText, desc: 'Pencatatan & label resep', roles: ['owner', 'apoteker', 'kasir'] },
  { id: 'stock-opname', label: 'Stok Opname', icon: ClipboardCheck, desc: 'Hitung fisik & adjust', roles: ['owner', 'apoteker'] },
  { id: 'batch-tracking', label: 'Tracking Batch/Lot', icon: Layers, desc: 'Pelacakan batch & recall BPOM', roles: ['owner', 'apoteker'] },
  { id: 'forecast', label: 'Forecast / Demand Planning', icon: TrendingUp, desc: 'Prediksi konsumsi AI', roles: ['owner'] },
  { id: 'finance', label: 'Financial Analytics', icon: DollarSign, desc: 'AI CFO & cost variance', roles: ['owner'] },
  { id: 'reports', label: 'Laporan Keuangan', icon: BarChart3, desc: 'Laporan & analisis', roles: ['owner', 'apoteker'] },
  { id: 'quality', label: 'Perbaikan & Validasi', icon: ShieldCheck, desc: 'CAPA & uji logika', roles: ['owner'] },
];

const DEFAULT_VIEW: Record<UserRole, ViewId> = {
  owner: 'dashboard',
  apoteker: 'dashboard',
  kasir: 'pos',
};

export default function Home() {
  const { user, loading, logout } = useAuth();
  const [view, setView] = useState<ViewId>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (user) setView(DEFAULT_VIEW[user.role]);
  }, [user]);

  if (!mounted || loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Memuat ApotekZ…</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const allowedNav = NAV.filter((n) => n.roles.includes(user.role));
  const currentNav = NAV.find((n) => n.id === view);
  const canAccessView = currentNav?.roles.includes(user.role) ?? false;
  const activeView = canAccessView ? view : DEFAULT_VIEW[user.role];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'no-print fixed inset-y-0 left-0 z-50 w-72 transform border-r border-border bg-card/95 backdrop-blur-xl transition-transform duration-300 ease-out lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Image src="/image.png" alt="ApotekZ" width={40} height={40} className="rounded-lg shadow-lg shadow-primary/20" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight text-foreground">ApotekZ</h1>
                <p className="text-xs text-muted-foreground">Apotek Management</p>
              </div>
            </div>
            <button
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin px-3 py-4">
            {allowedNav.map((item, idx) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id);
                    setMobileOpen(false);
                  }}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className={cn(
                    'stagger-item group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200',
                    active
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                      : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary-foreground/90" />
                  )}
                  <Icon className={cn('h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110', active ? 'text-primary-foreground animate-icon-pop' : 'text-muted-foreground group-hover:text-foreground')} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-tight">{item.label}</div>
                    <div className={cn('truncate text-xs', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                      {item.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* User panel */}
          <div className="border-t border-border px-4 py-4">
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/40 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-2 ring-primary/20">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{user.display_name}</p>
                <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold', ROLE_BADGE_COLORS[user.role])}>
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive press-scale"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="no-print glass flex items-center justify-between border-b border-border px-4 py-3 lg:px-6">
          <button
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground press-scale lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">{NAV.find((n) => n.id === activeView)?.label}</h2>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              &middot; {NAV.find((n) => n.id === activeView)?.desc}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg bg-success/10 px-3 py-1.5 sm:flex">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse-soft" />
              <span className="text-xs font-semibold text-success">Tersinkronisasi</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div key={activeView} className="animate-page-enter h-full">
            {activeView === 'dashboard' && <DashboardView />}
            {activeView === 'pos' && <PosView />}
            {activeView === 'sales-history' && <SalesHistoryView />}
            {activeView === 'po' && <PurchaseOrderView />}
            {activeView === 'cash-session' && <CashSessionView />}
            {activeView === 'prescription' && <PrescriptionView />}
            {activeView === 'stock-opname' && <StockOpnameView />}
            {activeView === 'batch-tracking' && <BatchTrackingView />}
            {activeView === 'inventory' && <InventoryView />}
            {activeView === 'reports' && <ReportsView />}
            {activeView === 'quality' && <QualityView />}
            {activeView === 'forecast' && (
              <div className="p-4 lg:p-6">
                <DemandForecastingDashboard />
              </div>
            )}
            {activeView === 'finance' && (
              <div className="p-4 lg:p-6">
                <FinancialCfoDashboard />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
