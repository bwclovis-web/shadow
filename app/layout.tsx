import type { Metadata } from 'next'
import { Inter, Limelight } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { cookies } from "next/headers"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import GlobalNavigation from '@/components/Molecules/GlobalNavigation/GlobalNavigation'

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
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
    const session = await getSessionFromCookieHeader(cookieHeader, {
      includeUser: true,
    })
  const user = session?.user ?? null

  return (
    <html lang="en" className={`${inter.variable} ${limelight.variable}`}>
      <body className={inter.className}>
        <GlobalNavigation user={user} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}