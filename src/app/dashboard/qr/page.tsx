import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { QrPageClient } from "@/components/dashboard/qr/qr-page-client"
import { QrSkeleton } from "@/components/dashboard/qr/qr-skeleton"

export default async function QRPage() {
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
    .select("id, name, slug")
    .eq("id", profile.business_id)
    .single()

  if (!business) {
    return <QrSkeleton />
  }

  return <QrPageClient business={business} />
}
