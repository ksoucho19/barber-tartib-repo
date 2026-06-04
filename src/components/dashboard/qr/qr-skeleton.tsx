"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function QrSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="جارٍ التحميل">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-8 w-48" />
        <Skeleton variant="text" className="h-4 w-72" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-6">
              <div className="space-y-2 text-center">
                <Skeleton variant="text" className="mx-auto h-6 w-40" />
                <Skeleton variant="text" className="mx-auto h-4 w-24" />
              </div>
              <Skeleton variant="rectangular" className="h-[260px] w-[260px]" />
              <Skeleton variant="rectangular" className="h-12 w-full max-w-sm" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton variant="rectangular" className="h-11 w-full" />
                <Skeleton variant="rectangular" className="h-11 w-full" />
                <Skeleton variant="rectangular" className="h-11 w-full" />
                <Skeleton variant="rectangular" className="h-11 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
