"use client";

import {
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  AppBskyEmbedRecord,
  AppBskyFeedDefs,
  AppBskyFeedPost,
} from "@atproto/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function fmtCount(n?: number): string {
  if (!n) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Embed sub-components ──────────────────────────────────────────────────────

function ImageEmbed({ embed }: { embed: AppBskyEmbedImages.View }) {
  const { images } = embed;
  if (images.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={images[0]!.thumb}
        alt={images[0]!.alt ?? ""}
        className="mt-2 max-h-64 w-full rounded-xl object-cover"
      />
    );
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {images.slice(0, 4).map((img, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={img.thumb}
          alt={img.alt ?? ""}
          className="h-32 flex-1 rounded-xl object-cover"
          style={{ minWidth: "calc(50% - 2px)", maxWidth: "calc(50% - 2px)" }}
        />
      ))}
    </div>
  );
}

function ExternalEmbed({ embed }: { embed: AppBskyEmbedExternal.View }) {
  const { external } = embed;
  const domain = (() => {
    try {
      return new URL(external.uri).hostname;
    } catch {
      return external.uri;
    }
  })();

  return (
    <a
      href={external.uri}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex overflow-hidden rounded-xl border border-gray-800 hover:border-gray-600"
    >
      {external.thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={external.thumb}
          alt=""
          className="h-20 w-20 flex-shrink-0 object-cover"
        />
      )}
      <div className="min-w-0 flex-1 p-3">
        <p className="truncate text-xs text-gray-500">{domain}</p>
        <p className="mt-0.5 line-clamp-2 text-sm font-medium text-white">
          {external.title}
        </p>
        {external.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
            {external.description}
          </p>
        )}
      </div>
    </a>
  );
}

function QuoteEmbed({ embed }: { embed: AppBskyEmbedRecord.View }) {
  const rec = embed.record;
  if (!AppBskyEmbedRecord.isViewRecord(rec)) return null;

  const author = rec.author;
  const text = AppBskyFeedPost.isRecord(rec.value)
    ? rec.value.text
    : "View post";

  return (
    <div className="mt-2 rounded-xl border border-gray-800 p-3">
      <div className="mb-1 flex items-center gap-2">
        {author.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatar}
            alt={author.handle}
            className="h-4 w-4 rounded-full object-cover"
          />
        )}
        <span className="text-xs font-semibold text-white">
          {author.displayName ?? author.handle}
        </span>
        <span className="text-xs text-gray-500">@{author.handle}</span>
      </div>
      <p className="line-clamp-3 text-sm text-gray-300">{text}</p>
    </div>
  );
}

function PostEmbed({ post }: { post: AppBskyFeedDefs.PostView }) {
  const embed = post.embed;
  if (!embed) return null;

  if (AppBskyEmbedImages.isView(embed))
    return <ImageEmbed embed={embed} />;
  if (AppBskyEmbedExternal.isView(embed))
    return <ExternalEmbed embed={embed} />;
  if (AppBskyEmbedRecord.isView(embed))
    return <QuoteEmbed embed={embed} />;

  return null;
}

// ── Main PostCard ─────────────────────────────────────────────────────────────

export function PostCard({ item }: { item: AppBskyFeedDefs.FeedViewPost }) {
  const { post, reason } = item;
  const author = post.author;
  const record = post.record as AppBskyFeedPost.Record;
  const isRepost = AppBskyFeedDefs.isReasonRepost(reason);

  return (
    <article className="border-b border-gray-800 px-4 py-3">
      {/* Repost banner */}
      {isRepost && AppBskyFeedDefs.isReasonRepost(reason) && (
        <p className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-500">
          <span>↺</span>
          <span>
            Reposted by{" "}
            {reason.by.displayName ?? reason.by.handle}
          </span>
        </p>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        {author.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatar}
            alt={author.handle}
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm">
            👤
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Author + timestamp */}
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-sm font-semibold text-white">
              {author.displayName ?? author.handle}
            </span>
            <span className="flex-shrink-0 text-xs text-gray-500">
              @{author.handle}
            </span>
            <span className="flex-shrink-0 text-xs text-gray-600">
              · {timeAgo(post.indexedAt)}
            </span>
          </div>

          {/* Post text */}
          {record.text && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-100">
              {record.text}
            </p>
          )}

          {/* Embedded media */}
          <PostEmbed post={post} />

          {/* Action counts */}
          <div className="mt-2 flex gap-5 text-xs text-gray-600">
            <span>💬 {fmtCount(post.replyCount)}</span>
            <span>↺ {fmtCount(post.repostCount)}</span>
            <span>♡ {fmtCount(post.likeCount)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
