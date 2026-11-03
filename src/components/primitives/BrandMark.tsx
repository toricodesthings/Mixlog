import { useId } from "react";

import { cn } from "../../lib/utils";

/** "Mix·log" said aloud: two syllables, the first louder, its peak held in Phantom above it. Same geometry as public/brand/. */
const BARS = [
    { x: 4, y: 29, h: 18, period: 820, delay: 0 },
    { x: 16, y: 18, h: 40, period: 640, delay: 120 },
    { x: 28, y: 26, h: 24, period: 980, delay: 60 },
    { x: 40, y: 22, h: 32, period: 700, delay: 200 },
    { x: 52, y: 31, h: 14, period: 880, delay: 90 },
];

/** The brand mark: a voice waveform lit from Signal through Haze to Ember, singing while `live` or while a
 *  `[data-meter-host]` ancestor is hovered. Its peak-hold dot is Phantom, so it spends the screen's one moment. */
export function BrandMark({ live = false, className }: { live?: boolean; className?: string }) {
    const id = useId();
    return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("brand-mark h-6 w-6", live && "brand-live", className)}>
            <defs>
                <linearGradient id={id} x1="4" x2="60" y1="0" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0" style={{ stopColor: "var(--color-mark-signal)" }} />
                    <stop offset=".38" style={{ stopColor: "var(--color-mark-haze)" }} />
                    <stop offset=".7" style={{ stopColor: "var(--color-mark-rose)" }} />
                    <stop offset="1" style={{ stopColor: "var(--color-ember)" }} />
                </linearGradient>
            </defs>
            <g fill={`url(#${id})`}>
                {BARS.map((b) => (
                    <rect key={b.x} className="brand-bar" x={b.x} y={b.y} width="8" height={b.h} rx="4"
                        style={{ "--period": `${b.period}ms`, "--delay": `${b.delay}ms` } as React.CSSProperties} />
                ))}
            </g>
            <circle cx="20" cy="10" r="4" className="fill-mark-phantom" />
        </svg>
    );
}
