// شارة التوثيق: ختم أزرق مموّج بعلامة صح بيضاء
// أو أيقونة شخص رمادية للمضاف يدويًا
import { Check, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  verified: boolean;
  manual?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};
const iconSizes = {
  sm: "size-2.5",
  md: "size-3",
  lg: "size-3.5",
};

export function VerifiedBadge({ verified, manual, size = "sm", className }: Props) {
  if (manual) {
    return (
      <span
        title="مُضاف يدويًا"
        className={cn(
          "inline-flex shrink-0 align-middle items-center justify-center rounded-full bg-muted text-muted-foreground border border-border/50",
          sizes[size],
          className
        )}
      >
        <User className={iconSizes[size]} />
      </span>
    );
  }
  if (verified) {
    return (
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="موثّق"
        className={cn(
          "inline-block shrink-0 align-middle overflow-visible",
          sizes[size],
          className
        )}
      >
        <title>موثّق</title>
        <g fill="#4DA3E6">
          <circle cx="50" cy="50" r="28" />
          <circle cx="50" cy="18" r="14" />
          <circle cx="66" cy="22.5" r="14" />
          <circle cx="77.5" cy="34" r="14" />
          <circle cx="82" cy="50" r="14" />
          <circle cx="77.5" cy="66" r="14" />
          <circle cx="66" cy="77.5" r="14" />
          <circle cx="50" cy="82" r="14" />
          <circle cx="34" cy="77.5" r="14" />
          <circle cx="22.5" cy="66" r="14" />
          <circle cx="18" cy="50" r="14" />
          <circle cx="22.5" cy="34" r="14" />
          <circle cx="34" cy="22.5" r="14" />
        </g>
        <path
          d="M35 52.5 46.5 63.5 67 44"
          fill="none"
          stroke="#FFF"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <span
      title="غير موثّق"
      className={cn(
        "inline-flex shrink-0 align-middle items-center justify-center rounded-full bg-warning/20 text-warning border border-warning/40",
        sizes[size],
        className
      )}
    >
      <span className="text-[10px] font-bold">!</span>
    </span>
  );
}
