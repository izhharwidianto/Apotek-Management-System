'use client';

import { PHARMACY_INFO, RECEIPT_FOOTER, INVOICE_FOOTER } from '@/lib/pharmacy-info';
import { formatIDR, formatIDRPlain, formatDateTime, formatDate } from '@/lib/format';
import type { Sale, SaleItem } from '@/lib/supabase';

type PrintableSale = Sale & { items: SaleItem[] };

/* ============================================================
 * STRUK (Receipt) — untuk customer
 * Ukuran 80mm thermal, ringkas, ada info apotek
 * ============================================================ */
export function ReceiptPrint({ sale }: { sale: PrintableSale }) {
  const subtotalNum = Number(sale.subtotal);
  const discountNum = Number(sale.discount);
  const taxNum = Number(sale.tax);
  const totalNum = Number(sale.total);
  const totalBeforeTax = subtotalNum - discountNum;

  return (
    <div className="print-area print-area-receipt">
      <div
        id="thermal-receipt"
        style={{
          width: '80mm',
          padding: '3mm 2mm',
          fontFamily: '"Courier New", monospace',
          fontSize: '10px',
          color: '#000',
          lineHeight: 1.4,
          background: '#fff',
        }}
      >
        {/* Header — info apotek */}
        <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{PHARMACY_INFO.name}</div>
          <div style={{ fontSize: '8px', marginTop: '1px' }}>{PHARMACY_INFO.address}</div>
          <div style={{ fontSize: '8px' }}>Telp: {PHARMACY_INFO.phone} &middot; WA: {PHARMACY_INFO.whatsapp}</div>
          {PHARMACY_INFO.email && <div style={{ fontSize: '8px' }}>{PHARMACY_INFO.email}</div>}
          <div style={{ fontSize: '8px', marginTop: '1px' }}>{PHARMACY_INFO.license}</div>
        </div>

        {/* Transaction info */}
        <div style={{ marginBottom: '3px', fontSize: '9px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>No: {sale.invoice_no}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tgl: {formatDateTime(sale.created_at)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kasir: Admin</span><span>Plgn: {sale.customer_name}</span></div>
        </div>

        {/* Items */}
        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '3px 0' }}>
          {sale.items.map((it) => (
            <div key={it.id} style={{ marginBottom: '2px' }}>
              <div style={{ fontWeight: 'bold' }}>{it.medicine_name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{it.quantity} x {formatIDRPlain(it.price)}</span>
                <span style={{ fontWeight: 'bold' }}>{formatIDRPlain(it.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ padding: '3px 0', fontSize: '9px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{formatIDRPlain(subtotalNum)}</span></div>
          {discountNum > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Diskon</span><span>-{formatIDRPlain(discountNum)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px dashed #000', marginTop: '1px', paddingTop: '1px' }}><span>Total Sebelum Pajak</span><span>{formatIDRPlain(totalBeforeTax)}</span></div>
          {taxNum > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pajak ({Math.round((taxNum / Math.max(1, totalBeforeTax)) * 100)}%)</span><span>{formatIDRPlain(taxNum)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', borderTop: '2px solid #000', borderBottom: '2px solid #000', marginTop: '2px', marginBottom: '2px', padding: '2px 0' }}><span>TOTAL BAYAR</span><span>{formatIDRPlain(totalNum)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bayar ({sale.payment_method})</span><span>{formatIDRPlain(sale.paid)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kembali</span><span>{formatIDRPlain(sale.change)}</span></div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '4px', marginTop: '2px', fontSize: '8px' }}>
          <div style={{ fontWeight: 'bold' }}>{RECEIPT_FOOTER.thankYou}</div>
          <div>{RECEIPT_FOOTER.line1}</div>
          <div>{RECEIPT_FOOTER.line2}</div>
          <div style={{ marginTop: '2px' }}>{RECEIPT_FOOTER.line3}</div>
          <div style={{ marginTop: '3px', fontSize: '7px', opacity: 0.7 }}>{PHARMACY_INFO.name} &middot; melayani pelayanan kesehatan</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * INVOICE — untuk arsip internal apotek
 * Ukuran A4, lebih formal, ada info apotek + NPWP
 * ============================================================ */
export function InvoicePrint({ sale }: { sale: PrintableSale }) {
  const subtotalNum = Number(sale.subtotal);
  const discountNum = Number(sale.discount);
  const taxNum = Number(sale.tax);
  const totalNum = Number(sale.total);
  const totalBeforeTax = subtotalNum - discountNum;
  const taxPct = Math.round((taxNum / Math.max(1, totalBeforeTax)) * 100);

  return (
    <div className="print-area print-area-invoice">
      <div
        id="a4-invoice"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '15mm 18mm',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '11px',
          color: '#000',
          lineHeight: 1.5,
          background: '#fff',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #000', paddingBottom: '10px', marginBottom: '15px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{PHARMACY_INFO.name}</div>
            <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>{PHARMACY_INFO.address}</div>
            <div style={{ fontSize: '10px', color: '#555' }}>Telp: {PHARMACY_INFO.phone} &middot; WA: {PHARMACY_INFO.whatsapp}</div>
            {PHARMACY_INFO.email && <div style={{ fontSize: '10px', color: '#555' }}>{PHARMACY_INFO.email}</div>}
            <div style={{ fontSize: '10px', color: '#555' }}>{PHARMACY_INFO.license} &middot; NPWP: {PHARMACY_INFO.npwp}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px' }}>INVOICE</div>
            <div style={{ fontSize: '10px', marginTop: '4px' }}>No: <strong>{sale.invoice_no}</strong></div>
            <div style={{ fontSize: '10px' }}>Tanggal: {formatDate(sale.created_at)}</div>
            <div style={{ fontSize: '10px' }}>Waktu: {formatDateTime(sale.created_at)}</div>
          </div>
        </div>

        {/* Customer info */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#888', marginBottom: '3px' }}>Ditagihkan Kepada</div>
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{sale.customer_name}</div>
          <div style={{ fontSize: '10px', color: '#555' }}>Kasir: Admin &middot; Metode: {sale.payment_method}</div>
        </div>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 'bold' }}>No</th>
              <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 'bold' }}>Nama Obat</th>
              <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 'bold' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 'bold' }}>Harga Satuan</th>
              <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 'bold' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it, i) => (
              <tr key={it.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '5px 4px' }}>{i + 1}</td>
                <td style={{ padding: '5px 4px' }}>{it.medicine_name}</td>
                <td style={{ padding: '5px 4px', textAlign: 'center' }}>{it.quantity}</td>
                <td style={{ padding: '5px 4px', textAlign: 'right' }}>{formatIDRPlain(it.price)}</td>
                <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 'bold' }}>{formatIDRPlain(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
          <table style={{ fontSize: '10px', minWidth: '250px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 8px', color: '#555' }}>Subtotal</td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatIDR(subtotalNum)}</td>
              </tr>
              {discountNum > 0 && (
                <tr>
                  <td style={{ padding: '4px 8px', color: '#555' }}>Diskon</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>-{formatIDR(discountNum)}</td>
                </tr>
              )}
              <tr style={{ borderTop: '1px solid #ddd' }}>
                <td style={{ padding: '4px 8px', fontWeight: 'bold' }}>Total Sebelum Pajak</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold' }}>{formatIDR(totalBeforeTax)}</td>
              </tr>
              {taxNum > 0 && (
                <tr>
                  <td style={{ padding: '4px 8px', color: '#555' }}>Pajak ({taxPct}%)</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatIDR(taxNum)}</td>
                </tr>
              )}
              <tr style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
                <td style={{ padding: '6px 8px', fontSize: '13px', fontWeight: 'bold' }}>TOTAL BAYAR</td>
                <td style={{ padding: '6px 8px', fontSize: '13px', textAlign: 'right', fontWeight: 'bold' }}>{formatIDR(totalNum)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 8px', color: '#555' }}>Dibayar ({sale.payment_method})</td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatIDR(sale.paid)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 8px', color: '#555' }}>Kembalian</td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatIDR(sale.change)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '40px', borderTop: '1px solid #ddd', paddingTop: '10px', fontSize: '9px', color: '#888' }}>
          <p>{INVOICE_FOOTER.note1}</p>
          <p>{INVOICE_FOOTER.note2}</p>
        </div>

        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
          <div>
            <div style={{ color: '#555' }}>Diterima oleh,</div>
            <div style={{ marginTop: '40px', borderTop: '1px solid #000', paddingTop: '3px', width: '150px' }}>(  {sale.customer_name}  )</div>
          </div>
          <div>
            <div style={{ color: '#555' }}>Hormat kami,</div>
            <div style={{ marginTop: '40px', borderTop: '1px solid #000', paddingTop: '3px', width: '150px' }}>(  Admin  )</div>
          </div>
        </div>
      </div>
    </div>
  );
}
