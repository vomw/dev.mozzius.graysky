import production from "./production.json";
import development from "./development.json";

// __DEV__ is a React Native global, declare it for TypeScript
declare const __DEV__: boolean | undefined;

// Use development metadata in dev, production otherwise
// __DEV__ is only available in React Native, check NODE_ENV for other contexts
const isDev =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV === "development";
export const oauthMetadata = isDev ? development : production;
export { production, development };
