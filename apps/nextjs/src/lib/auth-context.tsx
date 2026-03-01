"use client";

import { createContext, useContext } from "react";

import { type AtpAgent } from "@atproto/api";

import { type WebSession } from "./auth";

interface AuthContextValue {
  session: WebSession;
  agent: AtpAgent;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AppLayout");
  return ctx;
}
