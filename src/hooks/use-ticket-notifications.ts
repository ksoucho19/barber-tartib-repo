"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { Ticket } from "@/types"

interface Notification {
  message: string
  type: "info" | "warning" | "success"
}

interface UseTicketNotificationsResult {
  notification: Notification | null
  clearNotification: () => void
}

export function useTicketNotifications(
  activeTicket: Ticket | null,
  _defaultDuration: number,
): UseTicketNotificationsResult {
  const [notification, setNotification] = useState<Notification | null>(null)

  const lastPeopleAheadRef = useRef<number | null>(null)
  const lastStatusRef = useRef<string | null>(null)
  const notifiedTwoRef = useRef(false)
  const notifiedOneRef = useRef(false)
  const notifiedActiveRef = useRef(false)
  const notifiedCompletedRef = useRef(false)
  const wasPreviouslyWaitingRef = useRef(false)

  const clearNotification = useCallback(() => {
    setNotification(null)
  }, [])

  useEffect(() => {
    if (!activeTicket) {
      wasPreviouslyWaitingRef.current = false
      return
    }

    const status = activeTicket.status
    const position = activeTicket.position ?? 0
    const peopleAhead = status === "waiting" ? Math.max(0, position - 1) : 0

    const prevStatus = lastStatusRef.current
    const prevPeopleAhead = lastPeopleAheadRef.current

    lastPeopleAheadRef.current = peopleAhead
    lastStatusRef.current = status

    if (status === "waiting") {
      wasPreviouslyWaitingRef.current = true

      if (prevStatus !== "waiting") {
        notifiedTwoRef.current = false
        notifiedOneRef.current = false
      }

      if (peopleAhead === 2 && prevPeopleAhead !== 2 && !notifiedTwoRef.current) {
        notifiedTwoRef.current = true
        setNotification({
          message: "تبقى شخصان فقط قبل دورك",
          type: "warning",
        })
        return
      }

      if (peopleAhead === 1 && prevPeopleAhead !== 1 && !notifiedOneRef.current) {
        notifiedOneRef.current = true
        setNotification({
          message: "استعد، دورك يقترب",
          type: "warning",
        })
        return
      }
    }

    if (
      status === "active" &&
      prevStatus === "waiting" &&
      wasPreviouslyWaitingRef.current &&
      !notifiedActiveRef.current
    ) {
      notifiedActiveRef.current = true
      setNotification({
        message: "حان دورك الآن",
        type: "success",
      })
      return
    }

    if (
      status === "completed" &&
      !notifiedCompletedRef.current
    ) {
      notifiedCompletedRef.current = true
      setNotification({
        message: "تمت الخدمة، شكراً لانتظارك",
        type: "success",
      })
      return
    }

    if (status !== "waiting" && status !== "active") {
      wasPreviouslyWaitingRef.current = false
    }
  }, [activeTicket])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  return { notification, clearNotification }
}
