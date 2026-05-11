import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@markitome/auth", "@markitome/db", "@markitome/shared", "@markitome/ui"],
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
