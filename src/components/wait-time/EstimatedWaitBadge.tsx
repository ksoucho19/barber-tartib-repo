"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface EstimatedWaitBadgeProps {
  minutes: number
  className?: string
  compact?: boolean
}

export function EstimatedWaitBadge({
  minutes,
  className,
  compact = false,
}: EstimatedWaitBadgeProps) {
  return (
    <motion.span
      key={minutes}
      initial={{ scale: 1.2, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        compact ? "text-xs" : "text-sm",
        minutes <= 2
          ? "text-emerald-400"
          : minutes <= 10
            ? "text-amber-400"
            : "text-foreground/50",
        className,
      )}
      title="الوقت المتوقع للانتظار"
    >
      <svg
        className={compact ? "h-3 w-3" : "h-3.5 w-3.5"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <motion.span
        key={minutes}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        ~{minutes}
      </motion.span>
      <span className={compact ? "text-[10px]" : "text-xs"}>د</span>
    </motion.span>
  )
}
