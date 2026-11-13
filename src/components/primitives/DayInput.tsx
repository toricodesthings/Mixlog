import { CalendarDays } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { isTouchFirst } from "../../hooks/ui/use-shell-mode";
import { deviceZone, formatDay, parseDay, todayIn } from "../../lib/time";
import { cn } from "../../lib/utils";
import { Input } from "./Input";

/**
 * A day. On touch it's the native date wheel; with a mouse it's a text field that reads what's typed (`Oct 12`,
 * `12/10/2026`, `yesterday`: `parseDay`) and says back what it understood, with a picker beside it. The value is a
 * LocalDate (`YYYY-MM-DD`) or "" for none.
 */
export function DayInput({ value, onChange, max, required, disabled, row, className, "aria-label": label }: {
    value: string;
    onChange: (day: string) => void;
    max?: string;
    required?: boolean;
    disabled?: boolean;
    /** In a `ComposerRow` (Cadence's ROW_PILL): a slim capsule without its own icon, since the row shows one. */
    row?: boolean;
    className?: string;
    "aria-label"?: string;
}) {
    const today = todayIn(deviceZone());
    const shown = (day: string) => (day ? formatDay(day, today) : "");
    const [text, setText] = useState(() => shown(value));
    const [problem, setProblem] = useState<string | null>(null);
    const native = useRef<HTMLInputElement>(null);
    const said = useId();
    // The value moved from outside (the picker, a reset): say it in words.
    useEffect(() => { setText(shown(value)); setProblem(null); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    if (typeof window !== "undefined" && isTouchFirst()) {
        // Cadence's: the day in words on a pill, and a transparent native input over it takes the tap (the iOS wheel).
        return (
            <span className={cn("relative grid min-w-0 shrink-0", className)}>
                <span aria-hidden="true" className={cn("flex min-h-11 items-center gap-2.5 border border-white/[0.06] bg-white/[0.03] text-sm", row ? "min-h-10 rounded-full px-3.5" : "rounded-xl px-3", disabled && "opacity-40")}>
                    {row ? null : <CalendarDays size={15} className="shrink-0 text-accent" />}
                    <span className={value ? "truncate font-medium text-ink" : "truncate text-ink-muted"}>{value ? formatDay(value, today) : "Pick a day"}</span>
                </span>
                <input type="date" aria-label={label} value={value} max={max} required={required} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 min-w-0 cursor-pointer opacity-0" />
            </span>
        );
    }

    const read = (next: string) => {
        setText(next);
        const day = parseDay(next, today);
        if (day && max && day > max) return setProblem("That day hasn’t happened yet.");
        setProblem(null);
        if (day) onChange(day);
        else if (!next.trim()) onChange("");
    };
    const parsed = parseDay(text, today);
    const unread = text.trim() !== "" && !parsed;
    const bad = problem ?? (unread ? "Try “Oct 12”, “12/10/2026” or “yesterday”." : null);
    return (
        <span className="flex flex-col gap-1">
            <span className="relative flex items-center">
                <Input
                    aria-label={label}
                    aria-invalid={Boolean(bad && text)}
                    aria-describedby={said}
                    autoComplete="off"
                    placeholder="Oct 12 or yesterday"
                    value={text}
                    required={required}
                    disabled={disabled}
                    onChange={(e) => read(e.target.value)}
                    onBlur={() => parsed && !problem && setText(shown(parsed))}
                    className={cn("pr-11", className)}
                />
                <button
                    type="button"
                    disabled={disabled}
                    aria-label="Pick a day"
                    onClick={() => native.current?.showPicker?.()}
                    className="press absolute right-0 flex size-11 items-center justify-center rounded-xl text-ink-muted hover:text-accent"
                >
                    <CalendarDays size={16} aria-hidden="true" />
                </button>
                <input ref={native} type="date" tabIndex={-1} aria-hidden="true" value={value} max={max} onChange={(e) => onChange(e.target.value)} className="pointer-events-none absolute right-0 bottom-0 size-0 opacity-0" />
            </span>
            {/* In a row the field already says the day it read, so only a problem takes a line (the row stays centred). */}
            <span id={said} className={cn("readout", row ? (bad ? "" : "sr-only") : "min-h-4", bad ? "text-feedback-error" : "text-ink-muted")} aria-live="polite">
                {bad ?? (parsed ? `→ ${formatDay(parsed, today)}` : "")}
            </span>
        </span>
    );
}
