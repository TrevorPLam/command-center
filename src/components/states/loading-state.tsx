import * as React from 'react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  message?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingState({ message = 'Loading...', className, size = 'md' }: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  return (
    <div className={cn('flex flex-col items-center justify-center p-8', className)}>
      <div className="relative">
        <div className={cn('animate-spin rounded-full border-2 border-primary border-t-transparent', sizeClasses[size])} />
      </div>
      {message && (
        <p className={cn('mt-4 text-muted-foreground', textSizes[size])}>
          {message}
        </p>
      )}
    </div>
  )
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse', className)}>
      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
      <div className="h-4 bg-muted rounded w-5/6"></div>
    </div>
  )
}

export function LoadingCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <div className="animate-pulse space-y-3">
        <div className="h-6 bg-muted rounded w-1/3"></div>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
        </div>
      </div>
    </div>
  )
}
