'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Lock, User, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DEFAULT_CREDENTIALS, ROLE_BADGE_COLORS } from '@/lib/users';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (!result.ok) setError(result.error ?? 'Login gagal');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" />
            <Image
              src="/image.png"
              alt="ApotekZ"
              width={80}
              height={80}
              className="relative rounded-2xl shadow-lg"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">ApotekZ</h1>
            <p className="text-sm text-muted-foreground">Apotek Management System</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-xl backdrop-blur-md">
          <div className="mb-6 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Masuk ke Sistem</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memverifikasi…
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Akun Default
            </p>
            <div className="space-y-1.5">
              {DEFAULT_CREDENTIALS.map((c) => (
                <button
                  key={c.username}
                  type="button"
                  onClick={() => {
                    setUsername(c.username);
                    setPassword(c.password);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-left text-xs transition hover:bg-muted/60"
                >
                  <span className="font-mono text-muted-foreground">{c.username}</span>
                  <span className="font-mono text-muted-foreground/70">{c.password}</span>
                  <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', ROLE_BADGE_COLORS[c.role])}>
                    {c.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ApotekZ &middot; Sistem Manajemen Apotek &middot; v2.0
        </p>
      </div>
    </div>
  );
}
