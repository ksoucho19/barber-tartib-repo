"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient, createCustomerClient } from "@/lib/supabase/client"
import { useQueueStore } from "@/stores/use-queue-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { TicketCard } from "./TicketCard"
import { NotificationToast } from "./NotificationToast"
import { useTicketNotifications } from "@/hooks/use-ticket-notifications"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { EstimatedWaitBadge } from "@/components/wait-time/EstimatedWaitBadge"
import { motion, AnimatePresence } from "framer-motion"

type PageState = "FORM" | "TRACKING"

interface JoinQueueClientProps {
  business: {
    id: string
    name: string
    slug: string
    settings: { default_service_duration_minutes?: number } | null
    queueId: string | null
  }
}

const LS_TOKEN_KEY = "dourak_public_token"
const LS_JWT_KEY = "dourak_customer_jwt"

export function JoinQueueClient({ business }: JoinQueueClientProps) {
  const [pageState, setPageState] = useState<PageState>("FORM")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null)
  const [currentPublicToken, setCurrentPublicToken] = useState<string | null>(null)

  const subscribeToCustomerTicket = useQueueStore(
    (s) => s.subscribeToCustomerTicket,
  )
  const activeTicket = useQueueStore((s) => s.activeTicket)

  const tryResume = useCallback(async () => {
    const storedToken = localStorage.getItem(LS_TOKEN_KEY)
    const storedJwt = localStorage.getItem(LS_JWT_KEY)
    if (!storedToken || !storedJwt) return false

    const supabase = createClient()
    const { data } = await supabase.rpc("get_ticket_by_token", {
      p_token: storedToken,
    })

    if (data && data.length > 0) {
      const ticket = data[0]
      if (ticket.status === "waiting" || ticket.status === "active") {
        const client = createCustomerClient(storedJwt)
        subscribeToCustomerTicket(storedToken, client)
        setCurrentTicketId(ticket.id)
        setCurrentPublicToken(storedToken)
        setPageState("TRACKING")
        return true
      }
    }

    localStorage.removeItem(LS_TOKEN_KEY)
    localStorage.removeItem(LS_JWT_KEY)
    return false
  }, [subscribeToCustomerTicket])

  useEffect(() => {
    tryResume()
  }, [tryResume])

  async function handleJoin() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("يرجى إدخال الاسم")
      return
    }

    if (!business.queueId) {
      setError("الطابور مغلق حالياً")
      return
    }

    setLoading(true)
    setError("")

    try {
      const supabase = createClient()

      const { data: joinData, error: joinError } = await supabase.rpc(
        "join_queue",
        {
          p_slug: business.slug,
          p_name: trimmedName,
          p_phone: phone.trim() || null,
        },
      )

      if (joinError) {
        if (joinError.message.includes("No active queue")) {
          setError("الطابور مغلق حالياً")
        } else {
          setError(joinError.message)
        }
        setLoading(false)
        return
      }

      const result = joinData as {
        ticket_id: string
        ticket_number: number
        public_token: string
        position: number
      }

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke("create-customer-token", {
        body: { public_token: result.public_token },
      })

      if (tokenError) {
        throw new Error(tokenError.message)
      }

      const { token } = tokenData as { token: string }

      localStorage.setItem(LS_TOKEN_KEY, result.public_token)
      localStorage.setItem(LS_JWT_KEY, token)

      const customerClient = createCustomerClient(token)
      subscribeToCustomerTicket(result.public_token, customerClient)

      setCurrentTicketId(result.ticket_id)
      setCurrentPublicToken(result.public_token)
      setPageState("TRACKING")
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "حدث خطأ غير متوقع",
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    const unsub = useQueueStore.getState().unsubscribe
    unsub()
    localStorage.removeItem(LS_TOKEN_KEY)
    localStorage.removeItem(LS_JWT_KEY)
    setPageState("FORM")
    setError("")
  }

  const { notification, clearNotification } =
    useTicketNotifications(activeTicket, 15)
  const currentPosition = activeTicket?.position ?? 0

  const [predictedWait, setPredictedWait] = useState<number | null>(null)
  const predictedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  )

  const updatePrediction = useCallback(async () => {
    if (!activeTicket || activeTicket.status !== "waiting") {
      setPredictedWait(null)
      return
    }
    const supabase = createClient()
    const { data, error } = await supabase.rpc("predict_wait_time", {
      p_business_id: business.id,
      p_position: Math.max(1, activeTicket.position ?? 1),
      p_queue_id: business.queueId,
    })
    if (!error && data !== null) {
      setPredictedWait(data as number)
    }
  }, [activeTicket, business.id, business.queueId])

  useEffect(() => {
    updatePrediction()

    predictedIntervalRef.current = setInterval(updatePrediction, 30000)

    return () => {
      if (predictedIntervalRef.current) {
        clearInterval(predictedIntervalRef.current)
      }
    }
  }, [updatePrediction])

  useEffect(() => {
    if (activeTicket?.status !== "waiting") {
      setPredictedWait(null)
      if (predictedIntervalRef.current) {
        clearInterval(predictedIntervalRef.current)
        predictedIntervalRef.current = null
      }
    }
  }, [activeTicket?.status])

  const {
    isSubscribed,
    isSupported: pushSupported,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications({
    publicToken: currentPublicToken ?? "",
    ticketId: currentTicketId ?? "",
  })

  const [pushStatus, setPushStatus] = useState<
    "idle" | "loading" | "subscribed"
  >("idle")

  useEffect(() => {
    if (isSubscribed) setPushStatus("subscribed")
    else if (!isSubscribed && pushStatus !== "idle" && pushStatus !== "loading")
      setPushStatus("idle")
  }, [isSubscribed, pushStatus])

  async function handleTogglePush() {
    if (pushStatus === "subscribed") {
      const result = await unsubscribePush()
      if (result === "unsubscribed") setPushStatus("idle")
    } else {
      setPushStatus("loading")
      const result = await subscribePush()
      if (result === "subscribed" || result === "already") {
        setPushStatus("subscribed")
      } else {
        setPushStatus("idle")
      }
    }
  }

  if (pageState === "TRACKING") {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f] px-4 py-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-primary/10 blur-[128px]" />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-center p-4">
          <NotificationToast
            message={notification?.message ?? ""}
            type={notification?.type ?? "info"}
            visible={notification !== null}
            onClose={clearNotification}
          />
        </div>

        <div className="flex w-full max-w-md flex-col items-center gap-6">
          <p className="text-lg font-medium text-foreground/60">
            {business.name}
          </p>

          <AnimatePresence mode="wait">
            {activeTicket ? (
              <motion.div
                key={activeTicket.id + activeTicket.status}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <TicketCard ticket={activeTicket} />
              </motion.div>
            ) : (
              <Card className="w-full text-center animate-pulse">
                <CardContent className="p-8 space-y-4">
                  <div className="mx-auto h-20 w-20 rounded-full bg-white/10" />
                  <div className="mx-auto h-8 w-24 rounded bg-white/10" />
                  <div className="mx-auto h-4 w-32 rounded bg-white/5" />
                </CardContent>
              </Card>
            )}
          </AnimatePresence>

          {activeTicket?.status === "waiting" && (
            <Card className="w-full text-center">
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-sm text-foreground/50">
                    الأشخاص أمامك
                  </p>
                  <motion.p
                    key={currentPosition}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-5xl font-bold tabular-nums text-emerald-400"
                  >
                    {Math.max(0, currentPosition - 1)}
                  </motion.p>
                </div>

                <div>
                  <p className="text-sm text-foreground/50">
                    الوقت المتوقع
                  </p>
                  <p className="mt-1 flex items-center justify-center gap-1">
                    {predictedWait !== null ? (
                      <EstimatedWaitBadge
                        minutes={predictedWait}
                        className="text-2xl"
                      />
                    ) : (
                      <svg
                        className="h-5 w-5 animate-spin text-foreground/30"
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
                    )}
                  </p>
                </div>

                {predictedWait !== null && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-primary"
                      initial={{ width: "100%" }}
                      animate={{ width: "20%" }}
                      transition={{
                        duration: predictedWait * 60,
                        ease: "linear",
                      }}
                    />
                  </div>
                )}

                <p className="text-sm text-foreground/40">في الانتظار…</p>

                {pushSupported && currentTicketId && (
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={pushStatus === "loading"}
                      onClick={handleTogglePush}
                      className="touch-target mx-auto flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-all duration-200 active:scale-95 disabled:opacity-50"
                      style={{
                        borderColor:
                          pushStatus === "subscribed"
                            ? "rgba(52,211,153,0.3)"
                            : "rgba(255,255,255,0.1)",
                        backgroundColor:
                          pushStatus === "subscribed"
                            ? "rgba(52,211,153,0.08)"
                            : "rgba(255,255,255,0.03)",
                      }}
                      aria-label={
                        pushStatus === "subscribed"
                          ? "إلغاء تفعيل الإشعارات"
                          : "تفعيل الإشعارات"
                      }
                    >
                      {pushStatus === "loading" ? (
                        <svg
                          className="h-4 w-4 animate-spin text-foreground/50"
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
                      ) : (
                        <svg
                          className={`h-4 w-4 ${
                            pushStatus === "subscribed"
                              ? "text-emerald-400"
                              : "text-foreground/40"
                          }`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                      )}
                      <span
                        className={
                          pushStatus === "subscribed"
                            ? "text-emerald-400"
                            : "text-foreground/50"
                        }
                      >
                        {pushStatus === "loading"
                          ? "جارٍ التفعيل…"
                          : pushStatus === "subscribed"
                            ? "الإشعارات مفعلة"
                            : "تفعيل الإشعارات"}
                      </span>
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTicket?.status === "active" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-full"
            >
              <Card className="w-full text-center ring-2 ring-emerald-500/50">
                <CardContent className="space-y-5 p-8">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
                    <motion.span
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        ease: "easeInOut",
                      }}
                      className="text-4xl"
                    >
                      ⭐
                    </motion.span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">
                    حان دورك الآن
                  </p>
                  <p className="text-foreground/60">
                    توجّه إلى شباك الاستقبال
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTicket?.status === "completed" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-full"
            >
              <Card className="w-full text-center">
                <CardContent className="space-y-5 p-8">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
                    <motion.span
                      initial={{ rotate: -20, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="text-4xl"
                    >
                      ✅
                    </motion.span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">
                    تمت الخدمة بنجاح
                  </p>
                  <p className="text-foreground/60">نشكرك على زيارتك</p>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="mt-2"
                  >
                    انضمام جديد
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {(activeTicket?.status === "skipped" ||
            activeTicket?.status === "cancelled") && (
            <Card className="w-full text-center">
              <CardContent className="space-y-5 p-8">
                <p className="text-xl font-semibold text-foreground/50">
                  {activeTicket.status === "skipped"
                    ? "تم تخطي دورك"
                    : "تم إلغاء التذكرة"}
                </p>
                <Button variant="outline" onClick={handleReset}>
                  العودة للانضمام
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f] px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-primary/10 blur-[128px]" />
      </div>

      <Card className="w-full max-w-md animate-fade-in-up">
        <CardContent className="space-y-6 p-8">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-500/30">
              <span className="text-3xl font-bold text-emerald-400">
                د
              </span>
            </div>
            <h1 className="text-2xl font-bold">{business.name}</h1>
            <p className="text-foreground/50">انضم للطابور بسهولة</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleJoin()
            }}
            className="space-y-4"
          >
            <Input
              label="الاسم"
              placeholder="أدخل اسمك"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />

            <Input
              label="رقم الجوال (اختياري)"
              type="tel"
              placeholder="05xx xxx xxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className="text-left"
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
                role="alert"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading || !business.queueId}
              className="h-12 w-full bg-emerald-600 text-base shadow-lg shadow-emerald-500/25 hover:bg-emerald-500"
            >
              {loading ? (
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
                  جارٍ الانضمام…
                </span>
              ) : !business.queueId ? (
                "الطابور مغلق حالياً"
              ) : (
                "انضم للطابور"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
