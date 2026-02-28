"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { GroupSettingsModal } from "~/components/group-settings-modal";
import { useAuth } from "~/lib/auth-context";
import { subscribeToGroups, type Group } from "~/lib/groups";

export default function GroupsPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    return subscribeToGroups(session.did, setGroups);
  }, [session.did]);

  const sorted = groups.slice().sort((a, b) => {
    const aTime =
      a.lastMessageAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0;
    const bTime =
      b.lastMessageAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0;
    return bTime - aTime;
  });

  return (
    <>
      <div className="relative flex h-full flex-col">
        {/* Group list */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-600">
              <span className="mb-3 text-5xl">💬</span>
              <p className="text-sm">No groups yet.</p>
              <p className="text-sm">
                Tap{" "}
                <span className="font-semibold text-blue-500">+</span> to
                create one.
              </p>
            </div>
          ) : (
            sorted.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                onClick={() => router.push(`/groups/${group.id}`)}
              />
            ))
          )}
        </div>

        {/* Floating action button */}
        <button
          onClick={() => setShowCreate(true)}
          aria-label="Create group"
          className="absolute bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-2xl text-white shadow-lg transition hover:bg-blue-600 active:scale-95"
        >
          +
        </button>
      </div>

      {/* Create group modal */}
      {showCreate && (
        <GroupSettingsModal
          mode="create"
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}

function GroupRow({
  group,
  onClick,
}: {
  group: Group;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-gray-800 px-4 py-3 text-left transition hover:bg-gray-900 active:bg-gray-800"
    >
      {/* Avatar */}
      {group.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={group.avatarUrl}
          alt={group.name}
          className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-950 text-2xl">
          👥
        </div>
      )}

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">{group.name}</p>
        {group.lastMessage && (
          <p className="truncate text-sm text-gray-500">
            {group.lastMessage}
          </p>
        )}
      </div>

      <span className="flex-shrink-0 text-gray-700">›</span>
    </button>
  );
}
