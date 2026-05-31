import * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-emerald-500/20 text-emerald-400": variant === "success",
          "bg-amber-500/20 text-amber-400": variant === "warning",
          "bg-destructive/20 text-destructive": variant === "destructive",
          "bg-white/10 text-foreground/80": variant === "default",
          "bg-white/5 text-foreground/60": variant === "secondary",
          "border border-white/20 text-foreground/70": variant === "outline",
        },
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
export type { BadgeProps }
