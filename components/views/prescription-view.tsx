'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  FileText,
  X,
  Printer,
  CheckCircle2,
  FlaskConical,
  User,
  Stethoscope,
  AlertCircle,
} from 'lucide-react';
import { supabase, type Prescription } from '@/lib/supabase';
import { formatDate, esc } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  dispensed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  cancelled: 'bg-destructive/15 text-destructive',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu',
  dispensed: 'Sudah Diserahkan',
  cancelled: 'Dibatalkan',
};

function genRxNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 900) + 100;
  return `RX-${ymd}-${rand}`;
}

export default function PrescriptionView() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase.from('prescriptions').select('*').order('created_at', { ascending: false });
    setPrescriptions((data as Prescription[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prescriptions.filter((p) => {
      const matchQ = !q ||
        p.rx_no.toLowerCase().includes(q) ||
        p.patient_name.toLowerCase().includes(q) ||
        (p.doctor_name ?? '').toLowerCase().includes(q);
      if (!matchQ) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });
  }, [prescriptions, query, statusFilter]);

  const stats = useMemo(() => {
    const pending = prescriptions.filter((p) => p.status === 'pending').length;
    const dispensed = prescriptions.filter((p) => p.status === 'dispensed').length;
    const racikan = prescriptions.filter((p) => p.is_racikan).length;
    return { total: prescriptions.length, pending, dispensed, racikan };
  }, [prescriptions]);

  const handleDelete = async (p: Prescription) => {
    if (!confirm(`Hapus resep "${p.rx_no}"?`)) return;
    await supabase.from('prescriptions').delete().eq('id', p.id);
    loadData();
  };

  const handleDispense = async (p: Prescription) => {
    if (!confirm(`Tandai resep "${p.rx_no}" sebagai sudah diserahkan ke pasien?`)) return;
    await supabase.from('prescriptions').update({
      status: 'dispensed',
      dispensed_date: new Date().toISOString().slice(0, 10),
    }).eq('id', p.id);
    loadData();
  };

  const handleCancel = async (p: Prescription) => {
    if (!confirm(`Batalkan resep "${p.rx_no}"?`)) return;
    await supabase.from('prescriptions').update({ status: 'cancelled' }).eq('id', p.id);
    loadData();
  };

  const printLabel = (p: Prescription) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Label ${esc(p.rx_no)}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#1e293b}
        .label{width:300px;border:2px solid #0ea5e9;border-radius:8px;padding:12px;font-size:11px}
        .label h3{margin:0 0 6px;font-size:14px;color:#0ea5e9}
        .row{margin-bottom:3px} .row b{display:inline-block;width:70px}
        .racikan{margin-top:6px;padding:6px;background:#f0f9ff;border-radius:4px;font-size:10px}
        .foot{margin-top:8px;font-size:9px;color:#94a3b8}
      </style></head><body>
      <div class="label">
        <h3>ApotekZ — Label Resep</h3>
        <div class="row"><b>No. Resep</b>${esc(p.rx_no)}</div>
        <div class="row"><b>Pasien</b>${esc(p.patient_name)}${p.patient_age ? `, ${Number(p.patient_age)} thn` : ''} ${esc(p.patient_gender ?? '')}</div>
        <div class="row"><b>Dokter</b>${esc(p.doctor_name ?? '-')} ${p.doctor_sip ? `(${esc(p.doctor_sip)})` : ''}</div>
        <div class="row"><b>Tgl Terima</b>${formatDate(p.received_date)}</div>
        ${p.is_racikan && p.racikan_text ? `<div class="racikan"><b>Racikan:</b><br/>${esc(p.racikan_text)}</div>` : ''}
        ${p.notes ? `<div class="row" style="margin-top:4px"><b>Catatan</b>${esc(p.notes)}</div>` : ''}
        <div class="foot">Dicetak ${new Date().toLocaleString('id-ID')}</div>
      </div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Resep" value={String(stats.total)} icon={FileText} tone="primary" />
        <StatCard label="Menunggu" value={String(stats.pending)} icon={AlertCircle} tone="amber" />
        <StatCard label="Diserahkan" value={String(stats.dispensed)} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Racikan" value={String(stats.racikan)} icon={FlaskConical} tone="sky" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari no resep / pasien / dokter..."
              className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['all', 'pending', 'dispensed', 'cancelled'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-semibold transition',
                  statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:bg-secondary',
                )}
              >
                {s === 'all' ? 'Semua' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Catat Resep
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <FileText className="h-8 w-8 opacity-40" />
            <p className="text-sm">Belum ada resep tercatat. Klik "Catat Resep" untuk mulai.</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    p.is_racikan ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400' : 'bg-muted text-muted-foreground',
                  )}>
                    {p.is_racikan ? <FlaskConical className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-foreground">{p.rx_no}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_STYLES[p.status])}>
                        {STATUS_LABELS[p.status]}
                      </span>
                      {p.is_racikan && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/50 dark:text-sky-400">
                          RACIKAN
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {p.patient_name}{p.patient_age ? `, ${p.patient_age} thn` : ''} {p.patient_gender ?? ''}</span>
                      <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" /> {p.doctor_name ?? '-'} {p.doctor_sip ? `· SIP ${p.doctor_sip}` : ''}</span>
                      <span>Tgl: {formatDate(p.received_date)}</span>
                    </div>
                    {p.racikan_text && (
                      <p className="mt-1.5 rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300">
                        <FlaskConical className="mr-1 inline h-3 w-3" /> {p.racikan_text}
                      </p>
                    )}
                    {p.notes && (
                      <p className="mt-1 text-xs text-muted-foreground"><AlertCircle className="mr-1 inline h-3 w-3" /> {p.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {p.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleDispense(p)}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Serahkan
                      </button>
                      <button
                        onClick={() => handleCancel(p)}
                        className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20"
                      >
                        <X className="h-4 w-4" /> Batal
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => printLabel(p)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-primary"
                    title="Cetak label"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  {p.status === 'pending' && (
                    <button
                      onClick={() => handleDelete(p)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <PrescriptionForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadData(); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: string }) {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
  };
  return (
    <div className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function PrescriptionForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    patient_name: '',
    patient_age: '',
    patient_gender: '',
    doctor_name: '',
    doctor_sip: '',
    is_racikan: false,
    racikan_text: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.patient_name.trim()) return;
    setSaving(true);
    const rxNo = genRxNo();
    await supabase.from('prescriptions').insert({
      rx_no: rxNo,
      patient_name: form.patient_name.trim(),
      patient_age: form.patient_age ? Number(form.patient_age) : null,
      patient_gender: form.patient_gender || null,
      doctor_name: form.doctor_name.trim() || null,
      doctor_sip: form.doctor_sip.trim() || null,
      is_racikan: form.is_racikan,
      racikan_text: form.is_racikan ? form.racikan_text.trim() || null : null,
      status: 'pending',
      received_date: new Date().toISOString().slice(0, 10),
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Catat Resep Dokter</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nama Pasien" value={form.patient_name} onChange={(v) => setForm({ ...form, patient_name: v })} required />
            </div>
            <Field label="Usia" value={form.patient_age} onChange={(v) => setForm({ ...form, patient_age: v })} type="number" />
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Jenis Kelamin</label>
              <select value={form.patient_gender} onChange={(e) => setForm({ ...form, patient_gender: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
                <option value="">—</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <Field label="Nama Dokter" value={form.doctor_name} onChange={(v) => setForm({ ...form, doctor_name: v })} />
            <Field label="SIP Dokter" value={form.doctor_sip} onChange={(v) => setForm({ ...form, doctor_sip: v })} />
          </div>

          <div className="rounded-lg border border-border p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_racikan}
                onChange={(e) => setForm({ ...form, is_racikan: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <FlaskConical className="h-4 w-4 text-sky-600" /> Resep Racikan
              </span>
            </label>
            {form.is_racikan && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Detail Racikan</label>
                <textarea
                  value={form.racikan_text}
                  onChange={(e) => setForm({ ...form, racikan_text: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  placeholder="Contoh: R/ Amoxicillin 250mg 10 tablet, CTM 4mg 5 tablet, aduk homogen, bagi 10 pulv..."
                />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Catatan</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Catatan tambahan..." />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary">Batal</button>
            <button onClick={handleSave} disabled={saving || !form.patient_name.trim()} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan Resep'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type, required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
