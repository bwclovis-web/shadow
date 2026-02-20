import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      // Add any external image domains if needed
    ],
  },
};

export default nextConfig;
