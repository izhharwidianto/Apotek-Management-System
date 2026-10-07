import { callOpenRouter } from '@/lib/ai-config';

export interface PendingFlow {
  description: string;
  amount: number;
  dueDate: string;
}

export interface CostVarianceInput {
  sku: string;
  name: string;
  standardCost: number;
  actualCost: number;
  currentStock: number;
  monthlyVolume: number;
}

export interface FinancialHealthInput {
  currentCashBalance: number;
  monthlyOperatingExpense: number;
  totalRevenue30d: number;
  totalCogs30d: number;
  totalExpenses30d: number;
  pendingInflows: PendingFlow[];
  pendingOutflows: PendingFlow[];
  costVariances: CostVarianceInput[];
  topSellingSkus: { sku: string; name: string; qty: number; revenue: number; margin: number }[];
  lowMarginSkus: { sku: string; name: string; marginPct: number; stockValue: number }[];
}

export interface MarginDriftAlert {
  sku: string;
  recommendedAction: string;
}

export interface FinancialAIResult {
  cashRunwayMonths: number;
  cashStatus: 'SAFE' | 'WARNING' | 'CRITICAL';
  cfoExecutiveSummary: string;
  marginDriftAlerts: MarginDriftAlert[];
  grossMarginPct: number;
  netProfitProjection: number;
  workingCapitalRecommendation: string;
  hppOptimizationNotes: string;
}

export async function analyzeFinancialsWithAI(data: FinancialHealthInput): Promise<{ data: FinancialAIResult; error?: string }> {
  const prompt = `Kamu adalah seorang AI CFO (Chief Financial Officer) untuk apotek di Indonesia. Analisis data keuangan real-time berikut:

${JSON.stringify(data, null, 2)}

Konteks:
- currentCashBalance = saldo kas real-time (dari total penjualan - total pengeluaran).
- monthlyOperatingExpense = biaya operasional bulanan tetap (sewa, gaji, listrik).
- totalRevenue30d / totalCogs30d / totalExpenses30d = data 30 hari terakhir dari sales + expenses.
- costVariances = deteksi HPP drift — perbandingan cost_price (standard) vs harga aktual supplier.
- topSellingSkus = produk dengan kontribusi pendapatan tertinggi.
- lowMarginSkus = produk dengan margin tipis (<15%) yang perlu optimasi pricing.

Tugas analisis:
1. Hitung cashRunwayMonths = berapa bulan apotek bisa bertahan tanpa revenue baru.
2. Tentukan cashStatus: SAFE (>3 bulan), WARNING (1-3 bulan), CRITICAL (<1 bulan).
3. Hitung grossMarginPct dari revenue vs COGS 30 hari.
4. Proyeksikan netProfitProjection untuk bulan berikutnya berdasarkan tren.
5. Untuk setiap costVariance, berikan rekomendasi spesifik (re-negosiasi, ganti supplier, optimasi HPP).
6. Berikan workingCapitalRecommendation — berapa modal yang perlu dialokasikan untuk inventory.
7. Berikan hppOptimizationNotes — strategi menekan HPP tanpa mengorbankan kualitas.
8. Identifikasi SKU dengan margin tipis yang perlu price adjustment.

Berikan output JSON dalam format persis seperti ini (tanpa markdown, tanpa code block):
{
  "cashRunwayMonths": number,
  "cashStatus": "SAFE" | "WARNING" | "CRITICAL",
  "cfoExecutiveSummary": "string ringkas max 3 kalimat",
  "marginDriftAlerts": [{ "sku": "string", "recommendedAction": "string" }],
  "grossMarginPct": number,
  "netProfitProjection": number,
  "workingCapitalRecommendation": "string",
  "hppOptimizationNotes": "string"
}`;

  const result = await callOpenRouter(prompt);
  if (!result.ok) {
    return { data: localFallbackFinancialAnalysis(data), error: result.error };
  }

  try {
    const parsed = JSON.parse(result.content) as FinancialAIResult;
    return { data: parsed };
  } catch {
    return { data: localFallbackFinancialAnalysis(data), error: 'Gagal parse response AI — menggunakan analisis lokal.' };
  }
}

export function localFallbackFinancialAnalysis(data: FinancialHealthInput): FinancialAIResult {
  const totalInflow = data.pendingInflows.reduce((a, b) => a + b.amount, 0);
  const totalOutflow = data.pendingOutflows.reduce((a, b) => a + b.amount, 0);
  const projectedCash = data.currentCashBalance + totalInflow - totalOutflow;
  const monthlyBurn = Math.max(1, data.monthlyOperatingExpense);
  const runway = Math.max(0, Math.round((projectedCash / monthlyBurn) * 10) / 10);

  let status: FinancialAIResult['cashStatus'] = 'SAFE';
  if (runway < 1) status = 'CRITICAL';
  else if (runway < 3) status = 'WARNING';

  const grossMarginPct =
    data.totalRevenue30d > 0
      ? Math.round(((data.totalRevenue30d - data.totalCogs30d) / data.totalRevenue30d) * 1000) / 10
      : 0;

  const netProfit = data.totalRevenue30d - data.totalCogs30d - data.totalExpenses30d - data.monthlyOperatingExpense;
  const netProfitProjection = Math.round(netProfit * 1.05);

  const marginDriftAlerts: MarginDriftAlert[] = data.costVariances.map((c) => {
    const pct = c.standardCost > 0 ? ((c.actualCost - c.standardCost) / c.standardCost) * 100 : 0;
    if (pct > 10)
      return { sku: c.sku, recommendedAction: `Deviasi HPP +${pct.toFixed(1)}% — segera re-negosiasi harga supplier atau cari alternatif vendor. Stok saat ini ${c.currentStock} unit.` };
    if (pct > 0)
      return { sku: c.sku, recommendedAction: `Tinjau ulang HPP standar (+${pct.toFixed(1)}%). Evaluasi penyebab kenaikan biaya dan pertimbangkan price adjustment.` };
    return { sku: c.sku, recommendedAction: 'Biaya aktual sesuai budget — tidak ada tindakan khusus.' };
  });

  const driftCount = data.costVariances.filter((c) => c.actualCost > c.standardCost).length;
  const lowMarginCount = data.lowMarginSkus.length;
  const summary = `Saldo kas real-time Rp ${data.currentCashBalance.toLocaleString('id-ID')} dengan runway ${runway} bulan (status: ${status}). Gross margin ${grossMarginPct}% dari penjualan 30 hari. ${driftCount} SKU mengalami HPP drift, ${lowMarginCount} SKU margin tipis. Proyeksi laba bersih bulan depan Rp ${netProfitProjection.toLocaleString('id-ID')}.`;

  return {
    cashRunwayMonths: runway,
    cashStatus: status,
    cfoExecutiveSummary: summary,
    marginDriftAlerts,
    grossMarginPct,
    netProfitProjection,
    workingCapitalRecommendation:
      projectedCash > monthlyBurn * 3
        ? 'Working capital sehat — alokasikan surplus untuk procurement SKU dengan turnover tinggi.'
        : 'Working capital terbatas — prioritaskan pembelian SKU kritis dan tunda pengeluaran non-esensial.',
    hppOptimizationNotes:
      driftCount > 0
        ? `${driftCount} SKU mengalami kenaikan HPP. Lakukan re-negosiasi supplier, bulk purchasing untuk SKU dengan volume tinggi, dan evaluasi substitusi produk generic.`
        : 'HPP stabil — pertahankan kontrak supplier jangka panjang untuk locking price.',
  };
}
