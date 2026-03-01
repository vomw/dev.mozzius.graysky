"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home } from "lucide-react";

import { type AppBskyFeedDefs as FeedDefsNS } from "@atproto/api";

import { DrawerMenu } from "~/components/drawer-menu";
import { useAuth } from "~/lib/auth-context";
import { encodeFeedUri } from "~/lib/feed-uri";

type GeneratorView = FeedDefsNS.GeneratorView;

export default function FeedsPage() {
  const { agent } = useAuth();

  const [pinned, setPinned] = useState<GeneratorView[]>([]);
  const [saved, setSaved] = useState<GeneratorView[]>([]);
  // null = still loading, true/false = done
  const [feedsLoaded, setFeedsLoaded] = useState(false);
  const [feedsError, setFeedsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFeedsLoaded(false);
    setFeedsError(null);

    void (async () => {
      try {
        // Use the high-level getPreferences() which normalises both v1 and v2
        // formats into a unified savedFeeds: SavedFeed[] array.
        const prefs = await agent.getPreferences();

        // savedFeeds is already normalised: [{ id, type, value, pinned }]
        // type === 'feed' means it's a feed generator; value is the AT-URI.
        const feedItems = prefs.savedFeeds.filter(
          (f) => f.type === "feed" && f.value.includes("app.bsky.feed.generator"),
        );

        if (feedItems.length === 0) {
          if (!cancelled) setFeedsLoaded(true);
          return;
        }

        const allUris = feedItems.map((f) => f.value);
        const { data: gensData } =
          await agent.app.bsky.feed.getFeedGenerators({ feeds: allUris });
        const genMap = new Map(gensData.feeds.map((g) => [g.uri, g]));

        if (cancelled) return;

        const pinnedFeeds: GeneratorView[] = [];
        const savedFeeds: GeneratorView[] = [];

        for (const item of feedItems) {
          const gen = genMap.get(item.value);
          if (!gen) continue;
          if (item.pinned) pinnedFeeds.push(gen);
          else savedFeeds.push(gen);
        }

        setPinned(pinnedFeeds);
        setSaved(savedFeeds);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setFeedsError(msg);
        }
      } finally {
        if (!cancelled) setFeedsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agent]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-gray-800 px-4 py-3">
        <DrawerMenu />
        <h1 className="text-lg font-bold">Feeds</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Following — always shown immediately, no API needed */}
        <Link
          href="/feeds/following"
          className="flex items-center gap-4 border-b border-gray-800 px-4 py-5 transition hover:bg-gray-900/50 active:bg-gray-900"
        >
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-blue-600">
            <Home size={28} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-white">Following</p>
            <p className="text-sm text-gray-500">
              Posts from people you follow
            </p>
          </div>
          <span className="text-gray-600">›</span>
        </Link>

        {/* Custom feeds — loaded asynchronously */}
        {!feedsLoaded ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : feedsError ? (
          <p className="px-4 py-4 text-xs text-gray-600">
            Could not load custom feeds: {feedsError}
          </p>
        ) : (
          <>
            {pinned.length > 0 && (
              <div>
                <p className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Favourites
                </p>
                {pinned.map((gen) => (
                  <FeedRow key={gen.uri} gen={gen} />
                ))}
              </div>
            )}

            {saved.length > 0 && (
              <div>
                <p className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-gray-600">
                  All Feeds
                </p>
                {saved.map((gen) => (
                  <FeedRow key={gen.uri} gen={gen} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Feed row ──────────────────────────────────────────────────────────────────

function FeedRow({ gen }: { gen: GeneratorView }) {
  return (
    <Link
      href={`/feeds/${encodeFeedUri(gen.uri)}`}
      className="flex items-center gap-3 border-b border-gray-800 px-4 py-3 transition hover:bg-gray-900/50 active:bg-gray-900"
    >
      {gen.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gen.avatar}
          alt={gen.displayName}
          className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-950 text-lg">
          #
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {gen.displayName}
        </p>
        <p className="truncate text-xs text-gray-500">
          by @{gen.creator.handle}
        </p>
      </div>
      <span className="text-gray-600">›</span>
    </Link>
  );
}
