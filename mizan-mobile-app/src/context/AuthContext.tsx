import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, setAuthFailureHandler, studentsApi, tokenStore } from "../lib/api";
import type { Student, TokenResponse } from "../lib/types";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  student: Student | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (tokens: TokenResponse) => Promise<void>;
  refreshStudent: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);

  const clearSession = useCallback(async () => {
    await tokenStore.clear();
    setIsAuthenticated(false);
    setStudent(null);
  }, []);

  const fetchStudent = useCallback(async () => {
    const data = await studentsApi.me();
    setStudent(data);
    setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    setAuthFailureHandler(() => {
      void clearSession();
    });
    return () => setAuthFailureHandler(null);
  }, [clearSession]);

  useEffect(() => {
    let active = true;
    const initializeAuth = async () => {
      try {
        const token = await tokenStore.getAccessToken();
        if (!token) return;
        await fetchStudent();
      } catch {
        await clearSession();
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void initializeAuth();
    return () => {
      active = false;
    };
  }, [clearSession, fetchStudent]);

  const setTokens = useCallback(
    async (tokens: TokenResponse) => {
      await tokenStore.setTokens(tokens);
      setIsAuthenticated(true);
      await fetchStudent();
    },
    [fetchStudent]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await authApi.login({ email, password });
      await setTokens(tokens);
    },
    [setTokens]
  );

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      student,
      login,
      logout,
      setTokens,
      refreshStudent: fetchStudent,
    }),
    [fetchStudent, isAuthenticated, isLoading, login, logout, setTokens, student]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
