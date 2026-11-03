import * as React from "react"
import { cn } from "../../lib/utils"

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) => (
    <input
        className={cn(
            "flex h-11 w-full rounded-xl border border-line-light bg-white/[0.05] px-3 py-2 text-sm text-ink shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 focus-visible:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50",
            className
        )}
        {...props}
    />
);

export { Input }
