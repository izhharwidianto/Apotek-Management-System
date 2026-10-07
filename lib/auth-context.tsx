'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AppUser, UserRole } from '@/lib/users';

const SESSION_KEY = 'apotekz_session';

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  hasAccess: (allowedRoles: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppUser;
        setUser(parsed);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const res = await fetch(`${supabaseUrl}/functions/v1/verify-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ username: username.toLowerCase(), password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error ?? 'Login gagal' };
      }

      const data = await res.json();
      const u: AppUser = data.user;
      localStorage.setItem(SESSION_KEY, JSON.stringify(u));
      setUser(u);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Tidak dapat terhubung ke server' };
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const hasAccess = (allowedRoles: UserRole[]) => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
