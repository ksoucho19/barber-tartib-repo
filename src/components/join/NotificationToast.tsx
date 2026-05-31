"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface NotificationToastProps {
  message: string
  type: "info" | "warning" | "success"
  visible: boolean
  onClose: () => void
}

const typeStyles: Record<
  string,
  { border: string; bg: string; iconBg: string }
> = {
  warning: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    iconBg: "bg-amber-500/20",
  },
  info: {
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    iconBg: "bg-blue-500/20",
  },
  success: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    iconBg: "bg-emerald-500/20",
  },
}

function TypeIcon({ type }: { type: string }) {
  if (type === "warning") {
    return (
      <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  }
  if (type === "success") {
    return (
      <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    )
  }
  return (
    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

export function NotificationToast({
  message,
  type,
  visible,
  onClose,
}: NotificationToastProps) {
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [visible, onClose])

  const style = typeStyles[type] ?? typeStyles.info

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={`pointer-events-auto w-full rounded-2xl border ${style.border} ${style.bg} backdrop-blur-2xl shadow-2xl`}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-3 px-5 py-4">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.iconBg}`}
            >
              <TypeIcon type={type} />
            </div>
            <p className="text-sm font-medium leading-snug text-foreground/90">
              {message}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mr-auto flex h-6 w-6 items-center justify-center rounded-full text-foreground/30 hover:text-foreground/60 transition-colors"
              aria-label="إغلاق الإشعار"
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
