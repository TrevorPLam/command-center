import type { Metadata } from 'next'
import { validateEnv } from '@/lib/config/env'
import { bootstrapRuntime } from '@/lib/config/runtime'
import '@/app/globals.css'

// Validate environment on app startup
const env = validateEnv()

// Bootstrap runtime services (will be available to Server Components)
const runtimeServices = await bootstrapRuntime()

export const metadata: Metadata = {
  title: 'Local AI Command Center',
  description: 'A local-first, panel-driven control surface for AI operations',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body className='antialiased'>{children}</body>
    </html>
  )
}
