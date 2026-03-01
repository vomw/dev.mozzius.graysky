/** Encode an AT-URI to be URL-safe for use in route params (base64url) */
export function encodeFeedUri(uri: string): string {
  return btoa(uri).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a route param back to an AT-URI */
export function decodeFeedUri(param: string): string {
  let padded = param.replace(/-/g, "+").replace(/_/g, "/");
  while (padded.length % 4 !== 0) padded += "=";
  return atob(padded);
}

// Post URIs use the same base64url encoding — aliases for clarity.
export const encodePostUri = encodeFeedUri;
export const decodePostUri = decodeFeedUri;
