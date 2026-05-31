-- =============================================================================
-- Queue Management System — Supabase PostgreSQL Schema
-- =============================================================================
-- Usage: Paste the entire file in Supabase SQL Editor and execute.
-- =============================================================================

-- 0. Extensions
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- 1. Custom Enums
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'employee');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('waiting', 'active', 'completed', 'skipped', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Helper: get the business_id for the currently authenticated user
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS UUID
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 3. Tables
-- =============================================================================

-- 3.1 Businesses
CREATE TABLE public.businesses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  settings   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  role        user_role NOT NULL DEFAULT 'employee',
  name        TEXT,
  phone       TEXT
);

-- 3.3 Queues
CREATE TABLE public.queues (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 Customers
CREATE TABLE public.customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.5 Tickets
CREATE TABLE public.tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id      UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  business_id   UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  ticket_number INTEGER NOT NULL,
  position      INTEGER,
  status        ticket_status NOT NULL DEFAULT 'waiting',
  public_token  UUID NOT NULL DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_date  DATE NOT NULL GENERATED ALWAYS AS (created_at::date) STORED,
  called_at     TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  -- Each queue has unique ticket numbers per day (resets daily)
  UNIQUE (queue_id, ticket_number, created_date)
);

-- 3.6 Service Logs
CREATE TABLE public.service_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  ticket_id        UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  duration_seconds INTEGER,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.7 Analytics Daily (placeholder)
CREATE TABLE public.analytics_daily (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  data        JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, date)
);

-- 4. Indexes
-- =============================================================================
CREATE INDEX idx_profiles_business_id    ON public.profiles(business_id);
CREATE INDEX idx_queues_business_id      ON public.queues(business_id);
CREATE INDEX idx_customers_business_id   ON public.customers(business_id);
CREATE INDEX idx_tickets_business_id     ON public.tickets(business_id);
CREATE INDEX idx_tickets_queue_id        ON public.tickets(queue_id);
CREATE INDEX idx_tickets_status          ON public.tickets(status);
CREATE INDEX idx_tickets_created_at      ON public.tickets(created_at);
CREATE INDEX idx_tickets_created_date    ON public.tickets(created_date);
CREATE INDEX idx_tickets_public_token    ON public.tickets(public_token);
CREATE INDEX idx_tickets_business_status ON public.tickets(business_id, status);
CREATE INDEX idx_service_logs_business   ON public.service_logs(business_id);
CREATE INDEX idx_service_logs_ticket     ON public.service_logs(ticket_id);
CREATE INDEX idx_analytics_daily_bus     ON public.analytics_daily(business_id);

-- 5. Row-Level Security (RLS)
-- =============================================================================

-- 5.1 Enable RLS on all tables
ALTER TABLE public.businesses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------
-- 5.2 Policies for Authenticated Users (owners / employees)
--     All scoped to the user's business_id via profiles lookup.
-- -----------------------------------------------------------

-- Businesses
CREATE POLICY "auth_sel_business" ON public.businesses
  FOR SELECT USING (id = get_user_business_id());
CREATE POLICY "auth_ins_business" ON public.businesses
  FOR INSERT WITH CHECK (get_user_business_id() IS NULL);
CREATE POLICY "auth_upd_business" ON public.businesses
  FOR UPDATE USING (id = get_user_business_id());

-- Profiles
CREATE POLICY "auth_sel_profiles" ON public.profiles
  FOR SELECT USING (business_id = get_user_business_id() OR id = auth.uid());
CREATE POLICY "auth_ins_profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "auth_upd_profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Queues
CREATE POLICY "auth_all_queues" ON public.queues
  FOR ALL USING (business_id = get_user_business_id());

-- Customers
CREATE POLICY "auth_all_customers" ON public.customers
  FOR ALL USING (business_id = get_user_business_id());

-- Tickets
CREATE POLICY "auth_all_tickets" ON public.tickets
  FOR ALL USING (business_id = get_user_business_id());

-- Service Logs
CREATE POLICY "auth_all_service_logs" ON public.service_logs
  FOR ALL USING (business_id = get_user_business_id());

-- Analytics Daily
CREATE POLICY "auth_all_analytics" ON public.analytics_daily
  FOR ALL USING (business_id = get_user_business_id());

