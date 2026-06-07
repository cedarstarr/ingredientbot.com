'use client'

import { useState, createContext, useContext, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...opts, id }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  const dismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg bg-card text-card-foreground',
              t.variant === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground'
            )}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
