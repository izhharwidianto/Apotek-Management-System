import { callOpenRouter } from '@/lib/ai-config';

export interface StockItemAnalysisInput {
  sku: string;
  name: string;
  genericName: string | null;
  drugClassification: string;
  dosageForm: string;
  currentStock: number;
  unitCost: number;
  unitPrice: number;
  reorderPoint: number;
  avgDailyUsage: number;
  leadTimeDays: number;
  daysUnmoved: number;
  supplier: string | null;
  expiryDate: string | null;
}

export interface AIInventoryInsight {
  totalDeadStockValue: number;
  totalHoldingValue: number;
  highPriorityActions: { sku: string; action: string; reason: string; priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' }[];
  executiveSummary: string;
  workingCapitalRecommendation: string;
  dynamicSafetyStockNotes: string;
}

export async function analyzeInventoryWithAI(items: StockItemAnalysisInput[]): Promise<{ data: AIInventoryInsight; error?: string }> {
  const prompt = `Kamu adalah seorang AI Chief Supply Chain Officer untuk apotek di Indonesia. Analisis data persediaan obat berikut secara real-time:

${JSON.stringify(items, null, 2)}

Konteks:
- Data ini diambil langsung dari database stok apotek (tabel medicines + sales).
- avgDailyUsage dihitung dari riwayat penjualan aktual (sale_items).
- leadTimeDays adalah estimasi waktu tunggu supplier (default 7 hari jika tidak diketahui).
- daysUnmoved = hari sejak pergerakan stok terakhir.
- Dynamic Safety Stock = avgDailyUsage × leadTimeDays × safetyFactor (Z-score untuk service level 95% = 1.65).
- Dynamic ROP = (avgDailyUsage × leadTimeDays) + Safety Stock.

Tugas analisis:
1. Identifikasi SKU dengan stok kritis (di bawah ROP) dan berikan rekomendasi pemesanan dengan kuantitas spesifik.
2. Identifikasi dead stock (>60 hari tidak bergerak) dan hitung modal terkunci.
3. Identifikasi obat yang akan kadaluarsa dalam 90 hari dan berikan saran clearance.
4. Identifikasi obat dengan nilai persediaan tertinggi (ABC analysis) untuk prioritas manajemen.
5. Berikan rekomendasi working capital — berapa modal yang perlu disuntikkan atau yang bisa dilepaskan.
6. Berikan catatan dynamic safety stock — SKU mana yang perlu safety stock lebih tinggi karena volatilitas permintaan.

Berikan output JSON dalam format persis seperti ini (tanpa markdown, tanpa code block):
{
  "totalDeadStockValue": number,
  "totalHoldingValue": number,
  "highPriorityActions": [
    { "sku": "string", "action": "string spesifik dengan kuantitas", "reason": "string", "priority": "CRITICAL" | "HIGH" | "MEDIUM" }
  ],
  "executiveSummary": "string ringkas max 3 kalimat",
  "workingCapitalRecommendation": "string rekomendasi modal kerja",
  "dynamicSafetyStockNotes": "string catatan safety stock dinamis"
}`;

  const result = await callOpenRouter(prompt);
  if (!result.ok) {
    return { data: localFallbackInsight(items), error: result.error };
  }

  try {
    const parsed = JSON.parse(result.content) as AIInventoryInsight;
    return { data: parsed };
  } catch {
    return { data: localFallbackInsight(items), error: 'Gagal parse response AI — menggunakan analisis lokal.' };
  }
}

export function localFallbackInsight(items: StockItemAnalysisInput[]): AIInventoryInsight {
  const deadStock = items.filter((i) => i.daysUnmoved > 60);
  const totalDeadStockValue = deadStock.reduce((acc, i) => acc + i.currentStock * i.unitCost, 0);
  const totalHoldingValue = items.reduce((acc, i) => acc + i.currentStock * i.unitCost, 0);

  const highPriorityActions: AIInventoryInsight['highPriorityActions'] = [];

  for (const i of deadStock) {
    highPriorityActions.push({
      sku: i.sku,
      action: `Clearance/bundling/diskon untuk ${i.name} — lepas ${i.currentStock} unit senilai Rp ${(i.currentStock * i.unitCost).toLocaleString('id-ID')}`,
      reason: `Tidak bergerak ${i.daysUnmoved} hari (dead stock)`,
      priority: 'HIGH',
    });
  }

  for (const i of items) {
    if (i.daysUnmoved <= 60 && i.currentStock <= i.reorderPoint) {
      const reorderQty = Math.max(10, Math.round(i.avgDailyUsage * i.leadTimeDays * 2) - i.currentStock);
      highPriorityActions.push({
        sku: i.sku,
        action: `Segera pesan ulang ${reorderQty} unit ${i.name} dari ${i.supplier ?? 'supplier'}`,
        reason: `Stok ${i.currentStock} ≤ ROP ${i.reorderPoint}`,
        priority: 'CRITICAL',
      });
    }
  }

  const expiringSoon = items.filter((i) => {
    if (!i.expiryDate) return false;
    const days = Math.floor((new Date(i.expiryDate).getTime() - Date.now()) / 86400000);
    return days > 0 && days <= 90;
  });
  for (const i of expiringSoon) {
    highPriorityActions.push({
      sku: i.sku,
      action: `Promosikan ${i.name} sebelum kadaluarsa (${i.expiryDate})`,
      reason: `Kadaluarsa dalam ≤90 hari`,
      priority: 'MEDIUM',
    });
  }

  return {
    totalDeadStockValue,
    totalHoldingValue,
    highPriorityActions,
    executiveSummary:
      items.length > 0
        ? `Dari ${items.length} SKU, ${deadStock.length} terindikasi dead stock (modal terkunci Rp ${totalDeadStockValue.toLocaleString('id-ID')}). Total nilai persediaan Rp ${totalHoldingValue.toLocaleString('id-ID')}. Prioritaskan reorder ${items.filter((i) => i.currentStock <= i.reorderPoint).length} SKU kritis.`
        : 'Tidak ada data cukup untuk analisis.',
    workingCapitalRecommendation:
      deadStock.length > 0
        ? `Lepaskan modal terkunci Rp ${totalDeadStockValue.toLocaleString('id-ID')} dari dead stock melalui clearance. Investasikan kembali ke SKU dengan turnover tinggi.`
        : 'Working capital optimal — tidak ada dead stock signifikan.',
    dynamicSafetyStockNotes:
      'Safety stock dihitung dinamis berdasarkan avgDailyUsage aktual dari penjualan. SKU dengan volatilitas tinggi (obat musiman/epidemik) perlu safety factor lebih tinggi (1.65–2.0).',
  };
}
