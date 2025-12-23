import { type ExpoOAuthClientInterface } from "@atproto/oauth-client-expo";

import { oauthMetadata } from "@graysky/oauth-metadata";

let _oauthClient: ExpoOAuthClientInterface | null = null;

export function getOAuthClient(): ExpoOAuthClientInterface {
  if (!_oauthClient) {
    // Dynamic import to ensure polyfills are loaded first
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExpoOAuthClient } = require("@atproto/oauth-client-expo") as {
      ExpoOAuthClient: new (options: {
        handleResolver: string;
        clientMetadata: typeof oauthMetadata;
      }) => ExpoOAuthClientInterface;
    };
    _oauthClient = new ExpoOAuthClient({
      handleResolver: "https://bsky.social",
      clientMetadata: oauthMetadata,
    });
  }
  return _oauthClient;
}
