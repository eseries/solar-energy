'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { ApiError, authApi, tokenStore } from '../lib/api';
import type { User } from '../lib/types';
type Ctx = { user: User | null; loading: boolean; login: (e: string, p: string) => Promise<User>; logout: () => void };
const AuthContext = createContext<Ctx | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) { const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!tokenStore.get()) { setLoading(false); return; } authApi.me().then(setUser).catch((e) => { if (e instanceof ApiError && e.status === 401) tokenStore.clear(); }).finally(() => setLoading(false)); }, []);
  const login = async (email: string, password: string) => { const result = await authApi.login(email, password); tokenStore.set(result.accessToken); setUser(result.user); return result.user; };
  return <AuthContext.Provider value={{ user, loading, login, logout: () => { tokenStore.clear(); setUser(null); } }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider'); return value; };
