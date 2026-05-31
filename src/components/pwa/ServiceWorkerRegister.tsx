"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing
          if (installing) {
            installing.addEventListener("statechange", () => {
              if (installing.state === "activated") {
                window.location.reload()
              }
            })
          }
        })
      })
      .catch(() => {})
  }, [])

  return null
}
