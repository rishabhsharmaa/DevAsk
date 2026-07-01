import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * shiki uses Node.js APIs (fs, path) for loading language grammars.
   * Must be externalized to prevent bundling issues in server components.
   */
  serverExternalPackages: ['shiki'],

  /**
   * Allow images from GitHub avatars and other sources.
   */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },
};

export default nextConfig;
