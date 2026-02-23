import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius)] px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent-muted)] text-[var(--accent)]",
        secondary: "bg-[var(--surface-active)] text-[var(--foreground-muted)]",
        destructive: "bg-[var(--loss-muted)] text-[var(--loss)]",
        outline: "border border-[var(--border)] text-[var(--foreground-muted)]",
        gain: "bg-[var(--gain-muted)] text-[var(--gain)]",
        warning: "bg-[rgba(255,193,7,0.15)] text-[var(--warning)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
