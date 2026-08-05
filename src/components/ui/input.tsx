import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
