import type { Metadata, Viewport } from 'next'
import { Inter, Limelight } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import { Providers } from './providers'
import { ViewTransitionsWrapper } from './ViewTransitionsWrapper'
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import GlobalNavigation from '@/components/Molecules/GlobalNavigation/GlobalNavigation'
import { DirectMessageUnreadProvider } from '@/components/Molecules/DirectMessageUnread/DirectMessageUnreadProvider'
import MobileNavigation from '@/components/Molecules/MobileNavigation'
import ServiceWorkerRegistration from '@/components/Containers/ServiceWorkerRegistration'
import { getNewListingsThisWeekCount } from '@/models/activity-feed.server'
import { getUnreadDirectMessageCount } from '@/models/contactMessage.server'
import { getUnreadAlertCount, getUnreadTradeAlertCount, getUserAlerts } from '@/models/user-alerts.server'
import { TradeAlertUnreadProvider } from '@/components/Molecules/TradeAlertUnread/TradeAlertUnreadProvider'
import { UserAlertsProvider } from '@/components/Molecules/UserAlertsProvider/UserAlertsProvider'
import SiteFooter from '@/components/Organisms/SiteFooter/SiteFooter'
import OnboardingBannerSlot from '@/components/Onboarding/OnboardingBannerSlot'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans-loaded',
})
const limelight = Limelight({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-headline-loaded',
})

export const viewport: Viewport = {
  themeColor: '#c9a227',
}

export const metadata: Metadata = {
  title: 'Shadow and Sillage',
  description: 'Perfume trading platform',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Shadow and Sillage',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  const user = session?.user ?? null
  const locale = await getLocale()
  const messages = await getMessages()

  let directMessageUnreadInitial = 0
  let initialAlerts: Awaited<ReturnType<typeof getUserAlerts>> = []
  let initialAlertUnreadCount = 0
  let initialTradeAlertUnreadCount = 0
  let exchangeNewThisWeekCount = 0
  try {
    exchangeNewThisWeekCount = await getNewListingsThisWeekCount()
  } catch (error) {
    console.error("Failed to load exchange new listings count:", error)
  }
  if (user?.id) {
    try {
      directMessageUnreadInitial = await getUnreadDirectMessageCount(user.id)
    } catch (error) {
      console.error("Failed to load unread message count:", error)
    }
    try {
      const [alerts, unreadCount, tradeUnreadCount] = await Promise.all([
        getUserAlerts(user.id, 10),
        getUnreadAlertCount(user.id),
        getUnreadTradeAlertCount(user.id),
      ])
      initialAlerts = alerts ?? []
      initialAlertUnreadCount = unreadCount ?? 0
      initialTradeAlertUnreadCount = tradeUnreadCount ?? 0
    } catch (error) {
      console.error("Failed to load user alerts:", error)
    }
  }

  return (
    <html lang={locale} className={`${inter.variable} ${limelight.variable}`}>
      <body className={`${inter.className} bg-noir-black`}>
        <ViewTransitionsWrapper>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <DirectMessageUnreadProvider
              userId={user?.id}
              initialCount={directMessageUnreadInitial}
            >
              <TradeAlertUnreadProvider
                userId={user?.id}
                initialCount={initialTradeAlertUnreadCount}
              >
              <UserAlertsProvider
                userId={user?.id}
                initialAlerts={initialAlerts}
                initialUnreadCount={initialAlertUnreadCount}
              >
                <GlobalNavigation
                  user={user}
                  exchangeNewThisWeekCount={exchangeNewThisWeekCount}
                />
                <MobileNavigation
                  user={user}
                  exchangeNewThisWeekCount={exchangeNewThisWeekCount}
                />
                <Providers>
                  {user?.id ? <OnboardingBannerSlot userId={user.id} /> : null}
                  {children}
                  <SiteFooter />
                </Providers>
              </UserAlertsProvider>
              </TradeAlertUnreadProvider>
            </DirectMessageUnreadProvider>
          </NextIntlClientProvider>
          <div id="modal-portal" />
        </ViewTransitionsWrapper>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}