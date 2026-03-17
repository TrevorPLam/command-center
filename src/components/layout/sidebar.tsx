'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useActivePanel, useSidebarCollapsed, useShellStore } from '@/stores/use-shell-store'
import { StatusIndicator } from '@/components/ui/status-indicator'

interface SidebarItemProps {
  href: string
  panel: 'chat' | 'models' | 'rag' | 'agents' | 'monitoring' | 'prompts'
  label: string
  icon?: React.ReactNode
  badge?: string | number
}

function SidebarItem({ href, panel, label, icon, badge }: SidebarItemProps) {
  const pathname = usePathname()
  const activePanel = useActivePanel()
  const setActivePanel = useShellStore((state) => state.setActivePanel)
  const sidebarCollapsed = useSidebarCollapsed()

  const isActive = activePanel === panel

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        sidebarCollapsed && 'justify-center'
      )}
      onClick={() => setActivePanel(panel)}
    >
      {icon && (
        <span className={cn('flex-shrink-0', sidebarCollapsed && 'mx-auto')}>
          {icon}
        </span>
      )}
      {!sidebarCollapsed && (
        <>
          <span className="flex-1">{label}</span>
          {badge && (
            <span className="flex-shrink-0 bg-muted text-muted-foreground px-2 py-0.5 rounded text-xs">
              {badge}
            </span>
          )}
        </>
      )}
      {sidebarCollapsed && badge && (
        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {typeof badge === 'number' && badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}

export function Sidebar() {
  const sidebarCollapsed = useSidebarCollapsed()
  const toggleSidebar = useShellStore((state) => state.toggleSidebar)

  // Mock data for badges - in real app this would come from stores
  const badges = {
    chat: 3,
    models: 2,
    rag: null,
    agents: 1,
    monitoring: null,
    prompts: 5,
  }

  return (
    <aside className={cn(
      'flex h-full flex-col border-r border-border bg-card transition-all duration-300',
      sidebarCollapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!sidebarCollapsed && (
            <h2 className="text-lg font-semibold text-foreground">Command Center</h2>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={cn(
                'transition-transform',
                sidebarCollapsed ? 'rotate-180' : ''
              )}
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
              <path d="M13 5l-5 5 5 5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        <SidebarItem
          href="/command-center"
          panel="chat"
          label="Chat"
          icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
          badge={badges.chat}
        />
        <SidebarItem
          href="/command-center/models"
          panel="models"
          label="Models"
          icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          }
          badge={badges.models}
        />
        <SidebarItem
          href="/command-center/rag"
          panel="rag"
          label="RAG"
          icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          }
        />
        <SidebarItem
          href="/command-center/agents"
          panel="agents"
          label="Agents"
          icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-8z" />
              <path d="M6 12a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H6z" />
            </svg>
          }
          badge={badges.agents}
        />
        <SidebarItem
          href="/command-center/monitoring"
          panel="monitoring"
          label="Monitoring"
          icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
        />
        <SidebarItem
          href="/command-center/prompts"
          panel="prompts"
          label="Prompts"
          icon={
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          }
          badge={badges.prompts}
        />
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <StatusIndicator status="online" />
          {!sidebarCollapsed && (
            <span className="text-xs text-muted-foreground">System Online</span>
          )}
        </div>
      </div>
    </aside>
  )
}
