'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { usePanelLayout, useSidebarCollapsed } from '@/stores/use-shell-store'
import { PanelSplitter } from './panel-splitter'

interface DashboardGridProps {
  children: React.ReactNode
  chat: React.ReactNode
  models: React.ReactNode
  rag: React.ReactNode
  agents: React.ReactNode
  monitoring: React.ReactNode
  prompts: React.ReactNode
  className?: string
}

export function DashboardGrid({
  children,
  chat,
  models,
  rag,
  agents,
  monitoring,
  prompts,
  className
}: DashboardGridProps) {
  const panelLayout = usePanelLayout()
  const sidebarCollapsed = useSidebarCollapsed()

  // Convert layout percentages to CSS grid template areas
  const gridTemplateAreas = React.useMemo(() => {
    return `
      "chat chat models"
      "chat chat rag"
      "chat chat agents"
      "chat chat monitoring"
      "chat chat prompts"
    `
  }, [])

  const gridTemplateColumns = React.useMemo(() => {
    const chatSize = panelLayout.chat.size
    const otherSize = (100 - chatSize) / 2
    return `${chatSize}% ${otherSize}% ${otherSize}%`
  }, [panelLayout])

  return (
    <div className={cn('flex h-full', className)}>
      {/* Main Grid Layout */}
      <div 
        className="flex-1 grid gap-1 p-1 overflow-hidden"
        style={{
          gridTemplateAreas,
          gridTemplateColumns,
          display: 'grid',
          gridTemplateRows: 'repeat(5, 1fr)',
        }}
      >
        {/* Chat Panel - Spans 2 columns, 5 rows */}
        <div 
          className="bg-card border border-border rounded-lg p-4 overflow-hidden"
          style={{ gridArea: 'chat' }}
        >
          {chat}
        </div>

        {/* Models Panel */}
        <div 
          className="bg-card border border-border rounded-lg p-4 overflow-hidden"
          style={{ gridArea: 'models' }}
        >
          {models}
        </div>

        {/* RAG Panel */}
        <div 
          className="bg-card border border-border rounded-lg p-4 overflow-hidden"
          style={{ gridArea: 'rag' }}
        >
          {rag}
        </div>

        {/* Agents Panel */}
        <div 
          className="bg-card border border-border rounded-lg p-4 overflow-hidden"
          style={{ gridArea: 'agents' }}
        >
          {agents}
        </div>

        {/* Monitoring Panel */}
        <div 
          className="bg-card border border-border rounded-lg p-4 overflow-hidden"
          style={{ gridArea: 'monitoring' }}
        >
          {monitoring}
        </div>

        {/* Prompts Panel */}
        <div 
          className="bg-card border border-border rounded-lg p-4 overflow-hidden"
          style={{ gridArea: 'prompts' }}
        >
          {prompts}
        </div>
      </div>

      {/* Panel Splitters */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Vertical splitter between chat and other panels */}
        <div 
          className="absolute top-1 bottom-1 pointer-events-auto"
          style={{ 
            left: `calc(${panelLayout.chat.size}% - 2px)`,
            width: '4px'
          }}
        >
          <PanelSplitter panel="chat" direction="horizontal" />
        </div>
      </div>
    </div>
  )
}
