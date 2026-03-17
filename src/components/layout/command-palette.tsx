'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useShellStore } from '@/stores/use-shell-store'

interface CommandItem {
  id: string
  title: string
  description?: string
  icon?: React.ReactNode
  shortcut?: string
  category: 'panel' | 'action' | 'settings'
  action: () => void
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const setActivePanel = useShellStore((state) => state.setActivePanel)

  const commands: CommandItem[] = React.useMemo(() => [
    // Panel Navigation
    {
      id: 'chat',
      title: 'Chat',
      description: 'Open chat panel',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      shortcut: '⌘1',
      category: 'panel',
      action: () => {
        setActivePanel('chat')
        setIsOpen(false)
      },
    },
    {
      id: 'models',
      title: 'Models',
      description: 'Open models panel',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
      shortcut: '⌘2',
      category: 'panel',
      action: () => {
        setActivePanel('models')
        setIsOpen(false)
      },
    },
    {
      id: 'rag',
      title: 'RAG',
      description: 'Open RAG panel',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      ),
      shortcut: '⌘3',
      category: 'panel',
      action: () => {
        setActivePanel('rag')
        setIsOpen(false)
      },
    },
    {
      id: 'agents',
      title: 'Agents',
      description: 'Open agents panel',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-8z" />
          <path d="M6 12a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H6z" />
        </svg>
      ),
      shortcut: '⌘4',
      category: 'panel',
      action: () => {
        setActivePanel('agents')
        setIsOpen(false)
      },
    },
    {
      id: 'monitoring',
      title: 'Monitoring',
      description: 'Open monitoring panel',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
      shortcut: '⌘5',
      category: 'panel',
      action: () => {
        setActivePanel('monitoring')
        setIsOpen(false)
      },
    },
    {
      id: 'prompts',
      title: 'Prompts',
      description: 'Open prompts panel',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
      shortcut: '⌘6',
      category: 'panel',
      action: () => {
        setActivePanel('prompts')
        setIsOpen(false)
      },
    },
    // Actions
    {
      id: 'new-chat',
      title: 'New Chat',
      description: 'Start a new conversation',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
      category: 'action',
      action: () => {
        // TODO: Implement new chat functionality
        console.log('New chat action')
        setIsOpen(false)
      },
    },
    {
      id: 'upload-docs',
      title: 'Upload Documents',
      description: 'Upload documents to RAG index',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
      category: 'action',
      action: () => {
        // TODO: Implement upload functionality
        console.log('Upload documents action')
        setIsOpen(false)
      },
    },
    // Settings
    {
      id: 'settings',
      title: 'Settings',
      description: 'Open application settings',
      icon: (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-.89 1.66l-.06.04a2 2 0 0 1-2.1-.07l-.15-.1a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 .07 2.1l-.04.06a2 2 0 0 1-1.66.89H2a2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2h.18a2 2 0 0 1 1.66.89l.04.06a2 2 0 0 1-.07 2.1l-.15.1a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.1a2 2 0 0 1 2.1.07l.06.04a2 2 0 0 1 .89 1.66V22a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 .89-1.66l.06-.04a2 2 0 0 1 2.1.07l.15.1a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-.07-2.1l.04-.06a2 2 0 0 1 1.66-.89H22a2 2 0 0 0 2-2v-.44a2 2 0 0 0-2-2h-.18a2 2 0 0 1-1.66-.89l-.04-.06a2 2 0 0 1 .07-2.1l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.1a2 2 0 0 1-2.1-.07l-.06-.04a2 2 0 0 1-.89-1.66V2a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      category: 'settings',
      action: () => {
        // TODO: Implement settings functionality
        console.log('Settings action')
        setIsOpen(false)
      },
    },
  ], [setActivePanel])

  const filteredCommands = React.useMemo(() => {
    if (!search) return commands
    
    const lowerSearch = search.toLowerCase()
    return commands.filter(command =>
      command.title.toLowerCase().includes(lowerSearch) ||
      command.description?.toLowerCase().includes(lowerSearch)
    )
  }, [commands, search])

  const groupedCommands = React.useMemo(() => {
    const groups = filteredCommands.reduce((acc, command) => {
      const category = command.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(command)
      return acc
    }, {} as Record<string, CommandItem[]>)
    
    return groups
  }, [filteredCommands])

  const open = React.useCallback(() => {
    setIsOpen(true)
    setSearch('')
    setSelectedIndex(0)
  }, [])

  const close = React.useCallback(() => {
    setIsOpen(false)
    setSearch('')
    setSelectedIndex(0)
  }, [])

  const executeCommand = React.useCallback((command: CommandItem) => {
    command.action()
  }, [])

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        open()
      }
      
      if (e.key === 'Escape' && isOpen) {
        close()
      }
      
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % filteredCommands.length)
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex])
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, open, close, filteredCommands, selectedIndex, executeCommand])

  // Focus input when opened
  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-lg mx-4">
        <div className="border border-border bg-card rounded-lg shadow-lg">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search for panels, actions, or settings..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSelectedIndex(0)
              }}
              className="flex-1 bg-background border-0 outline-none text-foreground placeholder:text-muted-foreground"
            />
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {Object.entries(groupedCommands).map(([category, categoryCommands]) => (
              <div key={category} className="p-2">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground capitalize">
                  {category}
                </div>
                <div className="space-y-1">
                  {categoryCommands.map((command, index) => {
                    const globalIndex = filteredCommands.indexOf(command)
                    const isSelected = globalIndex === selectedIndex
                    
                    return (
                      <button
                        key={command.id}
                        className={cn(
                          'w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm text-left',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        )}
                        onClick={() => executeCommand(command)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        {command.icon && (
                          <span className="flex-shrink-0 w-4 h-4">
                            {command.icon}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{command.title}</div>
                          {command.description && (
                            <div className="text-xs opacity-70 truncate">
                              {command.description}
                            </div>
                          )}
                        </div>
                        {command.shortcut && (
                          <kbd className="flex-shrink-0 text-xs bg-muted px-2 py-1 rounded opacity-70">
                            {command.shortcut}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            
            {filteredCommands.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No commands found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
