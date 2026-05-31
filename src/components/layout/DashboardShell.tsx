"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "./Sidebar"
import { Toaster } from "@/components/ui/toaster"

interface DashboardShellProps {
  children: React.ReactNode
  businessName?: string
}

export function DashboardShell({
  children,
  businessName,
}: DashboardShellProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Toaster />
      <Sidebar onSignOut={handleSignOut} businessName={businessName} />
      <main className="min-h-screen lg:mr-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
