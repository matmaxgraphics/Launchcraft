import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Irys pulls in heavy Node-only dependencies; keep them out of the bundle and load them at runtime.
  serverExternalPackages: ["@irys/upload", "@irys/upload-solana"],
};

export default nextConfig;
