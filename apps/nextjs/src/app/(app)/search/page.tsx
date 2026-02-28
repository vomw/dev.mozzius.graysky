"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { type AppBskyActorDefs, type AppBskyFeedDefs } from "@atproto/api";

import { PostCard } from "~/components/post-card";
import { useAuth } from "~/lib/auth-context";
import { createAgent } from "~/lib/bsky-api";

type Tab = "people" | "posts";

function ActorRow({ actor }: { actor: AppBskyActorDefs.ProfileView }) {
  return (
    <a
      href={`https://bsky.app/profile/${actor.handle}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 border-b border-gray-800 px-4 py-3 hover:bg-gray-900"
    >
      {actor.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={actor.avatar}
          alt={actor.handle}
          className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gray-800">
          👤
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">
          {actor.displayName ?? actor.handle}
        </p>
        <p className="truncate text-sm text-gray-500">@{actor.handle}</p>
        {actor.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-600">
            {actor.description}
          </p>
        )}
      </div>
    </a>
  );
}

export default function SearchPage() {
  const { session } = useAuth();
  const agent = useMemo(() => createAgent(session), [session]);

  const [tab, setTab] = useState<Tab>("people");
  const [query, setQuery] = useState("");
  const [actors, setActors] = useState<AppBskyActorDefs.ProfileView[]>([]);
  const [posts, setPosts] = useState<AppBskyFeedDefs.PostView[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setActors([]);
      setPosts([]);
      return;
    }
    clearTimeout(timer.current);
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        if (tab === "people") {
          const { data } = await agent.searchActors({ q, limit: 25 });
          setActors(data.actors);
        } else {
          const { data } = await agent.app.bsky.feed.searchPosts({ q, limit: 25 });
          setPosts(data.posts);
        }
      } catch {
        // swallow — user will see empty results
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer.current);
  }, [query, tab, agent]);

  const hasResults = tab === "people" ? actors.length > 0 : posts.length > 0;
  const isEmpty = query.trim() !== "" && !searching && !hasResults;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-800 px-4 pb-0 pt-3">
        <h1 className="mb-3 text-lg font-bold">Search</h1>

        {/* Search bar */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-2.5 text-gray-500">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Bluesky…"
            className="w-full rounded-xl border border-gray-700 bg-gray-900 py-2.5 pl-8 pr-4 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          />
          {searching && (
            <span className="absolute right-3 top-2.5">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex">
          {(["people", "posts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 border-b-2 pb-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "border-blue-500 text-white"
                  : "border-transparent text-gray-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {query.trim() === "" ? (
          <p className="py-16 text-center text-sm text-gray-600">
            Search for people or posts on Bluesky
          </p>
        ) : isEmpty ? (
          <p className="py-16 text-center text-sm text-gray-600">
            No results for &ldquo;{query}&rdquo;
          </p>
        ) : tab === "people" ? (
          actors.map((actor) => <ActorRow key={actor.did} actor={actor} />)
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.uri}
              item={{ post, reply: undefined, reason: undefined }}
            />
          ))
        )}
      </div>
    </div>
  );
}
