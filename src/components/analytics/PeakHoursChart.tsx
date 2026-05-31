"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface PeakHoursChartProps {
  data: { hour: number; count: number }[]
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`
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
      <p className="text-xs text-foreground/50 mb-1">{label}</p>
      <p className="text-sm font-bold text-blue-400">
        {payload[0].value} تذكرة
      </p>
    </div>
  )
}

export function PeakHoursChart({ data }: PeakHoursChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-foreground/30">
        <p className="text-sm">لا توجد بيانات اليوم</p>
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const reversed = [...data].reverse()

  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={reversed} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="hour"
            tickFormatter={formatHour}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, Math.max(maxCount + 1, 4)]}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="count"
            fill="rgb(96,165,250)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
