"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface QuickStatsProps {
  waitingCount: number
  activeCount: number
  completedToday: number
}

const stats = [
  {
    key: "waiting",
    label: "في الانتظار",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    color: "text-amber-400",
    bg: "bg-amber-500/20",
    ring: "ring-amber-500/30",
  },
  {
    key: "active",
    label: "قيد الخدمة",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    ring: "ring-emerald-500/30",
  },
  {
    key: "completed",
    label: "مكتمل اليوم",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    color: "text-blue-400",
    bg: "bg-blue-500/20",
    ring: "ring-blue-500/30",
  },
]

export function QuickStats({ waitingCount, activeCount, completedToday }: QuickStatsProps) {
  const values: Record<string, number> = {
    waiting: waitingCount,
    active: activeCount,
    completed: completedToday,
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.key}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 200, damping: 20 }}
          className={cn(
            "glass rounded-2xl p-5 ring-1",
            stat.ring,
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", stat.bg, stat.color)}>
              {stat.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider">
                {stat.label}
              </p>
              <motion.p
                key={values[stat.key]}
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={cn("text-3xl font-bold tabular-nums mt-0.5", stat.color)}
              >
                {values[stat.key]}
              </motion.p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
