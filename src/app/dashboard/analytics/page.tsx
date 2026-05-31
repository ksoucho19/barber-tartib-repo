import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard"
import type { BusinessAnalytics } from "@/types"

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.business_id) {
    redirect("/onboarding")
  }

  const now = new Date().toISOString().slice(0, 10)

  const { data: analytics, error } = await supabase.rpc(
    "get_business_analytics",
    {
      p_business_id: profile.business_id,
      p_date: now,
    },
  )

  const initialAnalytics: BusinessAnalytics = error
    ? {
        total_today: 0,
        active: 0,
        completed: 0,
        avg_wait_minutes: 0,
        avg_service_minutes: 0,
        abandonment_rate: 0,
        peak_hours: [],
        daily_trend: [],
      }
    : (analytics as BusinessAnalytics)

  return (
    <AnalyticsDashboard
      businessId={profile.business_id}
      initialAnalytics={initialAnalytics}
      serverError={error?.message ?? null}
    />
  )
}
