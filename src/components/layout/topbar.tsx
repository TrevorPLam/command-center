'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useTheme, useShellStore } from '@/stores/use-shell-store'
import { StatusIndicator } from '@/components/ui/status-indicator'

export function Topbar() {
  const theme = useTheme()
  const setTheme = useShellStore((state) => state.setTheme)
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false)

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')
  }

  const openCommandPalette = React.useCallback(() => {
    setCommandPaletteOpen(true)
  }, [])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openCommandPalette()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openCommandPalette])

  return (
    <>
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground">Command Center</h1>
          <div className="flex items-center gap-2">
            <StatusIndicator status="online" />
            <span className="text-sm text-muted-foreground">All systems operational</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Command Palette Button */}
          <button
            onClick={openCommandPalette}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span className="text-muted-foreground">Search...</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-md border border-border p-2 hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' && (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
            {theme === 'dark' && (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
            {theme === 'system' && (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            )}
          </button>

          {/* Settings */}
          <button
            className="rounded-md border border-border p-2 hover:bg-accent transition-colors"
            aria-label="Settings"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-.89 1.66l-.06.04a2 2 0 0 1-2.1-.07l-.15-.1a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 .07 2.1l-.04.06a2 2 0 0 1-1.66.89H2a2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2h.18a2 2 0 0 1 1.66.89l.04.06a2 2 0 0 1-.07 2.1l-.15.1a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.1a2 2 0 0 1 2.1.07l.06.04a2 2 0 0 1 .89 1.66V22a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 .89-1.66l.06-.04a2 2 0 0 1 2.1.07l.15.1a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-.07-2.1l.04-.06a2 2 0 0 1 1.66-.89H22a2 2 0 0 0 2-2v-.44a2 2 0 0 0-2-2h-.18a2 2 0 0 1-1.66-.89l-.04-.06a2 2 0 0 1 .07-2.1l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.1a2 2 0 0 1-2.1-.07l-.06-.04a2 2 0 0 1-.89-1.66V2a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </header>

      {/* Command Palette Modal */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setCommandPaletteOpen(false)} />
          <div className="relative w-full max-w-lg mx-4">
            <div className="border border-border bg-card rounded-lg shadow-lg">
              <div className="flex items-center gap-2 border-b border-border p-4">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search for panels, actions, or settings..."
                  className="flex-1 bg-background border-0 outline-none text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ESC
                </kbd>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Panels</div>
                  <div className="space-y-1">
                    <button className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>Chat</span>
                      <kbd className="ml-auto text-xs bg-muted px-2 py-1 rounded">⌘1</kbd>
                    </button>
                    <button className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                      </svg>
                      <span>Models</span>
                      <kbd className="ml-auto text-xs bg-muted px-2 py-1 rounded">⌘2</kbd>
                    </button>
                  </div>
                </div>
                
                <div className="p-2 border-t border-border">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Actions</div>
                  <div className="space-y-1">
                    <button className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span>New Chat</span>
                    </button>
                    <button className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>Upload Documents</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
