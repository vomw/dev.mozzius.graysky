import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "./firebase";

// Firestore data types
export interface Group {
  id: string;
  name: string;
  members: string[]; // array of DIDs
  createdAt: Timestamp | null;
  lastMessage?: string;
  lastMessageAt?: Timestamp | null;
}

export interface Message {
  id: string;
  senderDid: string;
  content: string; // plain text or at:// URI
  timestamp: Timestamp | null;
  type: "text" | "post-embed";
}

// Subscribe to groups where the current user (by DID) is a member
export function subscribeToGroups(
  did: string,
  onGroups: (groups: Group[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, "groups"),
    where("members", "array-contains", did),
  );
  return onSnapshot(q, (snapshot) => {
    const groups: Group[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Group, "id">),
    }));
    onGroups(groups);
  });
}

// Subscribe to messages in a group (real-time)
export function subscribeToMessages(
  groupId: string,
  onMessages: (messages: Message[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, "groups", groupId, "messages"),
    orderBy("timestamp", "asc"),
  );
  return onSnapshot(q, (snapshot) => {
    const messages: Message[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Message, "id">),
    }));
    onMessages(messages);
  });
}

// Send a text message to a group
export async function sendMessage(
  groupId: string,
  senderDid: string,
  content: string,
): Promise<void> {
  const isPostEmbed =
    content.startsWith("at://") ||
    content.includes("bsky.app/profile/") ||
    content.includes("bsky.app/post/");

  await addDoc(collection(db, "groups", groupId, "messages"), {
    senderDid,
    content,
    type: isPostEmbed ? "post-embed" : "text",
    timestamp: serverTimestamp(),
  });

  // Update group's last message preview
  const groupRef = doc(db, "groups", groupId);
  await import("firebase/firestore").then(({ updateDoc }) =>
    updateDoc(groupRef, {
      lastMessage: isPostEmbed ? "📎 Shared a post" : content,
      lastMessageAt: serverTimestamp(),
    }),
  );
}

// Fetch a single group by ID (one-time)
export async function fetchGroup(groupId: string): Promise<Group | null> {
  const snap = await getDoc(doc(db, "groups", groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Group, "id">) };
}

// Resolve a BlueSky post URL/URI to an at:// URI
export function resolveToAtUri(content: string): string | null {
  // Already an at:// URI
  if (content.startsWith("at://")) return content;

  // bsky.app/profile/<handle>/post/<rkey>
  const webMatch =
    /bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(content);
  if (webMatch) {
    const [, handle, rkey] = webMatch;
    return `at://${handle}/app.bsky.feed.post/${rkey}`;
  }

  return null;
}

// Check if a message content is a BlueSky post reference
export function isBskyPostContent(content: string): boolean {
  return resolveToAtUri(content) !== null;
}
