import { cn } from "../../lib/utils";

/** Four cycles of a carrier, twice the window's width, so sliding it by half loops without a seam. */
const CARRIER = "M0 8 Q3.5 2 7 8 T14 8 T21 8 T28 8 T35 8 T42 8 T49 8 T56 8";

/** The room tuning in, while the studio works (a page on its way, a save, a move): a carrier racing across a tiny
 *  scope, swelling as it hunts for the lock. Not a spinner, and never the meter (that's music playing). Sized by the
 *  font like an icon. Decorative: what's loading is said in words beside it. Files in flight are `Transfer`'s. */
export function Tuning({ className }: { className?: string }) {
    return (
        <span aria-hidden="true" className={cn("tuning relative inline-block h-[1em] w-[1.75em] shrink-0 overflow-hidden text-accent", className)}>
            <svg viewBox="0 0 56 16" preserveAspectRatio="none" className="tuning-carrier absolute inset-y-0 left-0 h-full w-[200%] overflow-visible">
                <path d={CARRIER} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="tuning-wave" />
            </svg>
        </span>
    );
}
