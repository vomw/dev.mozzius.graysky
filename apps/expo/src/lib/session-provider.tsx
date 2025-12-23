import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import * as SecureStore from "expo-secure-store";
import { Agent } from "@atproto/api";
import { type OAuthSession } from "@atproto/oauth-client";
import { type ExpoOAuthClientInterface } from "@atproto/oauth-client-expo";

import { store } from "~/lib/storage/storage";

// Define SavedSession here to avoid circular dependency with switch-accounts
export interface SavedSession {
  displayName?: string;
  avatar?: string;
  handle: string;
  did: string;
  signedOut?: boolean;
}

// Helper to save profile metadata for a session
async function saveSessionMetadata(session: OAuthSession) {
  try {
    const agent = new Agent(session);
    agent.configureProxy("did:web:api.bsky.app#bsky_appview");
    const profile = await agent.getProfile({ actor: session.did });

    if (!profile.success) return;

    const sessionsRaw = store.getString("sessions");
    const sessions: SavedSession[] = sessionsRaw
      ? (JSON.parse(sessionsRaw) as SavedSession[])
      : [];

    // Update or add the session
    const existingIndex = sessions.findIndex((s) => s.did === session.did);
    const newSession: SavedSession = {
      did: session.did,
      handle: profile.data.handle,
      avatar: profile.data.avatar,
      displayName: profile.data.displayName,
      signedOut: false,
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = newSession;
    } else {
      sessions.unshift(newSession);
    }

    store.set("sessions", JSON.stringify(sessions));
  } catch (err) {
    console.warn("Failed to save session metadata", err);
  }
}

const CURRENT_AUTH_DID = "oauth_provider-current";

interface SessionContextValue {
  session: OAuthSession | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  signIn: (input: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchAccount: (did: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  isLoading: false,
  isLoggedIn: false,
  signIn: async () => {
    throw new Error("SessionContext not initialized");
  },
  signOut: async () => {
    throw new Error("SessionContext not initialized");
  },
  switchAccount: async () => {
    throw new Error("SessionContext not initialized");
  },
});

export function SessionProvider({
  client,
  children,
}: PropsWithChildren<{
  client: ExpoOAuthClientInterface;
}>) {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<OAuthSession | null>(null);

  // Initialize by restoring the previously loaded session, if any.
  useEffect(() => {
    setInitialized(false);
    setSession(null);

    void (async () => {
      try {
        // First check for OAuth callback (returning from browser auth)
        const newSession = await client.handleCallback();
        if (newSession) {
          setSession(newSession);
          await SecureStore.setItemAsync(CURRENT_AUTH_DID, newSession.did);
          // Save profile metadata for account switching
          void saveSessionMetadata(newSession);
          return;
        }

        // Otherwise, try to restore the last session
        const lastDid = await SecureStore.getItemAsync(CURRENT_AUTH_DID);
        if (!lastDid) return;

        // Use "false" as restore argument to allow the app to work offline
        const restoredSession = await client.restore(lastDid, false);
        setSession(restoredSession);

        // Force a refresh here, which will cause the session to be deleted
        // by the "deleted" event handler if the refresh token was revoked
        await restoredSession.getTokenInfo(true);

        // Update profile metadata in case it changed
        void saveSessionMetadata(restoredSession);
      } catch (err) {
        console.warn("Error setting up OAuth Session", err);
      } finally {
        setInitialized(true);
        setLoading(false);
      }
    })();
  }, [client]);

  // If the current session gets deleted (e.g. from another browser tab, or
  // because a refresh token was revoked), clear it
  useEffect(() => {
    if (!session) return;

    const handleDelete = (event: CustomEvent<{ sub: string }>) => {
      if (event.detail.sub === session.did) {
        setSession(null);
        void SecureStore.deleteItemAsync(CURRENT_AUTH_DID);
        // Mark session as signed out in saved sessions
        const sessionsRaw = store.getString("sessions");
        if (sessionsRaw) {
          const sessions = JSON.parse(sessionsRaw) as SavedSession[];
          const updated = sessions.map((s) =>
            s.did === session.did ? { ...s, signedOut: true } : s,
          );
          store.set("sessions", JSON.stringify(updated));
        }
      }
    };

    client.addEventListener("deleted", handleDelete);
    return () => {
      client.removeEventListener("deleted", handleDelete);
    };
  }, [client, session]);

  // Proactive token refresh every 10 minutes when online
  useEffect(() => {
    if (!session) return;

    const check = () => {
      void session.getTokenInfo(true).catch((err) => {
        console.warn("Failed to refresh token", err);
      });
    };

    const interval = setInterval(check, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session]);

  const signIn = useCallback(
    async (input: string) => {
      setLoading(true);
      try {
        // Try to restore existing session first, then fall back to new sign in
        const newSession = await client
          .restore(input, true)
          .catch(async () => client.signIn(input));

        setSession(newSession);
        await SecureStore.setItemAsync(CURRENT_AUTH_DID, newSession.did);

        // Save profile metadata for account switching
        void saveSessionMetadata(newSession);
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!session) return;

    const currentDid = session.did;
    setSession(null);
    setLoading(true);

    try {
      await session.signOut();
    } finally {
      setLoading(false);
    }

    await SecureStore.deleteItemAsync(CURRENT_AUTH_DID);

    // Mark session as signed out in saved sessions
    const sessionsRaw = store.getString("sessions");
    if (sessionsRaw) {
      const sessions = JSON.parse(sessionsRaw) as SavedSession[];
      const updated = sessions.map((s) =>
        s.did === currentDid ? { ...s, signedOut: true } : s,
      );
      store.set("sessions", JSON.stringify(updated));
    }
  }, [session]);

  const switchAccount = useCallback(
    async (did: string) => {
      setLoading(true);
      try {
        // Try to restore the session for this DID
        const newSession = await client.restore(did, true);
        setSession(newSession);
        await SecureStore.setItemAsync(CURRENT_AUTH_DID, did);
      } catch {
        // If restore fails, mark as signed out and require re-auth
        const sessionsRaw = store.getString("sessions");
        if (sessionsRaw) {
          const sessions = JSON.parse(sessionsRaw) as SavedSession[];
          const updated = sessions.map((s) =>
            s.did === did ? { ...s, signedOut: true } : s,
          );
          store.set("sessions", JSON.stringify(updated));
        }
        throw new Error("Session expired, please sign in again");
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  return (
    <SessionContext.Provider
      value={{
        session,
        isLoading: !initialized || loading,
        isLoggedIn: !!session,
        signIn,
        signOut,
        switchAccount,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

export function useOAuthSession(): OAuthSession {
  const { session } = useSession();
  if (!session) throw new Error("User is not logged in");
  return session;
}
