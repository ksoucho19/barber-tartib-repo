"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useInstallPrompt } from "@/hooks/use-install-prompt"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface InstallButtonProps {
  className?: string
  variant?: "default" | "compact"
}

export function InstallButton({
  className,
  variant = "default",
}: InstallButtonProps) {
  const { canInstall, install } = useInstallPrompt()
  const [installing, setInstalling] = useState(false)

  if (!canInstall) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {variant === "compact" ? (
          <button
            disabled={installing}
            onClick={async () => {
              setInstalling(true)
              await install()
              setInstalling(false)
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 backdrop-blur-xl transition-all hover:bg-emerald-500/20 active:scale-95",
              className,
            )}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {installing ? "جاري التثبيت…" : "تثبيت التطبيق"}
          </button>
        ) : (
          <Button
            disabled={installing}
            onClick={async () => {
              setInstalling(true)
              await install()
              setInstalling(false)
            }}
            className={cn("gap-2", className)}
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {installing ? "جاري التثبيت…" : "تثبيت التطبيق"}
          </Button>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
