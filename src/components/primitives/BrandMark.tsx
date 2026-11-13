import { useId } from "react";

import { cn } from "../../lib/utils";

/** "Mix·log" said aloud: two syllables, the first louder. Same geometry as public/brand/, which adds the glow and the
 *  soft shadows where the hold crosses a bar (too fine to see at the sizes the app wears). */
const BARS = [
    { x: 4, y: 29, h: 18, period: 820, delay: 0 },
    { x: 16, y: 18, h: 40, period: 640, delay: 120 },
    { x: 28, y: 26, h: 24, period: 980, delay: 60 },
    { x: 40, y: 22, h: 32, period: 700, delay: 200 },
    { x: 52, y: 31, h: 14, period: 880, delay: 90 },
];
const FRAME = "translate(0.64 6.51) scale(0.89)";
const HOLD = "M4.96,20.31C5.48,12.69 10.52,7.74 18.43,7.74C27.42,7.74 32.36,13.72 36.58,20.52C39.78,25.77 42.66,31.33 47.6,34.42C51.11,36.58 55.64,35.76 59.04,30.61";
const NOTE = "M14.2,17.97A4.63 3.6 -24 1 0 22.67,14.2A4.63 3.6 -24 1 0 14.2,17.97ZM16.3,14.65A2.58 1.49 34 1 0 20.57,17.53A2.58 1.49 34 1 0 16.3,14.65Z";

const stop = (token: string) => ({ stopColor: `var(--color-${token})` });

/** The brand mark, coloured by role: the bars are the room (Signal easing to Haze), the peak is held as a whole note in
 *  Phantom whose light falls on the bar beneath it, and over it a hand-drawn fermata (Rose warming to Ember) trails a wave
 *  behind the fourth bar and over the last. While `live` or while a `[data-meter-host]` ancestor is hovered the bars sing
 *  and the hold draws itself on. The note spends the screen's one Phantom moment. */
export function BrandMark({ live = false, className }: { live?: boolean; className?: string }) {
    const id = useId();
    const bar = (i: number, fill?: string) => {
        const b = BARS[i];
        return <rect key={i} className="brand-bar" x={b.x} y={b.y} width="8" height={b.h} rx="4" fill={fill}
            style={{ "--period": `${b.period}ms`, "--delay": `${b.delay}ms` } as React.CSSProperties} />;
    };
    return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("brand-mark h-6 w-6", live && "brand-live", className)}>
            <defs>
                <linearGradient id={`${id}v`} x1="8" y1="24" x2="56" y2="50" gradientUnits="userSpaceOnUse">
                    <stop offset=".12" style={stop("mark-signal")} />
                    <stop offset=".88" style={stop("mark-haze")} />
                </linearGradient>
                <linearGradient id={`${id}h`} x1="5" x2="59" y1="0" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset=".2" style={stop("mark-rose")} />
                    <stop offset="1" style={stop("ember")} />
                </linearGradient>
                <radialGradient id={`${id}l`} cx="20" cy="10.8" r="17" gradientUnits="userSpaceOnUse">
                    <stop offset=".25" stopOpacity=".5" style={stop("mark-phantom")} />
                    <stop offset="1" stopOpacity="0" style={stop("mark-phantom")} />
                </radialGradient>
                <radialGradient id={`${id}n`} cx="16.03" cy="13.79" r="7.2" gradientUnits="userSpaceOnUse">
                    <stop offset="0" style={stop("mark-rose")} />
                    <stop offset=".7" style={stop("mark-phantom")} />
                </radialGradient>
            </defs>
            <g transform={FRAME} fill={`url(#${id}v)`}>{[0, 1, 2, 4].map((i) => bar(i))}</g>
            <g transform={FRAME}>{bar(1, `url(#${id}l)`)}</g>
            <path className="brand-hold" d={HOLD} pathLength="1" fill="none" stroke={`url(#${id}h)`} strokeWidth="3.7" strokeLinecap="round" />
            <g transform={FRAME} fill={`url(#${id}v)`}>{bar(3)}</g>
            <path d={NOTE} fillRule="evenodd" fill={`url(#${id}n)`} />
        </svg>
    );
}
