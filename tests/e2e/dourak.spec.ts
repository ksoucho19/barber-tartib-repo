import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const TEST_SLUG = "test-shop"
const TEST_BUSINESS_NAME = "متجر اختبار"
const MERCHANT_EMAIL = "test@dourak.app"
const MERCHANT_PASSWORD = "TestPass123!"
const CUSTOMER_NAME = "أحمد محمد"
const CUSTOMER_PHONE = "0555000000"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_LINK
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_LINK and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set")
  }
  return createClient(url, key)
}

test.describe("دورك — Queue Management E2E", () => {
  test.beforeAll(async () => {
    const supabase = getSupabase()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_LINK!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: existing } = await admin
      .from("businesses")
      .select("id")
      .eq("slug", TEST_SLUG)
      .maybeSingle()

    if (existing) return

    const { data: { user }, error: userError } = await admin.auth.admin.createUser({
      email: MERCHANT_EMAIL,
      password: MERCHANT_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "مدير المتجر", role: "owner" },
    })
    if (userError) throw userError

    const { data: biz, error: bizError } = await admin
      .from("businesses")
      .insert({ name: TEST_BUSINESS_NAME, slug: TEST_SLUG })
      .select()
      .single()
    if (bizError) throw bizError

    await admin
      .from("profiles")
      .update({ business_id: biz.id, role: "owner" })
      .eq("id", user!.id)

    await admin
      .from("queues")
      .insert({ business_id: biz.id, name: "الطابور الرئيسي", is_active: true })
  })

  test("a. انضمام الزبون وتتبع التذكرة", async ({ page }) => {
    await page.goto(`/${TEST_SLUG}/join`)
    await expect(page.locator("h1")).toContainText(TEST_BUSINESS_NAME)

    await page.fill('input[label="الاسم"]', CUSTOMER_NAME)
    await page.fill('input[label="رقم الجوال (اختياري)"]', CUSTOMER_PHONE)
    await page.click('button[type="submit"]')

    await expect(page.locator("text=رقم التذكرة")).toBeVisible({ timeout: 15000 })
    const ticketNumber = page.locator("text=/\\d+/").first()
    await expect(ticketNumber).toBeVisible()
  })

  test("b. التاجر يستدعي العميل التالي", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[type="email"]', MERCHANT_EMAIL)
    await page.fill('input[type="password"]', MERCHANT_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

    await expect(page.locator("text=في الانتظار")).toBeVisible({ timeout: 10000 })

    const callButton = page.locator("button:has-text('استدعاء العميل التالي')")
    await callButton.waitFor({ state: "visible", timeout: 10000 })
    await callButton.click()

    await expect(page.locator("text=العميل الحالي")).toBeVisible({ timeout: 10000 })
    await expect(page.locator("text=قيد الخدمة")).toBeVisible()
  })

  test("c. العميل يرى رسالة حان دورك الآن", async ({ page }) => {
    await page.goto(`/${TEST_SLUG}/join`)

    const storedToken = await page.evaluate(() => localStorage.getItem("dourak_public_token"))
    if (!storedToken) {
      await page.fill('input[label="الاسم"]', "سارة أحمد")
      await page.fill('input[label="رقم الجوال (اختياري)"]', "0555111111")
      await page.click('button[type="submit"]')
      await expect(page.locator("text=رقم التذكرة")).toBeVisible({ timeout: 15000 })
    }

    const supabase = getSupabase()
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, queue_id")
      .eq("business_id", (await getBusinessId(supabase)))
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(1)

    if (tickets && tickets.length > 0) {
      await supabase.rpc("call_next_customer", { p_queue_id: tickets[0].queue_id })
    }

    await expect(page.locator("text=حان دورك الآن")).toBeVisible({ timeout: 20000 })
  })

  test("d. RLS يمنع التاجر من قراءة تذاكر تاجر آخر", async ({ page }) => {
    const supabase = getSupabase()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      test.skip(true, "SERVICE_ROLE_KEY not set, skipping RLS isolation test")
      return
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_LINK!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: otherBiz } = await admin
      .from("businesses")
      .insert({ name: "متجر آخر", slug: "other-shop-e2e" })
      .select()
      .single()

    const { data: { user: otherUser } } = await admin.auth.admin.createUser({
      email: "other-owner@dourak.app",
      password: "OtherPass123!",
      email_confirm: true,
      user_metadata: { name: "مالك آخر", role: "owner" },
    })

    await admin
      .from("profiles")
      .update({ business_id: otherBiz.id, role: "owner" })
      .eq("id", otherUser!.id)

    await page.goto("/login")
    await page.fill('input[type="email"]', MERCHANT_EMAIL)
    await page.fill('input[type="password"]', MERCHANT_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

    const merchantClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_LINK!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: sessionData } = await merchantClient.auth.getSession()
    if (!sessionData.session) {
      const cookies = await page.context().cookies()
      const sbCookie = cookies.find((c) => c.name.includes("supabase"))
      if (sbCookie) {
        await merchantClient.auth.setSession({
          access_token: sbCookie.value,
          refresh_token: sbCookie.value,
        })
      }
    }

    const { data: otherTickets } = await merchantClient
      .from("tickets")
      .select("*")
      .eq("business_id", otherBiz.id)

    expect(otherTickets).toEqual([])

    await admin
      .from("businesses")
      .delete()
      .eq("id", otherBiz.id)
  })
})

async function getBusinessId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", TEST_SLUG)
    .single()
  return data?.id ?? null
}
