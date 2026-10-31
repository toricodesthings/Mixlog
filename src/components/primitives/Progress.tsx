import { cn } from "../../lib/utils";

/**
 * How far something has gone, like a transport's position: a fader scale behind, the sent part lit, a bright
 * playhead where it's at. `value` is 0–1; `valueText` is what a screen reader hears ("12.4 of 48.0 MB").
 */
export function Progress({ value, label, valueText, className }: { value: number; label: string; valueText?: string; className?: string }) {
    const share = Math.min(1, Math.max(0, value));
    return (
        <span
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(share * 100)}
            aria-valuetext={valueText}
            className={cn(
                "relative block h-2 rounded-full bg-room-surface-muted shadow-[inset_0_0_0_1px_var(--color-line)]",
                // The fader scale: a tick every tenth.
                "bg-[repeating-linear-gradient(90deg,transparent_0_calc(10%-1px),var(--color-line-strong)_calc(10%-1px)_10%)]",
                className,
            )}
        >
            <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-accent/35 to-accent shadow-[0_0_10px_var(--accent)] transition-[width] duration-(--duration-smooth) ease-(--ease-out-expo)"
                style={{ width: `${share * 100}%` }}
            >
                {share > 0 && share < 1 && <span className="absolute -top-0.5 -right-px -bottom-0.5 w-0.5 rounded-full bg-ink shadow-[0_0_6px_var(--accent)]" />}
            </span>
        </span>
    );
}
