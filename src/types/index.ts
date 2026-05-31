export type UserRole = "owner" | "employee"
export type TicketStatus = "waiting" | "active" | "completed" | "skipped" | "cancelled"

export interface Business {
  id: string
  name: string
  slug: string
  settings: {
    default_service_duration_minutes?: number
    screen_color?: string
    welcome_message?: string
  } | null
  created_at: string
}

export interface Profile {
  id: string
  business_id: string | null
  role: UserRole
  name: string | null
  phone: string | null
}

export interface EmployeeRecord {
  user_id: string
  email: string
  name: string | null
  phone: string | null
  role: UserRole
}

export interface Queue {
  id: string
  business_id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Customer {
  id: string
  business_id: string
  name: string
  phone: string | null
  created_at: string
}

export interface BusinessAnalytics {
  total_today: number
  active: number
  completed: number
  avg_wait_minutes: number
  avg_service_minutes: number
  abandonment_rate: number
  peak_hours: { hour: number; count: number }[]
  daily_trend: { date: string; count: number }[]
}

export interface Ticket {
  id: string
  queue_id: string
  customer_id: string
  business_id: string
  ticket_number: number
  position: number | null
  status: TicketStatus
  public_token: string
  created_at: string
  created_date: string
  called_at: string | null
  completed_at: string | null
  estimated_wait_minutes?: number
}
