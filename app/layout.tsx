import type { Metadata } from 'next'
import { Inter, Limelight } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import { Providers } from './providers'
import { ViewTransitionsWrapper } from './ViewTransitionsWrapper'
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import GlobalNavigation from '@/components/Molecules/GlobalNavigation/GlobalNavigation'
import MobileNavigation from '@/components/Molecules/MobileNavigation'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans-loaded',
})
const limelight = Limelight({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-headline-loaded',
})

export const metadata: Metadata = {
  title: 'New Smell',
  description: 'Perfume trading platform',
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

  return (
    <html lang={locale} className={`${inter.variable} ${limelight.variable}`}>
      <body className={`${inter.className} bg-noir-black`}>
        <ViewTransitionsWrapper>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <GlobalNavigation user={user} />
            <MobileNavigation user={user} />
            <Providers>{children}</Providers>
          </NextIntlClientProvider>
          <div id="modal-portal" />
        </ViewTransitionsWrapper>
      </body>
    </html>
  )
}