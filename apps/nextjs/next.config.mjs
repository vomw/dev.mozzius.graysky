/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds and Linting.
 */
!process.env.SKIP_ENV_VALIDATION && (await import("./src/env.mjs"));

import withPWA from "next-pwa";

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: ["@graysky/api", "@graysky/db"],
  /** We already do typechecking as a separate task in CI */
  typescript: { ignoreBuildErrors: !!process.env.CI },
  /** Suppress Turbopack/webpack conflict warning (next-pwa uses webpack config) */
  turbopack: {},
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
