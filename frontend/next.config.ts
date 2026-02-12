import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use frontend as Turbopack root to avoid lockfile detection from parent dirs
  turbopack: { root: "." },
};

export default nextConfig;
