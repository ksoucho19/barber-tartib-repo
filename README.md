# دورك — Dourak

منصة رقمية متعددة المستأجرين (multi‑tenant) لإدارة طوابير الانتظار للمحلات والمراكز الخدمية.  
مبنية على **Next.js 15 (App Router)**، **Supabase** (Auth + PostgreSQL + Realtime)، و **Tailwind CSS**.

## المكدس التقني

| الطبقة | التقنية |
|---|---|
| الإطار (Framework) | Next.js 15 (App Router + React 19) |
| قاعدة البيانات | Supabase PostgreSQL مع Row‑Level Security |
| المصادقة | Supabase Auth (جلسات + JWTs مخصصة للزبائن وشاشات العرض) |
| الوقت الفعلي | Supabase Realtime (تحديث التذاكر لحظياً) |
| الأنماط | Tailwind CSS + shadcn/ui (مخصص) |
| الحركات | Framer Motion |
| الحالة | Zustand |
| المخططات | Recharts |
| الخط | Cairo (Google Fonts) |
| الخدمة | Vercel (Edge Middleware + Serverless Functions) |

## هيكل المشروع

```
dourak/
├── public/                      # أصول ثابتة (manifest.json, sw.js, أيقونات PWA)
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── [slug]/
│   │   │   ├── join/            # صفحة انضمام الزبون
│   │   │   └── display/         # شاشة العرض العامة
│   │   ├── dashboard/           # لوحة التحكم (الطابور، التحليلات، الإعدادات)
│   │   ├── login/               # تسجيل دخول التاجر
│   │   ├── onboarding/          # إعداد النشاط التجاري الجديد
│   │   └── layout.tsx           # الـ Root Layout (RTL, Cairo font, PWA SW)
│   ├── components/
│   │   ├── analytics/           # التحليلات (StatCard, DailyTrendChart, PeakHoursChart)
│   │   ├── dashboard/           # لوحة التحكم (QuickStats, QueueList, TicketRow)
│   │   ├── display/             # شاشة العرض العامة
│   │   ├── join/                # انضمام الزبون (JoinQueueClient, TicketCard)
│   │   ├── layout/              # غلافات و sidebars
│   │   ├── providers/           # Realtime QueueProvider
│   │   ├── pwa/                 # PWA (ServiceWorkerRegister, InstallButton)
│   │   ├── settings/            # إعدادات النشاط التجاري
│   │   ├── ui/                  # مكونات واجهة عامة (Card, Button, Input, Dialog, Skeleton…)
│   │   └── wait-time/           # EstimatedWaitBadge
│   ├── hooks/                   # هوكس مخصصة (usePushNotifications, useTicketNotifications, useInstallPrompt)
│   ├── lib/
│   │   ├── supabase/            # عملاء Supabase (client, server, middleware, customer, display)
│   │   └── wait-time.ts         # خدمة وقت الانتظار
│   ├── stores/                  # Zustand stores (use-queue-store, use-business-store)
│   └── types/                   # أنواع TypeScript
├── supabase/
│   └── functions/               # Edge Functions (Deno)
│       ├── create-customer-token/   # إنشاء JWT للزبون
│       ├── create-display-token/    # إنشاء JWT لشاشة العرض
│       └── send-push-notification/  # إرسال الإشعارات عبر Web Push API
├── scripts/                     # أدوات مساعدة (توليد مفاتيح VAPID، أيقونات)
├── tests/
│   └── e2e/                     # اختبارات E2E (Playwright)
├── schema.sql                   # مخطط قاعدة البيانات الكامل
├── playwright.config.ts
├── vercel.json
└── next.config.ts
```

## تشغيل المشروع محلياً

### 1. المتطلبات

- Node.js 20+
- npm 10+
- Supabase CLI (اختياري، لنشر Edge Functions)

### 2. التثبيت

```bash
git clone <repo-url>
cd dourak
npm install
```

### 3. إعداد Supabase

#### a. تشغيل قاعدة البيانات

1. افتح [Supabase Dashboard](https://supabase.com) وأنشئ مشروعاً جديداً.
2. اذهب إلى **SQL Editor**، والصق محتوى `schema.sql` بالكامل، ثم نفّذه.
3. اذهب إلى **Database → Replication**، وفعّل نشر `tickets` في Realtime.

#### b. إعداد المصادقة

في **Authentication → Settings**:
- فعّل البريد الإلكتروني/كلمة السر.
- أضف رابط إعادة التوجيه `http://localhost:3000` تحت **Redirect URLs**.

#### c. إعداد متغيرات البيئة

انسخ ملف `.env.example` إلى `.env.local` واملأ القيم:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_JWT_SECRET=<your-jwt-secret>

# VAPID Keys (شاهد الخطوة التالية)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@dourak.app
```

### 4. توليد مفاتيح VAPID (للإشعارات)

```bash
node scripts/generate-vapid-keys.mjs
```

هذا سيضيف المفاتيح تلقائياً إلى `.env.local`.

### 5. نشر Edge Functions

```bash
# سجّل الدخول إلى Supabase CLI
npx supabase login

# انشر الدوال
npx supabase functions deploy create-customer-token
npx supabase functions deploy create-display-token
npx supabase functions deploy send-push-notification
```

### 6. إعداد Webhook للإشعارات

في Supabase Dashboard → **Database → Webhooks**:
- أنشئ Webhook جديداً.
- الجدول: `tickets`
- الحدث: `UPDATE`
- الرابط: `<YOUR_SUPABASE_URL>/functions/v1/send-push-notification`
- الطريقة: `HTTP POST`

### 7. تشغيل الخادم المحلي

```bash
npm run dev
```

افتح `http://localhost:3000` في المتصفح.

### 8. تشغيل الاختبارات

تأكد من تشغيل الخادم المحلي أولاً:

```bash
npm run build && npm start
# أو
npm run dev

# في نافذة أخرى:
npx playwright test
```

## النشر على Vercel

### 1. ربط المستودع

1. اذهب إلى [Vercel Dashboard](https://vercel.com) وأنشئ مشروعاً جديداً.
2. اربط مستودع GitHub.
3. سيتم الكشف عن إعدادات Next.js تلقائياً (بفضل `vercel.json`).

### 2. إضافة متغيرات البيئة

في إعدادات المشروع على Vercel → **Environment Variables**، أضف:

| المتغير | المصدر |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API (`service_role` key) |
| `SUPABASE_JWT_SECRET` | Supabase Dashboard → Settings → API → JWT Secret |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | من `scripts/generate-vapid-keys.mjs` |
| `VAPID_PRIVATE_KEY` | من `scripts/generate-vapid-keys.mjs` |
| `VAPID_SUBJECT` | `mailto:admin@dourak.app` |

### 3. النشر

ادفع إلى الفرع الرئيسي (main/master) وسيقوم Vercel بالنشر تلقائياً.

### 4. ما بعد النشر

- حدّث **Redirect URLs** في Supabase Auth لتشمل رابط Vercel.
- إذا كنت تستخدم Edge Functions، تأكد من نشرها عبر Supabase CLI وتحديث Webhook.

## لقطات الشاشة

(يُضاف لاحقاً)

## المساهمة

نرحب بالمساهمات! يرجى فتح Issue أو Pull Request.

## الترخيص

MIT
