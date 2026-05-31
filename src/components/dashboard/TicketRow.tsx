"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { EstimatedWaitBadge } from "@/components/wait-time/EstimatedWaitBadge"
import type { Ticket } from "@/types"

interface TicketRowProps {
  ticket: Ticket
  onComplete: (ticketId: string) => void
  onSkip: (ticketId: string) => void
  onCancel: (ticketId: string) => void
  index: number
}

const statusBadge: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "default" }> = {
  active: { label: "قيد الخدمة", variant: "success" },
  waiting: { label: "بالانتظار", variant: "warning" },
  completed: { label: "مكتمل", variant: "default" },
  skipped: { label: "تم التخطي", variant: "destructive" },
  cancelled: { label: "ملغي", variant: "destructive" },
}

function formatWaitTime(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "أقل من دقيقة"
  if (minutes < 60) return `${minutes} د`
  const hours = Math.floor(minutes / 60)
  return `${hours}س ${minutes % 60}د`
}

export function TicketRow({ ticket, onComplete, onSkip, onCancel, index }: TicketRowProps) {
  const isActive = ticket.status === "active"
  const isWaiting = ticket.status === "waiting"
  const badge = statusBadge[ticket.status] ?? statusBadge.waiting

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.03, type: "spring", stiffness: 250, damping: 22 }}
      className={cn(
        "group flex items-center gap-4 rounded-xl border bg-white/5 p-4 backdrop-blur-sm transition-all duration-200",
        isActive
          ? "border-emerald-500/40 bg-emerald-500/[0.06] ring-1 ring-emerald-500/20"
          : "border-white/10 hover:bg-white/[0.08]",
      )}
      role="listitem"
    >
      <div className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-bold tabular-nums",
        isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-foreground/70",
      )}>
        {ticket.ticket_number}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn(
          "text-sm font-medium truncate",
          isActive && "text-emerald-300",
        )}>
          {ticket.status === "active" ? "العميل الحالي" : `رقم ${ticket.ticket_number}`}
        </p>
        <p className="text-xs text-foreground/40 mt-0.5">
          {formatWaitTime(ticket.created_at)}
        </p>
        {ticket.status === "waiting" && ticket.estimated_wait_minutes !== undefined && (
          <EstimatedWaitBadge
            minutes={ticket.estimated_wait_minutes}
            compact
            className="mt-0.5"
          />
        )}
      </div>

      <Badge variant={badge.variant}>
        {badge.label}
      </Badge>

      <div className="flex items-center gap-1.5">
        {isWaiting && (
          <button
            type="button"
            onClick={() => onCancel(ticket.id)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            aria-label="إلغاء التذكرة"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        {isActive && (
          <>
            <button
              type="button"
              onClick={() => onComplete(ticket.id)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-400 hover:bg-emerald-500/15 transition-all duration-200"
              aria-label="إنهاء الخدمة"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onSkip(ticket.id)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-amber-400 hover:bg-amber-500/15 transition-all duration-200"
              aria-label="تخطي العميل"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" />
              </svg>
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}
