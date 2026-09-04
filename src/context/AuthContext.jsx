import React, { createContext, useContext, useEffect, useState } from 'react';
import { demoUsers } from '../data/mockData';

const STORAGE_KEY = 'airs.session.v1';
const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const persist = (nextUser) => {
    setUser(nextUser);
    if (nextUser) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const login = async (identifier, password, role) => {
    const normalized = identifier.trim();
    if (!normalized || !password.trim()) return { ok: false, error: 'Enter both fields to continue.' };
    const matchedDemo = demoUsers.find((item) => item.role === role && (role === 'student' ? item.enrollment.toLowerCase() === normalized.toLowerCase() : item.teacherName.toLowerCase() === normalized.toLowerCase()));
    const generatedUser = role === 'student' ? {
      id: `student-${normalized}`,
      name: normalized === '23100BTCSE16089' ? 'Rishika Ahuja' : `Student ${normalized}`,
      email: `${normalized.toLowerCase()}@airs.edu`,
      enrollment: normalized,
      role,
      initials: normalized === '23100BTCSE16089' ? 'RA' : 'ST',
      program: 'B.Tech Computer Science',
      section: 'CSE-3B',
      year: '3rd Year'
    } : {
      id: `teacher-${normalized.toLowerCase().replace(/\s+/g, '-')}`,
      name: normalized,
      email: `${normalized.toLowerCase().replace(/\s+/g, '.')}@airs.edu`,
      teacherName: normalized,
      role,
      initials: normalized.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      department: 'Computer Science'
    };
    const { password: ignoredPassword, ...safeUser } = matchedDemo || generatedUser;
    persist(safeUser);
    return { ok: true };
  };

  const signup = async (name, email, password, role) => {
    if (!name.trim() || !email.trim() || password.length < 6) return { ok: false, error: 'Please enter your name, email and a 6+ char password.' };
    const safeUser = {
      id: `new-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      initials: name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      program: role === 'student' ? 'B.Tech Computer Science' : undefined,
      department: role === 'teacher' ? 'Computer Science' : undefined
    };
    persist(safeUser);
    return { ok: true };
  };

  const logout = async () => persist(null);

  return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
