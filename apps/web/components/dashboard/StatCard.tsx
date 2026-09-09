import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export interface StatCardProps {
  label: string;
  value: number;
  icon?: ComponentType<{ className?: string }>;
  tone?: "neutral" | "warning" | "danger";
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "bg-brand-50 text-brand-700",
  warning: "bg-status-pending-bg text-status-pending",
  danger: "bg-status-cancelled-bg text-status-cancelled",
};

export function StatCard({ label, value, icon: Icon, tone = "neutral" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4 pt-4 sm:p-6 sm:pt-6">
        {Icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <p className="text-2xl font-semibold text-neutral-900">{value}</p>
          <p className="text-sm text-neutral-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
