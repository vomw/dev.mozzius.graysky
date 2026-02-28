"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "~/lib/auth-context";
import {
  addGroupMember,
  createGroupFull,
  updateGroupAvatar,
  updateGroupName,
  uploadGroupAvatarFile,
} from "~/lib/groups";

interface BskyActor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

/** Stable empty array — avoids re-creating a new reference on every render */
const NO_MEMBERS: string[] = [];

interface Props {
  /** "create" = new group form; "edit" = settings for an existing group */
  mode: "create" | "edit";
  /** Required in edit mode */
  groupId?: string;
  groupName?: string;
  groupAvatar?: string;
  /** DIDs of current members — used to fetch profiles and filter search */
  currentMemberDids?: string[];
  onClose: () => void;
}

export function GroupSettingsModal({
  mode,
  groupId,
  groupName = "",
  groupAvatar,
  currentMemberDids = NO_MEMBERS,
  onClose,
}: Props) {
  const { session } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(groupName);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    groupAvatar ?? null,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BskyActor[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  /** Members queued to be added (shown in the pending list) */
  const [pendingMembers, setPendingMembers] = useState<BskyActor[]>([]);

  /** Resolved profiles for currentMemberDids (edit mode) */
  const [existingMembers, setExistingMembers] = useState<BskyActor[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Fetch existing member profiles (edit mode) ──────────────────────────
  useEffect(() => {
    if (mode !== "edit" || currentMemberDids.length === 0) return;
    void (async () => {
      try {
        const qs = currentMemberDids
          .map((d) => `actors=${encodeURIComponent(d)}`)
          .join("&");
        const res = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${qs}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { profiles: BskyActor[] };
        setExistingMembers(
          data.profiles.map((p) => ({
            did: p.did,
            handle: p.handle,
            displayName: p.displayName,
            avatar: p.avatar,
          })),
        );
      } catch {
        // non-fatal — member list is optional UI
      }
    })();
  }, [mode, currentMemberDids]);

  // ── Debounced actor search ───────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      // Functional update: returns the same reference when already empty,
      // so React bails out and avoids an infinite re-render loop.
      setSearchResults((prev) => (prev.length > 0 ? [] : prev));
      return;
    }
    clearTimeout(searchTimer.current);
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(q)}&limit=8`,
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { actors: BskyActor[] };

        // Exclude self, already-pending, and already-in-group DIDs
        const excluded = new Set([
          session.did,
          ...pendingMembers.map((m) => m.did),
          ...currentMemberDids,
        ]);
        setSearchResults(
          data.actors
            .filter((a) => !excluded.has(a.did))
            .map((a) => ({
              did: a.did,
              handle: a.handle,
              displayName: a.displayName,
              avatar: a.avatar,
            })),
        );
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(searchTimer.current);
  }, [searchQuery, pendingMembers, currentMemberDids, session.did]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleAddMember = (actor: BskyActor) => {
    setPendingMembers((prev) => [...prev, actor]);
    setSearchResults((prev) => prev.filter((a) => a.did !== actor.did));
    setSearchQuery("");
  };

  const handleRemovePending = (did: string) => {
    setPendingMembers((prev) => prev.filter((m) => m.did !== did));
  };

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      if (mode === "create") {
        // 1. Create the Firestore document with all members at once
        const newId = await createGroupFull(
          name.trim(),
          session.did,
          pendingMembers.map((m) => m.did),
        );

        // 2. Upload avatar if the user picked one
        if (avatarFile) {
          const url = await uploadGroupAvatarFile(newId, avatarFile);
          await updateGroupAvatar(newId, url);
        }

        onClose();
        router.push(`/groups/${newId}`);
      } else {
        // Edit mode
        if (!groupId) return;

        if (name.trim() !== groupName) {
          await updateGroupName(groupId, name.trim());
        }
        if (avatarFile) {
          const url = await uploadGroupAvatarFile(groupId, avatarFile);
          await updateGroupAvatar(groupId, url);
        }
        // Add new members one-by-one (each triggers a system message)
        for (const m of pendingMembers) {
          await addGroupMember(
            groupId,
            m.did,
            m.displayName ?? m.handle,
          );
        }

        onClose();
      }
    } catch (e) {
      console.error("GroupSettingsModal save error:", e);
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-gray-800 px-4 py-3">
        <button
          onClick={onClose}
          className="text-sm text-gray-400 hover:text-white"
        >
          Cancel
        </button>
        <h2 className="font-semibold">
          {mode === "create" ? "New Group" : "Group Settings"}
        </h2>
        <button
          onClick={() => void handleSave()}
          disabled={!name.trim() || saving}
          className="text-sm font-semibold text-blue-500 disabled:opacity-40"
        >
          {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
        </button>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Avatar ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center py-8">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative"
            aria-label="Change group avatar"
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview}
                alt="Group avatar"
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-950 text-4xl">
                👥
              </div>
            )}
            {/* Edit badge */}
            <span className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-sm shadow-md">
              ✎
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarPick}
          />
          <p className="mt-2 text-xs text-gray-600">Tap to set a photo</p>
        </div>

        {/* ── Group Name ─────────────────────────────────────────────────── */}
        <section className="border-b border-gray-800 px-4 pb-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Group Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this group…"
            autoFocus
            className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </section>

        {/* ── Members ────────────────────────────────────────────────────── */}
        <section className="px-4 pt-5 pb-8">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            {mode === "create" ? "Add Members" : "Invite Members"}
          </label>

          {/* Search input */}
          <div className="relative">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by handle…"
              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
            {searchLoading && (
              <span className="absolute right-3 top-3.5 text-gray-500">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
              </span>
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-gray-700">
              {searchResults.map((actor, i) => (
                <button
                  key={actor.did}
                  onClick={() => handleAddMember(actor)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-900 active:bg-gray-800 ${
                    i < searchResults.length - 1
                      ? "border-b border-gray-800"
                      : ""
                  }`}
                >
                  <ActorAvatar actor={actor} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {actor.displayName ?? actor.handle}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      @{actor.handle}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-sm text-blue-500">
                    + Add
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Pending members (queued to be added) */}
          {pendingMembers.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {mode === "create" ? "Members" : "Will Be Added"}
              </p>
              <ul className="space-y-2">
                {pendingMembers.map((m) => (
                  <li
                    key={m.did}
                    className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3"
                  >
                    <ActorAvatar actor={m} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {m.displayName ?? m.handle}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        @{m.handle}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemovePending(m.did)}
                      aria-label="Remove"
                      className="flex-shrink-0 text-gray-600 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Existing members (edit mode only) */}
          {mode === "edit" && existingMembers.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Current Members · {existingMembers.length}
              </p>
              <ul className="space-y-2">
                {existingMembers.map((m) => (
                  <li
                    key={m.did}
                    className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3"
                  >
                    <ActorAvatar actor={m} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {m.displayName ?? m.handle}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        @{m.handle}
                      </p>
                    </div>
                    {m.did === session.did && (
                      <span className="flex-shrink-0 text-xs text-gray-600">
                        You
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {error && (
          <p className="px-4 pb-4 text-center text-sm text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}

// ── Small avatar helper ───────────────────────────────────────────────────────
function ActorAvatar({ actor, size }: { actor: BskyActor; size: number }) {
  if (actor.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={actor.avatar}
        alt={actor.handle}
        className="flex-shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-gray-800 text-base"
      style={{ width: size, height: size }}
    >
      👤
    </div>
  );
}
