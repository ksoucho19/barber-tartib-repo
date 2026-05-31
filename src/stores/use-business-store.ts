import { create } from "zustand"
import { createClient } from "@/lib/supabase/client"
import type { Business } from "@/types"

interface BusinessState {
  business: Business | null
  loading: boolean
  error: string | null

  fetchBusiness: (slug: string) => Promise<void>
  fetchCurrentBusiness: () => Promise<void>
  reset: () => void
}

export const useBusinessStore = create<BusinessState>((set) => ({
  business: null,
  loading: false,
  error: null,

  fetchBusiness: async (slug: string) => {
    set({ loading: true, error: null })
    const supabase = createClient()

    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("slug", slug)
      .single()

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    set({ business: data, loading: false })
  },

  fetchCurrentBusiness: async () => {
    set({ loading: true, error: null })
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      set({ loading: false, error: "Not authenticated" })
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.business_id) {
      set({ loading: false, error: "No business found" })
      return
    }

    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", profile.business_id)
      .single()

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    set({ business: data, loading: false })
  },

  reset: () => set({ business: null, loading: false, error: null }),
}))
