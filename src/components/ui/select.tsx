import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-xl border border-border bg-white px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