-- -----------------------------------------------------------
-- 5.3 Policies for Anonymous Users (customers walking in)
--     Customers interact through the join_queue RPC function
--     for writes (see §6) and use Realtime for live updates
--     on their own ticket via a customer-scoped JWT.
-- -----------------------------------------------------------
DROP POLICY IF EXISTS anon_sel_tickets ON public.tickets;

CREATE POLICY "customer_read_own" ON public.tickets
  FOR SELECT
  USING (
    (auth.jwt()->>'role' = 'customer')
    AND (public_token = (auth.jwt()->>'sub')::uuid)
  );

CREATE POLICY "display_read" ON public.tickets
  FOR SELECT
  USING (
    (auth.jwt()->>'role' = 'display')
    AND (business_id = (auth.jwt()->>'business_id')::uuid)
  );

-- 6. Secure RPC for Anonymous Ticket Lookup
-- =============================================================================
-- Instead of giving anon SELECT on the tickets table (which would expose every
-- ticket), we expose a security-definer function that returns a single row
-- matching the public_token the customer holds in localStorage.
--
-- Call from the client:
--   const { data } = await supabase.rpc('get_ticket_by_token', {
--     p_token: 'the-uuid-from-localStorage'
--   });
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_ticket_by_token(p_token UUID)
RETURNS SETOF public.tickets
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT * FROM public.tickets WHERE public_token = p_token
$$;

GRANT EXECUTE ON FUNCTION public.get_ticket_by_token TO anon;

