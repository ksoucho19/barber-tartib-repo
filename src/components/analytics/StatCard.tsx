"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  bg: string
  ring: string
  index?: number
}

export function StatCard({
  label,
  value,
  icon,
  color,
  bg,
  ring,
  index = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.06,
        type: "spring",
        stiffness: 200,
        damping: 20,
      }}
      className={cn(
        "glass rounded-2xl p-5 ring-1 hover:brightness-110 transition-all duration-200",
        ring,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            bg,
            color,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider">
            {label}
          </p>
          <motion.p
            key={String(value)}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={cn("mt-0.5 text-2xl font-bold tabular-nums", color)}
          >
            {value}
          </motion.p>
        </div>
      </div>
    </motion.div>
  )
}
