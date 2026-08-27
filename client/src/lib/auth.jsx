import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthAPI, MetaAPI, tokenStore } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await MetaAPI.all();
        if (alive) setMeta(m);
      } catch {
        /* API might still be booting */
      }
      if (tokenStore.get()) {
        try {
          const { user: u } = await AuthAPI.me();
          if (alive) setUser(u);
        } catch {
          tokenStore.clear();
        }
      }
      if (alive) setBooting(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user: u } = await AuthAPI.login(email, password);
    tokenStore.set(token);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (payload) => {
    const { token, user: u } = await AuthAPI.register(payload);
    tokenStore.set(token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const reloadMeta = useCallback(async () => {
    try {
      setMeta(await MetaAPI.all());
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      meta,
      reloadMeta,
      booting,
      login,
      register,
      logout,
      isAdmin: user?.role === 'admin',
    }),
    [user, meta, reloadMeta, booting, login, register, logout]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
