'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/states/error-state'

export default function CommandCenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Command Center error:', error)
  }, [error])

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <ErrorState
        title="Application Error"
        description="The Command Center encountered an unexpected error. You can try refreshing the page or contact support if the problem persists."
        error={error}
        action={{
          label: 'Try Again',
          onClick: reset,
        }}
      />
    </div>
  )
}
