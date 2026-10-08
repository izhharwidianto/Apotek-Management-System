'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Bot,
  Sliders,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Gauge,
  Settings,
  AlertCircle,
} from 'lucide-react';
import AISettingsModal from '@/components/AISettingsModal';
import { supabase, type Medicine, medicinesAll } from '@/lib/supabase';
import {
  generateAIDemandForecast,
  localFallbackForecast,
  type DemandHistoryInput,
  type DemandForecast,
} from '@/services/openaiForecastService';

type SaleItemRow = {
  medicine_id: string | null;
  quantity: number;
  created_at: string;
};

export default function DemandForecastingDashboard() {
  const [productionTarget, setProductionTarget] = useState<number>(100);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [forecastData, setForecastData] = useState<DemandForecast | null>(null);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [demandInputs, setDemandInputs] = useState<DemandHistoryInput[]>([]);

  const loadData = async () => {
    setLoadingData(true);
    const [medRes, saleItemsRes] = await Promise.all([
      medicinesAll(),
      supabase.from('sale_items').select('medicine_id, quantity, created_at'),
    ]);
    const meds = (medRes.data as Medicine[]) ?? [];
    const saleItems = (saleItemsRes.data as SaleItemRow[]) ?? [];

    // Build monthly usage history per medicine from real sales data
    const usageByMed = new Map<string, { totalQty: number; count: number; lastDate: string | null }>();
    for (const si of saleItems) {
      if (!si.medicine_id) continue;
      const existing = usageByMed.get(si.medicine_id) ?? { totalQty: 0, count: 0, lastDate: null };
      existing.totalQty += si.quantity;
      existing.count += 1;
      if (!existing.lastDate || si.created_at > existing.lastDate) {
        existing.lastDate = si.created_at;
      }
      usageByMed.set(si.medicine_id, existing);
    }

    const inputs: DemandHistoryInput[] = meds.map((m) => {
      const usage = usageByMed.get(m.id);
      const monthlyAvg = usage ? Math.round(usage.totalQty / Math.max(1, Math.ceil(usage.count / 30))) : 0;
      // Build a simple 6-month history array from the average (or zeros)
      const history = usage
        ? [monthlyAvg, monthlyAvg, Math.round(monthlyAvg * 0.9), monthlyAvg, Math.round(monthlyAvg * 1.1), monthlyAvg]
        : [];
      return {
        sku: m.code,
        name: m.name,
        genericName: m.generic_name,
        drugClassification: m.drug_classification,
        currentStock: m.stock,
        unitCost: Number(m.cost_price),
        unitPrice: Number(m.sell_price),
        historicalUsageMonthly: history,
      };
    });
    setDemandInputs(inputs);
    setLoadingData(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunForecast = useCallback(async () => {
    if (demandInputs.length === 0) return;
    setLoadingAI(true);
    const multiplier = productionTarget / 100;
    const payload = demandInputs.map((item) => ({ ...item, productionTargetMultiplier: multiplier }));
    setAiError(null);
    const result = await generateAIDemandForecast(payload);
    setForecastData(result.data);
    setUsingFallback(!!result.error);
    setAiError(result.error ?? null);
    setLoadingAI(false);
  }, [demandInputs, productionTarget]);

  useEffect(() => {
    if (!loadingData && demandInputs.length > 0) {
      handleRunForecast();
    }
  }, [loadingData, demandInputs.length, productionTarget, handleRunForecast]);

  const atRiskCount = forecastData?.forecastResults?.filter((r) => r.stockOutRiskDate !== 'SAFE').length ?? 0;

  return (
    <div className="space-y-6 p-6 bg-background text-foreground rounded-2xl border border-border">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="text-primary" /> AI Demand Forecasting &amp; What-If Scenario
          </h2>
          <p className="text-xs text-muted-foreground">Prediksi konsumsi obat 30/60/90 hari berbasis data penjualan real-time dari database medicines + sale_items</p>
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
            onClick={handleRunForecast}
            disabled={loadingAI || loadingData}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-xs font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
          >
            <Bot size={16} className={loadingAI ? 'animate-spin' : ''} />
            {loadingAI ? 'Menganalisis dengan AI...' : 'Run AI Forecast'}
          </button>
        </div>

        <div className="bg-secondary/50 border border-border p-3 rounded-xl flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs text-primary font-semibold">
            <Sliders size={16} /> Target Produksi:
          </div>
          <input
            type="range"
            min="50"
            max="200"
            step="10"
            value={productionTarget}
            onChange={(e) => setProductionTarget(Number(e.target.value))}
            className="w-32 accent-primary cursor-pointer"
          />
          <span className="text-xs font-mono font-bold bg-primary/15 text-primary px-2 py-1 rounded">
            {productionTarget}% {productionTarget > 100 ? `(+${productionTarget - 100}%)` : productionTarget < 100 ? `(${productionTarget - 100}%)` : ''}
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

      {forecastData && (
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/30 rounded-xl p-4 flex items-start gap-3">
          <Bot className="text-primary shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              Ringkasan Skenario AI
              {usingFallback && (
                <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">MODE LOKAL (tanpa API key)</span>
              )}
            </h4>
            <p className="text-xs text-foreground/80 mt-1">{forecastData.forecastSummary}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-secondary/50 p-3 rounded-xl border border-border">
          <p className="text-[10px] text-muted-foreground font-medium">Total SKU Dianalisis</p>
          <p className="text-xl font-bold text-foreground">{demandInputs.length}</p>
        </div>
        <div className="bg-secondary/50 p-3 rounded-xl border border-destructive/30">
          <p className="text-[10px] text-muted-foreground font-medium">SKU Berisiko Stockout</p>
          <p className="text-xl font-bold text-destructive">{atRiskCount}</p>
        </div>
        <div className="bg-secondary/50 p-3 rounded-xl border border-border">
          <p className="text-[10px] text-muted-foreground font-medium">Confidence: HIGH</p>
          <p className="text-xl font-bold text-success">{forecastData?.forecastResults?.filter((r) => r.confidenceLevel === 'HIGH').length ?? 0}</p>
        </div>
        <div className="bg-secondary/50 p-3 rounded-xl border border-border">
          <p className="text-[10px] text-muted-foreground font-medium">Confidence: MEDIUM/LOW</p>
          <p className="text-xl font-bold text-warning">{forecastData?.forecastResults?.filter((r) => r.confidenceLevel !== 'HIGH').length ?? 0}</p>
        </div>
      </div>

      <div className="bg-secondary/50 rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <span className="font-semibold text-sm flex items-center gap-2">
            <Calendar size={16} className="text-primary" /> Proyeksi Kebutuhan &amp; Tanggal Stockout
          </span>
          {loadingAI && <span className="text-xs text-primary animate-pulse">Menghitung ulang proyeksi dengan AI...</span>}
          {loadingData && <span className="text-xs text-muted-foreground/70 flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Memuat data real-time…</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3">SKU &amp; Item</th>
                <th className="p-3">Stok Real-time</th>
                <th className="p-3">Proyeksi 30 Hari</th>
                <th className="p-3">Proyeksi 60 Hari</th>
                <th className="p-3">Proyeksi 90 Hari</th>
                <th className="p-3">Tren</th>
                <th className="p-3">Estimasi Kehabisan Stok</th>
                <th className="p-3">Saran Pembelian (PR)</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Catatan Musiman</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingData ? (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground/70">Memuat data real-time…</td></tr>
              ) : demandInputs.length === 0 ? (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground/70">Belum ada data medicines di database.</td></tr>
              ) : (
                demandInputs.map((item) => {
                  const aiResult = forecastData?.forecastResults?.find((r) => r.sku === item.sku);
                  return (
                    <tr key={item.sku} className="hover:bg-muted/50">
                      <td className="p-3">
                        <div className="font-bold text-foreground/90">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground/70 font-mono">{item.sku}</div>
                      </td>
                      <td className="p-3 font-semibold text-foreground">{item.currentStock}</td>
                      <td className="p-3 text-primary font-mono font-semibold">{aiResult ? aiResult.forecast30Days : '-'}</td>
                      <td className="p-3 text-primary font-mono">{aiResult ? aiResult.forecast60Days : '-'}</td>
                      <td className="p-3 text-primary font-mono">{aiResult ? aiResult.forecast90Days : '-'}</td>
                      <td className="p-3">
                        {aiResult?.trendPercentage !== undefined && aiResult.trendPercentage !== 0 ? (
                          <span className={`flex items-center font-bold ${aiResult.trendPercentage > 0 ? 'text-success' : 'text-destructive'}`}>
                            <TrendingUp size={14} /> {aiResult.trendPercentage > 0 ? '+' : ''}{aiResult.trendPercentage}%
                          </span>
                        ) : <span className="text-muted-foreground/70">Stabil</span>}
                      </td>
                      <td className="p-3">
                        {aiResult?.stockOutRiskDate && aiResult.stockOutRiskDate !== 'SAFE' ? (
                          <span className="bg-destructive/15 text-destructive border border-destructive/30 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                            <AlertTriangle size={12} /> {aiResult.stockOutRiskDate}
                          </span>
                        ) : (
                          <span className="text-success font-medium">AMAN / SAFE</span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-warning">{aiResult ? `${aiResult.recommendedProcurementQty} unit` : '-'}</td>
                      <td className="p-3">
                        {aiResult && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                            aiResult.confidenceLevel === 'HIGH' ? 'bg-success/15 text-success' :
                            aiResult.confidenceLevel === 'MEDIUM' ? 'bg-warning/15 text-warning' :
                            'bg-destructive/15 text-destructive'
                          }`}>
                            <Gauge size={10} /> {aiResult.confidenceLevel}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground text-[10px] max-w-[150px]">{aiResult?.seasonalNote ?? '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AISettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
