/**
 * AuthContext — identità utente lato frontend.
 *
 * Chiama GET /api/auth/me al mount per idratare lo stato.
 * login/register/logout usano fetch diretto (no hook generati —
 * i cookie HTTP-only non si prestano al pattern React Query).
 *
 * Il "gating" delle route (redirect se non loggato) è nel Passo B.
 * Qui basta che l'app sappia chi sei e lo mostri.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { apiUrl } from "@workspace/api-client-react";

export interface CurrentUser {
  id: string;
  email: string;
  display_name: string;
}

interface AuthState {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Idrata lo stato al mount
  useEffect(() => {
    fetch(apiUrl("/api/auth/me"), { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then((data: CurrentUser | null) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Errore durante il login");
    }
    const data = await r.json() as CurrentUser;
    setUser(data);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const r = await fetch(apiUrl("/api/auth/register"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Errore durante la registrazione");
    }
    const data = await r.json() as CurrentUser;
    setUser(data);
  }, []);

  const logout = useCallback(async () => {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useCurrentUser(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useCurrentUser deve essere usato dentro AuthProvider");
  return ctx;
}
