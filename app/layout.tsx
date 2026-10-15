import type { Metadata, Viewport } from 'next'
import { Inter, Cormorant_Garamond } from 'next/font/google'
import { cookies } from 'next/headers'
import Script from 'next/script'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Providers } from './providers'
import { ViewTransitionsWrapper } from './ViewTransitionsWrapper'
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import GlobalNavigation from '@/components/Molecules/GlobalNavigation/GlobalNavigation'
import MobileNavigation from '@/components/Molecules/MobileNavigation'
import MobileBottomNavigation from '@/components/Molecules/MobileBottomNavigation/MobileBottomNavigation'
import { ActivityPing } from '@/components/Molecules/ActivityPing'
import ServiceWorkerRegistration from '@/components/Containers/ServiceWorkerRegistration'
import { getNewListingsThisWeekCount } from '@/models/activity-feed.server'
import { ExchangeNewListingsBadgeProvider } from '@/components/Molecules/ExchangeNewListingsBadge/ExchangeNewListingsBadgeProvider'
import { UserAlertsProvider } from '@/components/Molecules/UserAlertsProvider/UserAlertsProvider'
import SiteFooter from '@/components/Organisms/SiteFooter/SiteFooter'
import OnboardingBannerSlot from '@/components/Containers/Onboarding/OnboardingBannerSlot'
import { getSiteUrl } from '@/lib/seo/site-url'
import {
  buildSiteOrganizationJsonLd,
  buildWebSiteJsonLd,
} from '@/lib/seo/json-ld'
import {
  getAdSenseClientId,
  isAdSenseEnabled,
} from '@/utils/ads/should-show-ads'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans-loaded',
})
const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-headline-loaded',
})

export const viewport: Viewport = {
  themeColor: '#c9a227',
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "perfumer's hollow",
    template: "%s | perfumer's hollow",
  },
  description:
    "Explore perfume notes, fragrance houses, and community reviews — then trade and swap decants and samples on the perfumer's hollow exchange.",
  openGraph: {
    siteName: "perfumer's hollow",
    type: "website",
    images: [{ url: "/images/new/home.webp" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/new/home.webp"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "perfumer's hollow",
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieHeader = await getCookieHeader()
  const cookieStore = await cookies()
  const hasRefreshToken = Boolean(cookieStore.get("refreshToken")?.value)
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  const user = session?.user ?? null
  const locale = await getLocale()
  const messages = await getMessages()
  const adsenseClientId = getAdSenseClientId()
  const adsenseEnabled = isAdSenseEnabled()

  let exchangeNewThisWeekCount = 0
  try {
    exchangeNewThisWeekCount = await getNewListingsThisWeekCount()
  } catch (error) {
    console.error("Failed to load exchange new listings count:", error)
  }

  return (
    <html lang={locale} className={`${inter.variable} ${cormorantGaramond.variable}`}>
      <body className={`${inter.className} bg-noir-black`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildSiteOrganizationJsonLd()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildWebSiteJsonLd()),
          }}
        />
        {adsenseEnabled && adsenseClientId ? (
          <Script
            id="google-adsense"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        ) : null}
        <ViewTransitionsWrapper>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <UserAlertsProvider userId={user?.id}>
              <ExchangeNewListingsBadgeProvider
                initialCount={exchangeNewThisWeekCount}
              >
              <GlobalNavigation user={user} />
              <MobileNavigation user={user} />
              <MobileBottomNavigation user={user} />
              <ActivityPing userId={user?.id} />
              <Providers enableTokenRefresh={hasRefreshToken}>
                {user?.id ? <OnboardingBannerSlot userId={user.id} /> : null}
                {children}
                <SiteFooter />
              </Providers>
              </ExchangeNewListingsBadgeProvider>
            </UserAlertsProvider>
          </NextIntlClientProvider>
          <div id="modal-portal" />
        </ViewTransitionsWrapper>
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  )
}
