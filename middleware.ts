import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CSRF_COOKIE_NAME = '_csrf'

/** Generate a CSRF token using Web Crypto (Edge-compatible). */
const generateCsrfToken = (): string => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    const accessToken = request.cookies.get('accessToken')?.value
    if (!accessToken) {
      return NextResponse.redirect(new URL('/sign-in', request.url))
    }
  }

  const response = NextResponse.next()

  // Issue CSRF cookie if missing (double-submit pattern; must be readable by client)
  if (!request.cookies.get(CSRF_COOKIE_NAME)) {
    response.cookies.set(CSRF_COOKIE_NAME, generateCsrfToken(), {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    })
  }

  return response
}

export const config = {
  matcher: [
    // Run on all routes except static assets so CSRF cookie is set on first page load
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}