"use client"

import { useState, useEffect } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const isStandalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches

    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    function handler(e: Event) {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", handler)

    const mediaQuery = window.matchMedia("(display-mode: standalone)")
    function onChange(e: MediaQueryListEvent) {
      if (e.matches) {
        setIsInstalled(true)
        setPrompt(null)
      }
    }
    mediaQuery.addEventListener("change", onChange)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      mediaQuery.removeEventListener("change", onChange)
    }
  }, [])

  const install = async () => {
    if (!prompt) return "dismissed"

    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") {
      setPrompt(null)
      setIsInstalled(true)
    }
    return outcome
  }

  return { canInstall: prompt !== null && !isInstalled, install }
}
