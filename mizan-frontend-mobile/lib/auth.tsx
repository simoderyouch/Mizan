"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, studentsApi } from "@/lib/api";
import type { Student, TokenResponse } from "@/lib/types";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  student: Student | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setTokens: (tokens: TokenResponse) => void;
  refreshStudent: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const router = useRouter();

  const fetchStudent = useCallback(async () => {
    try {
      const data = await studentsApi.me();
      setStudent(data);
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
      setStudent(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      const token = localStorage.getItem("mizan_access_token");

      if (!token) {
        if (active) setIsLoading(false);
        return;
      }

      try {
        await fetchStudent();
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void initializeAuth();
    return () => {
      active = false;
    };
  }, [fetchStudent]);

  const setTokens = useCallback((tokens: TokenResponse) => {
    localStorage.setItem("mizan_access_token", tokens.access_token);
    localStorage.setItem("mizan_refresh_token", tokens.refresh_token);
    setIsAuthenticated(true);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await authApi.login({ email, password });
      setTokens(tokens);
      await fetchStudent();
      router.push("/dashboard");
    },
    [setTokens, fetchStudent, router]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("mizan_access_token");
    localStorage.removeItem("mizan_refresh_token");
    setIsAuthenticated(false);
    setStudent(null);
    router.push("/login");
  }, [router]);

  const refreshStudent = fetchStudent;

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, student, login, logout, setTokens, refreshStudent }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
