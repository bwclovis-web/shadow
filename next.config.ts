import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const nextConfig: NextConfig = {
  transpilePackages: ["next-sanity"],
  serverExternalPackages: ["@prisma/client", "prisma"],
  experimental: {
    viewTransition: true,
    // Softer navigations: reuse prefetched RSC payloads briefly instead of always showing loading UI.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
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
        hostname: 'flagcdn.com',
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
      {
        protocol: 'https',
        hostname: 'basenotes.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.xerjoff.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'theduabrand.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.theduabrand.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com https://cdn.sanity.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
