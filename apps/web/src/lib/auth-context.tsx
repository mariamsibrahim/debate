"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { apiFetch } from "./api";
import { disconnectSocket } from "./socket";

interface AuthUser {
  id: string;
  email: string;
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("debate_token");
    const storedUser = localStorage.getItem("debate_user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const persist = (accessToken: string, authUser: AuthUser) => {
    localStorage.setItem("debate_token", accessToken);
    localStorage.setItem("debate_user", JSON.stringify(authUser));
    setToken(accessToken);
    setUser(authUser);
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ accessToken: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    persist(res.accessToken, res.user);
  }, []);

  const signup = useCallback(async (email: string, password: string, username: string) => {
    const res = await apiFetch<{ accessToken: string; user: AuthUser }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, username }),
    });
    persist(res.accessToken, res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("debate_token");
    localStorage.removeItem("debate_user");
    disconnectSocket();
    setToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
