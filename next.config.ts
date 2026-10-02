import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // NOTE: do not list @irys/* under serverExternalPackages. Turbopack then renames each one to a hash-suffixed alias
  // (e.g. "@irys/upload-21a5a1…") that only exists as a link inside .next/node_modules; on Vercel those links are not
  // preserved, so /api/upload crashed on load with an empty 500. Letting the bundler include them avoids that.
};

export default nextConfig;
