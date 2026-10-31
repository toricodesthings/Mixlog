import { cn } from "../../lib/utils";

/** Rest height and dance period per bar: uneven on purpose, so it reads as music, not a loader. */
const BARS = [
    { rest: 0.45, period: 820, delay: 0 },
    { rest: 0.9, period: 640, delay: 120 },
    { rest: 0.65, period: 980, delay: 60 },
    { rest: 1, period: 700, delay: 200 },
    { rest: 0.55, period: 880, delay: 90 },
];

/** An EQ meter: still bars at rest, dancing while `live` (something is playing). Decorative. */
export function Meter({ live = false, bars = 5, className, peak }: {
    live?: boolean;
    bars?: number;
    className?: string;
    /** Lights the tallest bar's tip in Phantom: only where Phantom is allowed (the brand mark). */
    peak?: boolean;
}) {
    return (
        <span aria-hidden="true" className={cn("inline-flex h-4 items-end gap-[2px]", live && "meter-live", className)}>
            {BARS.slice(0, bars).map((b, i) => (
                <span
                    key={i}
                    className={cn(
                        "meter-bar block h-full w-[3px] rounded-full bg-accent",
                        peak && b.rest === 1 && "bg-linear-to-t from-accent from-55% to-phantom",
                    )}
                    style={{ "--rest": b.rest, "--period": `${b.period}ms`, "--delay": `${b.delay}ms` } as React.CSSProperties}
                />
            ))}
        </span>
    );
}
