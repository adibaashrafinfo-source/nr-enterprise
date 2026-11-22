import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, authApi, setCsrfToken } from "@/lib/api";
import type { Role, User } from "@/lib/types";

interface AuthState {
  user: User | null;
  role: Role | null;
  csrfToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

// Kept on globalThis so a hot reload of this file reuses the same context and the provider still matches.
const g = globalThis as { __nreAuthCtx?: React.Context<AuthState | null> };
const AuthContext = (g.__nreAuthCtx ??= createContext<AuthState | null>(null));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [csrf, setCsrf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = (u: User | null, t: string | null) => { setUser(u); setCsrf(t); setCsrfToken(t); };

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      apply(me.user, me.csrf_token);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) console.error(e);
      apply(null, null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<AuthState>(() => ({
    user, role: user?.role ?? null, csrfToken: csrf, loading, refresh,
    login: async (email, password) => { const r = await authApi.login(email, password); apply(r.user, r.csrf_token); return r.user; },
    logout: async () => { try { await authApi.logout(); } finally { apply(null, null); } },
  }), [user, csrf, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

const RANK: Record<Role, number> = { staff: 1, manager: 2, admin: 3 };
export const roleAtLeast = (role: Role | null, min: Role) => !!role && RANK[role] >= RANK[min];

export function useRole() {
  const { role } = useAuth();
  return {
    role,
    isStaffPlus: roleAtLeast(role, "staff"),
    isManagerPlus: roleAtLeast(role, "manager"),
    isAdmin: role === "admin",
  };
}
