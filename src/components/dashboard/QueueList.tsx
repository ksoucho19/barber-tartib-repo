"use client"

import { AnimatePresence } from "framer-motion"
import { TicketRow } from "./TicketRow"
import { SkeletonCard } from "@/components/ui/skeleton"
import type { Ticket } from "@/types"

interface QueueListProps {
  tickets: Ticket[]
  loading: boolean
  onComplete: (ticketId: string) => void
  onSkip: (ticketId: string) => void
  onCancel: (ticketId: string) => void
}

export function QueueList({ tickets, loading, onComplete, onSkip, onCancel }: QueueListProps) {
  const waiting = tickets.filter((t) => t.status === "waiting" || t.status === "active")
  const sorted = [...waiting].sort((a, b) => {
    if (a.status === "active") return -1
    if (b.status === "active") return 1
    return (a.position ?? 0) - (b.position ?? 0)
  })

  if (loading && sorted.length === 0) {
    return (
      <div className="space-y-3" role="status" aria-label="جارٍ تحميل قائمة الانتظار">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16">
        <svg
          className="h-14 w-14 text-foreground/15 mb-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        <p className="text-xl font-semibold text-foreground/30">الطابور فارغ</p>
        <p className="mt-1 text-sm text-foreground/20">لا يوجد عملاء في قائمة الانتظار</p>
      </div>
    )
  }

  return (
    <div className="space-y-2" role="list" aria-label="قائمة الانتظار">
      <AnimatePresence mode="popLayout">
        {sorted.map((ticket, i) => (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            onComplete={onComplete}
            onSkip={onSkip}
            onCancel={onCancel}
            index={i}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
