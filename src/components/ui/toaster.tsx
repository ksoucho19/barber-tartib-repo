"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Toast {
  id: string
  message: string
  type: "success" | "error" | "info"
}

let toastListeners: Array<(toast: Toast) => void> = []

export function toast(message: string, type: Toast["type"] = "info") {
  const id = Math.random().toString(36).slice(2)
  const t: Toast = { id, message, type }
  toastListeners.forEach((fn) => fn(t))
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((t: Toast) => {
    setToasts((prev) => [...prev, t])
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== t.id))
    }, 4000)
  }, [])

  useEffect(() => {
    toastListeners.push(addToast)
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== addToast)
    }
  }, [addToast])

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }

  const typeStyles = {
    success: "border-emerald-500/40 bg-emerald-500/10",
    error: "border-red-500/40 bg-red-500/10",
    info: "border-blue-500/40 bg-blue-500/10",
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 p-4 sm:items-end">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border px-5 py-4 backdrop-blur-2xl shadow-2xl ${typeStyles[t.type]}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex-1 text-sm font-medium leading-snug text-foreground/90">
              {t.message}
            </div>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/30 hover:text-foreground/60 transition-colors"
              aria-label="إغلاق"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
