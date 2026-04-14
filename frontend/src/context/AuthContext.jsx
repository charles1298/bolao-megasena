import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

function getStorage() {
  // sessionStorage tem prioridade se não marcou "manter conectado"
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
  return { token, savedUser };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { token, savedUser } = getStorage();
    if (token && savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch { localStorage.clear(); sessionStorage.clear(); }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (nickname, password, totpToken, keepConnected = true) => {
    const body = { nickname, password };
    if (totpToken) body.totpToken = totpToken;

    const { data } = await api.post('/auth/login', body);

    if (data.requires2FA) return { requires2FA: true };

    const storage = keepConnected ? localStorage : sessionStorage;
    storage.setItem('accessToken', data.accessToken);
    storage.setItem('refreshToken', data.refreshToken);
    storage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return { success: true, user: data.user };
  }, []);

  const register = useCallback(async (nickname, password, whatsapp) => {
    const { data } = await api.post('/auth/register', { nickname, password, whatsapp });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch { /* ignora */ } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('user');
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin: user?.role === 'admin', isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
