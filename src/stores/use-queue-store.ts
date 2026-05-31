import { create } from "zustand"
import { createClient } from "@/lib/supabase/client"
import type { Ticket } from "@/types"
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js"
import { predictAllWaitTimes } from "@/lib/wait-time"

type RealtimeEvent =
  | "INSERT"
  | "UPDATE"
  | "DELETE"

interface QueueState {
  tickets: Ticket[]
  activeTicket: Ticket | null
  loading: boolean
  error: string | null
  estimatedWaitTimes: Record<string, number>

  businessChannel: ReturnType<SupabaseClient["channel"]> | null
  customerChannel: ReturnType<SupabaseClient["channel"]> | null
  activeSubscriptions: Set<string>

  subscribeToBusinessQueue: (businessId: string) => () => void
  subscribeToCustomerTicket: (publicToken: string, client?: SupabaseClient) => () => void
  unsubscribe: () => void
  updateTicketOptimistic: (
    ticketId: string,
    changes: Partial<Ticket>,
  ) => Promise<void>
  fetchInitialTickets: (businessId: string) => Promise<void>
  setActiveTicket: (ticket: Ticket | null) => void
  updateEstimatedTimes: (businessId: string, queueId: string) => Promise<void>
}

function handlePostgresChange(
  state: QueueState,
  payload: RealtimePostgresChangesPayload<Ticket>,
): Partial<QueueState> {
  const event = payload.eventType.toUpperCase() as RealtimeEvent

  if (event === "INSERT") {
    const newTicket = payload.new as Ticket
    if (!state.tickets.some((t) => t.id === newTicket.id)) {
      return { tickets: [...state.tickets, newTicket] }
    }
    return {}
  }

  if (event === "UPDATE") {
    const updated = payload.new as Ticket
    return {
      tickets: state.tickets.map((t) =>
        t.id === updated.id ? updated : t,
      ),
      activeTicket:
        state.activeTicket?.id === updated.id
          ? updated
          : state.activeTicket,
    }
  }

  if (event === "DELETE") {
    const deleted = payload.old as Ticket
    return {
      tickets: state.tickets.filter((t) => t.id !== deleted.id),
      activeTicket:
        state.activeTicket?.id === deleted.id
          ? null
          : state.activeTicket,
    }
  }

  return {}
}

export const useQueueStore = create<QueueState>((set, get) => ({
  tickets: [],
  activeTicket: null,
  loading: true,
  error: null,
  estimatedWaitTimes: {},

  businessChannel: null,
  customerChannel: null,
  activeSubscriptions: new Set(),

  subscribeToBusinessQueue: (businessId: string) => {
    const existing = get().businessChannel
    if (existing) {
      existing.unsubscribe()
    }

    const supabase = createClient()
    const channel = supabase
      .channel(`queue:${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `business_id=eq.${businessId}`,
        },
        (payload: RealtimePostgresChangesPayload<Ticket>) => {
          const patch = handlePostgresChange(get(), payload)
          if (Object.keys(patch).length > 0) {
            set(patch)
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          set({ loading: false })
        }
        if (status === "CHANNEL_ERROR") {
          set({ error: "Realtime connection lost. Retrying…" })
        }
        if (status === "CLOSED") {
          set({ error: "Realtime connection closed" })
        }
      })

    set({ businessChannel: channel, loading: true, error: null })

    return () => {
      channel.unsubscribe()
      set({ businessChannel: null, tickets: [], loading: true })
    }
  },

  subscribeToCustomerTicket: (publicToken: string, client?: SupabaseClient) => {
    const existing = get().customerChannel
    if (existing) {
      existing.unsubscribe()
    }

    const supabase = client ?? createClient()
    set({ loading: true, error: null })

    supabase
      .rpc("get_ticket_by_token", { p_token: publicToken })
      .then(({ data, error }) => {
        if (error) {
          set({ error: error.message, loading: false })
          return
        }
        if (data && data.length > 0) {
          set({ activeTicket: data[0] })
        }
      })

    const channel = supabase
      .channel(`ticket:${publicToken}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `public_token=eq.${publicToken}`,
        },
        (payload: RealtimePostgresChangesPayload<Ticket>) => {
          if (
            payload.eventType === "UPDATE" ||
            payload.eventType === "INSERT"
          ) {
            set({ activeTicket: payload.new as Ticket })
          }
          if (payload.eventType === "DELETE") {
            set({ activeTicket: null })
          }
        },
      )
      .subscribe((status) => {
        if (
          status === "SUBSCRIBED" ||
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          set({ loading: false })
        }
      })

    set({ customerChannel: channel })

    return () => {
      channel.unsubscribe()
      set({ customerChannel: null, activeTicket: null, loading: true })
    }
  },

  unsubscribe: () => {
    const { businessChannel, customerChannel } = get()

    if (businessChannel) {
      businessChannel.unsubscribe()
    }
    if (customerChannel) {
      customerChannel.unsubscribe()
    }

    set({
      businessChannel: null,
      customerChannel: null,
      tickets: [],
      activeTicket: null,
      loading: false,
      error: null,
    })
  },

  updateTicketOptimistic: async (
    ticketId: string,
    changes: Partial<Ticket>,
  ) => {
    const state = get()
    const previousTicket = state.tickets.find((t) => t.id === ticketId)
    const previousActive = state.activeTicket

    set({
      tickets: state.tickets.map((t) =>
        t.id === ticketId ? { ...t, ...changes } : t,
      ),
      activeTicket:
        state.activeTicket?.id === ticketId
          ? { ...state.activeTicket, ...changes }
          : state.activeTicket,
    })

    const supabase = createClient()
    const { error } = await supabase
      .from("tickets")
      .update(changes)
      .eq("id", ticketId)

    if (error) {
      set({
        tickets: state.tickets.map((t) =>
          t.id === ticketId ? (previousTicket ?? t) : t,
        ),
        activeTicket: previousActive,
        error: error.message,
      })
      return
    }

    set({ error: null })
  },

  fetchInitialTickets: async (businessId: string) => {
    set({ loading: true, error: null })
    const supabase = createClient()

    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("business_id", businessId)
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: true })

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    const active = data.find((t) => t.status === "active") ?? null

    set({ tickets: data, activeTicket: active, loading: false })
  },

  setActiveTicket: (ticket: Ticket | null) => {
    set({ activeTicket: ticket })
  },

  updateEstimatedTimes: async (businessId: string, queueId: string) => {
    const { tickets } = get()
    const waiting = tickets.filter(
      (t) => t.status === "waiting" || t.status === "active",
    )
    if (waiting.length === 0) return

    const times = await predictAllWaitTimes(businessId, queueId, waiting)
    set({ estimatedWaitTimes: times })
  },
}))
