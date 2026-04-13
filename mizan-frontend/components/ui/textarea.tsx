"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn("input-sanctuary w-full min-h-[120px] resize-vertical", className)}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";

export { Textarea };
