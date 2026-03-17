import * as React from 'react'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  description?: string
  message?: string
  error?: Error | string | undefined
  action?: {
    label: string
    onClick: () => void
  } | undefined
  icon?: React.ReactNode
  className?: string
}

export function ErrorState({ 
  title = 'Something went wrong', 
  description = 'An error occurred while loading this content.',
  message,
  error,
  action,
  className 
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error

  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      <div className="mb-4 text-destructive">
        <svg
          className="w-12 h-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-muted-foreground mb-4 max-w-md">
        {message || description}
      </p>
      {errorMessage && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive font-mono break-all">
            {errorMessage}
          </p>
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[200px] flex items-center justify-center">
      <ErrorState
        title="Component Error"
        message="This component encountered an error and could not be rendered."
        action={{
          label: 'Retry',
          onClick: () => window.location.reload(),
        }}
      />
    </div>
  )
}

export function NetworkErrorState({ onRetry }: { onRetry?: (() => void) | undefined }) {
  return (
    <ErrorState
      title="Network Error"
      message="Unable to connect to the server. Please check your connection and try again."
      action={onRetry ? {
        label: 'Retry',
        onClick: onRetry,
      } : undefined}
    />
  )
}

export function OfflineState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 text-muted-foreground">
        <svg
          className="w-12 h-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Offline Mode
      </h3>
      <p className="text-muted-foreground mb-4 max-w-md">
        You're currently offline. Some features may not be available until you reconnect.
      </p>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        <span>Attempting to reconnect...</span>
      </div>
    </div>
  )
}

export function ServiceUnavailableState({ serviceName }: { serviceName: string }) {
  return (
    <ErrorState
      title={`${serviceName} Unavailable`}
      message={`The ${serviceName} service is currently not responding. Please check if the service is running and try again.`}
      action={{
        label: 'Retry',
        onClick: () => window.location.reload(),
      }}
    />
  )
}
