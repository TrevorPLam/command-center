import * as React from 'react'
import { cn } from '@/lib/utils'

interface StatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: 'online' | 'offline' | 'busy' | 'error'
}

const StatusIndicator = React.forwardRef<
  HTMLDivElement,
  StatusIndicatorProps
>(({ className, status = 'offline', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'status-indicator',
      {
        'status-online': status === 'online',
        'status-offline': status === 'offline',
        'status-busy': status === 'busy',
        'status-error': status === 'error',
      },
      className
    )}
    {...props}
  />
))
StatusIndicator.displayName = 'StatusIndicator'

export { StatusIndicator }
