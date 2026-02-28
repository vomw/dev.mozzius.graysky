import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { db, storage } from "./firebase";

const GROUPS_COLLECTION = "chat_groups";

// Firestore data types
export interface Group {
  id: string;
  name: string;
  members: string[]; // array of DIDs
  avatarUrl?: string;
  createdAt: Timestamp | null;
  lastMessage?: string;
  lastMessageAt?: Timestamp | null;
}

export interface Message {
  id: string;
  sender: string;
  text: string; // plain text or at:// URI
  createdAt: Timestamp | null;
  type?: "text" | "post-embed" | "system";
}

// Subscribe to groups where the current user (by DID) is a member
export function subscribeToGroups(
  did: string,
  onGroups: (groups: Group[]) => void,
): Unsubscribe {
  console.log("[Groups] Subscribing for DID:", did);
  const q = query(
    collection(db, GROUPS_COLLECTION),
    where("members", "array-contains", did),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      console.log("[Groups] Snapshot received:", snapshot.docs.length, "groups");
      const groups: Group[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Group, "id">),
      }));
      onGroups(groups);
    },
    (error) => {
      console.error("[Groups] Firestore subscription error:", error);
      onGroups([]);
    },
  );
}

// Create a new group (single member allowed for testing)
export async function createGroup(
  name: string,
  creatorDid: string,
): Promise<string> {
  const docRef = await addDoc(collection(db, GROUPS_COLLECTION), {
    name,
    members: [creatorDid],
    createdAt: serverTimestamp(),
  });
  console.log("[Groups] Created group:", docRef.id, "name:", name);
  return docRef.id;
}

// Subscribe to messages in a group (real-time)
export function subscribeToMessages(
  groupId: string,
  onMessages: (messages: Message[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, GROUPS_COLLECTION, groupId, "messages"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const messages: Message[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Message, "id">),
      }));
      onMessages(messages);
    },
    (error) => {
      console.error("[Groups] Messages subscription error:", error);
      onMessages([]);
    },
  );
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

  await addDoc(collection(db, GROUPS_COLLECTION, groupId, "messages"), {
    sender: senderDid,
    text: content,
    type: isPostEmbed ? "post-embed" : "text",
    createdAt: serverTimestamp(),
  });

  // Update group's last message preview
  const groupRef = doc(db, GROUPS_COLLECTION, groupId);
  await updateDoc(groupRef, {
    lastMessage: isPostEmbed ? "📎 Shared a post" : content,
    lastMessageAt: serverTimestamp(),
  });
}

// Fetch a single group by ID (one-time)
export async function fetchGroup(groupId: string): Promise<Group | null> {
  const snap = await getDoc(doc(db, GROUPS_COLLECTION, groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Group, "id">) };
}

// Update a group's name
export async function updateGroupName(
  groupId: string,
  name: string,
): Promise<void> {
  await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { name });
}

// Update a group's avatar URL
export async function updateGroupAvatar(
  groupId: string,
  avatarUrl: string,
): Promise<void> {
  await updateDoc(doc(db, GROUPS_COLLECTION, groupId), { avatarUrl });
}

// Add a member to a group and post a system message announcing it
export async function addGroupMember(
  groupId: string,
  did: string,
  displayName?: string,
): Promise<void> {
  await updateDoc(doc(db, GROUPS_COLLECTION, groupId), {
    members: arrayUnion(did),
  });
  const label = displayName || did.slice(0, 20) + "...";
  await addDoc(collection(db, GROUPS_COLLECTION, groupId, "messages"), {
    sender: "system",
    text: `${label} was added to the group`,
    type: "system",
    createdAt: serverTimestamp(),
  });
}

// Upload a group avatar to Firebase Storage and return the download URL
export async function uploadGroupAvatar(
  groupId: string,
  imageUri: string,
): Promise<string> {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `group-avatars/${groupId}`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

// Upload a group avatar from a browser File object (web PWA)
export async function uploadGroupAvatarFile(
  groupId: string,
  file: File,
): Promise<string> {
  const storageRef = ref(storage, `group-avatars/${groupId}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// Create a new group with all initial members in one write (no system messages)
export async function createGroupFull(
  name: string,
  creatorDid: string,
  additionalMemberDids: string[],
): Promise<string> {
  const docRef = await addDoc(collection(db, GROUPS_COLLECTION), {
    name,
    members: [creatorDid, ...additionalMemberDids],
    createdAt: serverTimestamp(),
  });
  return docRef.id;
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
