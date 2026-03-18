/**
 * Auth.js API Route
 * 
 * NextAuth.js handler for authentication endpoints
 */

import NextAuth from 'next-auth'
import { authConfig, isAuthEnabled } from '../../../lib/app/auth/auth-config'

// Export the NextAuth handler
const handler = NextAuth(authConfig)

export { handler as GET, handler as POST }

// Only enable auth if configured properly
export async function GET(req: Request) {
  if (!isAuthEnabled()) {
    return Response.json(
      { error: 'Authentication is disabled' },
      { status: 404 }
    )
  }
  
  return handler(req)
}

export async function POST(req: Request) {
  if (!isAuthEnabled()) {
    return Response.json(
      { error: 'Authentication is disabled' },
      { status: 404 }
    )
  }
  
  return handler(req)
}
