import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full rounded-xl border border-border bg-white px-3 py-2 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
