import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-150",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_oklch(0.463_0.170_264_/_20%)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
