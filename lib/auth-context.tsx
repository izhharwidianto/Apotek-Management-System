'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { AppUser, UserRole } from '@/lib/users';

// Login memakai Supabase Auth. Username dipetakan ke email internal
// "<username>@apotekz.local" (akun dibuat oleh pemilik di dashboard Supabase).
const EMAIL_DOMAIN = 'apotekz.local';
const LEGACY_SESSION_KEY = 'apotekz_session'; // sesi palsu versi lama, dihapus
const IDLE_LOGOUT_MS = 60 * 60 * 1000; // otomatis keluar setelah 60 menit tanpa aktivitas

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  hasAccess: (allowedRoles: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(authUserId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('app_users')
    .select('id, username, display_name, role, is_active')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error || !data || !data.is_active) return null;
  return { id: data.id, username: data.username, display_name: data.display_name, role: data.role as UserRole };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      /* abaikan */
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session) {
        const profile = await fetchProfile(session.user.id);
        if (cancelled) return;
        if (profile) setUser(profile);
        else await supabase.auth.signOut();
      }
      if (!cancelled) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    void supabase.auth.signOut();
  }, []);

  // Keluar otomatis kalau komputer ditinggal (penting di komputer kasir bersama).
  useEffect(() => {
    if (!user) return;
    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(logout, IDLE_LOGOUT_MS);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [user, logout]);

  const login = async (username: string, password: string) => {
    const uname = username.trim().toLowerCase();
    const wrong = { ok: false, error: 'Username atau password salah' };
    if (!/^[a-z0-9._-]{2,40}$/.test(uname) || !password) return wrong;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `${uname}@${EMAIL_DOMAIN}`,
        password,
      });
      if (error || !data.user) {
        if (error?.status === 429) return { ok: false, error: 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.' };
        return wrong;
      }
      const profile = await fetchProfile(data.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        return { ok: false, error: 'Akun belum aktif atau belum terdaftar. Hubungi pemilik.' };
      }
      setUser(profile);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Tidak dapat terhubung ke server' };
    }
  };

  const hasAccess = (allowedRoles: UserRole[]) => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, hasAccess }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
