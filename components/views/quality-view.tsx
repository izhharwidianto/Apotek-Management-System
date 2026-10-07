'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  ClipboardCheck,
  Brain,
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ArrowRight,
  Lightbulb,
  Eye,
  Lock,
  Users,
  Timer,
} from 'lucide-react';
import { supabase, type Countermeasure, type LogicalTest, type Incident } from '@/lib/supabase';
import { formatDate, daysUntil } from '@/lib/format';
import { cn } from '@/lib/utils';
import PriorityMatrixAndAnalytics from '@/components/PriorityMatrixAndAnalytics';

const ACTION_TYPE_META: Record<string, { label: string; icon: React.ElementType }> = {
  sop: { label: 'SOP', icon: ClipboardCheck },
  visual: { label: 'Visual Mgmt', icon: Eye },
  poka_yoke: { label: 'Poka-Yoke', icon: Lock },
  audit: { label: 'Audit (LPA)', icon: Users },
  swcs: { label: 'SWCS', icon: Timer },
  other: { label: 'Lainnya', icon: ShieldCheck },
};

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  open: { label: 'Belum Dimulai', cls: 'bg-muted text-muted-foreground', icon: Circle },
  in_progress: { label: 'Berjalan', cls: 'bg-primary/15 text-primary', icon: Clock },
  done: { label: 'Selesai', cls: 'bg-success/15 text-success', icon: CheckCircle2 },
  verified: { label: 'Terverifikasi', cls: 'bg-success text-success-foreground', icon: ShieldCheck },
};

const TEST_TYPE_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  if_then: { label: 'If-Then (Reversibilitas)', icon: ArrowRight, cls: 'bg-primary/15 text-primary' },
  causation: { label: 'Korelasi vs Kausalitas', icon: Brain, cls: 'bg-warning/15 text-warning' },
  mece: { label: 'MECE 4M', icon: ClipboardCheck, cls: 'bg-success/15 text-success' },
  sanity: { label: 'Sanity & Sampling', icon: AlertCircle, cls: 'bg-destructive/15 text-destructive' },
};

const RESULT_META: Record<string, { label: string; cls: string }> = {
  pass: { label: 'Lulus', cls: 'bg-success/15 text-success' },
  fail: { label: 'Gagal', cls: 'bg-destructive/15 text-destructive' },
  inconclusive: { label: 'Belum Pasti', cls: 'bg-warning/15 text-warning' },
};

