/**
 * Primitive: Button
 *
 * Pre-themed Radix-slot-backed Button with Blue Hour.
 * Domain components import from here — never use raw <button> for
 * styled interactive surfaces.
 *
 * Supports `asChild` via @radix-ui/react-slot so callers can render
 * links, motion components, etc. while inheriting all Button styles.
 */
import { type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

/* ── Tokens ─────────────────────────────────────────────────────── */

const base = [
    "inline-flex items-center justify-center gap-2",
    "font-display font-semibold cursor-pointer",
    "press outline-none",
    "focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-room-base",
    "disabled:pointer-events-none disabled:opacity-50",
].join(" ");

const variants = {
    primary:
        "accent-fill",
    secondary:
        "bg-room-surface/80 border border-line text-ink hover:bg-room-surface-hover hover:border-line-strong",
    ghost:
        "text-ink-muted hover:text-ink hover:bg-white/5",
    text:
        "text-ink hover:text-accent",
    subtle:
        "text-ink-muted hover:text-accent hover:bg-accent/10",
    danger:
        "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20",
    card:
        "border border-line-light bg-room-deep text-ink hover:bg-white/[0.04] hover:border-line",
    cardPrimary:
        "border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 shadow-[inset_0_1px_rgba(255,255,255,0.1)] glow-accent",
    cardDanger:
        "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20",
} as const;

const sizes = {
    none: "",
    sm: "min-h-11 rounded-lg px-3.5 text-xs",
    md: "min-h-11 rounded-xl px-5 text-sm",
    lg: "min-h-12 rounded-2xl px-8 text-[15px] [--press-scale:1.025]",
    xl: "min-h-12 rounded-2xl px-8 text-[15px] [--press-scale:1.025]",
    icon: "h-11 w-11 rounded-xl",
    card: "flex-col gap-3 p-4 rounded-2xl text-[13px] tracking-wide",
} as const;

/* ── Types ──────────────────────────────────────────────────────── */

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Merge props onto child element instead of rendering a <button>. */
    asChild?: boolean;
}

/* ── Component ──────────────────────────────────────────────────── */

export const Button = ({ variant = "primary", size = "md", asChild = false, className = "", ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
    const Comp = asChild ? Slot : "button";
    return (
        <Comp
            className={cn(base, variants[variant], sizes[size], className)}
            {...props}
        />
    );
};
