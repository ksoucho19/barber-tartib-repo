"use client"

import { QRCodeSVG } from "qrcode.react"

interface QrPosterProps {
  type: "queue" | "display"
  businessName: string
  slug: string
  url: string
  logo?: string | null
}

export function QrPoster({ type, businessName, slug, url, logo }: QrPosterProps) {
  const title =
    type === "queue"
      ? "احجز دورك مباشرة"
      : "شاشة الانتظار المباشرة"

  const description =
    type === "queue"
      ? "امسح الرمز بهاتفك وانضم إلى قائمة الانتظار فوراً"
      : "امسح الرمز لعرض شاشة الطابور المباشرة"

  return (
    <div className="flex h-full w-full items-center justify-center bg-white" dir="rtl">
      <style>
        {`
          @media print {
            @page { size: A4; margin: 0; }
          }
          .poster-container { width: 210mm; height: 297mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rem; padding: 3rem; text-align: center; }
        `}
      </style>
      <div className="poster-container">
        {logo ? (
          <img src={logo} alt={businessName} className="h-20 w-20 rounded-3xl object-cover shadow-lg" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600 shadow-lg">
            <span className="text-4xl font-bold text-white">د</span>
          </div>
        )}

        {!logo && (
          <h1 className="text-4xl font-bold text-gray-900">{businessName}</h1>
        )}

        <div className="rounded-2xl border-4 border-gray-200 p-4">
          <QRCodeSVG
            value={url}
            size={320}
            level="H"
            bgColor="#ffffff"
            fgColor="#000000"
            includeMargin
          />
        </div>

        <p className="text-3xl font-bold text-gray-800">{title}</p>
        <p className="max-w-md text-xl text-gray-500">{description}</p>

        <div className="rounded-xl bg-gray-100 px-6 py-3" dir="ltr">
          <code className="font-mono text-lg text-gray-700">{url}</code>
        </div>

        <p className="mt-4 text-sm text-gray-400">
          بدعم من <span className="font-semibold text-emerald-600">دورك</span>
        </p>
      </div>
    </div>
  )
}