-- 7. Secure RPC for Joining a Queue (anon / kiosk)
-- =============================================================================
-- Creates a customer record (or finds existing by phone), inserts a ticket
-- into the first active queue for the given business slug, and returns the
-- ticket details.
--
-- Call from the client:
--   const { data } = await supabase.rpc('join_queue', {
--     p_slug: 'my-business',
--     p_name: 'Ahmed',
--     p_phone: '+966501234567'   // optional
--   });
--   // data → { ticket_id, ticket_number, public_token, position }
-- =============================================================================
CREATE OR REPLACE FUNCTION public.join_queue(
  p_slug  TEXT,
  p_name  TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_business_id   UUID;
  v_queue_id      UUID;
  v_ticket_number INTEGER;
  v_position      INTEGER;
  v_customer_id   UUID;
  v_ticket        public.tickets;
BEGIN
  -- 1. Resolve business by slug
  SELECT id INTO v_business_id
  FROM public.businesses
  WHERE slug = p_slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found for slug: %', p_slug
      USING HINT = 'Check the URL or business slug';
  END IF;

  -- 2. Lock & pick the first active queue (serialises ticket_number)
  SELECT id INTO v_queue_id
  FROM public.queues
  WHERE business_id = v_business_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active queue found for business: %', p_slug
      USING HINT = 'Ask the staff to activate a queue first';
  END IF;

  -- 3. Find existing customer by phone, or create a new one
  IF p_phone IS NOT NULL THEN
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE business_id = v_business_id AND phone = p_phone;
  END IF;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (business_id, name, phone)
    VALUES (v_business_id, p_name, p_phone)
    RETURNING id INTO v_customer_id;
  END IF;

  -- 4. Calculate next ticket_number for today (resets daily)
  SELECT COALESCE(MAX(ticket_number), 0) + 1
  INTO v_ticket_number
  FROM public.tickets
  WHERE queue_id = v_queue_id AND created_date = CURRENT_DATE;

  -- 5. Calculate position: how many waiting tickets ahead
  SELECT COUNT(*)::int + 1
  INTO v_position
  FROM public.tickets
  WHERE queue_id = v_queue_id
    AND created_date = CURRENT_DATE
    AND status = 'waiting';

  -- 6. Insert the ticket (created_date is auto-computed)
  INSERT INTO public.tickets (
    queue_id, customer_id, business_id,
    ticket_number, position, status, customer_name
  ) VALUES (
    v_queue_id, v_customer_id, v_business_id,
    v_ticket_number, v_position, 'waiting', p_name
  )
  RETURNING * INTO v_ticket;

  -- 7. Return ticket summary as JSON
  RETURN json_build_object(
    'ticket_id',     v_ticket.id::text,
    'ticket_number', v_ticket.ticket_number,
    'public_token',  v_ticket.public_token::text,
    'position',      v_ticket.position
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_queue TO anon;

-- 8. Helper: set business_id on the authenticated user's profile
-- =============================================================================
-- Called by the onboarding flow after creating a new business.
CREATE OR REPLACE FUNCTION public.set_user_business_id(p_business_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.profiles
  SET business_id = p_business_id
  WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.set_user_business_id TO authenticated;

-- 9. Auto-Create Profile on User Signup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, business_id, role, name)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'business_id')::uuid,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee'),
    NEW.raw_user_meta_data->>'name'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 10. Merchant Dashboard RPCs
-- =============================================================================

-- 10.1 call_next_customer(p_queue_id)
--      Picks the oldest waiting ticket and marks it active.
--      Raises an error if an active ticket already exists for this queue today.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.call_next_customer(p_queue_id UUID)
RETURNS JSON
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ticket      public.tickets;
  v_business_id UUID;
  v_customer_name TEXT;
BEGIN
  SELECT business_id INTO v_business_id
  FROM public.queues
  WHERE id = p_queue_id;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Queue not found';
  END IF;

  IF v_business_id != get_user_business_id() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tickets
    WHERE queue_id = p_queue_id
      AND status = 'active'
      AND created_date = CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'يوجد عميل قيد الخدمة حالياً. أنهِ أو تخطَّ العميل الحالي أولاً.';
  END IF;

  PERFORM id FROM public.tickets
  WHERE queue_id = p_queue_id
    AND status = 'waiting'
    AND created_date = CURRENT_DATE
  ORDER BY ticket_number
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا يوجد عملاء في الانتظار';
  END IF;

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE queue_id = p_queue_id
    AND status = 'waiting'
    AND created_date = CURRENT_DATE
  ORDER BY ticket_number
  LIMIT 1;

  UPDATE public.tickets
  SET status = 'active', called_at = now()
  WHERE id = v_ticket.id;

  SELECT c.name INTO v_customer_name
  FROM public.customers c
  WHERE c.id = v_ticket.customer_id;

  RETURN json_build_object(
    'ticket_id',      v_ticket.id::text,
    'ticket_number',  v_ticket.ticket_number,
    'customer_name',  v_customer_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.call_next_customer TO authenticated;

-- =============================================================================
-- 10.2 skip_customer(p_ticket_id)
--      Marks an active ticket as skipped (e.g. customer not present).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.skip_customer(p_ticket_id UUID)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ticket public.tickets;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'التذكرة غير موجودة';
  END IF;

  IF v_ticket.status != 'active' THEN
    RAISE EXCEPTION 'يمكن تخطي العميل النشط فقط';
  END IF;

  IF v_ticket.business_id != get_user_business_id() THEN
    RAISE EXCEPTION 'لا تملك صلاحية الوصول';
  END IF;

  UPDATE public.tickets
  SET status = 'skipped'
  WHERE id = p_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.skip_customer TO authenticated;

-- =============================================================================
-- 10.3 complete_service(p_ticket_id)
--      Completes an active ticket, logs duration in service_logs.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_service(p_ticket_id UUID)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ticket   public.tickets;
  v_duration INTEGER;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'التذكرة غير موجودة';
  END IF;

  IF v_ticket.status != 'active' THEN
    RAISE EXCEPTION 'يمكن إنهاء خدمة العميل النشط فقط';
  END IF;

  IF v_ticket.business_id != get_user_business_id() THEN
    RAISE EXCEPTION 'لا تملك صلاحية الوصول';
  END IF;

  v_duration := EXTRACT(EPOCH FROM (now() - v_ticket.called_at))::INTEGER;

  UPDATE public.tickets
  SET status = 'completed', completed_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO public.service_logs (business_id, ticket_id, duration_seconds)
  VALUES (v_ticket.business_id, p_ticket_id, v_duration);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_service TO authenticated;

-- =============================================================================
-- 10.4 cancel_ticket(p_ticket_id)
--      Cancels a waiting ticket.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cancel_ticket(p_ticket_id UUID)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ticket public.tickets;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'التذكرة غير موجودة';
  END IF;

  IF v_ticket.status != 'waiting' THEN
    RAISE EXCEPTION 'يمكن إلغاء التذاكر المنتظرة فقط';
  END IF;

  IF v_ticket.business_id != get_user_business_id() THEN
    RAISE EXCEPTION 'لا تملك صلاحية الوصول';
  END IF;

  UPDATE public.tickets
  SET status = 'cancelled'
  WHERE id = p_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_ticket TO authenticated;

-- =============================================================================
-- 11. Analytics RPC
-- =============================================================================
-- Returns a JSON bundle of KPI values, peak hours (today), and daily trend
-- (last 7 days) for the given business.  Verifies business ownership through
-- get_user_business_id().
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_business_analytics(
  p_business_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total_today     INT;
  v_active          INT;
  v_completed       INT;
  v_avg_wait        NUMERIC;
  v_avg_service     NUMERIC;
  v_abandonment     NUMERIC;
  v_peak_hours      JSON;
  v_daily_trend     JSON;
  v_today_total     INT;
  v_abandoned       INT;
BEGIN
  IF p_business_id != get_user_business_id() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*) INTO v_total_today
  FROM public.tickets
  WHERE business_id = p_business_id AND created_at::date = p_date;

  SELECT COUNT(*) INTO v_active
  FROM public.tickets
  WHERE business_id = p_business_id AND status IN ('waiting', 'active');

  SELECT COUNT(*) INTO v_completed
  FROM public.tickets
  WHERE business_id = p_business_id AND status = 'completed' AND created_at::date = p_date;

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (called_at - created_at)) / 60), 0)
  INTO v_avg_wait
  FROM public.tickets
  WHERE business_id = p_business_id
    AND status = 'completed'
    AND created_at::date = p_date
    AND called_at IS NOT NULL;

  SELECT COALESCE(AVG(sl.duration_seconds / 60.0), 0)
  INTO v_avg_service
  FROM public.service_logs sl
  JOIN public.tickets t ON t.id = sl.ticket_id
  WHERE sl.business_id = p_business_id AND t.completed_at::date = p_date;

  SELECT COUNT(*) INTO v_today_total
  FROM public.tickets
  WHERE business_id = p_business_id AND created_at::date = p_date;

  SELECT COUNT(*) INTO v_abandoned
  FROM public.tickets
  WHERE business_id = p_business_id AND created_at::date = p_date
    AND status IN ('skipped', 'cancelled');

  v_abandonment := CASE WHEN v_today_total > 0
    THEN ROUND((v_abandoned::NUMERIC / v_today_total) * 100, 1)
    ELSE 0
  END;

  SELECT COALESCE(
    json_agg(json_build_object('hour', hour, 'count', count) ORDER BY hour), '[]'::json
  ) INTO v_peak_hours
  FROM (
    SELECT EXTRACT(HOUR FROM created_at)::INT AS hour, COUNT(*)::INT AS count
    FROM public.tickets
    WHERE business_id = p_business_id AND created_at::date = p_date
    GROUP BY hour
  ) sub;

  SELECT COALESCE(
    json_agg(json_build_object('date', d::text, 'count', count) ORDER BY d), '[]'::json
  ) INTO v_daily_trend
  FROM (
    SELECT generate_series(p_date - INTERVAL '6 days', p_date, '1 day')::date AS d
  ) dates
  LEFT JOIN (
    SELECT created_at::date AS dt, COUNT(*)::INT AS count
    FROM public.tickets
    WHERE business_id = p_business_id
      AND created_at::date >= p_date - INTERVAL '6 days'
      AND created_at::date <= p_date
    GROUP BY dt
  ) t ON dates.d = t.dt
  ORDER BY d;

  RETURN json_build_object(
    'total_today',       v_total_today,
    'active',            v_active,
    'completed',         v_completed,
    'avg_wait_minutes',  ROUND(COALESCE(v_avg_wait, 0), 1),
    'avg_service_minutes', ROUND(COALESCE(v_avg_service, 0), 1),
    'abandonment_rate',  v_abandonment,
    'peak_hours',        v_peak_hours,
    'daily_trend',       v_daily_trend
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_analytics TO authenticated;

-- =============================================================================
-- 12. Smart Wait Time Prediction
-- =============================================================================
-- Predicts the expected wait time in minutes for a customer at a given queue
-- position, using real service_logs data with fallback to default_duration.
-- Accessible to anon (for customer join page) and authenticated (dashboard).
-- SECURITY DEFINER ensures the caller never reads raw data directly.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.predict_wait_time(
  p_business_id UUID,
  p_position    INT,
  p_queue_id    UUID
)
RETURNS INT
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_avg_duration      NUMERIC;
  v_default_minutes   INT;
  v_elapsed_seconds   NUMERIC;
  v_remaining_active  NUMERIC;
  v_predicted_minutes NUMERIC;
  v_active            RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id) THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  SELECT COALESCE((settings->>'default_service_duration_minutes')::INT, 15)
  INTO v_default_minutes
  FROM public.businesses
  WHERE id = p_business_id;

  SELECT AVG(duration_seconds) INTO v_avg_duration
  FROM public.service_logs
  WHERE business_id = p_business_id
    AND completed_at > now() - interval '24 hours';

  IF v_avg_duration IS NULL THEN
    SELECT AVG(duration_seconds) INTO v_avg_duration
    FROM public.service_logs
    WHERE business_id = p_business_id
      AND completed_at > now() - interval '7 days';
  END IF;

  IF v_avg_duration IS NULL THEN
    SELECT AVG(duration_seconds) INTO v_avg_duration
    FROM public.service_logs
    WHERE business_id = p_business_id
      AND completed_at > now() - interval '30 days';
  END IF;

  IF v_avg_duration IS NULL THEN
    v_avg_duration := v_default_minutes * 60;
  END IF;

  v_avg_duration := GREATEST(v_avg_duration, 60);

  SELECT * INTO v_active
  FROM public.tickets
  WHERE queue_id = p_queue_id
    AND status = 'active'
    AND created_date = CURRENT_DATE
  ORDER BY called_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_elapsed_seconds := EXTRACT(EPOCH FROM (now() - v_active.called_at));
    v_remaining_active := GREATEST(v_avg_duration - v_elapsed_seconds, 0);
  ELSE
    v_remaining_active := 0;
  END IF;

  v_predicted_minutes := ((GREATEST(p_position, 1) - 1) * v_avg_duration + v_remaining_active) / 60;

  RETURN GREATEST(ROUND(v_predicted_minutes)::INT, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.predict_wait_time TO anon;
GRANT EXECUTE ON FUNCTION public.predict_wait_time TO authenticated;

-- =============================================================================
-- 13. Settings & Employee Management — RLS & RPCs
-- =============================================================================

-- 13.1 Update business UPDATE policy: only owners can modify settings
DROP POLICY IF EXISTS "auth_upd_business" ON public.businesses;

CREATE POLICY "owner_upd_business" ON public.businesses
  FOR UPDATE USING (
    id = get_user_business_id()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner'
  );

-- 13.2 Allow owners to update any profile within their business
--     (users can still update their own profile via auth_upd_profile)
CREATE POLICY "owner_upd_employee_profiles" ON public.profiles
  FOR UPDATE USING (
    business_id = get_user_business_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- 13.3 Helper: get_business_employees
--      Returns all employees for the caller's business, including email from auth.users.
CREATE OR REPLACE FUNCTION public.get_business_employees()
RETURNS TABLE (user_id UUID, email TEXT, name TEXT, phone TEXT, role user_role)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, u.email, p.name, p.phone, p.role
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.business_id = public.get_user_business_id()
  ORDER BY p.name
$$;

GRANT EXECUTE ON FUNCTION public.get_business_employees TO authenticated;

-- 13.4 RPC: add_business_employee(p_email)
--      Owner invites an existing user by email to join their business as employee.
CREATE OR REPLACE FUNCTION public.add_business_employee(p_email TEXT)
RETURNS JSON
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
  v_user_id UUID;
  v_role TEXT;
BEGIN
  v_business_id := public.get_user_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد نشاط تجاري مرتبط بحسابك';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role != 'owner' THEN
    RAISE EXCEPTION 'فقط المالك يمكنه إضافة موظفين';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا يوجد مستخدم مسجل بهذا البريد الإلكتروني';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND business_id IS NOT NULL) THEN
    RAISE EXCEPTION 'هذا المستخدم مرتبط بنشاط تجاري آخر';
  END IF;

  UPDATE public.profiles
  SET business_id = v_business_id, role = 'employee'
  WHERE id = v_user_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_business_employee TO authenticated;

-- 13.5 RPC: remove_business_employee(p_user_id)
--      Owner removes an employee from their business.
CREATE OR REPLACE FUNCTION public.remove_business_employee(p_user_id UUID)
RETURNS JSON
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
  v_role TEXT;
  v_target_role TEXT;
BEGIN
  v_business_id := public.get_user_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد نشاط تجاري مرتبط بحسابك';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role != 'owner' THEN
    RAISE EXCEPTION 'فقط المالك يمكنه إزالة موظفين';
  END IF;

  SELECT role INTO v_target_role
  FROM public.profiles
  WHERE id = p_user_id AND business_id = v_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الموظف غير موجود في نشاطك التجاري';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'لا يمكن إزالة المالك';
  END IF;

  UPDATE public.profiles
  SET business_id = NULL, role = 'employee'
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_business_employee TO authenticated;

-- 13.6 RPC: update_business_settings
--      Owner updates business name, slug, and settings JSON.
CREATE OR REPLACE FUNCTION public.update_business_settings(
  p_name      TEXT,
  p_slug      TEXT,
  p_settings  JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
  v_role TEXT;
  v_slug_taken BOOLEAN;
BEGIN
  v_business_id := public.get_user_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد نشاط تجاري مرتبط بحسابك';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role != 'owner' THEN
    RAISE EXCEPTION 'فقط المالك يمكنه تعديل الإعدادات';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE slug = p_slug AND id != v_business_id
  ) INTO v_slug_taken;

  IF v_slug_taken THEN
    RAISE EXCEPTION 'الرابط مستخدم بالفعل';
  END IF;

  UPDATE public.businesses
  SET name = p_name, slug = p_slug, settings = p_settings
  WHERE id = v_business_id;

  RETURN json_build_object('success', true, 'slug', p_slug);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_business_settings TO authenticated;

-- =============================================================================
-- 14. Push Notifications
-- =============================================================================

-- 14.1 Create PostgreSQL role for customer JWT
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'customer') THEN
    CREATE ROLE customer;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO customer;

-- 14.2 Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  ticket_id     UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  public_token  UUID NOT NULL,
  endpoint      TEXT NOT NULL,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14.3 Indexes
CREATE INDEX IF NOT EXISTS idx_push_sub_ticket   ON public.push_subscriptions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_token    ON public.push_subscriptions(public_token);
CREATE INDEX IF NOT EXISTS idx_push_sub_business ON public.push_subscriptions(business_id);

-- 14.4 RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Customer can manage their own subscription (matching public_token = JWT sub)
CREATE POLICY "customer_ins_push_sub" ON public.push_subscriptions
  FOR INSERT WITH CHECK (
    auth.jwt()->>'role' = 'customer'
    AND public_token = (auth.jwt()->>'sub')::uuid
  );

CREATE POLICY "customer_sel_push_sub" ON public.push_subscriptions
  FOR SELECT USING (
    auth.jwt()->>'role' = 'customer'
    AND public_token = (auth.jwt()->>'sub')::uuid
  );

CREATE POLICY "customer_del_push_sub" ON public.push_subscriptions
  FOR DELETE USING (
    auth.jwt()->>'role' = 'customer'
    AND public_token = (auth.jwt()->>'sub')::uuid
  );

-- Authenticated users (merchants) can read subscriptions for their business
CREATE POLICY "auth_sel_push_sub" ON public.push_subscriptions
  FOR SELECT USING (
    business_id = public.get_user_business_id()
  );

GRANT INSERT, SELECT, DELETE ON public.push_subscriptions TO customer;

-- 14.5 RPC: save_push_subscription (SECURITY DEFINER, fallback if JWT role fails)
CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_ticket_id    UUID,
  p_public_token UUID,
  p_endpoint     TEXT,
  p_p256dh       TEXT,
  p_auth         TEXT
)
RETURNS JSON
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  SELECT business_id INTO v_business_id
  FROM public.tickets
  WHERE id = p_ticket_id AND public_token = p_public_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found or token mismatch';
  END IF;

  INSERT INTO public.push_subscriptions (business_id, ticket_id, public_token, endpoint, p256dh, auth)
  VALUES (v_business_id, p_ticket_id, p_public_token, p_endpoint, p_p256dh, p_auth)
  ON CONFLICT (ticket_id) DO UPDATE
  SET endpoint = p_endpoint, p256dh = p_p256dh, auth = p_auth, updated_at = now();

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_push_subscription TO anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription TO customer;

-- 14.6 RPC: delete_push_subscription
CREATE OR REPLACE FUNCTION public.delete_push_subscription(
  p_public_token UUID,
  p_endpoint     TEXT
)
RETURNS JSON
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.push_subscriptions
  WHERE public_token = p_public_token AND endpoint = p_endpoint;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_push_subscription TO anon;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription TO customer;
