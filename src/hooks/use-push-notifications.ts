"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

interface UsePushNotificationsOptions {
  publicToken: string
  ticketId: string
}

export function usePushNotifications({
  publicToken,
  ticketId,
}: UsePushNotificationsOptions) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const subscriptionRef = useRef<PushSubscription | null>(null)
  const subscribingRef = useRef(false)

  useEffect(() => {
    if (!("Notification" in window) || !("PushManager" in window)) {
      setIsSupported(false)
      return
    }
    setIsSupported(true)
    setPermission(Notification.permission)

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) {
          subscriptionRef.current = sub
          setIsSubscribed(true)
        }
      })
    })
  }, [])

  const subscribe = useCallback(async () => {
    if (subscribingRef.current) return "already-trying"
    subscribingRef.current = true

    try {
      if (Notification.permission === "denied") {
        subscribingRef.current = false
        return "denied"
      }

      if (Notification.permission === "default") {
        const result = await Notification.requestPermission()
        setPermission(result)
        if (result !== "granted") {
          subscribingRef.current = false
          return "denied"
        }
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.warn("VAPID public key not configured")
        subscribingRef.current = false
        return "no-key"
      }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        subscriptionRef.current = existing
        setIsSubscribed(true)
        subscribingRef.current = false
        return "already"
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      } as PushSubscriptionOptionsInit)

      subscriptionRef.current = sub

      const json = sub.toJSON()
      const supabase = createClient()

      const { error } = await supabase.rpc("save_push_subscription", {
        p_ticket_id: ticketId,
        p_public_token: publicToken,
        p_endpoint: json.endpoint ?? "",
        p_p256dh: (json.keys as Record<string, string> | undefined)?.p256dh ?? "",
        p_auth: (json.keys as Record<string, string> | undefined)?.auth ?? "",
      })

      if (error) {
        await sub.unsubscribe()
        subscriptionRef.current = null
        subscribingRef.current = false
        return "error"
      }

      setIsSubscribed(true)
      subscribingRef.current = false
      return "subscribed"
    } catch {
      subscribingRef.current = false
      return "error"
    }
  }, [publicToken, ticketId])

  const unsubscribe = useCallback(async () => {
    try {
      const sub = subscriptionRef.current
      if (sub) {
        const json = sub.toJSON()
        const supabase = createClient()

        await supabase.rpc("delete_push_subscription", {
          p_public_token: publicToken,
          p_endpoint: json.endpoint ?? "",
        })

        await sub.unsubscribe()
        subscriptionRef.current = null
      }

      setIsSubscribed(false)
      return "unsubscribed"
    } catch {
      return "error"
    }
  }, [publicToken])

  return {
    isSubscribed,
    isSupported,
    permission,
    subscribe,
    unsubscribe,
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
