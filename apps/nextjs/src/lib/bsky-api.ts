import { AtpAgent, CredentialSession } from "@atproto/api";

import { type WebSession } from "./auth";

/**
 * Create an authenticated AtpAgent from a stored WebSession.
 * Sets the session directly on a CredentialSession so no network call
 * is made — safe to call inside useMemo().
 */
export function createAgent(session: WebSession): AtpAgent {
  const credSession = new CredentialSession(new URL(session.service));
  credSession.session = {
    did: session.did,
    handle: session.handle,
    accessJwt: session.accessJwt,
    refreshJwt: session.refreshJwt,
    active: true,
  };
  return new AtpAgent(credSession);
}
