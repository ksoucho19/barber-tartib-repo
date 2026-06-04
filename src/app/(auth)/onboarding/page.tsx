"use client"

import { useState, type FormEvent, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-]|[-]$/g, "")
}

export default function OnboardingPage() {
  const router = useRouter()

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [defaultDuration, setDefaultDuration] = useState("15")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login")
        return
      }
      supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.business_id) {
            router.push("/dashboard")
            return
          }
          setLoading(false)
        })
    })
  }, [router, supabase])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManuallyEdited) {
      setSlug(slugify(value))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()
    const duration = parseInt(defaultDuration, 10)

    if (!trimmedName) {
      setError("يرجى إدخال اسم النشاط التجاري")
      setSubmitting(false)
      return
    }
    if (!trimmedSlug) {
      setError("يرجى إدخال الرابط المختصر")
      setSubmitting(false)
      return
    }
    if (isNaN(duration) || duration < 1) {
      setError("مدة الخدمة الافتراضية يجب أن تكون رقماً صحيحاً موجباً")
      setSubmitting(false)
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data: business, error: bizError } = await supabase
        .from("businesses")
        .insert({
          name: trimmedName,
          slug: trimmedSlug,
          settings: { default_service_duration_minutes: duration },
        })
        .select()
        .single()

      if (bizError) {
        if (bizError.message.includes("slug")) {
          throw new Error("الرابط المختصر مستخدم بالفعل، يرجى اختيار رابط آخر")
        }
        throw bizError
      }

      const { error: rpcError } = await supabase.rpc("set_user_business_id", {
        p_business_id: business.id,
      })

      if (rpcError) throw rpcError

      const { error: queueError } = await supabase.from("queues").insert({
        business_id: business.id,
        name: "الطابور الرئيسي",
        is_active: true,
      })

      if (queueError) throw queueError

      router.push("/dashboard")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </main>
    )
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f] px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-1/3 top-1/4 h-72 w-72 rounded-full bg-primary/15 blur-[128px]" />
        <div className="absolute bottom-1/3 left-1/4 h-96 w-96 rounded-full bg-purple-500/10 blur-[128px]" />
      </div>

      <Card className="w-full max-w-lg animate-fade-in-up">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 ring-1 ring-primary/30">
            <span className="text-2xl font-bold text-primary">د</span>
          </div>
          <CardTitle className="text-2xl">مرحباً بك في دورك</CardTitle>
          <CardDescription>لنبدأ بإعداد نشاطك التجاري — خطوة واحدة فقط</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="اسم النشاط التجاري"
              placeholder="مثال: صالون الجمال العربي"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />

            <Input
              label="الرابط المختصر"
              placeholder="arabic-beauty-salon"
              value={slug}
              onChange={(e) => {
                setSlugManuallyEdited(true)
                setSlug(slugify(e.target.value))
              }}
              required
              dir="ltr"
              className="text-left"
            />

            <Input
              label="مدة الخدمة الافتراضية (بالدقائق)"
              type="number"
              placeholder="15"
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(e.target.value)}
              min={1}
              required
              dir="ltr"
              className="text-left"
            />

            {error && (
              <div className="animate-fade-in rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20">
                {error}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  جارٍ إنشاء النشاط التجاري…
                </span>
              ) : (
                "إنشاء النشاط التجاري"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
