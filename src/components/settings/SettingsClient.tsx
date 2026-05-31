"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/components/ui/toaster"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { PageTransition } from "@/components/layout/PageTransition"
import { motion } from "framer-motion"

interface BusinessData {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
}

interface EmployeeData {
  user_id: string
  email: string
  name: string | null
  phone: string | null
  role: string
}

interface SettingsClientProps {
  business: BusinessData
  currentUserRole: string
  initialEmployees: EmployeeData[]
}

export function SettingsClient({
  business,
  currentUserRole,
  initialEmployees,
}: SettingsClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const isOwner = currentUserRole === "owner"

  const [name, setName] = useState(business.name)
  const [slug, setSlug] = useState(business.slug)
  const [defaultDuration, setDefaultDuration] = useState(
    String((business.settings as { default_service_duration_minutes?: number })
      ?.default_service_duration_minutes ?? 15),
  )
  const [screenColor, setScreenColor] = useState(
    String((business.settings as { screen_color?: string })?.screen_color ?? "#064e3b"),
  )
  const [welcomeMessage, setWelcomeMessage] = useState(
    String((business.settings as { welcome_message?: string })?.welcome_message ?? ""),
  )

  const [saving, setSaving] = useState(false)
  const [slugError, setSlugError] = useState("")
  const [nameError, setNameError] = useState("")

  const handleSave = useCallback(async () => {
    setSlugError("")
    setNameError("")

    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()

    if (!trimmedName) {
      setNameError("الاسم مطلوب")
      return
    }
    if (!trimmedSlug) {
      setSlugError("الرابط مطلوب")
      return
    }
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      setSlugError("الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط")
      return
    }

    setSaving(true)

    const { error } = await supabase.rpc("update_business_settings", {
      p_name: trimmedName,
      p_slug: trimmedSlug,
      p_settings: {
        default_service_duration_minutes: parseInt(defaultDuration, 10) || 15,
        screen_color: screenColor,
        welcome_message: welcomeMessage,
      },
    })

    if (error) {
      if (error.message.includes("الرابط مستخدم بالفعل")) {
        setSlugError("الرابط مستخدم بالفعل")
      } else {
        toast(error.message, "error")
      }
      setSaving(false)
      return
    }

    toast("تم حفظ الإعدادات بنجاح", "success")
    setSaving(false)
    router.refresh()
  }, [name, slug, defaultDuration, screenColor, welcomeMessage, supabase, router])

  const [employees, setEmployees] = useState<EmployeeData[]>(initialEmployees)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addEmail, setAddEmail] = useState("")
  const [addError, setAddError] = useState("")
  const [adding, setAdding] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<EmployeeData | null>(null)

  const refreshEmployees = useCallback(async () => {
    const { data } = await supabase.rpc("get_business_employees")
    if (Array.isArray(data)) {
      setEmployees(
        data.map((e: Record<string, unknown>) => ({
          user_id: e.user_id as string,
          email: e.email as string,
          name: (e.name as string) ?? null,
          phone: (e.phone as string) ?? null,
          role: e.role as string,
        })),
      )
    }
  }, [supabase])

  const handleAddEmployee = useCallback(async () => {
    setAddError("")
    const trimmed = addEmail.trim()
    if (!trimmed) {
      setAddError("يرجى إدخال البريد الإلكتروني")
      return
    }

    setAdding(true)
    const { error } = await supabase.rpc("add_business_employee", {
      p_email: trimmed,
    })

    if (error) {
      setAddError(error.message)
      setAdding(false)
      return
    }

    toast("تم إضافة الموظف بنجاح", "success")
    setAddDialogOpen(false)
    setAddEmail("")
    setAdding(false)
    await refreshEmployees()
  }, [addEmail, supabase, refreshEmployees])

  const handleRemoveEmployee = useCallback(async () => {
    if (!removeTarget) return

    const { error } = await supabase.rpc("remove_business_employee", {
      p_user_id: removeTarget.user_id,
    })

    if (error) {
      toast(error.message, "error")
    } else {
      toast("تم إزالة الموظف", "info")
    }

    setRemoveTarget(null)
    await refreshEmployees()
  }, [removeTarget, supabase, refreshEmployees])

  return (
    <PageTransition>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="mt-0.5 text-sm text-foreground/50">
          إدارة النشاط التجاري والموظفين
        </p>
      </div>

      {!isOwner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300 ring-1 ring-amber-500/20"
          role="status"
        >
          لديك صلاحية قراءة فقط. المالك فقط يمكنه تعديل الإعدادات.
        </motion.div>
      )}

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">معلومات النشاط التجاري</h2>
        <div className="space-y-5 glass rounded-2xl p-6">
          <div>
            <Label htmlFor="name">اسم النشاط التجاري</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameError("")
              }}
              disabled={!isOwner}
              error={nameError}
            />
          </div>

          <div>
            <Label htmlFor="slug">الرابط (slug)</Label>
            <div className="mt-1 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-foreground/30">
              <span>{process.env.NEXT_PUBLIC_SITE_URL ?? "https://dourak.app"}/</span>
            </div>
            <Input
              id="slug"
              dir="ltr"
              className="text-left font-mono text-sm"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                setSlugError("")
              }}
              disabled={!isOwner}
              error={slugError}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="duration">مدة الخدمة الافتراضية (دقيقة)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={120}
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(e.target.value)}
                disabled={!isOwner}
              />
            </div>

            <div>
              <Label htmlFor="screenColor">لون شاشة العرض</Label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  id="screenColor"
                  type="color"
                  value={screenColor}
                  onChange={(e) => setScreenColor(e.target.value)}
                  disabled={!isOwner}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-white/10 bg-transparent disabled:opacity-40"
                />
                <span className="font-mono text-xs text-foreground/50">
                  {screenColor}
                </span>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="welcomeMsg">رسالة الترحيب (شاشة العرض)</Label>
            <Input
              id="welcomeMsg"
              placeholder="مرحباً بكم في…"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              disabled={!isOwner}
            />
          </div>

          {isOwner && (
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="min-w-[120px]"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    جارٍ الحفظ…
                  </span>
                ) : (
                  "حفظ الإعدادات"
                )}
              </Button>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">الموظفون</h2>
            <p className="text-sm text-foreground/50">
              {employees.length} موظف
            </p>
          </div>
          {isOwner && (
            <Button
              size="sm"
              onClick={() => {
                setAddEmail("")
                setAddError("")
                setAddDialogOpen(true)
              }}
            >
              إضافة موظف
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-12">
              <svg
                className="mb-4 h-10 w-10 text-foreground/20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p className="text-sm text-foreground/30">
                لا يوجد موظفون بعد
              </p>
              <p className="mt-1 text-xs text-foreground/20">
                أضف موظفين لمساعدتك في إدارة الطابور
              </p>
            </div>
          ) : (
            employees.map((emp, i) => (
              <motion.div
                key={emp.user_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <span className="text-sm font-bold text-foreground/60">
                      {emp.name?.charAt(0) ?? emp.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {emp.name ?? "بدون اسم"}
                    </p>
                    <p className="truncate text-xs text-foreground/40">
                      {emp.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-foreground/50">
                    {emp.role === "owner" ? "مالك" : "موظف"}
                  </span>
                  {emp.role !== "owner" && isOwner && (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(emp)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      aria-label="إزالة الموظف"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة موظف جديد</DialogTitle>
            <DialogDescription>
              أدخل البريد الإلكتروني للموظف. يجب أن يكون مسجلاً في النظام مسبقاً.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              label="البريد الإلكتروني"
              type="email"
              dir="ltr"
              className="text-left font-mono text-sm"
              placeholder="employee@example.com"
              value={addEmail}
              onChange={(e) => {
                setAddEmail(e.target.value)
                setAddError("")
              }}
            />
            {addError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400"
                role="alert"
              >
                {addError}
              </motion.p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAddDialogOpen(false)}
              disabled={adding}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleAddEmployee}
              disabled={adding || !addEmail.trim()}
            >
              {adding ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  جارٍ الإضافة…
                </span>
              ) : (
                "إضافة"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد إزالة الموظف</DialogTitle>
            <DialogDescription>
              سيتم إزالة {removeTarget?.name ?? removeTarget?.email ?? "الموظف"} من
              قائمة الموظفين ومنعه من الوصول إلى لوحة التحكم. هذا الإجراء لا يمكن
              التراجع عنه.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRemoveTarget(null)}
            >
              تراجع
            </Button>
            <Button
              onClick={handleRemoveEmployee}
              className="bg-red-600/80 hover:bg-red-600 text-white"
            >
              إزالة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}
