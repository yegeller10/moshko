import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-xl border border-border bg-white px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
