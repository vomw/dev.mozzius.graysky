"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AppBskyFeedDefs } from "@atproto/api";

import { PostCard } from "~/components/post-card";
import { DrawerMenu } from "~/components/drawer-menu";
import { useAuth } from "~/lib/auth-context";
import { decodeFeedUri } from "~/lib/feed-uri";

export default function FeedTimelinePage() {
  const { agent } = useAuth();
  const params = useParams<{ feed: string }>();

  const isFollowing = params.feed === "following";
  const feedUri = isFollowing ? null : decodeFeedUri(params.feed);

  const [feedName, setFeedName] = useState(isFollowing ? "Following" : "Feed");
  const [feed, setFeed] = useState<AppBskyFeedDefs.FeedViewPost[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch feed name for custom feeds
  useEffect(() => {
    if (!feedUri) return;
    void (async () => {
      try {
        const { data } = await agent.app.bsky.feed.getFeedGenerator({
          feed: feedUri,
        });
        setFeedName(data.view.displayName);
      } catch {
        // non-fatal — keep default name
      }
    })();
  }, [agent, feedUri]);

  const load = useCallback(
    async (cur?: string) => {
      if (cur) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        let data: { feed: AppBskyFeedDefs.FeedViewPost[]; cursor?: string };
        if (isFollowing) {
          const res = await agent.getTimeline({ limit: 30, cursor: cur });
          data = res.data;
        } else {
          const res = await agent.app.bsky.feed.getFeed({
            feed: feedUri!,
            limit: 30,
            cursor: cur,
          });
          data = res.data;
        }
        setFeed((prev) => (cur ? [...prev, ...data.feed] : data.feed));
        setCursor(data.cursor);
      } catch {
        setError("Could not load this feed. Check your connection.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [agent, isFollowing, feedUri],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-gray-800 px-4 py-3">
        <DrawerMenu />
        <Link
          href="/feeds"
          className="flex-shrink-0 text-gray-400 hover:text-white"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">
          {feedName}
        </h1>
      </header>

      {/* Timeline */}
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
            {isFollowing
              ? "Your feed is empty. Follow some people on Bluesky!"
              : "This feed has no posts yet."}
          </p>
        ) : (
          <>
            {feed.map((item) => {
              // If the post is a reply, show the parent above with a thread line
              const replyParent =
                item.reply &&
                AppBskyFeedDefs.isPostView(item.reply.parent)
                  ? (item.reply.parent as AppBskyFeedDefs.PostView)
                  : null;

              return (
                <div
                  key={`${item.post.uri}-${item.reason?.$type ?? "post"}`}
                >
                  {replyParent && (
                    <PostCard
                      item={
                        {
                          post: replyParent,
                        } as AppBskyFeedDefs.FeedViewPost
                      }
                      hasReply
                      hideActions
                    />
                  )}
                  <PostCard item={item} />
                </div>
              );
            })}

            {cursor && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => void load(cursor)}
                  disabled={loadingMore}
                  className="rounded-xl border border-gray-700 px-5 py-2 text-sm text-gray-400 hover:border-gray-500 disabled:opacity-40"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
