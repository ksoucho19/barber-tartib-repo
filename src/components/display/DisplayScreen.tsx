"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createDisplayClient } from "@/lib/supabase/client"
import { EstimatedWaitBadge } from "@/components/wait-time/EstimatedWaitBadge"
import { predictWaitTime } from "@/lib/wait-time"
import type { SupabaseClient } from "@supabase/supabase-js"

interface DisplayScreenProps {
  slug: string
  businessName: string
}

interface DisplayTicket {
  id: string
  ticket_number: number
  customer_name: string
  status: string
  position: number | null
}

const MAX_RETRIES = 3
const RETRY_DELAY = 2000

function fetchToken(slug: string): Promise<{ token: string; business_id: string }> {
  return fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_LINK}/functions/v1/create-display-token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    },
  ).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(
        (body as { error?: string }).error ?? "فشل الحصول على رمز العرض",
      )
    }
    return res.json() as Promise<{ token: string; business_id: string }>
  })
}

export function DisplayScreen({
  slug,
  businessName,
}: DisplayScreenProps) {
  const [activeTicket, setActiveTicket] = useState<DisplayTicket | null>(null)
  const [waitingTickets, setWaitingTickets] = useState<DisplayTicket[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reconnecting, setReconnecting] = useState(false)
  const [waitPredictions, setWaitPredictions] = useState<Record<string, number>>({})
  const [queueId, setQueueId] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)

  const channelRef = useRef<ReturnType<SupabaseClient["channel"]> | null>(null)
  const retryCountRef = useRef(0)
  const mountedRef = useRef(true)
  const predictIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshPredictions = useCallback(async () => {
    if (!queueId || !businessId) return
    const ticketsToPredict = (activeTicket
      ? [activeTicket, ...waitingTickets.slice(0, 9)]
      : waitingTickets.slice(0, 10)
    ).filter((t) => t.status === "waiting" || t.status === "active")

    const promises = ticketsToPredict.map(async (t) => {
      try {
        const minutes = await predictWaitTime(
          businessId,
          Math.max(1, t.position ?? 1),
          queueId,
        )
        return { id: t.id, minutes }
      } catch {
        return { id: t.id, minutes: 0 }
      }
    })

    const results = await Promise.all(promises)
    const map: Record<string, number> = {}
    for (const r of results) {
      map[r.id] = r.minutes
    }
    if (mountedRef.current) {
      setWaitPredictions(map)
    }
  }, [queueId, businessId, activeTicket, waitingTickets])

  const connect = useCallback(async () => {
    setError(null)
    setReconnecting(true)
    setLoading(true)

    try {
      const { token, business_id } = await fetchToken(slug)
      const client = createDisplayClient(token)
      setBusinessId(business_id)

      const { data: queues } = await client
        .from("queues")
        .select("id")
        .eq("business_id", business_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)

      const activeQueueId = queues?.[0]?.id ?? null
      setQueueId(activeQueueId)

      const { data: initialTickets, error: fetchError } = await client
        .from("tickets")
        .select("id, ticket_number, customer_name, status, position")
        .in("status", ["waiting", "active"])
        .order("ticket_number", { ascending: true })

      if (fetchError) throw fetchError

      if (initialTickets && mountedRef.current) {
        setLoading(false)
        const active = initialTickets.find(
          (t: DisplayTicket) => t.status === "active",
        ) ?? null
        const waiting = initialTickets.filter(
          (t: DisplayTicket) => t.status === "waiting",
        )

        setActiveTicket(active)
        setWaitingTickets(waiting)
      }

      if (activeQueueId) {
        refreshPredictions()
      }

      const channel = client
        .channel("display-queue")
        .on(
          "postgres_changes" as never,
          {
            event: "*",
            schema: "public",
            table: "tickets",
            filter: `business_id=eq.${business_id}`,
          },
          (payload: { eventType: string; new: DisplayTicket; old: DisplayTicket }) => {
            if (!mountedRef.current) return

            if (payload.eventType === "INSERT") {
              const t = payload.new as DisplayTicket
              if (t.status === "waiting") {
                setWaitingTickets((prev) => [...prev, t])
              }
            }

            if (payload.eventType === "UPDATE") {
              const t = payload.new as DisplayTicket
              if (t.status === "active") {
                setActiveTicket(t)
                setWaitingTickets((prev) =>
                  prev.filter((x) => x.id !== t.id),
                )
              } else if (t.status === "waiting") {
                setWaitingTickets((prev) => {
                  const exists = prev.some((x) => x.id === t.id)
                  if (exists) {
                    return prev.map((x) => (x.id === t.id ? t : x))
                  }
                  return [...prev, t]
                })
                if (activeTicket?.id === t.id) {
                  setActiveTicket(null)
                }
              } else {
                setActiveTicket((prev) =>
                  prev?.id === t.id ? null : prev,
                )
                setWaitingTickets((prev) =>
                  prev.filter((x) => x.id !== t.id),
                )
              }
            }

            if (payload.eventType === "DELETE") {
              const t = payload.old as DisplayTicket
              setActiveTicket((prev) =>
                prev?.id === t.id ? null : prev,
              )
              setWaitingTickets((prev) =>
                prev.filter((x) => x.id !== t.id),
              )
            }
          },
        )
        .subscribe((status) => {
          if (!mountedRef.current) return
          if (status === "SUBSCRIBED") {
            setReconnecting(false)
            retryCountRef.current = 0
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setReconnecting(true)
          }
        })

      channelRef.current = channel
      retryCountRef.current = 0
    } catch (err) {
      if (!mountedRef.current) return
      retryCountRef.current++

      if (retryCountRef.current < MAX_RETRIES) {
        setTimeout(() => {
          if (mountedRef.current) connect()
        }, RETRY_DELAY * retryCountRef.current)
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "تعذر الاتصال. يرجى التحقق من الرابط.",
        )
        setReconnecting(false)
        setLoading(false)
      }
    }
  }, [slug, refreshPredictions])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
      retryCountRef.current = 0
    }
  }, [connect])

  useEffect(() => {
    if (queueId && businessId) {
      predictIntervalRef.current = setInterval(refreshPredictions, 30000)
    }
    return () => {
      if (predictIntervalRef.current) {
        clearInterval(predictIntervalRef.current)
      }
    }
  }, [queueId, businessId, refreshPredictions])

  useEffect(() => {
    if (queueId && businessId) {
      refreshPredictions()
    }
  }, [waitingTickets.length, activeTicket?.id, queueId, businessId, refreshPredictions])

  const nextTickets = waitingTickets.slice(0, 10)

  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col bg-[#0a0a0f] text-white overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[160px]" />
        <div className="absolute bottom-1/3 right-1/4 h-64 w-64 rounded-full bg-primary/5 blur-[128px]" />
      </div>

      <header className="relative z-10 border-b border-white/5 px-8 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            {businessName}
          </h1>
          <svg
            className="h-7 w-7 text-emerald-400/60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
      </header>

      {loading && !error && (
        <div className="relative z-10 flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-foreground/30">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
            <p className="text-lg font-medium">جارٍ الاتصال…</p>
          </div>
        </div>
      )}

      {reconnecting && !error && !loading && (
        <div className="relative z-10 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-300">
          جارٍ إعادة الاتصال…
        </div>
      )}

      {error && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-4">
          <svg
            className="h-16 w-16 text-red-400/30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <p className="text-lg text-red-300">{error}</p>
          <button
            type="button"
            onClick={connect}
            className="rounded-xl border border-white/10 bg-white/5 px-6 py-2 text-sm text-foreground/60 transition-colors hover:bg-white/10"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-8 py-8">
          {activeTicket ? (
            <div className="flex w-full flex-col items-center gap-12">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-3xl animate-pulse" />
                <div className="relative flex h-56 w-56 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-emerald-500/[0.06]">
                  <span className="font-bold tabular-nums leading-none tracking-tighter text-emerald-400"
                        style={{ fontSize: "clamp(4rem, 8vw, 8rem)" }}>
                    {String(activeTicket.ticket_number).padStart(2, "0")}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-3xl font-medium text-emerald-300">
                  {activeTicket.customer_name}
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <span className="inline-block h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xl font-semibold text-emerald-400/80">
                    دورك الآن
                  </span>
                </div>
              </div>
            </div>
          ) : nextTickets.length > 0 ? (
            <div className="text-center">
              <p className="text-lg text-foreground/40 mb-8">قريباً</p>
              <p className="text-7xl font-bold tabular-nums leading-none tracking-tighter text-emerald-400/70">
                {String(nextTickets[0].ticket_number).padStart(2, "0")}
              </p>
              <p className="mt-4 text-xl text-foreground/50">
                {nextTickets[0].customer_name}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-foreground/30">
              <svg
                className="h-20 w-20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              <p className="text-3xl font-semibold">الطابور فارغ</p>
              <p className="text-lg">لا يوجد عملاء في قائمة الانتظار حالياً</p>
            </div>
          )}
        </div>
      )}

      {!loading && !error && nextTickets.length > 0 && (
        <footer className="relative z-10 border-t border-white/5 px-8 py-6">
          <div className="mx-auto max-w-5xl">
            <p className="mb-4 text-center text-sm text-foreground/30 tracking-wider">
              التالي
            </p>
            <div className="flex flex-wrap justify-center gap-4" dir="rtl">
              {nextTickets.map((t, i) => (
                <div
                  key={t.id}
                  className={`flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 backdrop-blur-sm ${
                    i === 0 && !activeTicket
                      ? "ring-1 ring-emerald-500/30"
                      : ""
                  }`}
                >
                  <span className="text-3xl font-bold tabular-nums text-foreground/80">
                    {String(t.ticket_number).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-sm text-foreground/40">
                    {t.customer_name}
                  </span>
                  {waitPredictions[t.id] !== undefined && (
                    <EstimatedWaitBadge
                      minutes={waitPredictions[t.id]}
                      compact
                      className="mt-1"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </footer>
      )}
    </main>
  )
}
