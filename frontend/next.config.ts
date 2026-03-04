import type { NextConfig } from "next";
import path from "path";

// Monorepo root (parent of frontend) – required for outputFileTracingRoot + turbopack alignment on Vercel
const monorepoRoot = path.resolve(process.cwd(), "..");

const nextConfig: NextConfig = {
  // Align both roots to monorepo for Turbopack + output file tracing (required on Vercel)
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
};

export default nextConfig;
