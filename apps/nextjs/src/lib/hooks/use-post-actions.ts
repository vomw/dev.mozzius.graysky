"use client";

import { useCallback, useState } from "react";

import { type AtpAgent, type AppBskyFeedDefs } from "@atproto/api";

/**
 * Hook for toggling a like on a post with optimistic updates.
 */
export function useLike(agent: AtpAgent, post: AppBskyFeedDefs.PostView) {
  const [liked, setLiked] = useState(!!post.viewer?.like);
  const [likeUri, setLikeUri] = useState(post.viewer?.like);

  // Compute adjusted count based on delta from original state
  const originallyLiked = !!post.viewer?.like;
  const delta = liked === originallyLiked ? 0 : liked ? 1 : -1;
  const likeCount = Math.max(0, (post.likeCount ?? 0) + delta);

  const toggleLike = useCallback(async () => {
    if (liked) {
      // Optimistic unlike
      setLiked(false);
      const prevUri = likeUri;
      setLikeUri(undefined);
      try {
        if (prevUri) await agent.deleteLike(prevUri);
      } catch {
        // Rollback
        setLiked(true);
        setLikeUri(prevUri);
      }
    } else {
      // Optimistic like
      setLiked(true);
      try {
        const res = await agent.like(post.uri, post.cid);
        setLikeUri(res.uri);
      } catch {
        // Rollback
        setLiked(false);
        setLikeUri(undefined);
      }
    }
  }, [agent, post.uri, post.cid, liked, likeUri]);

  return { liked, likeCount, toggleLike };
}

/**
 * Hook for toggling a repost on a post with optimistic updates.
 */
export function useRepost(agent: AtpAgent, post: AppBskyFeedDefs.PostView) {
  const [reposted, setReposted] = useState(!!post.viewer?.repost);
  const [repostUri, setRepostUri] = useState(post.viewer?.repost);

  const originallyReposted = !!post.viewer?.repost;
  const delta = reposted === originallyReposted ? 0 : reposted ? 1 : -1;
  const repostCount = Math.max(0, (post.repostCount ?? 0) + delta);

  const toggleRepost = useCallback(async () => {
    if (reposted) {
      setReposted(false);
      const prevUri = repostUri;
      setRepostUri(undefined);
      try {
        if (prevUri) await agent.deleteRepost(prevUri);
      } catch {
        setReposted(true);
        setRepostUri(prevUri);
      }
    } else {
      setReposted(true);
      try {
        const res = await agent.repost(post.uri, post.cid);
        setRepostUri(res.uri);
      } catch {
        setReposted(false);
        setRepostUri(undefined);
      }
    }
  }, [agent, post.uri, post.cid, reposted, repostUri]);

  return { reposted, repostCount, toggleRepost };
}
