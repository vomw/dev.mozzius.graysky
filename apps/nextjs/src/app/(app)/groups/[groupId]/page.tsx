"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";

import { GroupSettingsModal } from "~/components/group-settings-modal";
import { useAuth } from "~/lib/auth-context";
import {
  fetchGroup,
  isBskyPostContent,
  sendMessage,
  subscribeToMessages,
  type Group,
  type Message,
} from "~/lib/groups";

/** Format a Date as a short relative time string */
function timeSince(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

/** Tiny inline Bluesky post embed fetched via the public AppView */
function BskyPostEmbed({ atUri }: { atUri: string }) {
  const [post, setPost] = useState<{
    text: string;
    handle: string;
    displayName?: string;
    avatar?: string;
    likeCount?: number;
    repostCount?: number;
  } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=0`,
        );
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as {
          thread: {
            post: {
              record: { text: string };
              author: {
                handle: string;
                displayName?: string;
                avatar?: string;
              };
              likeCount?: number;
              repostCount?: number;
            };
          };
        };
        const p = data.thread.post;
        setPost({
          text: p.record.text,
          handle: p.author.handle,
          displayName: p.author.displayName,
          avatar: p.author.avatar,
          likeCount: p.likeCount,
          repostCount: p.repostCount,
        });
      } catch {
        setError(true);
      }
    })();
  }, [atUri]);

  if (error) {
    return (
      <div className="rounded-xl border border-gray-700 px-3 py-2 text-xs text-gray-500">
        ⚠️ Post could not be loaded
      </div>
    );
  }
  if (!post) {
    return (
      <div className="rounded-xl border border-gray-700 px-3 py-2 text-xs text-gray-500">
        Loading post…
      </div>
    );
  }

  return (
    <a
      href={`https://bsky.app/profile/${post.handle}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 block rounded-xl border border-gray-700 bg-gray-950 p-3 text-left hover:border-gray-500"
    >
      <div className="mb-1.5 flex items-center gap-2">
        {post.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.avatar}
            alt={post.handle}
            className="h-5 w-5 rounded-full object-cover"
          />
        )}
        <span className="text-xs font-semibold text-white">
          {post.displayName ?? post.handle}
        </span>
        <span className="text-xs text-gray-500">@{post.handle}</span>
      </div>
      <p className="line-clamp-4 text-sm text-gray-200">{post.text}</p>
      <div className="mt-2 flex gap-3 text-xs text-gray-600">
        <span>♡ {post.likeCount ?? 0}</span>
        <span>↺ {post.repostCount ?? 0}</span>
      </div>
    </a>
  );
}

/** A single chat message bubble */
function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  const timeStr = msg.createdAt ? timeSince(msg.createdAt.toDate()) : "";
  const isPost = isBskyPostContent(msg.text);

  let atUri: string | null = null;
  if (isPost) {
    if (msg.text.startsWith("at://")) {
      atUri = msg.text;
    } else {
      const m = /bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(
        msg.text,
      );
      if (m) atUri = `at://${m[1]}/app.bsky.feed.post/${m[2]}`;
    }
  }

  return (
    <div
      className={`my-1 flex flex-col ${isOwn ? "items-end" : "items-start"}`}
    >
      {!isOwn && (
        <span className="mb-0.5 ml-1 truncate text-xs text-gray-500">
          {msg.sender.slice(0, 24)}…
        </span>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          isOwn
            ? "bg-blue-500 text-white"
            : "border border-gray-700 bg-gray-900 text-white"
        }`}
      >
        {isPost && atUri ? (
          <BskyPostEmbed atUri={atUri} />
        ) : (
          <span className="whitespace-pre-wrap break-words">{msg.text}</span>
        )}
      </div>

      {timeStr && (
        <span className="mx-1 mt-0.5 text-xs text-gray-600">{timeStr}</span>
      )}
    </div>
  );
}

export default function GroupChatPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load group metadata
  useEffect(() => {
    if (!groupId) return;
    void fetchGroup(groupId).then(setGroup);
  }, [groupId]);

  // Re-fetch group when settings modal closes (to pick up name/avatar changes)
  const handleSettingsClose = () => {
    setShowSettings(false);
    if (groupId) void fetchGroup(groupId).then(setGroup);
  };

  // Subscribe to messages
  useEffect(() => {
    if (!groupId) return;
    return subscribeToMessages(groupId, setMessages);
  }, [groupId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Auto-grow textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending || !session.did || !groupId) return;
    setInputText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    try {
      await sendMessage(groupId, session.did, text);
    } catch (e) {
      console.error("Failed to send:", e);
      setInputText(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [inputText, sending, session.did, groupId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      <div className="flex h-full flex-col">
        {/* ── Chat header ───────────────────────────────────────────────── */}
        <header className="flex flex-shrink-0 items-center gap-2 border-b border-gray-800 bg-black px-3 py-2">
          {/* Back */}
          <button
            onClick={() => router.push("/groups")}
            aria-label="Back"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            ←
          </button>

          {/* Tappable group identity → opens settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-1 items-center gap-2 overflow-hidden rounded-xl px-2 py-1 hover:bg-gray-900 active:bg-gray-800"
          >
            {group?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={group.avatarUrl}
                alt={group.name}
                className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-950 text-sm">
                👥
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold leading-tight">
                {group?.name ?? "Loading…"}
              </p>
              {group && (
                <p className="text-xs text-gray-500">
                  {group.members.length} member
                  {group.members.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </button>

          {/* Gear icon */}
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Group settings"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            ⚙
          </button>
        </header>

        {/* ── Message list ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-600">
              No messages yet. Say something!
            </p>
          )}

          {messages.map((msg) => {
            if (msg.type === "system") {
              return (
                <div
                  key={msg.id}
                  className="my-2 text-center text-xs italic text-gray-600"
                >
                  {msg.text}
                </div>
              );
            }
            return (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.sender === session.did}
              />
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-shrink-0 items-end gap-2 border-t border-gray-800 bg-gray-900 px-3 py-2">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-gray-700 bg-black px-4 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!inputText.trim() || sending}
            aria-label="Send"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-lg font-bold text-white transition hover:bg-blue-600 disabled:opacity-40"
          >
            ↑
          </button>
        </div>
      </div>

      {/* Settings modal (renders on top of everything) */}
      {showSettings && group && (
        <GroupSettingsModal
          mode="edit"
          groupId={group.id}
          groupName={group.name}
          groupAvatar={group.avatarUrl}
          currentMemberDids={group.members}
          onClose={handleSettingsClose}
        />
      )}
    </>
  );
}
