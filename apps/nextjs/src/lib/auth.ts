"use client";

// Lightweight Bluesky auth for the web PWA.
// Uses the public AppView (bsky.social) to resolve handles and get DIDs.
// Sessions are stored in localStorage as a plain object.

export interface WebSession {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  accessJwt: string;
  refreshJwt: string;
  service: string;
}

const SESSION_KEY = "saucer_session";

export function getSession(): WebSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as WebSession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: WebSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function loginWithPassword(
  identifier: string,
  password: string,
): Promise<WebSession> {
  // Resolve the PDS URL for the user's handle
  const service = "https://bsky.social";

  const res = await fetch(`${service}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(err.message ?? "Login failed");
  }

  const data = (await res.json()) as {
    did: string;
    handle: string;
    displayName?: string;
    accessJwt: string;
    refreshJwt: string;
  };

  // Fetch profile for avatar
  let avatar: string | undefined;
  try {
    const profileRes = await fetch(
      `${service}/xrpc/app.bsky.actor.getProfile?actor=${data.did}`,
      { headers: { Authorization: `Bearer ${data.accessJwt}` } },
    );
    if (profileRes.ok) {
      const profile = (await profileRes.json()) as { avatar?: string };
      avatar = profile.avatar;
    }
  } catch {
    // avatar is optional
  }

  const session: WebSession = {
    did: data.did,
    handle: data.handle,
    displayName: data.displayName,
    avatar,
    accessJwt: data.accessJwt,
    refreshJwt: data.refreshJwt,
    service,
  };

  setSession(session);
  return session;
}
