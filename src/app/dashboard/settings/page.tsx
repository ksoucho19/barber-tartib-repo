import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SettingsClient } from "@/components/settings/SettingsClient"

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.business_id) {
    redirect("/onboarding")
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, slug, settings, created_at")
    .eq("id", profile.business_id)
    .single()

  if (!business) {
    redirect("/dashboard")
  }

  const { data: employees } = await supabase.rpc("get_business_employees")

  const initialEmployees = Array.isArray(employees)
    ? employees.map((e: Record<string, unknown>) => ({
        user_id: e.user_id as string,
        email: e.email as string,
        name: (e.name as string) ?? null,
        phone: (e.phone as string) ?? null,
        role: e.role as string,
      }))
    : []

  return (
    <SettingsClient
      business={{
        id: business.id,
        name: business.name,
        slug: business.slug,
        settings: business.settings as Record<string, unknown> ?? {},
        created_at: business.created_at,
      }}
      currentUserRole={profile.role}
      initialEmployees={initialEmployees}
    />
  )
}
