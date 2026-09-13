import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Acknowledges the webpack config that @serwist/next attaches (used only
  // for `next build --webpack`; a no-op in dev since Serwist is disabled
  // there) so Next 16's Turbopack dev server doesn't treat it as a mistake.
  turbopack: {},
};

export default withSerwist(nextConfig);
