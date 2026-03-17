import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type PanelName = 'chat' | 'models' | 'rag' | 'agents' | 'monitoring' | 'prompts'

type ShellState = {
  // Active panel for focus
  activePanel: PanelName
  
  // Panel layout configuration
  panelLayout: {
    chat: { size: number; position: { x: number; y: number } }
    models: { size: number; position: { x: number; y: number } }
    rag: { size: number; position: { x: number; y: number } }
    agents: { size: number; position: { x: number; y: number } }
    monitoring: { size: number; position: { x: number; y: number } }
    prompts: { size: number; position: { x: number; y: number } }
  }
  
  // Sidebar state
  sidebarCollapsed: boolean
  
  // Theme preference
  theme: 'light' | 'dark' | 'system'
  
  // Actions
  setActivePanel: (panel: PanelName) => void
  setPanelSize: (panel: PanelName, size: number) => void
  setPanelPosition: (panel: PanelName, position: { x: number; y: number }) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  
  // Reset to defaults
  resetLayout: () => void
}

const defaultPanelLayout = {
  chat: { size: 50, position: { x: 0, y: 0 } },
  models: { size: 25, position: { x: 50, y: 0 } },
  rag: { size: 25, position: { x: 75, y: 0 } },
  agents: { size: 25, position: { x: 50, y: 50 } },
  monitoring: { size: 25, position: { x: 75, y: 50 } },
  prompts: { size: 25, position: { x: 0, y: 50 } },
}

export const useShellStore = create<ShellState>()(
  persist(
    (set, get) => ({
      // Initial state
      activePanel: 'chat',
      panelLayout: defaultPanelLayout,
      sidebarCollapsed: false,
      theme: 'system',
      
      // Actions
      setActivePanel: (panel) => set({ activePanel: panel }),
      
      setPanelSize: (panel, size) => 
        set((state) => ({
          panelLayout: {
            ...state.panelLayout,
            [panel]: {
              ...state.panelLayout[panel],
              size: Math.max(10, Math.min(80, size)), // Clamp between 10% and 80%
            },
          },
        })),
      
      setPanelPosition: (panel, position) =>
        set((state) => ({
          panelLayout: {
            ...state.panelLayout,
            [panel]: {
              ...state.panelLayout[panel],
              position,
            },
          },
        })),
      
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      setTheme: (theme) => set({ theme }),
      
      resetLayout: () => ({
        activePanel: 'chat',
        panelLayout: defaultPanelLayout,
        sidebarCollapsed: false,
        theme: 'system',
      }),
    }),
    {
      name: 'command-center-shell-storage',
      version: 1,
      // Only persist the fields we want to save
      partialize: (state) => ({
        activePanel: state.activePanel,
        panelLayout: state.panelLayout,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
      // Migration function for future changes
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Migration from version 0 to 1
          return {
            ...persistedState,
            panelLayout: defaultPanelLayout,
          }
        }
        return persistedState
      },
    }
  )
)

// Selectors for optimized re-renders
export const useActivePanel = () => useShellStore((state) => state.activePanel)
export const usePanelLayout = () => useShellStore((state) => state.panelLayout)
export const useSidebarCollapsed = () => useShellStore((state) => state.sidebarCollapsed)
export const useTheme = () => useShellStore((state) => state.theme)

// Hook for getting a specific panel's layout
export const usePanelLayoutItem = (panel: PanelName) => 
  useShellStore((state) => state.panelLayout[panel])
