import { useId } from "react";

import { cn } from "../../lib/utils";

const ARROW = { up: "M12 16.5v-9M8 11.5l4-4 4 4", down: "M12 7.5v9M8 12.5l4 4 4-4" } as const;

/**
 * A file on the move, and which way: a ring that fills as it goes, around an arrow that keeps travelling out of it
 * (`up`: sending to the cloud) or into it (`down`: fetching it here to hear or read). `value` is the share moved (0–1).
 * Sized by the font like an icon, coloured by `currentColor`. With a `label` it's the progressbar itself; without,
 * it's decorative and a bar or words beside it say how far. The studio working without a file is `Tuning`'s.
 */
export function Transfer({ direction, value, label, className }: { direction: "up" | "down"; value: number; label?: string; className?: string }) {
    const clip = useId();
    const share = Math.min(1, Math.max(0, value));
    const bar = label
        ? { role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(share * 100) }
        : { "aria-hidden": true };
    return (
        <span {...bar} data-direction={direction} className={cn("transfer inline-block size-[1.25em] shrink-0 text-accent", className)}>
            <svg viewBox="0 0 24 24" className="block size-full overflow-visible">
                <defs>
                    <clipPath id={clip}>
                        <circle cx="12" cy="12" r="7.5" />
                    </clipPath>
                </defs>
                <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-20" />
                <circle
                    cx="12"
                    cy="12"
                    r="10.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray="100 100"
                    strokeDashoffset={100 - share * 100}
                    transform="rotate(-90 12 12)"
                    className={cn("transfer-fill", share === 0 && "opacity-0")}
                />
                <g clipPath={`url(#${clip})`}>
                    <path d={ARROW[direction]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transfer-arrow" />
                </g>
            </svg>
        </span>
    );
}
