import { useId } from "react";
import { cn } from "../../lib/utils";

/** One cycle-and-a-bit of a decaying wave across a 240×48 screen; `flat` is a line with a single blip. */
const WAVE = "M0 24 C 20 4, 30 4, 40 24 S 60 44, 80 24 S 100 8, 120 24 S 140 38, 160 24 S 180 14, 200 24 S 220 30, 240 24";
const FLAT = "M0 24 L 112 24 L 116 18 L 120 30 L 124 24 L 240 24";

/** An oscilloscope screen: a trace that draws itself in, then a pulse of signal that keeps travelling it. Decorative.
 *  `flat`: no signal (nothing here yet, nothing at this address). `phantom` lights the trace's dot in
 *  the rare accent: only where Phantom is allowed. */
export function Scope({ flat = false, phantom = false, className }: { flat?: boolean; phantom?: boolean; className?: string }) {
    const glow = useId();
    return (
        <span aria-hidden="true" className={cn("relative block h-12 w-60 max-w-full overflow-hidden", className)}>
            <svg viewBox="0 0 240 48" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
                <defs>
                    <filter id={glow} x="-10%" y="-50%" width="120%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" />
                    </filter>
                </defs>
                <line x1="0" y1="24" x2="240" y2="24" className="stroke-line" strokeDasharray="2 6" />
                <path d={flat ? FLAT : WAVE} pathLength={1} fill="none" strokeWidth="3" className="scope-trace stroke-accent opacity-50" filter={`url(#${glow})`} />
                <path d={flat ? FLAT : WAVE} pathLength={1} fill="none" strokeWidth="1.5" strokeLinecap="round" className="scope-trace stroke-accent" />
                <path d={flat ? FLAT : WAVE} pathLength={1} fill="none" strokeWidth="2.5" strokeLinecap="round" className="scope-pulse" filter={`url(#${glow})`} />
            </svg>
            <span className={cn("led absolute top-1/2 right-0 -translate-y-1/2", phantom && "phantom-spark")} />
        </span>
    );
}
