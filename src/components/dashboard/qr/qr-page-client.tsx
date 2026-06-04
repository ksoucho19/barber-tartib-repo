"use client"

import { useRef, useState, useCallback } from "react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { PageTransition } from "@/components/layout/PageTransition"
import { QrCode, Copy, Download, Printer, ExternalLink, Check } from "lucide-react"

interface BusinessInfo {
  id: string
  name: string
  slug: string
}

interface QrCardProps {
  type: "queue" | "display"
  businessName: string
  slug: string
  url: string
}

function QrCard({ type, businessName, slug, url }: QrCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [downloadingPng, setDownloadingPng] = useState(false)
  const [downloadingSvg, setDownloadingSvg] = useState(false)
  const [printing, setPrinting] = useState(false)

  const label = type === "queue" ? "طابور العملاء" : "شاشة الانتظار"
  const filePrefix = type === "queue" ? "queue-qr" : "display-qr"

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast("تم نسخ الرابط بنجاح", "success")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast("فشل نسخ الرابط", "error")
    }
  }, [url])

  const handleDownloadPng = useCallback(() => {
    setDownloadingPng(true)
    const canvas = canvasRef.current
    if (!canvas) {
      toast("فشل تصدير الصورة", "error")
      setDownloadingPng(false)
      return
    }
    const link = document.createElement("a")
    link.download = `${filePrefix}-${slug}.png`
    link.href = canvas.toDataURL("image/png")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast("تم تحميل الصورة بنجاح", "success")
    setDownloadingPng(false)
  }, [slug, filePrefix])

  const handleDownloadSvg = useCallback(() => {
    setDownloadingSvg(true)
    const container = svgContainerRef.current
    if (!container) {
      toast("فشل تصدير SVG", "error")
      setDownloadingSvg(false)
      return
    }
    const svg = container.querySelector("svg")
    if (!svg) {
      toast("فشل تصدير SVG", "error")
      setDownloadingSvg(false)
      return
    }
    const data = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" })
    const link = document.createElement("a")
    link.download = `${filePrefix}-${slug}.svg`
    link.href = URL.createObjectURL(blob)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
    toast("تم تحميل SVG بنجاح", "success")
    setDownloadingSvg(false)
  }, [slug, filePrefix])

  const handlePrint = useCallback(() => {
    setPrinting(true)
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast("فشل فتح نافذة الطباعة، يرجى السماح بالنوافذ المنبثقة", "error")
      setPrinting(false)
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head><meta charset="utf-8"><title>${label} - ${businessName}</title></head>
      <body>
        <div id="poster-root"></div>
        <script>
          var svgHTML = ${JSON.stringify(
            svgContainerRef.current
              ? new XMLSerializer().serializeToString(
                  svgContainerRef.current.querySelector("svg")!
                )
              : ""
          )};
          var container = document.getElementById("poster-root");
          if (container) {
            container.innerHTML = [
              '<div style="width:210mm;height:297mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2rem;padding:3rem;text-align:center;font-family:sans-serif">',
              '<div style="width:80px;height:80px;border-radius:24px;background:#059669;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15)">',
              '<span style="font-size:32px;font-weight:bold;color:white">د</span></div>',
              '<h1 style="font-size:28px;font-weight:bold;color:#111;margin:0">${businessName}</h1>',
              '<div style="border:3px solid #e5e7eb;border-radius:16px;padding:12px">' + svgHTML + '</div>',
              '<p style="font-size:24px;font-weight:bold;color:#1f2937;margin:0">${type === "queue" ? "احجز دورك مباشرة" : "شاشة الانتظار المباشرة"}</p>',
              '<p style="font-size:18px;color:#6b7280;max-width:400px;margin:0">${type === "queue" ? "امسح الرمز بهاتفك وانضم إلى قائمة الانتظار فوراً" : "امسح الرمز لعرض شاشة الطابور المباشرة"}</p>',
              '<div style="background:#f3f4f6;border-radius:12px;padding:12px 24px;direction:ltr"><code style="font-size:16px;color:#374151">${url}</code></div>',
              '<p style="font-size:12px;color:#9ca3af;margin-top:16px">بدعم من <span style="font-weight:600;color:#059669">دورك</span></p>',
              '</div>'
            ].join("");
            window.print();
          }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
    setPrinting(false)
  }, [type, businessName, slug, url, label])

  const handleOpenPage = useCallback(() => {
    window.open(url, "_blank", "noopener,noreferrer")
  }, [url])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
    >
      <Card>
        <CardContent className="flex flex-col items-center p-8">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold">{businessName}</h2>
            <p className="mt-1 text-sm text-foreground/40" dir="ltr">
              {slug}
            </p>
            <span className="mt-2 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              {label}
            </span>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 blur-3xl" />
            <div className="relative rounded-2xl border border-white/10 bg-white p-4 shadow-2xl">
              <QRCodeCanvas
                key={url}
                ref={canvasRef}
                value={url}
                size={240}
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
                includeMargin
              />
            </div>
          </div>

          <div className="mt-6 w-full max-w-sm">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3" dir="ltr">
              <span className="flex-1 truncate text-sm text-foreground/60" dir="ltr">
                {url}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-lg p-1.5 text-foreground/40 transition-colors hover:text-emerald-400 hover:bg-emerald-500/10"
                aria-label="نسخ الرابط"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={handleDownloadPng}
              disabled={downloadingPng}
              className="gap-2"
              aria-label="تحميل PNG"
            >
              <Download className="h-4 w-4" />
              {downloadingPng ? "…" : "PNG"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownloadSvg}
              disabled={downloadingSvg}
              className="gap-2"
              aria-label="تحميل SVG"
            >
              <Download className="h-4 w-4" />
              {downloadingSvg ? "…" : "SVG"}
            </Button>
            <Button
              variant="secondary"
              onClick={handlePrint}
              disabled={printing}
              className="gap-2"
              aria-label="طباعة بوستر"
            >
              <Printer className="h-4 w-4" />
              {printing ? "…" : "طباعة"}
            </Button>
            <Button
              variant="ghost"
              onClick={handleOpenPage}
              className="gap-2"
              aria-label="فتح الصفحة"
            >
              <ExternalLink className="h-4 w-4" />
              فتح
            </Button>
          </div>

          <div
            ref={svgContainerRef}
            className="pointer-events-none absolute -z-10 opacity-0"
            aria-hidden="true"
          >
            <QRCodeSVG
              key={url}
              value={url}
              size={1200}
              level="H"
              bgColor="#ffffff"
              fgColor="#000000"
              includeMargin
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

interface QrPageClientProps {
  business: BusinessInfo
}

export function QrPageClient({ business }: QrPageClientProps) {
  const queueUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${business.slug}`
  const displayUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${business.slug}/display`

  return (
    <PageTransition>
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-500/30">
          <QrCode className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">رمز QR</h1>
          <p className="mt-1 text-sm text-foreground/50">
            استخدم رموز QR لتمكين العملاء من الانضمام للطابور بسهولة
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <QrCard
          type="queue"
          businessName={business.name}
          slug={business.slug}
          url={queueUrl}
        />
        <QrCard
          type="display"
          businessName={business.name}
          slug={business.slug}
          url={displayUrl}
        />
      </div>
    </PageTransition>
  )
}