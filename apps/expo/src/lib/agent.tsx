import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import { Agent } from "@atproto/api";

import { useSession } from "~/lib/session-provider";

/**
 * An unauthenticated Agent instance, that can be used to perform
 * unauthenticated requests directly towards the Bluesky API.
 */
const unauthenticatedAgent = new Agent("https://api.bsky.app");

const agentContext = createContext<Agent>(unauthenticatedAgent);

export default agentContext;

export const useAgent = () => {
  const agent = useContext(agentContext);
  if (!agent.did) throw new Error("No authenticated agent found in context");
  return agent;
};

export const useOptionalAgent = () => {
  const agent = useContext(agentContext);
  return agent.did ? agent : null;
};

/**
 * Returns an unauthenticated Agent to perform requests towards the Bluesky API.
 * Using an unauthenticated agent will result in faster requests
 * (since no proxying will be involved), but only public data can be accessed.
 */
export const useUnauthenticatedAgent = () => {
  return unauthenticatedAgent;
};

export const AgentProvider = ({ children }: PropsWithChildren) => {
  const { session } = useSession();

  /**
   * An agent that will perform authenticated requests towards the Bluesky
   * API, by proxying requests through the user's PDS.
   *
   * Requires that at least one `rpc:` OAuth scope with
   * `aud=did:web:api.bsky.app#bsky_appview` is granted during the OAuth flow,
   * otherwise the PDS will reject any proxying attempts.
   */
  const authenticatedAgent = useMemo(() => {
    if (!session) return null;
    const agent = new Agent(session);
    agent.assertAuthenticated();
    agent.configureProxy("did:web:api.bsky.app#bsky_appview");
    return agent;
  }, [session]);

  return (
    <agentContext.Provider value={authenticatedAgent ?? unauthenticatedAgent}>
      {children}
    </agentContext.Provider>
  );
};
