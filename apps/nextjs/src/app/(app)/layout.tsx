"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  clearSession,
  getSession,
  loginWithPassword,
  type WebSession,
} from "~/lib/auth";
import { AuthContext } from "~/lib/auth-context";

// ── Bottom navigation tab bar ─────────────────────────────────────────────────

const TABS = [
  { label: "Home", icon: "⌂", href: "/feeds" },
  { label: "Search", icon: "⌕", href: "/search" },
  { label: "Groups", icon: "💬", href: "/groups" },
  { label: "Alerts", icon: "🔔", href: "/notifications" },
  { label: "Me", icon: "◯", href: "/profile" },
] as const;

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-shrink-0 border-t border-gray-800 bg-black">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              active ? "text-blue-400" : "text-gray-600 hover:text-gray-400"
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── App layout ────────────────────────────────────────────────────────────────

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<WebSession | null | "loading">(
    "loading",
  );
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setError("");
    try {
      const s = await loginWithPassword(form.identifier, form.password);
      setSession(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (session === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  // ── Login form ────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12">
        <div className="mb-8 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="Saucer"
            className="h-16 w-16 rounded-2xl"
          />
          <h1 className="text-2xl font-bold text-white">Saucer</h1>
          <p className="text-sm text-gray-500">Sign in with your Bluesky account</p>
        </div>

        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">
              Handle or Email
            </label>
            <input
              type="text"
              value={form.identifier}
              onChange={(e) =>
                setForm((f) => ({ ...f, identifier: e.target.value }))
              }
              placeholder="you.bsky.social"
              autoComplete="username"
              required
              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">
              App Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder="xxxx-xxxx-xxxx-xxxx"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-gray-600">
              Create an app password at Settings → Privacy → App Passwords
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full rounded-xl bg-blue-500 py-3 font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {loggingIn ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    );
  }

  // ── Authenticated app shell ───────────────────────────────────────────────
  return (
    <AuthContext.Provider value={{ session, logout: handleLogout }}>
      <div className="flex h-screen flex-col bg-black text-white">
        {/* Page content */}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>

        {/* Bottom tab bar */}
        <BottomNav />
      </div>
    </AuthContext.Provider>
  );
}
