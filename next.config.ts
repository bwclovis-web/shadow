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
      // Add any external image domains if needed
    ],
  },
}

export default withNextIntl(nextConfig)
