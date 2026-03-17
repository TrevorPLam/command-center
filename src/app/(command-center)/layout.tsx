import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { CommandPalette } from '@/components/layout/command-palette'

export default function CommandCenterLayout({
  children,
  chat,
  models,
  rag,
  agents,
  monitoring,
  prompts,
}: {
  children: ReactNode
  chat: ReactNode
  models: ReactNode
  rag: ReactNode
  agents: ReactNode
  monitoring: ReactNode
  prompts: ReactNode
}) {
  return (
    <div className="flex h-screen bg-background flex-col">
      {/* Topbar */}
      <Topbar />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full grid grid-cols-1 grid-rows-2 gap-1 p-1 lg:grid-cols-3 lg:grid-rows-5">
            {/* Chat Panel - Spans 2 columns, 5 rows */}
            <div className="col-span-1 row-span-5 lg:col-span-2 lg:row-span-5">
              {chat}
            </div>

            {/* Models Panel */}
            <div className="col-span-1 row-span-1 lg:col-span-1 lg:row-span-1">
              {models}
            </div>

            {/* RAG Panel */}
            <div className="col-span-1 row-span-1 lg:col-span-1 lg:row-span-1">
              {rag}
            </div>

            {/* Agents Panel */}
            <div className="col-span-1 row-span-1 lg:col-span-1 lg:row-span-1">
              {agents}
            </div>

            {/* Monitoring Panel */}
            <div className="col-span-1 row-span-1 lg:col-span-1 lg:row-span-1">
              {monitoring}
            </div>

            {/* Prompts Panel */}
            <div className="col-span-1 row-span-1 lg:col-span-1 lg:row-span-1">
              {prompts}
            </div>
          </div>
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette />
    </div>
  )
}
