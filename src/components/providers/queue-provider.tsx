"use client"

import { useEffect, useRef } from "react"
import { useQueueStore } from "@/stores/use-queue-store"

interface QueueProviderProps {
  children: React.ReactNode
  businessId?: string
  publicToken?: string
}

export function QueueProvider({
  children,
  businessId,
  publicToken,
}: QueueProviderProps) {
  const subscribeToBusinessQueue = useQueueStore(
    (s) => s.subscribeToBusinessQueue,
  )
  const subscribeToCustomerTicket = useQueueStore(
    (s) => s.subscribeToCustomerTicket,
  )
  const unsubscribe = useQueueStore((s) => s.unsubscribe)

  const cleanupRef = useRef<(() => void) | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true

    if (businessId) {
      cleanupRef.current = subscribeToBusinessQueue(businessId)
    } else if (publicToken) {
      cleanupRef.current = subscribeToCustomerTicket(publicToken)
    }

    return () => {
      mountedRef.current = false
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
      unsubscribe()
    }
  }, [businessId, publicToken, subscribeToBusinessQueue, subscribeToCustomerTicket, unsubscribe])

  return <>{children}</>
}
