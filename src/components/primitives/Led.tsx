import { cn } from "../../lib/utils";

/** A console LED. Decorative: whatever it lights (current page, on air) is also said in words or aria.
 *  `phantom` is the rare light (src/AGENTS.md §6): at most one on screen. */
export function Led({ tone = "accent", lit = true, breathe, className }: {
    tone?: "accent" | "tube" | "phantom";
    lit?: boolean;
    breathe?: boolean;
    className?: string;
}) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                "led inline-block shrink-0",
                !lit && "led-off",
                lit && tone === "tube" && "[--led-tone:var(--color-tube)]",
                lit && tone === "phantom" && "phantom-spark",
                lit && breathe && tone !== "phantom" && "led-breathe",
                className,
            )}
        />
    );
}
