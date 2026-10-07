'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  AlertCircle,
  Bot,
  TrendingDown,
  ArrowUpRight,
  ShieldCheck,
  Wallet,
  Activity,
  RefreshCw,
  TrendingUp,
  Settings,
} from 'lucide-react';
import AISettingsModal from '@/components/AISettingsModal';
import { supabase, type Medicine } from '@/lib/supabase';
import {
  analyzeFinancialsWithAI,
  localFallbackFinancialAnalysis,
  type FinancialHealthInput,
  type FinancialAIResult,
} from '@/services/openaiFinancialService';
import { formatIDR } from '@/lib/format';

type SaleRow = {
  id: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  created_at: string;
};

type SaleItemRow = {
  sale_id: string;
  medicine_id: string | null;
  medicine_name: string;
  quantity: number;
  price: number;
  subtotal: number;
};

type ExpenseRow = {
  id: string;
  category: string;
  description: string;
  amount: number;
  created_at: string;
};

export default function FinancialCfoDashboard() {
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [aiFinancialResult, setAiFinancialResult] = useState<FinancialAIResult | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [currentCashBalance, setCurrentCashBalance] = useState(0);
  const [totalRevenue30d, setTotalRevenue30d] = useState(0);
  const [totalCogs30d, setTotalCogs30d] = useState(0);
  const [totalExpenses30d, setTotalExpenses30d] = useState(0);
  const [costVariances, setCostVariances] = useState<FinancialHealthInput['costVariances']>([]);
  const [topSellingSkus, setTopSellingSkus] = useState<FinancialHealthInput['topSellingSkus']>([]);
  const [lowMarginSkus, setLowMarginSkus] = useState<FinancialHealthInput['lowMarginSkus']>([]);

  const loadData = async () => {
    setLoadingData(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [salesRes, saleItemsRes, expensesRes, medicinesRes] = await Promise.all([
      supabase.from('sales').select('id, subtotal, tax, discount, total, created_at'),
      supabase.from('sale_items').select('sale_id, medicine_id, medicine_name, quantity, price, subtotal'),
      supabase.from('expenses').select('id, category, description, amount, created_at'),
      supabase.from('medicines').select('*'),
    ]);

    const sales = (salesRes.data as SaleRow[]) ?? [];
    const saleItems = (saleItemsRes.data as SaleItemRow[]) ?? [];
    const expenses = (expensesRes.data as ExpenseRow[]) ?? [];
    const medicines = (medicinesRes.data as Medicine[]) ?? [];

    // Real-time cash balance = total sales revenue - total expenses
    const totalSalesRevenue = sales.reduce((acc, s) => acc + Number(s.total), 0);
    const totalExpensesAll = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const cashBalance = totalSalesRevenue - totalExpensesAll;
    setCurrentCashBalance(cashBalance);

    // 30-day revenue and COGS
    const sales30d = sales.filter((s) => new Date(s.created_at) >= thirtyDaysAgo);
    const saleItemIds30d = new Set(sales30d.map((s) => s.id));
    const saleItems30d = saleItems.filter((si) => saleItemIds30d.has(si.sale_id));

    const revenue30d = sales30d.reduce((acc, s) => acc + Number(s.total), 0);
    setTotalRevenue30d(revenue30d);

    // COGS = sum(quantity * cost_price) for each sale item
    const medCostMap = new Map(medicines.map((m) => [m.id, Number(m.cost_price)]));
    const cogs30d = saleItems30d.reduce((acc, si) => {
      const cost = si.medicine_id ? (medCostMap.get(si.medicine_id) ?? 0) : 0;
      return acc + si.quantity * cost;
    }, 0);
    setTotalCogs30d(cogs30d);

    // 30-day expenses
    const expenses30d = expenses.filter((e) => new Date(e.created_at) >= thirtyDaysAgo);
    const exp30d = expenses30d.reduce((acc, e) => acc + Number(e.amount), 0);
    setTotalExpenses30d(exp30d);

    // Cost variances: compare current cost_price vs sell_price margin
    // Detect HPP drift: medicines where margin < 15% (low margin = HPP eating into profit)
    const variances: FinancialHealthInput['costVariances'] = [];
    const lowMargin: FinancialHealthInput['lowMarginSkus'] = [];
    for (const m of medicines) {
      const cost = Number(m.cost_price);
      const price = Number(m.sell_price);
      if (cost > 0 && price > 0) {
        const marginPct = ((price - cost) / price) * 100;
        if (marginPct < 15) {
          lowMargin.push({
            sku: m.code,
            name: m.name,
            marginPct: Math.round(marginPct * 10) / 10,
            stockValue: m.stock * cost,
          });
        }
        // Treat cost_price as "standard" and compare against a baseline (e.g. 70% of sell price = healthy margin)
        const standardCost = price * 0.7; // expected cost for 30% margin
        if (cost > standardCost) {
          variances.push({
            sku: m.code,
            name: m.name,
            standardCost: Math.round(standardCost),
            actualCost: cost,
            currentStock: m.stock,
            monthlyVolume: saleItems30d
              .filter((si) => si.medicine_id === m.id)
              .reduce((acc, si) => acc + si.quantity, 0),
          });
        }
      }
    }
    setCostVariances(variances);
    setLowMarginSkus(lowMargin);

    // Top selling SKUs by revenue
    const skuRevenue = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
    for (const si of saleItems30d) {
      const key = si.medicine_id ?? si.medicine_name;
      const med = medicines.find((m) => m.id === si.medicine_id);
      const cost = med ? Number(med.cost_price) : 0;
      const existing = skuRevenue.get(key) ?? { name: si.medicine_name, qty: 0, revenue: 0, cost: 0 };
      existing.qty += si.quantity;
      existing.revenue += Number(si.subtotal);
      existing.cost += si.quantity * cost;
      skuRevenue.set(key, existing);
    }
    const top = Array.from(skuRevenue.entries())
      .map(([id, v]) => ({
        sku: medicines.find((m) => m.id === id)?.code ?? id,
        name: v.name,
        qty: v.qty,
        revenue: v.revenue,
        margin: v.revenue - v.cost,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    setTopSellingSkus(top);

    setLoadingData(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const monthlyOperatingExpense = 120000000; // Fixed monthly opex (rent, salaries, utilities)

  const handleRunFinancialAnalysis = useCallback(async () => {
    const payload: FinancialHealthInput = {
      currentCashBalance,
      monthlyOperatingExpense,
      totalRevenue30d,
      totalCogs30d,
      totalExpenses30d,
      pendingInflows: [],
      pendingOutflows: [],
      costVariances,
      topSellingSkus,
      lowMarginSkus,
    };
    setLoadingAI(true);
    setAiError(null);
    const result = await analyzeFinancialsWithAI(payload);
    setAiFinancialResult(result.data);
    setUsingFallback(!!result.error);
    setAiError(result.error ?? null);
    setLoadingAI(false);
  }, [currentCashBalance, totalRevenue30d, totalCogs30d, totalExpenses30d, costVariances, topSellingSkus, lowMarginSkus]);

  useEffect(() => {
    if (!loadingData && !aiFinancialResult) {
      handleRunFinancialAnalysis();
    }
  }, [loadingData, aiFinancialResult, handleRunFinancialAnalysis]);

  const projectedCash = currentCashBalance + totalRevenue30d - totalCogs30d - totalExpenses30d;

  return (
    <div className="space-y-6 p-6 bg-background text-foreground rounded-2xl border border-border">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="text-success" /> AI CFO Agent &amp; Financial Analytics
          </h2>
          <p className="text-xs text-muted-foreground">Saldo kas real-time, deteksi HPP drift, proyeksi laba berbasis data penjualan aktual</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
            title="Pengaturan AI"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={handleRunFinancialAnalysis}
            disabled={loadingAI || loadingData}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-success text-xs font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
          >
            <Bot size={16} className={loadingAI ? 'animate-spin' : ''} />
            {loadingAI ? 'CFO sedang Menganalisis...' : 'Run AI CFO Audit'}
          </button>
        </div>
      </div>

      {/* TOP METRICS & RUNWAY */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-secondary/50 p-4 rounded-xl border border-border">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Wallet size={14} /> Saldo Kas Real-time</p>
          <p className={`text-2xl font-bold mt-1 ${currentCashBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>{formatIDR(currentCashBalance)}</p>
          <span className="text-[10px] text-muted-foreground/70 mt-1 block">Dari total penjualan - total pengeluaran</span>
        </div>

        <div className="bg-secondary/50 p-4 rounded-xl border border-border">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Activity size={14} /> Proyeksi Kas 30 Hari</p>
          <p className={`text-2xl font-bold mt-1 ${projectedCash >= 0 ? 'text-success' : 'text-destructive'}`}>{formatIDR(projectedCash)}</p>
          <span className="text-[10px] text-muted-foreground/70 mt-1 block">Revenue - COGS - Expenses (30 hari)</span>
        </div>

        <div className="bg-secondary/50 p-4 rounded-xl border border-primary/30 relative overflow-hidden">
          <p className="text-xs text-muted-foreground font-medium">Cash Flow Runway (AI)</p>
          <p className="text-2xl font-bold text-primary mt-1">{aiFinancialResult ? `${aiFinancialResult.cashRunwayMonths} Bulan` : '-'}</p>
          <span className="text-[10px] text-primary mt-1 block">Ketahanan operasional tanpa Revenue</span>
        </div>

        <div className="bg-secondary/50 p-4 rounded-xl border border-border flex flex-col justify-center">
          <p className="text-xs text-muted-foreground font-medium mb-1">Status Kesehatan Kas</p>
          {aiFinancialResult?.cashStatus === 'SAFE' && (
            <span className="bg-success/15 text-success border border-success/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 w-fit">
              <ShieldCheck size={16} /> SAFE / SEHAT
            </span>
          )}
          {aiFinancialResult?.cashStatus === 'WARNING' && (
            <span className="bg-warning/15 text-warning border border-warning/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 w-fit">
              <AlertCircle size={16} /> WARNING / WASPADA
            </span>
          )}
          {aiFinancialResult?.cashStatus === 'CRITICAL' && (
            <span className="bg-destructive/15 text-destructive border border-destructive/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 w-fit">
              <AlertCircle size={16} /> CRITICAL / KRITIS
            </span>
          )}
          {!aiFinancialResult && <span className="text-xs text-muted-foreground/70">-</span>}
        </div>
      </div>

      {/* Revenue & Margin Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-secondary/50 p-3 rounded-xl border border-border">
          <p className="text-[10px] text-muted-foreground font-medium">Revenue 30 Hari</p>
          <p className="text-lg font-bold text-success">{formatIDR(totalRevenue30d)}</p>
        </div>
        <div className="bg-secondary/50 p-3 rounded-xl border border-border">
          <p className="text-[10px] text-muted-foreground font-medium">COGS 30 Hari (HPP)</p>
          <p className="text-lg font-bold text-destructive">{formatIDR(totalCogs30d)}</p>
        </div>
        <div className="bg-secondary/50 p-3 rounded-xl border border-border">
          <p className="text-[10px] text-muted-foreground font-medium">Gross Margin (AI)</p>
          <p className="text-lg font-bold text-primary">{aiFinancialResult ? `${aiFinancialResult.grossMarginPct}%` : '-'}</p>
        </div>
        <div className="bg-secondary/50 p-3 rounded-xl border border-border">
          <p className="text-[10px] text-muted-foreground font-medium">Proyeksi Laba Bersih</p>
          <p className={`text-lg font-bold ${aiFinancialResult && aiFinancialResult.netProfitProjection >= 0 ? 'text-success' : 'text-destructive'}`}>
            {aiFinancialResult ? formatIDR(aiFinancialResult.netProfitProjection) : '-'}
          </p>
        </div>
      </div>

      {aiError && (
        <div className="bg-destructive/5 border border-destructive/30 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-destructive">{aiError}</p>
            <p className="text-[10px] text-destructive/70 mt-0.5">Sistem otomatis beralih ke Mode Lokal (analisis statistik). Untuk mengaktifkan AI kembali, periksa kredit OpenRouter atau klik Pengaturan AI.</p>
          </div>
        </div>
      )}

      {/* AI CFO EXECUTIVE SUMMARY */}
      {aiFinancialResult && (
        <div className="bg-gradient-to-r from-emerald-950/50 to-slate-900 border border-success/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-success font-bold text-sm mb-1">
            <Bot size={18} /> Direct Insight dari AI CFO Agent
            {usingFallback && (
              <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">MODE LOKAL (tanpa API key)</span>
            )}
          </div>
          <p className="text-xs text-foreground/80 italic mb-2">&ldquo;{aiFinancialResult.cfoExecutiveSummary}&rdquo;</p>
          {aiFinancialResult.workingCapitalRecommendation && (
            <p className="text-xs text-muted-foreground mb-1"><span className="font-semibold text-success">Working Capital:</span> {aiFinancialResult.workingCapitalRecommendation}</p>
          )}
          {aiFinancialResult.hppOptimizationNotes && (
            <p className="text-xs text-muted-foreground mb-2"><span className="font-semibold text-success">Optimasi HPP:</span> {aiFinancialResult.hppOptimizationNotes}</p>
          )}
        </div>
      )}

      {/* COST VARIANCE & MARGIN DRIFT TABLE */}
      <div className="bg-secondary/50 rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border font-semibold text-sm flex justify-between items-center">
          <span className="flex items-center gap-2"><TrendingDown className="text-destructive" size={16} /> Deteksi Pembengkakan HPP (Cost Variance / Margin Drift)</span>
          {loadingData && <span className="text-xs text-muted-foreground/70 flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Memuat…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3">SKU &amp; Item</th>
                <th className="p-3">Harga Budget (Standard)</th>
                <th className="p-3">Harga Actual Vendor</th>
                <th className="p-3">Deviasi HPP (%)</th>
                <th className="p-3">Stok Saat Ini</th>
                <th className="p-3">Rekomendasi AI CFO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingData ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground/70">Memuat data…</td></tr>
              ) : costVariances.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground/70">Tidak ada HPP drift terdeteksi — semua SKU memiliki margin sehat (≥30%).</td></tr>
              ) : (
                costVariances.map((item) => {
                  const diff = item.actualCost - item.standardCost;
                  const percent = ((diff / item.standardCost) * 100).toFixed(1);
                  const aiAlert = aiFinancialResult?.marginDriftAlerts?.find((a) => a.sku === item.sku);
                  return (
                    <tr key={item.sku} className="hover:bg-muted/50">
                      <td className="p-3 font-bold">
                        <div>{item.name}</div>
                        <div className="text-[10px] text-muted-foreground/70 font-mono">{item.sku}</div>
                      </td>
                      <td className="p-3">{formatIDR(item.standardCost)}</td>
                      <td className="p-3 font-semibold text-foreground">{formatIDR(item.actualCost)}</td>
                      <td className="p-3">
                        <span className="bg-destructive/15 text-destructive border border-destructive/30 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 w-fit">
                          <ArrowUpRight size={12} /> +{percent}% ({formatIDR(diff)})
                        </span>
                      </td>
                      <td className="p-3 text-foreground/80">{item.currentStock} unit</td>
                      <td className="p-3 text-foreground/80 italic">{aiAlert ? aiAlert.recommendedAction : 'Perlu re-negosiasi harga supplier'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOW MARGIN SKUS */}
      {lowMarginSkus.length > 0 && (
        <div className="bg-secondary/50 rounded-xl border border-warning/30 overflow-hidden">
          <div className="p-4 border-b border-border font-semibold text-sm flex items-center gap-2">
            <AlertCircle className="text-warning" size={16} /> SKU Margin Tipis (&lt;15%) — Perlu Price Adjustment
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-background text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">SKU &amp; Item</th>
                  <th className="p-3">Margin (%)</th>
                  <th className="p-3">Nilai Stok Terkunci</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lowMarginSkus.map((item) => (
                  <tr key={item.sku} className="hover:bg-muted/50">
                    <td className="p-3 font-bold">
                      <div>{item.name}</div>
                      <div className="text-[10px] text-muted-foreground/70 font-mono">{item.sku}</div>
                    </td>
                    <td className="p-3">
                      <span className="bg-warning/15 text-warning border border-warning/30 px-2 py-0.5 rounded text-[10px] font-bold">
                        {item.marginPct}%
                      </span>
                    </td>
                    <td className="p-3 text-foreground/80">{formatIDR(item.stockValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TOP SELLING SKUS */}
      {topSellingSkus.length > 0 && (
        <div className="bg-secondary/50 rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="text-success" size={16} /> Top 10 SKU by Revenue (30 Hari)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-background text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Nama</th>
                  <th className="p-3">Qty Terjual</th>
                  <th className="p-3">Revenue</th>
                  <th className="p-3">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topSellingSkus.map((item) => (
                  <tr key={item.sku} className="hover:bg-muted/50">
                    <td className="p-3 font-mono text-muted-foreground">{item.sku}</td>
                    <td className="p-3 font-bold text-slate-200">{item.name}</td>
                    <td className="p-3 text-foreground">{item.qty}</td>
                    <td className="p-3 text-success font-semibold">{formatIDR(item.revenue)}</td>
                    <td className="p-3 text-primary">{formatIDR(item.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AISettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
