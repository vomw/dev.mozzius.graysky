"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type AppBskyActorDefs,
  type AppBskyFeedDefs,
} from "@atproto/api";

import { PostCard } from "~/components/post-card";
import { useAuth } from "~/lib/auth-context";
import { createAgent } from "~/lib/bsky-api";

function fmtCount(n?: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function ProfilePage() {
  const { session, logout } = useAuth();
  const agent = useMemo(() => createAgent(session), [session]);

  const [profile, setProfile] = useState<AppBskyActorDefs.ProfileViewDetailed | null>(null);
  const [feed, setFeed] = useState<AppBskyFeedDefs.FeedViewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, feedRes] = await Promise.all([
        agent.getProfile({ actor: session.did }),
        agent.getAuthorFeed({ actor: session.did, limit: 20 }),
      ]);
      setProfile(profileRes.data);
      setFeed(feedRes.data.feed);
    } catch {
      setError("Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, [agent, session.did]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full flex-col">
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
        ) : profile ? (
          <>
            {/* Banner */}
            <div className="relative">
              {profile.banner ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.banner}
                  alt=""
                  className="h-28 w-full object-cover"
                />
              ) : (
                <div className="h-28 w-full bg-blue-950" />
              )}

              {/* Avatar overlapping banner */}
              <div className="absolute -bottom-10 left-4">
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar}
                    alt={profile.handle}
                    className="h-20 w-20 rounded-full border-4 border-black object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-black bg-gray-800 text-3xl">
                    👤
                  </div>
                )}
              </div>
            </div>

            {/* Profile info */}
            <div className="px-4 pb-4 pt-12">
              <h2 className="text-xl font-bold text-white">
                {profile.displayName ?? profile.handle}
              </h2>
              <p className="text-sm text-gray-500">@{profile.handle}</p>

              {profile.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                  {profile.description}
                </p>
              )}

              {/* Stats */}
              <div className="mt-3 flex gap-5 text-sm">
                <span>
                  <span className="font-bold text-white">
                    {fmtCount(profile.postsCount)}
                  </span>{" "}
                  <span className="text-gray-500">posts</span>
                </span>
                <span>
                  <span className="font-bold text-white">
                    {fmtCount(profile.followersCount)}
                  </span>{" "}
                  <span className="text-gray-500">followers</span>
                </span>
                <span>
                  <span className="font-bold text-white">
                    {fmtCount(profile.followsCount)}
                  </span>{" "}
                  <span className="text-gray-500">following</span>
                </span>
              </div>
            </div>

            {/* Divider + Posts label */}
            <div className="border-b border-gray-800 px-4 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Posts
              </p>
            </div>

            {/* Posts */}
            {feed.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-600">
                No posts yet
              </p>
            ) : (
              feed.map((item) => (
                <PostCard
                  key={`${item.post.uri}-${item.reason?.$type ?? "post"}`}
                  item={item}
                />
              ))
            )}

            {/* Sign out */}
            <div className="border-t border-gray-800 p-4">
              <button
                onClick={logout}
                className="w-full rounded-xl border border-red-900 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-950"
              >
                Sign Out
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