export default function QualityView() {
  const [countermeasures, setCountermeasures] = useState<Countermeasure[]>([]);
  const [tests, setTests] = useState<LogicalTest[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerError, setTriggerError] = useState('');
  const [tab, setTab] = useState<'countermeasures' | 'tests'>('countermeasures');
  const [editingCm, setEditingCm] = useState<Countermeasure | null>(null);
  const [showCmForm, setShowCmForm] = useState(false);
  const [editingTest, setEditingTest] = useState<LogicalTest | null>(null);
  const [showTestForm, setShowTestForm] = useState(false);

  const load = async () => {
    setLoading(true);
    const [cm, lt, inc] = await Promise.all([
      supabase.from('countermeasures').select('*').order('created_at', { ascending: true }),
      supabase.from('logical_tests').select('*').order('created_at', { ascending: true }),
      supabase.from('incidents').select('*').order('created_at', { ascending: false }),
    ]);
    setCountermeasures((cm.data as Countermeasure[]) ?? []);
    setTests((lt.data as LogicalTest[]) ?? []);
    setIncidents((inc.data as Incident[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const total = countermeasures.length;
    const done = countermeasures.filter((c) => c.status === 'done' || c.status === 'verified').length;
    const inProgress = countermeasures.filter((c) => c.status === 'in_progress').length;
    const overdue = countermeasures.filter((c) => {
      const d = daysUntil(c.due_date);
      return d !== null && d < 0 && c.status !== 'done' && c.status !== 'verified';
    }).length;
    const passCount = tests.filter((t) => t.result === 'pass').length;
    return { total, done, inProgress, overdue, passCount, testTotal: tests.length };
  }, [countermeasures, tests]);

  const deleteCm = async (c: Countermeasure) => {
    if (!confirm(`Hapus aksi perbaikan "${c.title}"?`)) return;
    await supabase.from('countermeasures').delete().eq('id', c.id);
    load();
  };

  const deleteTest = async (t: LogicalTest) => {
    if (!confirm(`Hapus uji logika "${t.title}"?`)) return;
    await supabase.from('logical_tests').delete().eq('id', t.id);
    load();
  };

  const cycleCmStatus = async (c: Countermeasure) => {
    const order: Countermeasure['status'][] = ['open', 'in_progress', 'done', 'verified'];
    const next = order[(order.indexOf(c.status) + 1) % order.length];
    setTriggerError('');
    const { error } = await supabase.from('countermeasures').update({ status: next, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (error) {
      setTriggerError(error.message);
      setTimeout(() => setTriggerError(''), 4000);
    }
    load();
  };

  const cycleTestResult = async (t: LogicalTest) => {
    const order: LogicalTest['result'][] = ['inconclusive', 'pass', 'fail'];
    const next = order[(order.indexOf(t.result) + 1) % order.length];
    await supabase.from('logical_tests').update({ result: next, updated_at: new Date().toISOString() }).eq('id', t.id);
    load();
  };

  // Map countermeasures to the PriorityMatrix shape (uppercase status)
  const matrixItems = countermeasures.map((c) => ({
    id: c.id,
    title: c.title,
    effort: c.effort_level,
    impact: c.impact_level,
    status: (c.status === 'open' ? 'NOT_STARTED' : c.status === 'in_progress' ? 'IN_PROGRESS' : c.status === 'done' ? 'COMPLETED' : 'VERIFIED') as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED',
  }));

  return (
    <div className="space-y-5 p-4 lg:p-6">
      {/* Priority matrix & analytics */}
      <PriorityMatrixAndAnalytics
        countermeasures={matrixItems}
        totalIncidents={incidents.length}
        passedTestsCount={stats.passCount}
        totalTestsCount={stats.testTotal}
      />

      {triggerError && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="font-medium">{triggerError}</span>
        </div>
      )}

      {/* Header & stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Total Aksi" value={stats.total} icon={ShieldCheck} tone="primary" />
        <StatTile label="Selesai" value={stats.done} icon={CheckCircle2} tone="success" />
        <StatTile label="Berjalan" value={stats.inProgress} icon={Clock} tone="warning" />
        <StatTile label="Terlambat" value={stats.overdue} icon={AlertCircle} tone="destructive" />
        <StatTile label="Uji Lulus" value={`${stats.passCount}/${stats.testTotal}`} icon={Brain} tone="primary" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          <TabButton active={tab === 'countermeasures'} onClick={() => setTab('countermeasures')} icon={ShieldCheck} label="Countermeasures" />
          <TabButton active={tab === 'tests'} onClick={() => setTab('tests')} icon={Brain} label="Logical Tests" />
        </div>
        <button
          onClick={() => (tab === 'countermeasures' ? (setEditingCm(null), setShowCmForm(true)) : (setEditingTest(null), setShowTestForm(true)))}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {tab === 'countermeasures' ? 'Tambah Aksi' : 'Tambah Uji'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">Memuat…</span>
        </div>
      ) : tab === 'countermeasures' ? (
        <CountermeasuresList
          items={countermeasures}
          onCycleStatus={cycleCmStatus}
          onEdit={(c) => { setEditingCm(c); setShowCmForm(true); }}
          onDelete={deleteCm}
        />
      ) : (
        <LogicalTestsList
          items={tests}
          onCycleResult={cycleTestResult}
          onEdit={(t) => { setEditingTest(t); setShowTestForm(true); }}
          onDelete={deleteTest}
        />
      )}

      {showCmForm && (
        <CountermeasureForm
          item={editingCm}
          onClose={() => setShowCmForm(false)}
          onSaved={() => { setShowCmForm(false); load(); }}
        />
      )}
      {showTestForm && (
        <LogicalTestForm
          item={editingTest}
          onClose={() => setShowTestForm(false)}
          onSaved={() => { setShowTestForm(false); load(); }}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: React.ElementType; tone: 'primary' | 'success' | 'warning' | 'destructive' }) {
  const tones: Record<string, string> = {
    primary: 'from-primary/15 to-primary/5 text-primary',
    success: 'from-success/15 to-success/5 text-success',
    warning: 'from-warning/15 to-warning/5 text-warning',
    destructive: 'from-destructive/15 to-destructive/5 text-destructive',
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br', tones[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-1.5 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
        active ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' : 'bg-card border border-border text-muted-foreground hover:bg-secondary',
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function CountermeasuresList({
  items,
  onCycleStatus,
  onEdit,
  onDelete,
}: {
  items: Countermeasure[];
  onCycleStatus: (c: Countermeasure) => void;
  onEdit: (c: Countermeasure) => void;
  onDelete: (c: Countermeasure) => void;
}) {
  const grouped = useMemo(() => {
    const immediate = items.filter((i) => i.category === 'immediate');
    const preventive = items.filter((i) => i.category === 'preventive');
    return { immediate, preventive };
  }, [items]);

  return (
    <div className="space-y-6">
      <Section title="Perbaikan Jangka Pendek (Immediate Corrective)" tone="warning" items={grouped.immediate} onCycleStatus={onCycleStatus} onEdit={onEdit} onDelete={onDelete} />
      <Section title="Perbaikan Jangka Panjang (Preventive & Systemic)" tone="primary" items={grouped.preventive} onCycleStatus={onCycleStatus} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function Section({
  title,
  tone,
  items,
  onCycleStatus,
  onEdit,
  onDelete,
}: {
  title: string;
  tone: 'warning' | 'primary';
  items: Countermeasure[];
  onCycleStatus: (c: Countermeasure) => void;
  onEdit: (c: Countermeasure) => void;
  onDelete: (c: Countermeasure) => void;
}) {
  const barCls = tone === 'warning' ? 'bg-warning' : 'bg-primary';
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3">
        <span className={cn('h-2 w-2 rounded-full', barCls)} />
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Belum ada aksi.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {items.map((c) => {
            const meta = ACTION_TYPE_META[c.action_type];
            const st = STATUS_META[c.status];
            const STIcon = st.icon;
            const AMIcon = meta.icon;
            const d = daysUntil(c.due_date);
            const overdue = d !== null && d < 0 && c.status !== 'done' && c.status !== 'verified';
            return (
              <div key={c.id} className="flex flex-col gap-3 p-4 transition hover:bg-muted/20 sm:flex-row sm:items-center">
                <button onClick={() => onCycleStatus(c)} className="flex shrink-0 items-center gap-2 self-start" title="Klik untuk ubah status">
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', st.cls)}>
                    <STIcon className="h-4 w-4" />
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{c.title}</p>
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                      <AMIcon className="h-3 w-3" /> {meta.label}
                    </span>
                    <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold', st.cls)}>{st.label}</span>
                    {overdue && <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">Terlambat</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>Owner: <span className="font-medium text-foreground">{c.owner}</span></span>
                    {c.due_date && (
                      <span className={overdue ? 'font-semibold text-destructive' : ''}>
                        Tenggat: {formatDate(c.due_date)}{d !== null && d >= 0 && c.status !== 'done' && c.status !== 'verified' ? ` (${d}h)` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 self-end sm:self-center">
                  <button onClick={() => onEdit(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => onDelete(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LogicalTestsList({
  items,
  onCycleResult,
  onEdit,
  onDelete,
}: {
  items: LogicalTest[];
  onCycleResult: (t: LogicalTest) => void;
  onEdit: (t: LogicalTest) => void;
  onDelete: (t: LogicalTest) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {items.length === 0 ? (
        <div className="col-span-full rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          Belum ada uji logika.
        </div>
      ) : (
        items.map((t) => {
          const meta = TEST_TYPE_META[t.test_type];
          const res = RESULT_META[t.result];
          const TIcon = meta.icon;
          return (
            <div key={t.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', meta.cls)}>
                    <TIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">{meta.label}</p>
                  </div>
                </div>
                <button onClick={() => onCycleResult(t)} className={cn('rounded-md px-2 py-1 text-[11px] font-bold transition', res.cls)} title="Klik untuk ubah hasil">
                  {res.label}
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Premis / Pertanyaan</p>
                  <p className="text-foreground">{t.premise}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kesimpulan</p>
                  <p className="text-foreground">{t.conclusion}</p>
                </div>
                {t.notes && (
                  <p className="flex items-start gap-1.5 text-muted-foreground">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <span>{t.notes}</span>
                  </p>
                )}
              </div>
              <div className="mt-3 flex justify-end gap-1">
                <button onClick={() => onEdit(t)} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onDelete(t)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

function CountermeasureForm({ item, onClose, onSaved }: { item: Countermeasure | null; onClose: () => void; onSaved: () => void; }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  useEffect(() => {
    supabase.from('incidents').select('*').order('created_at', { ascending: false }).then(({ data }) => setIncidents((data as Incident[]) ?? []));
  }, []);

  const [form, setForm] = useState({
    title: item?.title ?? '',
    category: item?.category ?? 'immediate',
    action_type: item?.action_type ?? 'sop',
    description: item?.description ?? '',
    owner: item?.owner ?? 'Supervisor Produksi',
    status: item?.status ?? 'open',
    due_date: item?.due_date ?? '',
    incident_id: item?.incident_id ?? '',
    effort_level: item?.effort_level ?? 'LOW',
    impact_level: item?.impact_level ?? 'HIGH',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { setError('Judul wajib diisi'); return; }
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      category: form.category,
      action_type: form.action_type,
      description: form.description.trim(),
      owner: form.owner.trim(),
      status: form.status,
      due_date: form.due_date || null,
      incident_id: form.incident_id || null,
      effort_level: form.effort_level,
      impact_level: form.impact_level,
      updated_at: new Date().toISOString(),
    };
    const r = item
      ? await supabase.from('countermeasures').update(payload).eq('id', item.id)
      : await supabase.from('countermeasures').insert(payload);
    setSaving(false);
    if (r.error) { setError(r.error.message); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-card p-5 shadow-2xl animate-fade-in">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">{item ? 'Edit Aksi Perbaikan' : 'Tambah Aksi Perbaikan'}</h3>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Judul" required><input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori">
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inputCls}>
                <option value="immediate">Jangka Pendek</option>
                <option value="preventive">Jangka Panjang</option>
              </select>
            </Field>
            <Field label="Tipe Aksi">
              <select value={form.action_type} onChange={(e) => set('action_type', e.target.value)} className={inputCls}>
                {Object.entries(ACTION_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Deskripsi"><textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className={inputCls} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Effort">
              <select value={form.effort_level} onChange={(e) => set('effort_level', e.target.value)} className={inputCls}>
                <option value="LOW">Low</option>
                <option value="HIGH">High</option>
              </select>
            </Field>
            <Field label="Impact">
              <select value={form.impact_level} onChange={(e) => set('impact_level', e.target.value)} className={inputCls}>
                <option value="LOW">Low</option>
                <option value="HIGH">High</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
                {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Penanggung Jawab"><input value={form.owner} onChange={(e) => set('owner', e.target.value)} className={inputCls} /></Field>
            <Field label="Tenggat"><input type="date" value={form.due_date ?? ''} onChange={(e) => set('due_date', e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Incident (RCA)">
            <select value={form.incident_id} onChange={(e) => set('incident_id', e.target.value)} className={inputCls}>
              <option value="">— Tidak terhubung —</option>
              {incidents.map((it) => <option key={it.id} value={it.id}>{it.title}</option>)}
            </select>
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary">Batal</button>
        </div>
      </div>
    </div>
  );
}

function LogicalTestForm({ item, onClose, onSaved }: { item: LogicalTest | null; onClose: () => void; onSaved: () => void }) {
  const [countermeasures, setCountermeasures] = useState<Countermeasure[]>([]);
  useEffect(() => {
    supabase.from('countermeasures').select('*').order('created_at', { ascending: true }).then(({ data }) => setCountermeasures((data as Countermeasure[]) ?? []));
  }, []);
  const [form, setForm] = useState({
    test_type: item?.test_type ?? 'if_then',
    title: item?.title ?? '',
    premise: item?.premise ?? '',
    conclusion: item?.conclusion ?? '',
    result: item?.result ?? 'inconclusive',
    notes: item?.notes ?? '',
    countermeasure_id: item?.countermeasure_id ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { setError('Judul wajib diisi'); return; }
    setSaving(true);
    setError('');
    const payload = {
      test_type: form.test_type,
      title: form.title.trim(),
      premise: form.premise.trim(),
      conclusion: form.conclusion.trim(),
      result: form.result,
      notes: form.notes.trim(),
      countermeasure_id: form.countermeasure_id || null,
      updated_at: new Date().toISOString(),
    };
    const r = item
      ? await supabase.from('logical_tests').update(payload).eq('id', item.id)
      : await supabase.from('logical_tests').insert(payload);
    setSaving(false);
    if (r.error) { setError(r.error.message); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-card p-5 shadow-2xl animate-fade-in">
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">{item ? 'Edit Uji Logika' : 'Tambah Uji Logika'}</h3>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipe Uji">
              <select value={form.test_type} onChange={(e) => set('test_type', e.target.value)} className={inputCls}>
                {Object.entries(TEST_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Hasil">
              <select value={form.result} onChange={(e) => set('result', e.target.value)} className={inputCls}>
                {Object.entries(RESULT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Judul" required><input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} /></Field>
          <Field label="Premis / Pertanyaan"><textarea value={form.premise} onChange={(e) => set('premise', e.target.value)} rows={3} className={inputCls} /></Field>
          <Field label="Kesimpulan"><textarea value={form.conclusion} onChange={(e) => set('conclusion', e.target.value)} rows={2} className={inputCls} /></Field>
          <Field label="Catatan"><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={inputCls} /></Field>
          <Field label="Countermeasure terkait">
            <select value={form.countermeasure_id} onChange={(e) => set('countermeasure_id', e.target.value)} className={inputCls}>
              <option value="">— Tidak terhubung —</option>
              {countermeasures.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary">Batal</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}{required && ' *'}</span>
      {children}
    </label>
  );
}
