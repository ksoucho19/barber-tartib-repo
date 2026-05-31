"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import type { Ticket } from "@/types"

interface TicketCardProps {
  ticket: Ticket
}

const statusConfig = {
  waiting: {
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    label: "في الانتظار",
    color: "text-amber-400",
    bg: "bg-amber-500/20",
    ring: "ring-amber-500/30",
  },
  active: {
    icon: (
      <motion.div
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      >
        <motion.svg
          className="h-8 w-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </motion.svg>
      </motion.div>
    ),
    label: "دورك الآن",
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    ring: "ring-emerald-500/30",
  },
  completed: {
    icon: (
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
      >
        <motion.svg
          className="h-8 w-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          <motion.polyline
            points="22 4 12 14.01 9 11.01"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.4, ease: "easeOut" }}
          />
        </motion.svg>
      </motion.div>
    ),
    label: "تمت الخدمة",
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    ring: "ring-emerald-500/30",
  },
  skipped: {
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    label: "تم التخطي",
    color: "text-red-400",
    bg: "bg-red-500/20",
    ring: "ring-red-500/30",
  },
  cancelled: {
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    label: "ملغية",
    color: "text-red-400",
    bg: "bg-red-500/20",
    ring: "ring-red-500/30",
  },
}

export function TicketCard({ ticket }: TicketCardProps) {
  const config = statusConfig[ticket.status] ?? statusConfig.waiting

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <Card className={`text-center ring-2 ${config.ring}`}>
        <CardContent className="p-8 space-y-4">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${config.bg} ${config.color}`}
          >
            {config.icon}
          </div>

          <div className="space-y-1">
            <p className="text-sm text-foreground/50">رقم التذكرة</p>
            <motion.p
              key={ticket.ticket_number}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-7xl font-bold tabular-nums leading-none tracking-tighter"
            >
              {ticket.ticket_number}
            </motion.p>
          </div>

          {ticket.status === "active" && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`text-lg font-semibold ${config.color}`}
            >
              {config.label}
            </motion.p>
          )}

          {ticket.status === "waiting" && (
            <p className="text-sm text-foreground/50">
              {ticket.position && ticket.position > 1
                ? `قبل دورك ${ticket.position - 1} أشخاص`
                : ticket.position === 1
                  ? "أنت التالي"
                  : "في الانتظار"}
            </p>
          )}

          {ticket.status === "completed" && (
            <p className="text-sm text-emerald-400/70">
              {config.label}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
