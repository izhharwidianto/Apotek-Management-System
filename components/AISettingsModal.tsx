'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Key,
  X,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  Cpu,
  Zap,
  Wifi,
  Sparkles,
} from 'lucide-react';
import {
  getApiKey,
  setApiKey,
  hasApiKey,
  PROVIDERS,
  getSavedProvider,
  getSavedModel,
  saveConnection,
  autoDetectConnection,
  type DetectProgress,
} from '@/lib/ai-config';

interface ProviderInfo {
  id: string;
  label: string;
  url: string;
  free: boolean;
}

const PROVIDER_LINKS: Record<string, ProviderInfo> = {
  groq: { id: 'groq', label: 'Groq', url: 'https://console.groq.com/keys', free: true },
  openrouter: { id: 'openrouter', label: 'OpenRouter', url: 'https://openrouter.ai/keys', free: true },
  together: { id: 'together', label: 'Together AI', url: 'https://api.together.xyz/settings/api-keys', free: false },
  fireworks: { id: 'fireworks', label: 'Fireworks AI', url: 'https://fireworks.ai/account/api-keys', free: false },
  openai: { id: 'openai', label: 'OpenAI', url: 'https://platform.openai.com/api-keys', free: false },
};

export default function AISettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [progress, setProgress] = useState<DetectProgress[]>([]);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [activeProvider, setActiveProvider] = useState('');
  const [activeModel, setActiveModel] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setKeyInput(getApiKey() ?? '');
      setHasKey(hasApiKey());
      setActiveProvider(getSavedProvider());
      setActiveModel(getSavedModel());
      setResult(null);
      setProgress([]);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [progress]);

  const handleAutoDetect = async () => {
    if (!keyInput.trim()) return;
    setApiKey(keyInput);
    setDetecting(true);
    setResult(null);
    setProgress([]);

    const detectResult = await autoDetectConnection(keyInput, (p) => {
      setProgress((prev) => [...prev, p]);
    });

    setResult({ ok: detectResult.ok, message: detectResult.message });
    if (detectResult.ok && detectResult.provider && detectResult.model) {
      setActiveProvider(detectResult.provider.id);
      setActiveModel(detectResult.model);
    }
    setHasKey(true);
    setDetecting(false);
  };

  const handleClear = () => {
    setApiKey('');
    setKeyInput('');
    setHasKey(false);
    setActiveProvider('');
    setActiveModel('');
    setResult(null);
    setProgress([]);
  };

  if (!open) return null;

  const activeProviderInfo = activeProvider ? PROVIDER_LINKS[activeProvider] : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-scale-in" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Pengaturan AI</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Active connection badge */}
        {hasKey && activeProvider && activeModel && !detecting && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                AI Aktif: {PROVIDER_LINKS[activeProvider]?.label ?? activeProvider}
              </p>
              <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">Model: {activeModel}</p>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Key className="h-3.5 w-3.5" /> API Key
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste API key di sini..."
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              autoComplete="off"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Sistem otomatis mendeteksi provider & model yang cocok. Anda tidak perlu memilih manual.
            </p>
          </div>

          {/* Auto-detect button */}
          <button
            onClick={handleAutoDetect}
            disabled={detecting || !keyInput.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {detecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mendeteksi provider & model...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Deteksi Otomatis & Tes Koneksi
              </>
            )}
          </button>

          {/* Live progress */}
          {progress.length > 0 && (
            <div ref={scrollRef} className="max-h-32 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Log Deteksi ({progress.length} dicoba)
              </p>
              <div className="space-y-1">
                {progress.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    {p.status === 'testing' ? (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : p.status === 'ok' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <X className="h-3 w-3 text-muted-foreground/50" />
                    )}
                    <span className="font-mono text-muted-foreground">
                      {p.provider} → {p.model}
                    </span>
                    {p.status === 'ok' && (
                      <span className="font-semibold text-emerald-600">BERHASIL</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className={`flex items-start gap-2 rounded-xl border p-3 ${
                result.ok
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                  : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
              }`}
            >
              {result.ok ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              )}
              <span
                className={`text-xs font-semibold ${
                  result.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {result.message}
              </span>
            </div>
          )}

          {/* Provider links */}
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Cpu className="h-3 w-3" /> Dapatkan API Key Gratis dari:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(PROVIDER_LINKS)
                .filter((p) => p.free)
                .map((p) => (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <ExternalLink className="h-3 w-3 text-primary" />
                    {p.label}
                  </a>
                ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.values(PROVIDER_LINKS)
                .filter((p) => !p.free)
                .map((p) => (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    {p.label}
                  </a>
                ))}
            </div>
          </div>

          {/* Supported providers info */}
          <div className="rounded-xl border border-border bg-muted/10 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Wifi className="h-3 w-3" /> Provider yang Didukung
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PROVIDERS.map((p) => (
                <span
                  key={p.id}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    p.free
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                  }`}
                >
                  {p.label} {p.free ? '(Gratis)' : '(Berbayar)'}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {PROVIDERS.reduce((sum, p) => sum + p.models.length, 0)} model AI tersedia. Sistem otomatis memilih yang pertama berhasil.
            </p>
          </div>

          {/* Clear button */}
          {hasKey && (
            <button
              onClick={handleClear}
              className="w-full rounded-xl border border-destructive/30 bg-destructive/5 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
            >
              Hapus API Key & Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
