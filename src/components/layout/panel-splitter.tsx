'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { usePanelLayoutItem, useShellStore } from '@/stores/use-shell-store'

interface PanelSplitterProps {
  panel: 'chat' | 'models' | 'rag' | 'agents' | 'monitoring' | 'prompts'
  direction?: 'horizontal' | 'vertical'
  minSize?: number
  maxSize?: number
  className?: string
}

export function PanelSplitter({ 
  panel, 
  direction = 'horizontal', 
  minSize = 10, 
  maxSize = 80,
  className 
}: PanelSplitterProps) {
  const panelLayout = usePanelLayoutItem(panel)
  const setPanelSize = useShellStore((state) => state.setPanelSize)
  const [isDragging, setIsDragging] = React.useState(false)
  const splitterRef = React.useRef<HTMLDivElement>(null)

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!splitterRef.current) return
      
      const rect = splitterRef.current.parentElement?.getBoundingClientRect()
      if (!rect) return
      
      let newSize: number
      
      if (direction === 'horizontal') {
        newSize = ((moveEvent.clientX - rect.left) / rect.width) * 100
      } else {
        newSize = ((moveEvent.clientY - rect.top) / rect.height) * 100
      }
      
      newSize = Math.max(minSize, Math.min(maxSize, newSize))
      setPanelSize(panel, newSize)
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [direction, minSize, maxSize, panel, setPanelSize])

  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false)
    }
    
    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp)
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging])

  return (
    <div
      ref={splitterRef}
      className={cn(
        'bg-border hover:bg-primary/20 transition-colors',
        direction === 'horizontal' 
          ? 'w-1 h-full cursor-col-resize' 
          : 'h-1 w-full cursor-row-resize',
        isDragging && 'bg-primary/40',
        className
      )}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation={direction}
      aria-label={`Resize ${panel} panel`}
    />
  )
}
