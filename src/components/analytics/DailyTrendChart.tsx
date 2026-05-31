"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface DailyTrendChartProps {
  data: { date: string; count: number }[]
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00")
  const day = d.toLocaleDateString("ar-SA", { weekday: "short" })
  const num = d.getDate()
  return `${day} ${num}`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/20 bg-[#1a1a2e] px-4 py-3 backdrop-blur-2xl shadow-2xl">
      <p className="text-xs text-foreground/50 mb-1">{formatDate(label ?? "")}</p>
      <p className="text-sm font-bold text-emerald-400">
        {payload[0].value} تذكرة
      </p>
    </div>
  )
}

export function DailyTrendChart({ data }: DailyTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-foreground/30">
        <p className="text-sm">لا توجد بيانات كافية</p>
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const reversed = [...data].reverse()

  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={reversed} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, Math.max(maxCount + 2, 5)]}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="count"
            stroke="rgb(52,211,153)"
            strokeWidth={2}
            dot={{ fill: "rgb(52,211,153)", r: 3, strokeWidth: 2, stroke: "#0a0a0f" }}
            activeDot={{ r: 5, fill: "rgb(52,211,153)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
