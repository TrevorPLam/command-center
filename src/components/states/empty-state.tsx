import * as React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  } | undefined
  className?: string
}

export function EmptyState({ 
  title = 'No data available', 
  description = 'There are no items to display here.',
  icon,
  action,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-muted-foreground mb-4 max-w-md">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export function EmptyStateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-12 h-12', className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  )
}

export function EmptyChatState() {
  return (
    <EmptyState
      title="No conversations yet"
      description="Start a new conversation to begin chatting with the AI assistant."
      icon={
        <svg
          className="w-12 h-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      }
      action={{
        label: 'Start New Chat',
        onClick: () => console.log('Start new chat'),
      }}
    />
  )
}

export function EmptyModelsState() {
  return (
    <EmptyState
      title="No models installed"
      description="Pull your first AI model to get started with local inference."
      icon={
        <svg
          className="w-12 h-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      }
      action={{
        label: 'Pull Model',
        onClick: () => console.log('Pull model'),
      }}
    />
  )
}

export function EmptyDocumentsState() {
  return (
    <EmptyState
      title="No documents indexed"
      description="Upload documents to enable RAG (Retrieval-Augmented Generation) capabilities."
      icon={
        <svg
          className="w-12 h-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      }
      action={{
        label: 'Upload Documents',
        onClick: () => console.log('Upload documents'),
      }}
    />
  )
}

export function EmptyAgentsState() {
  return (
    <EmptyState
      title="No agents configured"
      description="Create AI agents to automate tasks and workflows."
      icon={
        <svg
          className="w-12 h-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
      }
      action={{
        label: 'Create Agent',
        onClick: () => console.log('Create agent'),
      }}
    />
  )
}
