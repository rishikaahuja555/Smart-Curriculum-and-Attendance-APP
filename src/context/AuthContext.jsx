import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => { if (active) setUser(result?.user || null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = async (identifier, password, role, rememberMe = false) => {
    if (!identifier.trim() || (!password.trim() && !import.meta.env.DEV)) return { ok: false, error: 'Enter both fields to continue.' };
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ identifier: identifier.trim(), password, role, rememberMe })
      });
      const result = await response.json();
      if (!response.ok) return { ok: false, error: result.error || 'Unable to sign in.' };
      setUser(result.user);
      return { ok: true };
    } catch {
      return { ok: false, error: 'AIRS could not reach its authentication service.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      setUser(null);
    }
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
