import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardPageContent } from "@/components/dashboard/DashboardPage"

export default async function DashboardPage() {
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

  return <DashboardPageContent businessId={profile.business_id} />
}
