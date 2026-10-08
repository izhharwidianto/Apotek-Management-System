'use client';

import { useEffect, useState } from 'react';
import { Settings, X, Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { getAiStatus } from '@/lib/ai-config';

type Status = { ok: boolean; configured: boolean; model: string; error?: string } | null;

// Status AI. API key TIDAK lagi diisi di browser: key disimpan sebagai secret
// di Supabase (Edge Function `ai-proxy`). Lihat docs/PANDUAN-SETUP.md.
export default function AISettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<Status>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    setStatus(await getAiStatus());
    setChecking(false);
  };

  useEffect(() => {
    if (open) {
      setStatus(null);
      check();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-scale-in" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Status AI</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>

        {checking && !status && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa koneksi AI…
          </div>
        )}

        {status?.ok && status.configured && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">AI aktif (dikelola server)</p>
              <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">Model: {status.model}</p>
            </div>
          </div>
        )}

        {status && (!status.ok || !status.configured) && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="text-xs text-destructive">
              <p className="font-semibold">AI belum aktif</p>
              <p className="mt-0.5 opacity-80">{status.error ?? 'API key AI belum dipasang di server.'}</p>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Cara mengaktifkan (khusus pemilik)</p>
          <p className="mt-1">
            API key tidak diisi di sini lagi supaya tidak bisa dicuri dari browser. Pasang di Supabase: Edge Functions &rarr; Secrets,
            isi <code className="rounded bg-muted px-1">AI_API_KEY</code> (opsional <code className="rounded bg-muted px-1">AI_MODEL</code> dan{' '}
            <code className="rounded bg-muted px-1">AI_BASE_URL</code>). Langkah lengkap ada di docs/PANDUAN-SETUP.md. Tanpa AI, fitur tetap
            jalan dengan analisis statistik lokal.
          </p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={check}
            disabled={checking}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={checking ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Periksa lagi
          </button>
          <button onClick={onClose} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
