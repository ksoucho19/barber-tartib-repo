"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQueueStore } from "@/stores/use-queue-store"
import { useBusinessStore } from "@/stores/use-business-store"
import { QueueProvider } from "@/components/providers/queue-provider"
import { QuickStats } from "./QuickStats"
import { QueueList } from "./QueueList"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { SkeletonStatCard } from "@/components/ui/skeleton"
import { PageTransition } from "@/components/layout/PageTransition"

function DashboardInner({ businessId: _businessId }: { businessId: string }) {
  const supabase = createClient()

  const tickets = useQueueStore((s) => s.tickets)
  const loading = useQueueStore((s) => s.loading)
  const estimatedWaitTimes = useQueueStore((s) => s.estimatedWaitTimes)
  const fetchInitialTickets = useQueueStore((s) => s.fetchInitialTickets)
  const updateEstimatedTimes = useQueueStore((s) => s.updateEstimatedTimes)
  const closeQueue = useQueueStore((s) => s.unsubscribe)

  const business = useBusinessStore((s) => s.business)
  const fetchCurrentBusiness = useBusinessStore(
    (s) => s.fetchCurrentBusiness,
  )

  const [queueId, setQueueId] = useState<string | null>(null)
  const [completedToday, setCompletedToday] = useState(0)
  const [calling, setCalling] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<{
    action: "skip" | "cancel"
    ticketId: string
  } | null>(null)

  useEffect(() => {
    fetchCurrentBusiness()
  }, [fetchCurrentBusiness])

  useEffect(() => {
    fetchInitialTickets(_businessId)
  }, [_businessId, fetchInitialTickets])

  useEffect(() => {
    supabase
      .from("queues")
      .select("id")
      .eq("business_id", _businessId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setQueueId(data.id)
      })
  }, [_businessId, supabase])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("business_id", _businessId)
      .eq("status", "completed")
      .gte("created_at", today)
      .lt("created_at", today + "T23:59:59.999Z")
      .then(({ count }) => {
        if (count !== null) setCompletedToday(count)
      })
  }, [_businessId, supabase])

  useEffect(() => {
    if (!queueId) return

    const doUpdate = async () => {
      await updateEstimatedTimes(_businessId, queueId)
    }

    doUpdate()
    const interval = setInterval(doUpdate, 60000)

    return () => clearInterval(interval)
  }, [_businessId, queueId, updateEstimatedTimes])

  const ticketsWithEstimates = tickets.map((t) => ({
    ...t,
    estimated_wait_minutes: estimatedWaitTimes[t.id],
  }))

  const waitingTickets = ticketsWithEstimates.filter((t) => t.status === "waiting")
  const activeTicket = ticketsWithEstimates.find((t) => t.status === "active") ?? null
  const waitingCount = waitingTickets.length
  const activeCount = activeTicket ? 1 : 0

  useEffect(() => {
    return () => { closeQueue() }
  }, [closeQueue])

  const handleCallNext = useCallback(async () => {
    if (!queueId) {
      toast("لا يوجد طابور نشط", "error")
      return
    }

    setCalling(true)
    const { error } = await supabase.rpc("call_next_customer", {
      p_queue_id: queueId,
    })

    if (error) {
      toast(error.message, "error")
    } else {
      toast("تم استدعاء العميل التالي", "success")
    }
    setCalling(false)
  }, [queueId, supabase])

  const handleComplete = useCallback(
    async (ticketId: string) => {
      const { error } = await supabase.rpc("complete_service", {
        p_ticket_id: ticketId,
      })
      if (error) {
        toast(error.message, "error")
      } else {
        toast("تم إنهاء الخدمة", "success")
      }
    },
    [supabase],
  )

  const handleSkip = useCallback(async () => {
    if (!confirmTarget || confirmTarget.action !== "skip") return
    const ticketId = confirmTarget.ticketId
    setConfirmTarget(null)

    const { error } = await supabase.rpc("skip_customer", {
      p_ticket_id: ticketId,
    })
    if (error) {
      toast(error.message, "error")
    } else {
      toast("تم تخطي العميل", "info")
    }
  }, [confirmTarget, supabase])

  const handleCancel = useCallback(async () => {
    if (!confirmTarget || confirmTarget.action !== "cancel") return
    const ticketId = confirmTarget.ticketId
    setConfirmTarget(null)

    const { error } = await supabase.rpc("cancel_ticket", {
      p_ticket_id: ticketId,
    })
    if (error) {
      toast(error.message, "error")
    } else {
      toast("تم إلغاء التذكرة", "info")
    }
  }, [confirmTarget, supabase])

  return (
    <PageTransition>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم</h1>
          <p className="mt-0.5 text-sm text-foreground/50">
            {business?.name ?? "جاري التحميل…"}
          </p>
        </div>
      </div>

      <section className="mb-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </div>
        ) : (
          <QuickStats
            waitingCount={waitingCount}
            activeCount={activeCount}
            completedToday={completedToday}
          />
        )}
      </section>

      <section className="mb-6">
        <Button
          onClick={handleCallNext}
          disabled={calling || waitingCount === 0 || !!activeTicket}
          size="lg"
          className="h-12 w-full bg-emerald-600 text-base shadow-lg shadow-emerald-500/25 hover:bg-emerald-500 disabled:opacity-40"
          aria-label={activeTicket ? "يوجد عميل قيد الخدمة حالياً" : waitingCount === 0 ? "لا يوجد عملاء في الانتظار" : "استدعاء العميل التالي"}
        >
          {calling ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              جارٍ الاستدعاء…
            </span>
          ) : activeTicket ? (
            "يوجد عميل قيد الخدمة حالياً"
          ) : waitingCount === 0 ? (
            "لا يوجد عملاء في الانتظار"
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" />
              </svg>
              استدعاء العميل التالي
            </span>
          )}
        </Button>
      </section>

      {activeTicket && (
        <section className="mb-6">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5 ring-1 ring-emerald-500/15">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
                  <span className="text-2xl font-bold text-emerald-400">
                    {activeTicket.ticket_number}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-foreground/50">العميل الحالي</p>
                  <p className="text-lg font-semibold text-emerald-300">
                    رقم {activeTicket.ticket_number}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleComplete(activeTicket.id)}
                  className="bg-emerald-600/80 hover:bg-emerald-600 text-white"
                >
                  <span className="flex items-center gap-1.5">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    إنهاء الخدمة
                  </span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setConfirmTarget({
                      action: "skip",
                      ticketId: activeTicket.id,
                    })
                  }
                  className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                >
                  تخطي
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">قائمة الانتظار</h2>
          <span className="text-sm text-foreground/40" role="status">
            {waitingCount} عميل
          </span>
        </div>
        <QueueList
          tickets={ticketsWithEstimates}
          loading={loading}
          onComplete={handleComplete}
          onSkip={(ticketId) =>
            setConfirmTarget({ action: "skip", ticketId })
          }
          onCancel={(ticketId) =>
            setConfirmTarget({ action: "cancel", ticketId })
          }
        />
      </section>

      <Dialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmTarget?.action === "skip"
                ? "تأكيد تخطي العميل"
                : "تأكيد إلغاء التذكرة"}
            </DialogTitle>
            <DialogDescription>
              {confirmTarget?.action === "skip"
                ? "سيتم تخطي العميل الحالي ونقله إلى قائمة المتخطين. هذا الإجراء لا يمكن التراجع عنه."
                : "سيتم إلغاء التذكرة وإزالتها من قائمة الانتظار. هذا الإجراء لا يمكن التراجع عنه."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmTarget(null)}
            >
              تراجع
            </Button>
            <Button
              variant={
                confirmTarget?.action === "skip" ? "secondary" : "default"
              }
              onClick={
                confirmTarget?.action === "skip"
                  ? handleSkip
                  : handleCancel
              }
              className={
                confirmTarget?.action === "skip"
                  ? "bg-amber-600/80 hover:bg-amber-600 text-white"
                  : "bg-red-600/80 hover:bg-red-600 text-white"
              }
            >
              {confirmTarget?.action === "skip" ? "تخطي" : "إلغاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}

export function DashboardPageContent({ businessId }: { businessId: string }) {
  return (
    <QueueProvider businessId={businessId}>
      <DashboardInner businessId={businessId} />
    </QueueProvider>
  )
}
