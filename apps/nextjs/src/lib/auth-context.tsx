"use client";

import { createContext, useContext } from "react";

import { type WebSession } from "./auth";

interface AuthContextValue {
  session: WebSession;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AppLayout");
  return ctx;
}
