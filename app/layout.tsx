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
import { getUnreadDirectMessageCount } from '@/models/contactMessage.server'

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
  if (user?.id) {
    try {
      directMessageUnreadInitial = await getUnreadDirectMessageCount(user.id)
    } catch (error) {
      console.error("Failed to load unread message count:", error)
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
              <GlobalNavigation user={user} />
              <MobileNavigation user={user} />
              <Providers>{children}</Providers>
            </DirectMessageUnreadProvider>
          </NextIntlClientProvider>
          <div id="modal-portal" />
        </ViewTransitionsWrapper>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}