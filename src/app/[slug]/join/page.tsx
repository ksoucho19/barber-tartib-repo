import { createClient } from "@/lib/supabase/server"
import { JoinQueueClient } from "@/components/join/JoinQueueClient"
import { notFound } from "next/navigation"

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function JoinPage({ params }: PageProps) {
  const { slug } = await params

  const supabase = await createClient()

  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("id, name, slug, settings")
    .eq("slug", slug)
    .single()

  if (bizError || !business) {
    notFound()
  }

  const { data: queues } = await supabase
    .from("queues")
    .select("id")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)

  const activeQueue = queues?.[0] ?? null

  return (
    <JoinQueueClient
      business={{
        id: business.id,
        name: business.name,
        slug: business.slug,
        settings: business.settings as {
          default_service_duration_minutes?: number
        } | null,
        queueId: activeQueue?.id ?? null,
      }}
    />
  )
}
