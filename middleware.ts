/**
 * Authentication Middleware
 * 
 * Middleware to protect routes when authentication is enabled
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAuthEnabled } from './lib/app/auth/auth-config'

export async function middleware(request: NextRequest) {
  // Skip auth checks if authentication is disabled
  if (!isAuthEnabled()) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  // Allow access to auth pages and API routes
  if (
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  try {
    // Get the token from the request
    const token = await getToken({ 
      req: request, 
      secret: process.env.JWT_SECRET 
    })

    // If no token, redirect to login
    if (!token) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Token exists, allow access
    return NextResponse.next()
  } catch (error) {
    console.error('Middleware auth error:', error)
    
    // On error, redirect to login for safety
    const loginUrl = new URL('/auth/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth (auth pages)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|auth).*)',
  ],
}
