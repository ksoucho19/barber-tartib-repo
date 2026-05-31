import type { Metadata } from "next"
import "./globals.css"
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "دورك — إدارة طوابير رقمية",
  description: "منصة رقمية لإدارة طوابير الانتظار للمحلات والمراكز الخدمية",
  icons: {
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "دورك",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>
      <body className="font-cairo antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
