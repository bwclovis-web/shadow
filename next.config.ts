import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'galehayman.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'sites.create-cdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'mysterymodernmark.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-cebc143562244d6fbf277d0ab2b1d01e.r2.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scentsofwood.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn-content-oz2.storbie.com',
        pathname: '/**',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
