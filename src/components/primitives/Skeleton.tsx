import { cn } from "../../lib/utils";

/** A part of the page whose shape is already known, before what fills it arrives: a clip waiting on the timeline, the
 *  playhead's light passing over it. Shape it with `className` like the thing it stands in for. Decorative: the
 *  surface around it says it's loading (a `Tuning` readout, `aria-busy`). */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return <span aria-hidden="true" className={cn("skeleton block rounded-xl", className)} style={style} />;
}
