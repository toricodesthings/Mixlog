import { cn } from "../../lib/utils";

/** Rest height and dance period per bar: uneven on purpose, so it reads as music, not a loader. */
const BARS = [
    { rest: 0.45, period: 820, delay: 0 },
    { rest: 0.9, period: 640, delay: 120 },
    { rest: 0.65, period: 980, delay: 60 },
    { rest: 1, period: 700, delay: 200 },
    { rest: 0.55, period: 880, delay: 90 },
];

/** An EQ meter: still bars at rest, dancing while `live` (something is playing). Decorative. Where the player's
 *  signal runs (player/signal.ts: desktop), a live meter's bars read the music instead, each its own band, low to high. */
export function Meter({ live = false, bars = 5, className }: { live?: boolean; bars?: number; className?: string }) {
    return (
        <span aria-hidden="true" data-signal={live ? "" : undefined} className={cn("inline-flex h-4 items-end gap-[2px]", live && "meter-live", className)}>
            {BARS.slice(0, bars).map((b, i) => (
                <span
                    key={i}
                    className="meter-bar block h-full w-[3px] rounded-full bg-accent"
                    style={{ "--rest": b.rest, "--period": `${b.period}ms`, "--delay": `${b.delay}ms`, "--level": `var(--level-${Math.round((i * 4) / Math.max(bars - 1, 1))})` } as React.CSSProperties}
                />
            ))}
        </span>
    );
}
