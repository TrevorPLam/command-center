'use client'

import * as React from 'react'
import { LoadingState } from './loading-state'
import { EmptyState } from './empty-state'
import { ErrorState, NetworkErrorState, OfflineState } from './error-state'

type PanelState = 'loading' | 'empty' | 'error' | 'offline' | 'success'

interface PanelStateWrapperProps {
  state: PanelState
  children: React.ReactNode
  loadingMessage?: string
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: {
    label: string
    onClick: () => void
  } | undefined
  errorTitle?: string
  errorMessage?: string
  error?: Error | string | undefined
  onRetry?: (() => void) | undefined
  className?: string
}

export function PanelStateWrapper({
  state,
  children,
  loadingMessage,
  emptyTitle,
  emptyDescription,
  emptyAction,
  errorTitle,
  errorMessage,
  error,
  onRetry,
  className,
}: PanelStateWrapperProps) {
  switch (state) {
    case 'loading':
      return (
        <div className={className}>
          <LoadingState message={loadingMessage || 'Loading...'} />
        </div>
      )
    
    case 'empty':
      return (
        <div className={className}>
          <EmptyState
            title={emptyTitle || 'No data available'}
            description={emptyDescription || 'There are no items to display here.'}
            action={emptyAction}
          />
        </div>
      )
    
    case 'error':
      if (errorMessage?.includes('fetch') || errorMessage?.includes('network')) {
        return (
          <div className={className}>
            <NetworkErrorState onRetry={onRetry} />
          </div>
        )
      }
      return (
        <div className={className}>
          <ErrorState
            title={errorTitle || 'Something went wrong'}
            message={errorMessage || 'An error occurred while loading this content.'}
            error={error || undefined}
            action={onRetry ? {
              label: 'Retry',
              onClick: onRetry,
            } : undefined}
          />
        </div>
      )
    
    case 'offline':
      return (
        <div className={className}>
          <OfflineState />
        </div>
      )
    
    case 'success':
      return <>{children}</>
    
    default:
      return <>{children}</>
  }
}

// Hook for managing panel state with error boundaries
export function usePanelState<T>(
  fetcher: () => Promise<T>,
  dependencies: React.DependencyList = []
) {
  const [state, setState] = React.useState<PanelState>('loading')
  const [data, setData] = React.useState<T | null>(null)
  const [error, setError] = React.useState<Error | string | null>(null)

  const execute = React.useCallback(async () => {
    try {
      setState('loading')
      setError(null)
      const result = await fetcher()
      setData(result)
      setState('success')
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err))
      setError(errorObj)
      setState('error')
    }
  }, [fetcher, ...dependencies])

  React.useEffect(() => {
    execute()
  }, [execute])

  const retry = React.useCallback(() => {
    execute()
  }, [execute])

  return {
    state,
    data,
    error,
    retry,
    execute,
  }
}
