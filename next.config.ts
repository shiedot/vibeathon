import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // @auth/drizzle-adapter + pg pull in Node built-ins. Keep them external so
  // the bundler doesn't try to polyfill them.
  serverExternalPackages: ["pg", "pg-native"],
};

export default nextConfig;
