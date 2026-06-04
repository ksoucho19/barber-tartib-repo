export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { JoinQueueClient } from "@/components/join/JoinQueueClient"

interface JoinPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function JoinQueuePage({ params }: JoinPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name, slug, settings")
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`)
  }

  if (!business) {
    notFound()
  }

  let queueId: string | null = null

  const { data: queues } = await supabase
    .from("queues")
    .select("id")
    .eq("business_id", business.id)
    .limit(1)

  if (queues && queues.length > 0) {
    queueId = queues[0].id
  } else {
    const { data: newQueue, error: createError } = await supabase
      .from("queues")
      .insert({
        business_id: business.id,
        name: "الطابور الرئيسي",
        is_active: true,
      })
      .select("id")
      .single()

    if (!createError && newQueue) {
      queueId = newQueue.id
    }
  }

  return (
    <JoinQueueClient
      business={{
        id: business.id,
        name: business.name,
        slug: business.slug,
        settings: business.settings as { default_service_duration_minutes?: number } | null,
        queueId,
      }}
    />
  )
}