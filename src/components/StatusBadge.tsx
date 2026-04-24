import { CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "verified" | "pending" | "awaiting" | "failed";

const config: Record<Variant, { icon: typeof CheckCircle2; label: string; cls: string }> = {
  verified: { icon: CheckCircle2, label: "موثّق", cls: "bg-success/15 text-success border-success/30" },
  pending: { icon: Clock, label: "معلّق", cls: "bg-warning/15 text-warning border-warning/30" },
  awaiting: { icon: RefreshCw, label: "بانتظار التأكيد", cls: "bg-primary/15 text-primary border-primary/30" },
  failed: { icon: XCircle, label: "ملغاة", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function StatusBadge({ variant, label, className }: { variant: Variant; label?: string; className?: string }) {
  const c = config[variant];
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", c.cls, className)}>
      <Icon className="size-3" />
      {label ?? c.label}
    </span>
  );
}
