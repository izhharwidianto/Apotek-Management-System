'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowDownRight,
  Bot,
  Box,
  DollarSign,
  RefreshCw,
  ShoppingCart,
  Zap,
  TrendingUp,
  Settings,
} from 'lucide-react';
import AISettingsModal from '@/components/AISettingsModal';
import { supabase, type Medicine } from '@/lib/supabase';
import {
  analyzeInventoryWithAI,
  localFallbackInsight,
  type StockItemAnalysisInput,
  type AIInventoryInsight,
} from '@/services/openaiInventoryService';
import { formatIDR } from '@/lib/format';

type SaleItemRow = {
  medicine_id: string | null;
  quantity: number;
  created_at: string;
};

export default function SmartStockDashboard() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiInsight, setAiInsight] = useState<AIInventoryInsight | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const load = async () => {
    setLoading(true);
    const [medRes, saleItemsRes] = await Promise.all([
      supabase.from('medicines').select('*').order('name', { ascending: true }),
      supabase.from('sale_items').select('medicine_id, quantity, created_at'),
    ]);
    const meds = (medRes.data as Medicine[]) ?? [];
    const saleItems = (saleItemsRes.data as SaleItemRow[]) ?? [];

    // Calculate avg daily usage per medicine from real sales data
    const usageByMed = new Map<string, { totalQty: number; lastDate: string | null }>();
    for (const si of saleItems) {
      if (!si.medicine_id) continue;
      const existing = usageByMed.get(si.medicine_id) ?? { totalQty: 0, lastDate: null };
      existing.totalQty += si.quantity;
      if (!existing.lastDate || si.created_at > existing.lastDate) {
        existing.lastDate = si.created_at;
      }
      usageByMed.set(si.medicine_id, existing);
    }

    // Merge usage data into medicines
    const enriched = meds.map((m) => {
      const usage = usageByMed.get(m.id);
      const daysSinceLastSale = usage?.lastDate
        ? Math.max(0, Math.floor((Date.now() - new Date(usage.lastDate).getTime()) / 86400000))
        : m.stock > 0
          ? 999 // never sold but has stock = potential dead stock
          : 0;
      return { ...m, _avgDailyUsage: usage?.totalQty ?? 0, _daysUnmoved: daysSinceLastSale };
    });
    setMedicines(enriched as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Calculate total span of sales data for avg daily usage
  const processedItems = useMemo(() => {
    return (medicines as any[]).map((item) => {
      const leadTimeDays = 7; // default supplier lead time
      // If we have sales data, compute daily usage over the period
      // Otherwise estimate based on stock and reorder point
      const avgDailyUsage = item._avgDailyUsage > 0
        ? Math.max(0.1, item._avgDailyUsage / 30) // assume at least 30 days of data
        : Math.max(0.1, item.reorder_point / 30); // fallback: ROP implies ~30 days

      // Dynamic safety stock with Z-score 1.65 (95% service level)
      const safetyStock = Math.ceil(avgDailyUsage * leadTimeDays * 1.65 * 0.5);
      const rop = Math.ceil(avgDailyUsage * leadTimeDays + safetyStock);
      const totalValue = item.stock * Number(item.cost_price);
      const isCritical = item.stock <= rop;
      const isDeadStock = item._daysUnmoved > 60;
      return {
        ...item,
        safetyStock,
        rop,
        totalValue,
        isCritical,
        isDeadStock,
        daysUnmoved: item._daysUnmoved,
        avgDailyUsage: Math.round(avgDailyUsage * 10) / 10,
      };
    });
  }, [medicines]);

  const totalHoldingValue = processedItems.reduce((acc, c) => acc + c.totalValue, 0);
  const totalDeadStockValue = processedItems.filter((i) => i.isDeadStock).reduce((acc, c) => acc + c.totalValue, 0);
  const criticalItemsCount = processedItems.filter((i) => i.isCritical).length;

  const handleRunAIAnalysis = useCallback(async () => {
    if (processedItems.length === 0) return;
    setLoadingAI(true);
    const aiInput: StockItemAnalysisInput[] = processedItems.map((i) => ({
      sku: i.code,
      name: i.name,
      genericName: i.generic_name,
      drugClassification: i.drug_classification,
      dosageForm: i.dosage_form,
      currentStock: i.stock,
      unitCost: Number(i.cost_price),
      unitPrice: Number(i.sell_price),
      reorderPoint: i.reorder_point,
      avgDailyUsage: i.avgDailyUsage,
      leadTimeDays: 7,
      daysUnmoved: i.daysUnmoved,
      supplier: i.supplier,
      expiryDate: i.expiry_date,
    }));
    setAiError(null);
    const result = await analyzeInventoryWithAI(aiInput);
    setAiInsight(result.data);
    setUsingFallback(!!result.error);
    setAiError(result.error ?? null);
    setLoadingAI(false);
  }, [processedItems]);

  useEffect(() => {
    if (!loading && processedItems.length > 0 && !aiInsight) {
      handleRunAIAnalysis();
    }
  }, [loading, processedItems.length, aiInsight, handleRunAIAnalysis]);

  return (
    <div className="space-y-6 p-6 bg-background text-foreground rounded-2xl border border-border">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Box className="text-primary" /> AI-Driven Inventory &amp; Working Capital
          </h2>
          <p className="text-xs text-muted-foreground">Dynamic Safety Stock &amp; ROP berbasis real-time stok + riwayat penjualan aktual</p>
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
            onClick={handleRunAIAnalysis}
            disabled={loadingAI || loading}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-xs font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
          >
            <Bot size={16} className={loadingAI ? 'animate-spin' : ''} />
            {loadingAI ? 'Menganalisis dengan AI...' : 'Refresh AI Copilot'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-secondary/50 p-4 rounded-xl border border-border relative overflow-hidden">
          <div className="absolute right-2 top-2 opacity-10 text-success"><DollarSign size={60} /></div>
          <p className="text-xs text-muted-foreground font-medium">Total Nilai Persediaan (Real-time)</p>
          <p className="text-2xl font-bold text-success mt-1">{formatIDR(totalHoldingValue)}</p>
          <span className="text-[10px] text-muted-foreground/70 mt-2 block">{processedItems.length} SKU aktif dari database medicines</span>
        </div>

        <div className="bg-secondary/50 p-4 rounded-xl border border-destructive/30 relative overflow-hidden">
          <div className="absolute right-2 top-2 opacity-10 text-destructive"><Archive size={60} /></div>
          <p className="text-xs text-muted-foreground font-medium">Dead Stock (Modal Terkunci &gt;60 Hari)</p>
          <p className="text-2xl font-bold text-destructive mt-1">{formatIDR(totalDeadStockValue)}</p>
          <span className="text-[10px] text-destructive/80 mt-2 flex items-center gap-1">
            <ArrowDownRight size={12} /> {processedItems.filter((i) => i.isDeadStock).length} SKU butuh clearance
          </span>
        </div>

        <div className="bg-secondary/50 p-4 rounded-xl border border-warning/30 relative overflow-hidden">
          <div className="absolute right-2 top-2 opacity-10 text-warning"><ShoppingCart size={60} /></div>
          <p className="text-xs text-muted-foreground font-medium">Reorder Point (ROP) Alerts</p>
          <p className="text-2xl font-bold text-warning mt-1">{criticalItemsCount} SKU</p>
          <span className="text-[10px] text-warning/80 mt-2 flex items-center gap-1">
            <AlertCircle size={12} /> Dynamic ROP dihitung dari penjualan aktual
          </span>
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

      {aiInsight && (
        <div className="bg-primary/5 border border-primary/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-primary font-semibold text-sm">
            <Zap size={16} /> AI Chief Supply Chain Officer Recommendation
            {usingFallback && (
              <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">MODE LOKAL (tanpa API key)</span>
            )}
          </div>
          <p className="text-xs text-foreground/80 italic mb-3">&ldquo;{aiInsight.executiveSummary}&rdquo;</p>
          {aiInsight.workingCapitalRecommendation && (
            <p className="text-xs text-muted-foreground mb-2"><span className="font-semibold text-primary">Working Capital:</span> {aiInsight.workingCapitalRecommendation}</p>
          )}
          {aiInsight.dynamicSafetyStockNotes && (
            <p className="text-xs text-muted-foreground mb-3"><span className="font-semibold text-primary">Dynamic Safety Stock:</span> {aiInsight.dynamicSafetyStockNotes}</p>
          )}
          <div className="space-y-2">
            {aiInsight.highPriorityActions?.map((act, idx) => (
              <div key={idx} className="bg-secondary/50/80 p-2 rounded border border-primary/20 text-xs flex flex-wrap justify-between items-center gap-2">
                <span className="font-mono font-bold text-primary">{act.sku}</span>
                <span className="text-foreground/80 flex-1 min-w-0">{act.action}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${act.priority === 'CRITICAL' ? 'bg-destructive/15 text-destructive' : act.priority === 'HIGH' ? 'bg-warning/15 text-warning' : 'bg-sky-500/20 text-sky-300'}`}>{act.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-secondary/50 rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border font-semibold text-sm flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          Monitoring Stok Real-time, Dynamic Safety Stock &amp; Reorder Point
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3">SKU &amp; Nama Obat</th>
                <th className="p-3">Klasifikasi</th>
                <th className="p-3">Stok Real-time</th>
                <th className="p-3">Avg Daily Usage</th>
                <th className="p-3">Safety Stock (AI)</th>
                <th className="p-3">Dynamic ROP</th>
                <th className="p-3">Total Value</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground/70"><RefreshCw className="inline h-4 w-4 animate-spin mr-2" />Memuat data real-time…</td></tr>
              ) : processedItems.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground/70">Belum ada data medicines.</td></tr>
              ) : (
                processedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/50">
                    <td className="p-3 font-medium">
                      <div>{item.name}</div>
                      <div className="text-[10px] text-muted-foreground/70 font-mono">{item.code}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{item.drug_classification}</td>
                    <td className="p-3 font-bold">{item.stock} {item.unit}</td>
                    <td className="p-3 text-muted-foreground">{item.avgDailyUsage}/hari</td>
                    <td className="p-3 text-muted-foreground">{item.safetyStock}</td>
                    <td className="p-3 text-warning font-semibold">{item.rop}</td>
                    <td className="p-3">{formatIDR(item.totalValue)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {item.isCritical && (
                          <span className="bg-warning/15 text-warning px-2 py-1 rounded text-[10px] font-bold border border-warning/30">REORDER NOW</span>
                        )}
                        {item.isDeadStock && (
                          <span className="bg-destructive/15 text-destructive px-2 py-1 rounded text-[10px] font-bold border border-destructive/30">DEAD STOCK ({item.daysUnmoved}d)</span>
                        )}
                        {!item.isCritical && !item.isDeadStock && (
                          <span className="bg-success/15 text-success px-2 py-1 rounded text-[10px]">OPTIMAL</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AISettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
