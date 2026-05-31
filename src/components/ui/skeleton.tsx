import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular"
}

function Skeleton({ className, variant = "text", ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="جارٍ التحميل"
      className={cn(
        "animate-pulse bg-white/10",
        variant === "circular" && "rounded-full",
        variant === "rectangular" && "rounded-xl",
        variant === "text" && "h-4 w-full rounded",
        className,
      )}
      {...props}
    />
  )
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" className="h-11 w-11 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="rectangular" className="h-11 w-11 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-3/6" />
          <Skeleton className="h-6 w-2/6" />
        </div>
      </div>
    </div>
  )
}

export { Skeleton, SkeletonCard, SkeletonStatCard }
