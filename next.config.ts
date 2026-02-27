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
    ],
  },
}

export default withNextIntl(nextConfig)
