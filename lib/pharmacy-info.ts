// ============================================================
// INFORMASI APOTEK — ubah nilai di bawah ini kapan saja
// ============================================================
// File ini khusus untuk menyimpan identitas apotek yang
// tampil di struk (untuk customer) dan invoice (untuk arsip).
// Cukup ganti teks di antara tanda kutip, simpan file, selesai.

export const PHARMACY_INFO = {
  // Nama apotek — tampil di header struk & invoice
  name: 'Apotek Sehat Sentosa',

  // Alamat lengkap apotek
  address: 'Jl. Kesehatan Raya No. 1, Menteng, Jakarta Pusat 10310',

  // Nomor telepon apotek
  phone: '(021) 314-5678',

  // WhatsApp apotek (opsional, tampil di struk)
  whatsapp: '0812-3456-7890',

  // Email apotek (opsional, tampil di struk)
  email: 'info@apoteksehatsentosa.co.id',

  // Nomor izin / SIKL (opsional, tampil di struk kecil)
  license: 'SIKL: 503/A/AP/2018',

  // NPWP (opsional, tampil di invoice)
  npwp: '01.234.567.8-901.000',
} as const;

// Catatan kaki struk (untuk customer)
export const RECEIPT_FOOTER = {
  thankYou: '*** Terima Kasih ***',
  line1: 'Barang yang dibeli dapat ditukar',
  line2: 'dengan bukti struk ini',
  line3: 'Simpan struk sebagai bukti garansi',
} as const;

// Catatan kaki invoice (untuk arsip internal)
export const INVOICE_FOOTER = {
  note1: 'Invoice ini merupakan arsip transaksi untuk keperluan internal.',
  note2: 'Bukan untuk diberikan kepada pelanggan.',
} as const;
