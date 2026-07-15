import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';
import { router } from 'expo-router';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  profile_photo?: string | null;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const u = await api.me();
      setUser(u);
    } catch {
      await setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    await setToken(res.access_token);
    setUser(res.user);
    if (res.user.role === 'admin') router.replace('/(admin)/(tabs)/dashboard');
    else router.replace('/(employee)/(tabs)/home');
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
    router.replace('/login');
  };

  return <AuthCtx.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
