'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Printer,
  Receipt,
  FileText,
  Undo2,
  X,
  Keyboard,
  CheckCircle2,
  Package,
  AlertCircle,
  Clock,
  Phone,
  User,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { supabase, type Medicine, type Sale, type SaleItem, type ReturnRow, type Customer } from '@/lib/supabase';
import { formatIDR, formatIDRPlain, formatDateTime, genInvoiceNo, daysUntil } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ReceiptPrint, InvoicePrint } from '@/components/printables';

type CartItem = {
  medicine: Medicine;
  qty: number;
};

const TAX_RATE = 0.0;
const LOYALTY_MIN_SPEND = 20000;
const LOYALTY_THRESHOLD = 7;

export default function PosView() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(TAX_RATE);
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<(Sale & { items: SaleItem[] }) | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showRetur, setShowRetur] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [pendingSales, setPendingSales] = useState<(Sale & { items: SaleItem[] })[]>([]);
  const [showPending, setShowPending] = useState(false);
  const [resumeSale, setResumeSale] = useState<(Sale & { items: SaleItem[] }) | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadMedicines = async () => {
    setLoading(true);
    const { data } = await supabase.from('medicines').select('*').order('name', { ascending: true });
    setMedicines((data as Medicine[]) ?? []);
    setLoading(false);
  };

  const loadPendingSales = async () => {
    const { data: salesData } = await supabase
      .from('sales')
      .select('*')
      .in('status', ['pending', 'receipt_not_printed'])
      .order('created_at', { ascending: false });
    if (!salesData || salesData.length === 0) {
      setPendingSales([]);
      return;
    }
    const saleIds = salesData.map((s) => s.id);
    const { data: itemsData } = await supabase
      .from('sale_items')
      .select('*')
      .in('sale_id', saleIds);
    const itemsBySale = (itemsData ?? []).reduce<Record<string, SaleItem[]>>((acc, item) => {
      const it = item as SaleItem;
      if (!acc[it.sale_id]) acc[it.sale_id] = [];
      acc[it.sale_id].push(it);
      return acc;
    }, {});
    const combined = (salesData as Sale[]).map((s) => ({ ...s, items: itemsBySale[s.id] ?? [] }));
    setPendingSales(combined);
  };

  useEffect(() => {
    loadMedicines();
    loadPendingSales();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return medicines;
    return medicines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.drug_classification.toLowerCase().includes(q) ||
        (m.generic_name ?? '').toLowerCase().includes(q),
    );
  }, [medicines, query]);

  useEffect(() => setHighlightedIndex(0), [query]);

  const subtotal = useMemo(() => cart.reduce((a, c) => a + c.medicine.sell_price * c.qty, 0), [cart]);
  const taxAmount = useMemo(() => Math.round(subtotal * taxRate), [subtotal, taxRate]);
  const total = Math.max(0, subtotal - discount + taxAmount);

  const showToast = (msg: string, tone: 'success' | 'error' = 'success') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2500);
  };

  const addToCart = useCallback((med: Medicine) => {
    if (med.stock <= 0) {
      showToast(`Stok ${med.name} habis`, 'error');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.medicine.id === med.id);
      if (existing) {
        if (existing.qty + 1 > med.stock) {
          showToast(`Stok ${med.name} hanya ${med.stock}`, 'error');
          return prev;
        }
        return prev.map((c) => (c.medicine.id === med.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { medicine: med, qty: 1 }];
    });
  }, []);

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.medicine.id !== id) return c;
          const next = c.qty + delta;
          if (next > c.medicine.stock) {
            showToast(`Stok ${c.medicine.name} hanya ${c.medicine.stock}`, 'error');
            return c;
          }
          return { ...c, qty: next };
        })
        .filter((c) => c.qty > 0),
    );
  };

  const setQty = (id: string, qty: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.medicine.id !== id) return c;
        const clamped = Math.max(1, Math.min(qty, c.medicine.stock));
        return { ...c, qty: clamped };
      }),
    );
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.medicine.id !== id));
  const clearCart = () => {
    setCart([]);
    setDiscount(0);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showReceipt || showRetur || showCheckout || showPending || resumeSale) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setShowCheckout(true);
        return;
      }
      if (e.key === 'Escape') {
        if (isInput) (e.target as HTMLElement).blur();
        else clearCart();
        return;
      }
      if (e.key === 'ArrowDown' && !isInput) {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp' && !isInput) {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !isInput && filtered[highlightedIndex]) {
        e.preventDefault();
        addToCart(filtered[highlightedIndex]);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, highlightedIndex, cart, showReceipt, showRetur, showCheckout, showPending, resumeSale, addToCart]);

  const handleCheckout = async (custName: string, custPhone: string, paidAmount: number, payMethod: string) => {
    if (cart.length === 0) {
      showToast('Keranjang kosong', 'error');
      return;
    }
    if (paidAmount < total) {
      showToast('Pembayaran kurang dari total', 'error');
      return;
    }
    setProcessing(true);

    // Find or create customer
    let customerId: string | null = null;
    const finalName = custName.trim() || 'Umum';
    if (custName.trim() && custPhone.trim()) {
      const { data: existing } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', custPhone.trim())
        .maybeSingle();
      if (existing) {
        customerId = (existing as Customer).id;
      } else {
        const { data: newCust, error } = await supabase
          .from('customers')
          .insert({ name: custName.trim(), phone: custPhone.trim() })
          .select()
          .single();
        if (!error && newCust) customerId = (newCust as Customer).id;
      }
    } else if (custName.trim()) {
      const { data: existing } = await supabase
        .from('customers')
        .select('*')
        .ilike('name', custName.trim())
        .maybeSingle();
      if (existing) customerId = (existing as Customer).id;
    }

    const change = Math.max(0, paidAmount - total);
    const invoiceNo = genInvoiceNo();
    const saleRow = {
      invoice_no: invoiceNo,
      customer_name: finalName,
      customer_id: customerId,
      status: 'receipt_not_printed',
      subtotal,
      tax: taxAmount,
      discount,
      total,
      paid: paidAmount,
      change,
      payment_method: payMethod,
    };
    const { data: saleData, error: saleErr } = await supabase
      .from('sales')
      .insert(saleRow)
      .select()
      .single();
    if (saleErr || !saleData) {
      showToast('Gagal menyimpan transaksi: ' + (saleErr?.message ?? 'unknown'), 'error');
      setProcessing(false);
      return;
    }
    const items = cart.map((c) => ({
      sale_id: (saleData as Sale).id,
      medicine_id: c.medicine.id,
      medicine_name: c.medicine.name,
      quantity: c.qty,
      price: c.medicine.sell_price,
      subtotal: c.medicine.sell_price * c.qty,
    }));
    const { error: itemsErr } = await supabase.from('sale_items').insert(items);
    if (itemsErr) {
      showToast('Gagal menyimpan item: ' + itemsErr.message, 'error');
      setProcessing(false);
      return;
    }
    // Decrement stock
    await Promise.all(
      cart.map((c) => {
        const newStock = Math.max(0, c.medicine.stock - c.qty);
        return supabase.from('medicines').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', c.medicine.id);
      }),
    );

    // Update customer loyalty stats
    if (customerId) {
      const qualifies = total >= LOYALTY_MIN_SPEND;
      const { data: cust } = await supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
      if (cust) {
        const existing = cust as Customer;
        await supabase.from('customers').update({
          total_visits: existing.total_visits + 1,
          total_spent: Number(existing.total_spent) + total,
          loyalty_points: existing.loyalty_points + (qualifies ? 1 : 0),
          updated_at: new Date().toISOString(),
        }).eq('id', customerId);
      }
    }

    setLastSale({ ...(saleData as Sale), items: items as SaleItem[] });
    setShowCheckout(false);
    setShowReceipt(true);
    clearCart();
    setProcessing(false);
    loadMedicines();
    loadPendingSales();
    showToast('Transaksi berhasil', 'success');
  };

  const printDocument = async (mode: 'receipt' | 'invoice') => {
    if (lastSale) {
      await supabase.from('sales').update({ status: 'completed' }).eq('id', lastSale.id);
      loadPendingSales();
    }
    if (mode === 'invoice') {
      document.body.classList.add('print-invoice-mode');
    } else {
      document.body.classList.remove('print-invoice-mode');
    }
    window.print();
    document.body.classList.remove('print-invoice-mode');
  };

  // Resume a pending/receipt_not_printed sale
  const handleResumeSale = async (sale: Sale & { items: SaleItem[] }) => {
    if (sale.status === 'pending') {
      // Load items back into cart for editing
      const items = sale.items;
      const medIds = items.map((it) => it.medicine_id).filter(Boolean) as string[];
      const { data: meds } = await supabase.from('medicines').select('*').in('id', medIds);
      const medMap = new Map<string, Medicine>();
      (meds as Medicine[] ?? []).forEach((m) => medMap.set(m.id, m));
      const newCart: CartItem[] = items
        .map((it) => {
          const med = medMap.get(it.medicine_id ?? '');
          if (!med) return null;
          return { medicine: med, qty: it.quantity } as CartItem;
        })
        .filter((c): c is CartItem => c !== null);
      setCart(newCart);
      setDiscount(Number(sale.discount));
      // Delete the pending sale so we can re-create it on checkout
      await supabase.from('sale_items').delete().eq('sale_id', sale.id);
      await supabase.from('sales').delete().eq('id', sale.id);
      setResumeSale(null);
      setShowPending(false);
      showToast('Transaksi dimuat ke keranjang, silakan edit dan lanjutkan', 'success');
    } else if (sale.status === 'receipt_not_printed') {
      // Show receipt for printing
      setLastSale(sale);
      setResumeSale(null);
      setShowPending(false);
      setShowReceipt(true);
    }
  };

  const cancelPendingSale = async (saleId: string) => {
    // Restore stock and delete
    const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', saleId);
    if (items) {
      await Promise.all((items as SaleItem[]).map(async (it) => {
        if (it.medicine_id) {
          const { data: med } = await supabase.from('medicines').select('stock').eq('id', it.medicine_id).maybeSingle();
          if (med) {
            const newStock = (med as Medicine).stock + it.quantity;
            await supabase.from('medicines').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', it.medicine_id);
          }
        }
      }));
    }
    await supabase.from('sale_items').delete().eq('sale_id', saleId);
    await supabase.from('sales').delete().eq('id', saleId);
    loadPendingSales();
    loadMedicines();
    showToast('Transaksi dibatalkan, stok dikembalikan', 'success');
  };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Left: catalog */}
      <div className="flex flex-1 flex-col overflow-hidden border-b border-border lg:border-b-0 lg:border-r">
        <div className="border-b border-border bg-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari obat (nama / kode / kategori)…  [F2]"
              className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Kbd>F2</Kbd> cari <Kbd>↑↓</Kbd> pilih <Kbd>Enter</Kbd> tambah <Kbd>F9</Kbd> bayar <Kbd>Esc</Kbd> batal
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          {loading ? (
            <div className="space-y-2.5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 rounded-xl border border-border bg-card p-3 animate-shimmer" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Tidak ada obat cocok.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((m, i) => {
                const exp = daysUntil(m.expiry_date);
                const low = m.stock <= m.reorder_point;
                return (
                  <button
                    key={m.id}
                    onClick={() => addToCart(m)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                    className={cn(
                      'stagger-item group flex flex-col rounded-xl border bg-card p-3 text-left transition-all duration-200 card-hover press-scale',
                      i === highlightedIndex ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.code} &middot; {m.drug_classification}</p>
                      </div>
                      <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold', m.stock <= 0 ? 'bg-destructive/15 text-destructive' : low ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success')}>
                        {m.stock} {m.unit}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">{formatIDR(m.sell_price)}</span>
                      {exp !== null && exp <= 30 && (
                        <span className="text-[10px] font-medium text-warning">Exp {exp}h</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: cart */}
      <div className="flex w-full flex-col bg-card lg:w-[420px] xl:w-[460px]">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Keranjang</h3>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{cart.length}</span>
            </div>
            <div className="flex gap-1.5">
              {pendingSales.length > 0 && (
                <button
                  onClick={() => setShowPending(true)}
                  className="flex items-center gap-1 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs font-semibold text-warning transition hover:bg-warning/20"
                >
                  <Clock className="h-3.5 w-3.5" /> Pending ({pendingSales.length})
                </button>
              )}
              <button onClick={() => setShowRetur(true)} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary">
                <Undo2 className="h-3.5 w-3.5" /> Retur
              </button>
              {cart.length > 0 && (
                <button onClick={clearCart} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" /> Reset
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <ShoppingCart className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">Keranjang kosong</p>
              <p className="text-xs">Pilih obat atau tekan Enter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((c) => (
                <div key={c.medicine.id} className="animate-slide-in-right rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{c.medicine.name}</p>
                      <p className="text-xs text-muted-foreground">{formatIDR(c.medicine.sell_price)} / {c.medicine.unit}</p>
                    </div>
                    <button onClick={() => removeFromCart(c.medicine.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateQty(c.medicine.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-secondary">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        value={c.qty}
                        onChange={(e) => setQty(c.medicine.id, parseInt(e.target.value) || 1)}
                        className="h-7 w-12 rounded-md border border-border bg-card text-center text-sm font-semibold outline-none focus:border-primary"
                      />
                      <button onClick={() => updateQty(c.medicine.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-secondary">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-foreground">{formatIDR(c.medicine.sell_price * c.qty)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout summary */}
        <div className="border-t border-border p-4 space-y-3">
          <div className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatIDR(subtotal)} />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Diskon (Rp)</span>
              <input
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-7 w-28 rounded-md border border-border bg-background px-2 text-right text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pajak (%)</span>
              <input
                type="number"
                value={Math.round(taxRate * 100)}
                onChange={(e) => setTaxRate(Math.max(0, (parseInt(e.target.value) || 0) / 100))}
                className="h-7 w-28 rounded-md border border-border bg-background px-2 text-right text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-border pt-1.5">
              <span className="font-bold text-foreground">Total</span>
              <span className="text-lg font-bold text-primary">{formatIDR(total)}</span>
            </div>
          </div>
          <button
            onClick={() => setShowCheckout(true)}
            disabled={processing || cart.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 press-scale disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Receipt className="h-4 w-4" />
            {processing ? 'Memproses…' : `Bayar [F9]`}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn('fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg', toast.tone === 'success' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground')}>
          {toast.msg}
        </div>
      )}

      {/* Checkout modal */}
      {showCheckout && (
        <CheckoutModal
          total={total}
          onClose={() => setShowCheckout(false)}
          onSubmit={handleCheckout}
          processing={processing}
        />
      )}

      {/* Receipt modal */}
      {showReceipt && lastSale && (
        <ReceiptModal
          sale={lastSale}
          onClose={() => { setShowReceipt(false); loadPendingSales(); }}
          onPrint={printDocument}
        />
      )}

      {/* Pending sales modal */}
      {showPending && (
        <PendingSalesModal
          sales={pendingSales}
          onClose={() => setShowPending(false)}
          onResume={handleResumeSale}
          onCancel={cancelPendingSale}
        />
      )}

      {/* Retur modal */}
      {showRetur && (
        <ReturModal
          onClose={() => setShowRetur(false)}
          onDone={() => {
            loadMedicines();
            showToast('Retur berhasil, stok diperbarui', 'success');
          }}
          showToast={showToast}
        />
      )}

      {/* Print areas (hidden on screen) */}
      {lastSale && <ReceiptPrint sale={lastSale} />}
      {lastSale && <InvoicePrint sale={lastSale} />}
    </div>
  );
}

/* ---------- Checkout Modal ---------- */
function CheckoutModal({
  total,
  onClose,
  onSubmit,
  processing,
}: {
  total: number;
  onClose: () => void;
  onSubmit: (name: string, phone: string, paid: number, method: string) => void;
  processing: boolean;
}) {
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [paid, setPaid] = useState(total);
  const [method, setMethod] = useState('Tunai');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Search existing customers
  useEffect(() => {
    const q = custName.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(5);
      setSearchResults((data as Customer[]) ?? []);
      setShowDropdown(true);
    }, 200);
    return () => clearTimeout(t);
  }, [custName]);

  const selectCustomer = (c: Customer) => {
    setCustName(c.name);
    setCustPhone(c.phone ?? '');
    setShowDropdown(false);
  };

  const change = Math.max(0, paid - total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-2xl animate-fade-in">
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Pembayaran</h3>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Customer name */}
          <div className="relative">
            <label className="text-xs font-semibold text-muted-foreground">Nama Pelanggan</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                onFocus={() => { if (custName.trim().length >= 2) setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Ketik nama atau cari pelanggan…"
                className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      onMouseDown={(e) => { e.preventDefault(); selectCustomer(c); }}
                      className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-foreground">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.phone ?? '-'} &middot; {c.total_visits}x &middot; {c.loyalty_points}/{LOYALTY_THRESHOLD} poin</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">No. Telepon (opsional)</label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                placeholder="08xx-xxxx-xxxx"
                className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Metode Pembayaran</label>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {['Tunai', 'QRIS', 'Debit', 'Transfer'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    'rounded-lg border py-2 text-xs font-semibold transition',
                    method === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Total + payment */}
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Belanja</span>
              <span className="text-lg font-bold text-primary">{formatIDR(total)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Bayar (Rp)</span>
              <input
                type="number"
                value={paid || ''}
                onChange={(e) => setPaid(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-9 w-32 rounded-lg border border-input bg-background px-3 text-right text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-dashed border-border pt-2">
              <span className="text-sm font-semibold text-foreground">Kembalian</span>
              <span className="text-sm font-bold text-success">{formatIDR(change)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onSubmit(custName, custPhone, paid, method)}
            disabled={processing || paid < total}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> {processing ? 'Memproses…' : 'Proses Pembayaran'}
          </button>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary">
            Batal
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Isi nama dan/atau no. telepon untuk mencatat pelanggan. Kosongkan untuk pembeli umum.
        </p>
      </div>
    </div>
  );
}

/* ---------- Pending Sales Modal ---------- */
function PendingSalesModal({
  sales,
  onClose,
  onResume,
  onCancel,
}: {
  sales: (Sale & { items: SaleItem[] })[];
  onClose: () => void;
  onResume: (sale: Sale & { items: SaleItem[] }) => void;
  onCancel: (saleId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-card p-5 shadow-2xl animate-fade-in">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          <h3 className="text-base font-bold text-foreground">Transaksi Belum Selesai</h3>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sales.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada transaksi pending.</p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto scrollbar-thin">
            {sales.map((sale) => (
              <div key={sale.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{sale.invoice_no}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.customer_name} &middot; {formatDateTime(sale.created_at)}
                    </p>
                  </div>
                  <span className={cn(
                    'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold',
                    sale.status === 'pending' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary',
                  )}>
                    {sale.status === 'pending' ? 'Belum Bayar' : 'Belum Cetak Struk'}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{formatIDR(sale.total)}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onResume(sale)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {sale.status === 'pending' ? 'Edit & Lanjutkan' : 'Cetak Struk'}
                    </button>
                    <button
                      onClick={() => onCancel(sale.id)}
                      className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      Batalkan
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Receipt/Invoice Modal ---------- */
function ReceiptModal({
  sale,
  onClose,
  onPrint,
}: {
  sale: Sale & { items: SaleItem[] };
  onClose: () => void;
  onPrint: (mode: 'receipt' | 'invoice') => void;
}) {
  const [viewMode, setViewMode] = useState<'receipt' | 'invoice'>('receipt');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-card p-5 shadow-2xl animate-fade-in">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Transaksi Berhasil</h3>
            <p className="text-xs text-muted-foreground">{sale.invoice_no}</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toggle: Struk vs Invoice */}
        <div className="mb-3 flex rounded-xl border border-border bg-secondary p-1">
          <button
            onClick={() => setViewMode('receipt')}
            className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition', viewMode === 'receipt' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            <Receipt className="h-4 w-4" /> Struk (untuk Customer)
          </button>
          <button
            onClick={() => setViewMode('invoice')}
            className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition', viewMode === 'invoice' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            <FileText className="h-4 w-4" /> Invoice (Arsip Internal)
          </button>
        </div>

        {/* Preview */}
        <div className="mb-4 max-h-[50vh] overflow-y-auto scrollbar-thin rounded-xl border border-border bg-background p-3">
          {viewMode === 'receipt' ? (
            <div className="mx-auto" style={{ maxWidth: '300px' }}>
              <ReceiptPreview sale={sale} />
            </div>
          ) : (
            <InvoicePreview sale={sale} />
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => onPrint(viewMode)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            <Printer className="h-4 w-4" /> Cetak {viewMode === 'receipt' ? 'Struk' : 'Invoice'}
          </button>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Receipt Preview (on-screen) ---------- */
function ReceiptPreview({ sale }: { sale: Sale & { items: SaleItem[] } }) {
  const subtotalNum = Number(sale.subtotal);
  const discountNum = Number(sale.discount);
  const taxNum = Number(sale.tax);
  const totalNum = Number(sale.total);
  const totalBeforeTax = subtotalNum - discountNum;
  return (
    <div className="rounded-lg bg-white p-4 font-mono text-xs text-black" style={{ width: '100%' }}>
      <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
        <p className="text-sm font-bold">Apotek Sehat Sentosa</p>
        <p className="text-[10px]">Jl. Kesehatan Raya No. 1, Menteng, Jakarta Pusat</p>
        <p className="text-[10px]">Telp: (021) 314-5678</p>
      </div>
      <div className="mb-2 text-[10px]">
        <div className="flex justify-between"><span>No: {sale.invoice_no}</span></div>
        <div className="flex justify-between"><span>Tgl: {formatDateTime(sale.created_at)}</span></div>
        <div className="flex justify-between"><span>Plgn: {sale.customer_name}</span></div>
      </div>
      <div className="border-t border-b border-dashed border-gray-400 py-2">
        {sale.items.map((it) => (
          <div key={it.id} className="mb-1">
            <p className="font-bold">{it.medicine_name}</p>
            <div className="flex justify-between">
              <span>{it.quantity} x {formatIDRPlain(it.price)}</span>
              <span className="font-bold">{formatIDRPlain(it.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="py-2 text-[10px]">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatIDRPlain(subtotalNum)}</span></div>
        {discountNum > 0 && <div className="flex justify-between"><span>Diskon</span><span>-{formatIDRPlain(discountNum)}</span></div>}
        <div className="flex justify-between font-bold border-t border-dashed border-gray-400"><span>Total Sebelum Pajak</span><span>{formatIDRPlain(totalBeforeTax)}</span></div>
        {taxNum > 0 && <div className="flex justify-between"><span>Pajak</span><span>{formatIDRPlain(taxNum)}</span></div>}
        <div className="flex justify-between font-bold text-sm border-y-2 border-black"><span>TOTAL BAYAR</span><span>{formatIDRPlain(totalNum)}</span></div>
        <div className="flex justify-between"><span>Bayar ({sale.payment_method})</span><span>{formatIDRPlain(sale.paid)}</span></div>
        <div className="flex justify-between"><span>Kembali</span><span>{formatIDRPlain(sale.change)}</span></div>
      </div>
      <div className="text-center border-t border-dashed border-gray-400 pt-2 text-[10px]">
        <p className="font-bold">*** Terima Kasih ***</p>
      </div>
    </div>
  );
}

/* ---------- Invoice Preview (on-screen) ---------- */
function InvoicePreview({ sale }: { sale: Sale & { items: SaleItem[] } }) {
  const subtotalNum = Number(sale.subtotal);
  const discountNum = Number(sale.discount);
  const taxNum = Number(sale.tax);
  const totalNum = Number(sale.total);
  const totalBeforeTax = subtotalNum - discountNum;
  return (
    <div className="rounded-lg bg-white p-6 text-black" style={{ width: '100%' }}>
      <div className="flex justify-between border-b-2 border-black pb-3 mb-4">
        <div>
          <p className="text-lg font-bold">Apotek Sehat Sentosa</p>
          <p className="text-xs text-gray-600">Jl. Kesehatan Raya No. 1, Menteng, Jakarta Pusat</p>
          <p className="text-xs text-gray-600">Telp: (021) 314-5678</p>
          <p className="text-xs text-gray-600">NPWP: 01.234.567.8-901.000</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold tracking-wider">INVOICE</p>
          <p className="text-xs mt-1">No: <strong>{sale.invoice_no}</strong></p>
          <p className="text-xs">Tgl: {formatDateTime(sale.created_at)}</p>
        </div>
      </div>
      <div className="mb-4">
        <p className="text-[10px] uppercase text-gray-500 font-bold">Ditagihkan Kepada</p>
        <p className="text-sm font-bold">{sale.customer_name}</p>
        <p className="text-xs text-gray-600">Metode: {sale.payment_method}</p>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left py-1.5">No</th>
            <th className="text-left py-1.5">Nama Obat</th>
            <th className="text-center py-1.5">Qty</th>
            <th className="text-right py-1.5">Harga</th>
            <th className="text-right py-1.5">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((it, i) => (
            <tr key={it.id} className="border-b border-gray-300">
              <td className="py-1.5">{i + 1}</td>
              <td className="py-1.5">{it.medicine_name}</td>
              <td className="py-1.5 text-center">{it.quantity}</td>
              <td className="py-1.5 text-right">{formatIDRPlain(it.price)}</td>
              <td className="py-1.5 text-right font-bold">{formatIDRPlain(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end mt-4">
        <table className="text-xs min-w-[250px]">
          <tbody>
            <tr><td className="px-2 py-1 text-gray-600">Subtotal</td><td className="px-2 py-1 text-right">{formatIDR(subtotalNum)}</td></tr>
            {discountNum > 0 && <tr><td className="px-2 py-1 text-gray-600">Diskon</td><td className="px-2 py-1 text-right">-{formatIDR(discountNum)}</td></tr>}
            <tr className="border-t border-gray-300"><td className="px-2 py-1 font-bold">Total Sebelum Pajak</td><td className="px-2 py-1 text-right font-bold">{formatIDR(totalBeforeTax)}</td></tr>
            {taxNum > 0 && <tr><td className="px-2 py-1 text-gray-600">Pajak</td><td className="px-2 py-1 text-right">{formatIDR(taxNum)}</td></tr>}
            <tr className="border-y-2 border-black"><td className="px-2 py-1.5 text-sm font-bold">TOTAL BAYAR</td><td className="px-2 py-1.5 text-right text-sm font-bold">{formatIDR(totalNum)}</td></tr>
            <tr><td className="px-2 py-1 text-gray-600">Dibayar ({sale.payment_method})</td><td className="px-2 py-1 text-right">{formatIDR(sale.paid)}</td></tr>
            <tr><td className="px-2 py-1 text-gray-600">Kembalian</td><td className="px-2 py-1 text-right">{formatIDR(sale.change)}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="mt-8 flex justify-between text-xs">
        <div>
          <p className="text-gray-500">Diterima oleh,</p>
          <div className="mt-8 border-t border-black w-40 pt-1">( {sale.customer_name} )</div>
        </div>
        <div>
          <p className="text-gray-500">Hormat kami,</p>
          <div className="mt-8 border-t border-black w-40 pt-1">( Admin )</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Retur Modal ---------- */
function ReturModal({
  onClose,
  onDone,
  showToast,
}: {
  onClose: () => void;
  onDone: () => void;
  showToast: (msg: string, tone: 'success' | 'error') => void;
}) {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [foundSale, setFoundSale] = useState<(Sale & { items: SaleItem[] }) | null>(null);
  const [selectedItem, setSelectedItem] = useState<SaleItem | null>(null);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const search = async () => {
    if (!invoiceNo.trim()) return;
    setSearching(true);
    setFoundSale(null);
    setSelectedItem(null);
    const { data: sale } = await supabase
      .from('sales')
      .select('*')
      .eq('invoice_no', invoiceNo.trim())
      .maybeSingle();
    if (!sale) {
      showToast('Invoice tidak ditemukan', 'error');
      setSearching(false);
      return;
    }
    const { data: items } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', (sale as Sale).id);
    setFoundSale({ ...(sale as Sale), items: (items as SaleItem[]) ?? [] });
    setSearching(false);
  };

  const submit = async () => {
    if (!foundSale || !selectedItem) {
      showToast('Pilih item yang diretur', 'error');
      return;
    }
    if (qty < 1 || qty > selectedItem.quantity) {
      showToast(`Jumlah retur 1-${selectedItem.quantity}`, 'error');
      return;
    }
    if (!reason.trim()) {
      showToast('Isi alasan retur', 'error');
      return;
    }
    setSubmitting(true);
    const refund = selectedItem.price * qty;
    const { error } = await supabase.from('returns').insert({
      sale_id: foundSale.id,
      invoice_no: foundSale.invoice_no,
      medicine_id: selectedItem.medicine_id,
      medicine_name: selectedItem.medicine_name,
      quantity: qty,
      reason: reason.trim(),
      refund_amount: refund,
    });
    if (error) {
      showToast('Gagal mencatat retur: ' + error.message, 'error');
      setSubmitting(false);
      return;
    }
    if (selectedItem.medicine_id) {
      const { data: med } = await supabase.from('medicines').select('stock').eq('id', selectedItem.medicine_id).maybeSingle();
      if (med) {
        const newStock = (med as Medicine).stock + qty;
        await supabase.from('medicines').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', selectedItem.medicine_id);
      }
    }
    setSubmitting(false);
    onDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-card p-5 shadow-2xl animate-fade-in">
        <div className="mb-4 flex items-center gap-2">
          <Undo2 className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Retur Obat</h3>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Nomor invoice (mis. INV-20260720-…)"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button onClick={search} disabled={searching} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {searching ? '…' : 'Cari'}
            </button>
          </div>

          {foundSale && (
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>{foundSale.invoice_no}</span>
                <span>{formatDateTime(foundSale.created_at)}</span>
              </div>
              <div className="space-y-1">
                {foundSale.items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => { setSelectedItem(it); setQty(1); }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition',
                      selectedItem?.id === it.id ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted',
                    )}
                  >
                    <span className="min-w-0 truncate">{it.medicine_name} ×{it.quantity}</span>
                    <span className="font-medium">{formatIDR(it.subtotal)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedItem && (
            <div className="space-y-2.5 rounded-xl border border-border p-3">
              <p className="text-sm font-semibold text-foreground">{selectedItem.medicine_name}</p>
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Jumlah retur (max {selectedItem.quantity})</label>
                <input
                  type="number"
                  min={1}
                  max={selectedItem.quantity}
                  value={qty}
                  onChange={(e) => setQty(Math.min(selectedItem.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="h-8 w-20 rounded-md border border-border bg-background px-2 text-right text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Alasan retur</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Mis. rusak, salah beli, kadaluarsa…"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-warning/10 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Pengembalian uang</span>
                <span className="font-bold text-warning">{formatIDR(selectedItem.price * qty)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={submit}
            disabled={submitting || !selectedItem}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Undo2 className="h-4 w-4" />
            {submitting ? 'Memproses…' : 'Proses Retur'}
          </button>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary">
            Batal
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <AlertCircle className="h-3 w-3" /> Stok obat akan bertambah otomatis sesuai jumlah retur.
        </p>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(strong ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</span>
      <span className={cn(strong ? 'font-bold text-foreground' : 'font-medium text-foreground')}>{value}</span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">{children}</kbd>;
}
