import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        scheduled: "bg-status-pending-bg text-status-pending",
        confirmed: "bg-status-confirmed-bg text-status-confirmed",
        cancelled: "bg-status-cancelled-bg text-status-cancelled",
        no_show: "bg-status-noshow-bg text-status-noshow",
        completed: "bg-neutral-100 text-neutral-600",
        waiting: "bg-status-pending-bg text-status-pending",
        offered: "bg-status-pending-bg text-status-pending",
        claimed: "bg-status-confirmed-bg text-status-confirmed",
        expired: "bg-neutral-100 text-neutral-600",
        neutral: "bg-neutral-100 text-neutral-700",
      },
    },
    defaultVariants: {
      status: "neutral",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, status, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ status }), className)} {...props} />
  );
}
