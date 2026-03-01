"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

import { useAuth } from "~/lib/auth-context";

export function DrawerMenu() {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Trigger — user avatar */}
      <button
        onClick={() => setOpen(true)}
        className="flex-shrink-0"
        aria-label="Open menu"
      >
        {session.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.avatar}
            alt={session.handle}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-sm">
            👤
          </div>
        )}
      </button>

      {/* Overlay + Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative z-10 flex h-full w-[280px] flex-col bg-gray-950 shadow-xl">
            {/* User info */}
            <div className="border-b border-gray-800 p-5">
              {session.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.avatar}
                  alt={session.handle}
                  className="mb-3 h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800 text-2xl">
                  👤
                </div>
              )}
              <p className="truncate text-base font-bold text-white">
                {session.displayName ?? session.handle}
              </p>
              <p className="truncate text-sm text-gray-500">
                @{session.handle}
              </p>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Sign out */}
            <div className="border-t border-gray-800 p-4">
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-red-400 transition hover:bg-red-950"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
