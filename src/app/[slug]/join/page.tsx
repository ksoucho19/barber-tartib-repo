export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

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
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`)
  }

  if (!business) {
    notFound()
  }

  return (
    <div className="min-h-screen w-full bg-[#0B0F19] text-white flex flex-col items-center justify-center p-4" style={{ direction: "rtl" }}>
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/20 ring-1 ring-emerald-500/30 mx-auto">
          <span className="text-3xl font-bold text-emerald-400">د</span>
        </div>
        
        <h1 className="text-2xl font-bold">{business.name}</h1>
        
        <div className="p-6 rounded-2xl border border-white/10 bg-[#151D30] shadow-xl">
          <p className="text-emerald-400 font-medium animate-pulse">...</p>
        </div>
      </div>
    </div>
  )
}