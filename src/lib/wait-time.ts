import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function predictWaitTime(
  businessId: string,
  position: number,
  queueId: string,
  client?: SupabaseClient,
): Promise<number> {
  const supabase = client ?? createClient()

  const { data, error } = await supabase.rpc("predict_wait_time", {
    p_business_id: businessId,
    p_position: position,
    p_queue_id: queueId,
  })

  if (error) throw error
  return (data ?? 0) as number
}

export interface WaitTimeMap {
  [ticketId: string]: number
}

export async function predictAllWaitTimes(
  businessId: string,
  queueId: string,
  tickets: { id: string; position: number | null }[],
  client?: SupabaseClient,
): Promise<WaitTimeMap> {
  const result: WaitTimeMap = {}

  const promises = tickets.map(async (t) => {
    const pos = t.position ?? 1
    try {
      const minutes = await predictWaitTime(businessId, pos, queueId, client)
      result[t.id] = minutes
    } catch {
      result[t.id] = 0
    }
  })

  await Promise.all(promises)
  return result
}
