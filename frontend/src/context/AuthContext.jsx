import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { getToken, setToken } from '../api/client.js';
import { connectSocket, disconnectSocket } from '../api/socket.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  // Restore the session on first paint.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then(({ user: me }) => {
        setUser(me);
        connectSocket();
      })
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const applySession = useCallback((payload) => {
    setToken(payload.token);
    setUser(payload.user);
    connectSocket();
    return payload.user;
  }, []);

  const login = useCallback(
    async (credentials) => applySession(await api.post('/auth/login', credentials, { auth: false })),
    [applySession],
  );

  const register = useCallback(
    async (payload) => applySession(await api.post('/auth/register', payload, { auth: false })),
    [applySession],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  const refresh = useCallback(async () => {
    const { user: me } = await api.get('/auth/me');
    setUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, isAdmin: user?.role === 'admin' }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
