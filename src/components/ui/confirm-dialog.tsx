'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { Button } from './button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void
  onCancel?: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={handleConfirm}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hook for managing confirm dialogs
export function useConfirmDialog() {
  const [dialog, setDialog] = React.useState<{
    open: boolean
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: 'default' | 'destructive'
    onConfirm?: () => void
    onCancel?: () => void
  }>({
    open: false,
    title: '',
    description: '',
  })

  const confirm = React.useCallback((
    title: string,
    description: string,
    onConfirm: () => void,
    options?: {
      confirmText?: string
      cancelText?: string
      variant?: 'default' | 'destructive'
      onCancel?: () => void
    }
  ) => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        open: true,
        title,
        description,
        confirmText: options?.confirmText || 'Confirm',
        cancelText: options?.cancelText || 'Cancel',
        variant: options?.variant || 'default',
        onConfirm: () => {
          onConfirm()
          resolve(true)
        },
        onCancel: () => {
          options?.onCancel?.()
          resolve(false)
        },
      })
    })
  }, [])

  const ConfirmDialogComponent = React.useCallback(() => {
    if (!dialog.onConfirm || !dialog.onCancel) return null

    return (
      <ConfirmDialog
        open={dialog.open}
        onOpenChange={(open) => {
          if (!open) {
            dialog.onCancel?.()
            setDialog(prev => ({ ...prev, open: false }))
          }
        }}
        title={dialog.title}
        description={dialog.description}
        confirmText={dialog.confirmText || 'Confirm'}
        cancelText={dialog.cancelText || 'Cancel'}
        variant={dialog.variant || 'default'}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />
    )
  }, [dialog])

  return { confirm, ConfirmDialog: ConfirmDialogComponent }
}
