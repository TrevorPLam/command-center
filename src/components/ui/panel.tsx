import * as React from 'react'
import { cn } from '@/lib/utils'

const Panel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('panel', className)}
    {...props}
  />
))
Panel.displayName = 'Panel'

const PanelHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('panel-header', className)}
    {...props}
  />
))
PanelHeader.displayName = 'PanelHeader'

const PanelTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('panel-title', className)}
    {...props}
  />
))
PanelTitle.displayName = 'PanelTitle'

const PanelContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-1', className)}
    {...props}
  />
))
PanelContent.displayName = 'PanelContent'

export { Panel, PanelHeader, PanelTitle, PanelContent }
