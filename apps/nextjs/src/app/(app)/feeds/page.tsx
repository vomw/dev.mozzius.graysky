"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { type AppBskyFeedDefs } from "@atproto/api";

import { PostCard } from "~/components/post-card";
import { useAuth } from "~/lib/auth-context";
import { createAgent } from "~/lib/bsky-api";

export default function FeedsPage() {
  const { session } = useAuth();
  const agent = useMemo(() => createAgent(session), [session]);

  const [feed, setFeed] = useState<AppBskyFeedDefs.FeedViewPost[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cur?: string) => {
      if (cur) setLoadingMore(true);
      else { setLoading(true); setError(null); }
      try {
        const { data } = await agent.getTimeline({ limit: 30, cursor: cur });
        setFeed((prev) =>
          cur ? [...prev, ...data.feed] : data.feed,
        );
        setCursor(data.cursor);
      } catch {
        setError("Could not load your feed. Check your connection.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [agent],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-bold">Home</h1>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40"
        >
          ↺ Refresh
        </button>
      </header>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="mb-3 text-sm text-gray-500">{error}</p>
            <button
              onClick={() => void load()}
              className="rounded-xl bg-blue-500 px-4 py-2 text-sm text-white"
            >
              Try again
            </button>
          </div>
        ) : feed.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-600">
            Your feed is empty. Follow some people on Bluesky!
          </p>
        ) : (
          <>
            {feed.map((item) => (
              <PostCard key={`${item.post.uri}-${item.reason?.$type ?? "post"}`} item={item} />
            ))}

            {cursor && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => void load(cursor)}
                  disabled={loadingMore}
                  className="rounded-xl border border-gray-700 px-5 py-2 text-sm text-gray-400 hover:border-gray-500 disabled:opacity-40"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
