import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    remotePatterns: [],
  },
  // pg pulls in Node built-ins; keep it external so the bundler doesn't try
  // to polyfill them.
  serverExternalPackages: ["pg", "pg-native"],
};

export default nextConfig;
