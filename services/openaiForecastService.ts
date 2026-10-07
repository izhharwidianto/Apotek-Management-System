import { callOpenRouter } from '@/lib/ai-config';

export interface DemandHistoryInput {
  sku: string;
  name: string;
  genericName: string | null;
  drugClassification: string;
  currentStock: number;
  unitCost: number;
  unitPrice: number;
  historicalUsageMonthly: number[];
  productionTargetMultiplier?: number;
}

export interface ForecastResult {
  sku: string;
  forecast30Days: number;
  forecast60Days: number;
  forecast90Days: number;
  trendPercentage: number;
  stockOutRiskDate: string;
  recommendedProcurementQty: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  seasonalNote: string;
}

export interface DemandForecast {
  forecastSummary: string;
  forecastResults: ForecastResult[];
}

export async function generateAIDemandForecast(items: DemandHistoryInput[]): Promise<{ data: DemandForecast; error?: string }> {
  const prompt = `Kamu adalah seorang AI Demand Planner untuk apotek di Indonesia. Analisis data historis konsumsi obat berikut secara real-time:

${JSON.stringify(items, null, 2)}

Konteks:
- Data ini diambil langsung dari database apotek (tabel medicines + sale_items).
- historicalUsageMonthly adalah array penjualan bulanan aktual per SKU (bulan terbaru di akhir array).
- currentStock adalah stok real-time saat ini.
- productionTargetMultiplier adalah faktor skenario what-if (1.0 = normal, 1.5 = +50% demand, dst).
- Pertimbangkan pola musiman Indonesia (musim flu/hujan, lebaran, tahun baru, epidemic season).

Tugas analisis:
1. Untuk setiap SKU, prediksi konsumsi 30, 60, dan 90 hari ke depan berdasarkan tren historis dan musiman.
2. Hitung trendPercentage (persentase pertumbuhan/penurunan).
3. Estimasi tanggal stockout berdasarkan currentStock dan forecast harian.
4. Rekomendasikan kuantitas procurement (PR) yang optimal — cukup untuk 90 hari minus stok saat ini, dengan buffer safety stock.
5. Berikan confidenceLevel berdasarkan jumlah data historis (≥6 bulan = HIGH, 3-5 bulan = MEDIUM, <3 = LOW).
6. Berikan seasonalNote untuk SKU dengan pola musiman yang terdeteksi.

Berikan output JSON dalam format persis seperti ini (tanpa markdown, tanpa code block):
{
  "forecastSummary": "string ringkas max 3 kalimat",
  "forecastResults": [
    {
      "sku": "string",
      "forecast30Days": number,
      "forecast60Days": number,
      "forecast90Days": number,
      "trendPercentage": number,
      "stockOutRiskDate": "string (tanggal atau 'SAFE')",
      "recommendedProcurementQty": number,
      "confidenceLevel": "HIGH" | "MEDIUM" | "LOW",
      "seasonalNote": "string"
    }
  ]
}`;

  const result = await callOpenRouter(prompt);
  if (!result.ok) {
    return { data: localFallbackForecast(items), error: result.error };
  }

  try {
    const parsed = JSON.parse(result.content) as DemandForecast;
    return { data: parsed };
  } catch {
    return { data: localFallbackForecast(items), error: 'Gagal parse response AI — menggunakan prediksi lokal.' };
  }
}

export function localFallbackForecast(items: DemandHistoryInput[]): DemandForecast {
  const results: ForecastResult[] = items.map((item) => {
    const mult = item.productionTargetMultiplier ?? 1;
    const history = item.historicalUsageMonthly;
    const n = history.length;

    let dailyUsage: number;
    let trendPct = 0;
    let confidence: ForecastResult['confidenceLevel'] = 'LOW';
    let seasonalNote = 'Data historis terbatas — monitoring ketat disarankan.';

    if (n >= 3) {
      const xs = history.map((_, i) => i);
      const meanX = xs.reduce((a, b) => a + b, 0) / n;
      const meanY = history.reduce((a, b) => a + b, 0) / n;
      const num = xs.reduce((acc, x, i) => acc + (x - meanX) * (history[i] - meanY), 0);
      const den = xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0);
      const slope = den === 0 ? 0 : num / den;
      const intercept = meanY - slope * meanX;
      const nextMonthForecast = Math.max(0, Math.round((intercept + slope * n) * mult));
      dailyUsage = Math.max(1, nextMonthForecast / 30);
      trendPct = Math.round((slope * 100) / Math.max(1, meanY));
      confidence = n >= 6 ? 'HIGH' : 'MEDIUM';

      if (n >= 4) {
        const lastQ = history.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const firstQ = history.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        if (lastQ > firstQ * 1.3) seasonalNote = 'Tren peningkatan terdeteksi — kemungkinan pola musiman.';
        else if (lastQ < firstQ * 0.7) seasonalNote = 'Tren penurunan — evaluasi kebutuhan stok.';
        else seasonalNote = 'Permintaan relatif stabil.';
      }
    } else if (n > 0) {
      dailyUsage = Math.max(1, (history[0] * mult) / 30);
    } else {
      dailyUsage = Math.max(1, Math.ceil(item.currentStock / 90));
      seasonalNote = 'Tidak ada data historis — estimasi berdasarkan stok saat ini.';
    }

    const forecast30 = Math.round(dailyUsage * 30);
    const forecast60 = Math.round(dailyUsage * 60);
    const forecast90 = Math.round(dailyUsage * 90);

    const daysUntilStockout = Math.floor(item.currentStock / dailyUsage);
    let stockOutRisk = 'SAFE';
    if (daysUntilStockout <= 90) {
      const riskDate = new Date();
      riskDate.setDate(riskDate.getDate() + daysUntilStockout);
      stockOutRisk = riskDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    const recommended = Math.max(0, forecast90 - item.currentStock);

    return {
      sku: item.sku,
      forecast30Days: forecast30,
      forecast60Days: forecast60,
      forecast90Days: forecast90,
      trendPercentage: trendPct,
      stockOutRiskDate: stockOutRisk,
      recommendedProcurementQty: recommended,
      confidenceLevel: confidence,
      seasonalNote,
    };
  });

  const atRisk = results.filter((r) => r.stockOutRiskDate !== 'SAFE').length;
  const summary = `Berdasarkan analisis ${items.length} SKU dari database real-time, ${atRisk} SKU berisiko stockout dalam 90 hari. Tren konsumsi ${results.some((r) => r.trendPercentage > 0) ? 'cenderung meningkat' : 'relatif stabil'}. Tinjau saran pembelian untuk mencegah kehabisan stok.`;

  return { forecastSummary: summary, forecastResults: results };
}
