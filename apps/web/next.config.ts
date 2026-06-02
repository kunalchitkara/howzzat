import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@howzzat/rules-engine",
    "@howzzat/shared",
    "@howzzat/db",
  ],
};

export default nextConfig;
