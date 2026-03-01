"use client";

import { useCallback, useEffect, useState } from "react";

import { type AppBskyNotificationListNotifications } from "@atproto/api";

import { useAuth } from "~/lib/auth-context";

type Notif = AppBskyNotificationListNotifications.Notification;

function reasonLabel(reason: string): string {
  switch (reason) {
    case "like": return "liked your post";
    case "repost": return "reposted your post";
    case "follow": return "followed you";
    case "mention": return "mentioned you";
    case "reply": return "replied to your post";
    case "quote": return "quoted your post";
    default: return reason;
  }
}

function reasonIcon(reason: string): string {
  switch (reason) {
    case "like": return "♡";
    case "repost": return "↺";
    case "follow": return "➕";
    case "mention": return "＠";
    case "reply": return "💬";
    case "quote": return "❝";
    default: return "🔔";
  }
}

function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function NotifRow({ notif }: { notif: Notif }) {
  const { author, reason, isRead, indexedAt } = notif;
  return (
    <div
      className={`flex gap-3 border-b border-gray-800 px-4 py-3 ${
        isRead ? "" : "border-l-2 border-l-blue-500 bg-blue-950/20"
      }`}
    >
      {/* Reason icon */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-lg">
        {reasonIcon(reason)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {/* Author avatar */}
          {author.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.avatar}
              alt={author.handle}
              className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white">
              <span className="font-semibold">
                {author.displayName ?? author.handle}
              </span>{" "}
              <span className="text-gray-400">{reasonLabel(reason)}</span>
            </p>
          </div>
          <span className="flex-shrink-0 text-xs text-gray-600">
            {timeAgo(indexedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { agent } = useAuth();

  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await agent.listNotifications({ limit: 50 });
      setNotifs(data.notifications);
      // Mark as read in the background
      void agent.updateSeenNotifications();
    } catch {
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = notifs.filter((n) => !n.isRead).length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-bold">
          Notifications
          {unread > 0 && (
            <span className="ml-2 rounded-full bg-blue-500 px-1.5 py-0.5 text-xs font-normal text-white">
              {unread}
            </span>
          )}
        </h1>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40"
        >
          ↺ Refresh
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="mb-3 text-sm text-gray-500">{error}</p>
            <button
              onClick={() => void load()}
              className="rounded-xl bg-blue-500 px-4 py-2 text-sm text-white"
            >
              Try again
            </button>
          </div>
        ) : notifs.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-600">
            No notifications yet
          </p>
        ) : (
          notifs.map((n) => <NotifRow key={n.uri} notif={n} />)
        )}
      </div>
    </div>
  );
}
