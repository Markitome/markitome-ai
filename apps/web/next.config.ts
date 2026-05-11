import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@markitome/auth", "@markitome/db", "@markitome/shared", "@markitome/ui"]
};

export default nextConfig;
