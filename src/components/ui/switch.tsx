import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    dir="ltr"
    className={cn(
      "peer relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-border/60 bg-input/80 p-0.5 transition-[background-color,border-color] data-[state=checked]:border-primary/40 data-[state=checked]:bg-primary/85 data-[state=unchecked]:bg-input/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none absolute left-0.5 top-1/2 block h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-[0_3px_10px_rgba(0,0,0,0.35)] ring-0 transition-transform duration-200 will-change-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
