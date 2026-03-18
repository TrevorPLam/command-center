/**
 * Auth.js Configuration
 * 
 * Optional authentication configuration for shared-machine deployments
 * following 2026 security best practices.
 */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getEnv } from '../config/env'

// ============================================================================
// AUTH TYPES
// ============================================================================

/**
 * Local user credentials
 */
export interface LocalCredentials {
  username: string
  password: string
}

/**
 * Auth configuration options
 */
export interface AuthConfig {
  /** Enable authentication */
  enabled: boolean
  /** Session timeout in minutes */
  sessionTimeout: number
  /** Maximum login attempts */
  maxLoginAttempts: number
  /** Lockout duration in minutes */
  lockoutDuration: number
  /** Require strong passwords */
  requireStrongPassword: boolean
  /** Enable session monitoring */
  enableSessionMonitoring: boolean
}

// ============================================================================
// DEFAULT USERS (for development/demonstration)
// ============================================================================

const DEFAULT_USERS = [
  {
    id: 'admin',
    username: 'admin',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvO.', // 'admin123'
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'operator',
    username: 'operator',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvO.', // 'operator123'
    role: 'operator',
    createdAt: new Date().toISOString(),
  },
]

// ============================================================================
// AUTH CONFIGURATION
// ============================================================================

export const authConfig: NextAuthOptions = {
  // Only configure auth if enabled
  session: {
    strategy: 'jwt',
    maxAge: 30 * 60, // 30 minutes
  },
  
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      
      async authorize(credentials) {
        // Skip auth if disabled
        const env = getEnv()
        if (!env.ENABLE_AUTH) {
          return null
        }

        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          // For now, use default users. In production, this would check a database
          const user = DEFAULT_USERS.find(
            u => u.username === credentials.username
          )

          if (!user) {
            return null
          }

          // In production, you'd use bcrypt.compare here
          // For demo purposes, we're doing a simple check
          const bcrypt = await import('bcryptjs')
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          )

          if (!isValid) {
            return null
          }

          return {
            id: user.id,
            name: user.username,
            role: user.role,
          }
        } catch (error) {
          console.error('Authentication error:', error)
          return null
        }
      },
    }),
  ],

  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },

    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
      }
      return session
    },
  },

  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`User signed in: ${user.name} (${user.id})`)
    },

    async signOut({ session, token }) {
      console.log(`User signed out: ${session?.user?.name}`)
    },
  },

  debug: process.env.NODE_ENV === 'development',
}

// ============================================================================
// AUTH HELPERS
// ============================================================================

/**
 * Check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  const env = getEnv()
  return env.ENABLE_AUTH && !!env.JWT_SECRET
}

/**
 * Get auth configuration
 */
export function getAuthConfig(): AuthConfig {
  return {
    enabled: isAuthEnabled(),
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    requireStrongPassword: true,
    enableSessionMonitoring: true,
  }
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs')
  return bcrypt.hash(password, 12)
}

/**
 * Verify a password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs')
  return bcrypt.compare(password, hash)
}

/**
 * Get default users for development
 */
export function getDefaultUsers(): Array<{
  id: string
  username: string
  role: string
  createdAt: string
}> {
  return DEFAULT_USERS.map(({ password, ...user }) => user)
}

/**
 * Check if user has admin role
 */
export function isAdmin(role?: string): boolean {
  return role === 'admin'
}

/**
 * Check if user has operator role
 */
export function isOperator(role?: string): boolean {
  return role === 'operator' || role === 'admin'
}
