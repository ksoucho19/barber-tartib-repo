import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/layout/DashboardShell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", profile.business_id)
    .single()

  return (
    <DashboardShell businessName={business?.name ?? undefined}>
      {children}
    </DashboardShell>
  )
}
