"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { StatCard } from "./StatCard"
import { DailyTrendChart } from "./DailyTrendChart"
import { PeakHoursChart } from "./PeakHoursChart"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { motion } from "framer-motion"
import { PageTransition } from "@/components/layout/PageTransition"
import { SkeletonStatCard } from "@/components/ui/skeleton"
import type { BusinessAnalytics } from "@/types"

interface AnalyticsDashboardProps {
  businessId: string
  initialAnalytics: BusinessAnalytics
  serverError: string | null
}

export function AnalyticsDashboard({
  businessId,
  initialAnalytics,
  serverError,
}: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] =
    useState<BusinessAnalytics>(initialAnalytics)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(serverError)
  const [initialLoading, setInitialLoading] = useState(!serverError && initialAnalytics.total_today === 0)

  const supabase = createClient()

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const now = new Date().toISOString().slice(0, 10)

    const { data, error: rpcError } = await supabase.rpc(
      "get_business_analytics",
      {
        p_business_id: businessId,
        p_date: now,
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      toast("فشل تحديث الإحصائيات", "error")
    } else if (data) {
      setAnalytics(data as BusinessAnalytics)
      toast("تم تحديث الإحصائيات", "success")
    }

    setInitialLoading(false)
    setLoading(false)
  }, [businessId, supabase])

  const cards = [
    {
      key: "total",
      label: "إجمالي اليوم",
      value: analytics.total_today,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      color: "text-blue-400",
      bg: "bg-blue-500/20",
      ring: "ring-blue-500/30",
    },
    {
      key: "active",
      label: "في الانتظار",
      value: analytics.active,
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
      key: "completed",
      label: "مكتمل",
      value: analytics.completed,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      color: "text-emerald-400",
      bg: "bg-emerald-500/20",
      ring: "ring-emerald-500/30",
    },
    {
      key: "wait",
      label: "متوسط الانتظار",
      value: `${analytics.avg_wait_minutes} د`,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      color: "text-blue-400",
      bg: "bg-blue-500/20",
      ring: "ring-blue-500/30",
    },
    {
      key: "service",
      label: "متوسط الخدمة",
      value: `${analytics.avg_service_minutes} د`,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
      color: "text-purple-400",
      bg: "bg-purple-500/20",
      ring: "ring-purple-500/30",
    },
    {
      key: "abandon",
      label: "معدل الانسحاب",
      value: `${analytics.abandonment_rate}%`,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
      color: analytics.abandonment_rate > 20 ? "text-red-400" : "text-emerald-400",
      bg: analytics.abandonment_rate > 20 ? "bg-red-500/20" : "bg-emerald-500/20",
      ring: analytics.abandonment_rate > 20 ? "ring-red-500/30" : "ring-emerald-500/30",
    },
  ]

  return (
    <PageTransition>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">التحليلات</h1>
          <p className="mt-0.5 text-sm text-foreground/50">
            إحصائيات وإنجازات اليوم
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={refresh}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
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
              جارٍ التحديث…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              تحديث
            </span>
          )}
        </Button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
          role="alert"
        >
          {error}
        </motion.div>
      )}

      <div className="mb-8">
        {initialLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map((card, i) => (
              <StatCard
                key={card.key}
                label={card.label}
                value={card.value}
                icon={card.icon}
                color={card.color}
                bg={card.bg}
                ring={card.ring}
                index={i}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 20 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="mb-2 text-sm font-semibold text-foreground/70">
            الاتجاه اليومي (آخر 7 أيام)
          </h2>
          <p className="mb-6 text-xs text-foreground/30">
            عدد التذاكر لكل يوم
          </p>
          {initialLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : (
            <DailyTrendChart data={analytics.daily_trend} />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 20 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="mb-2 text-sm font-semibold text-foreground/70">
            ساعات الذروة (اليوم)
          </h2>
          <p className="mb-6 text-xs text-foreground/30">
            توزيع التذاكر حسب الساعة
          </p>
          {initialLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : (
            <PeakHoursChart data={analytics.peak_hours} />
          )}
        </motion.div>
      </div>
    </PageTransition>
  )
}
