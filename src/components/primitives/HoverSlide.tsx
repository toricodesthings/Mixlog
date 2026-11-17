import { motion } from "framer-motion";
import { useEffect, useImperativeHandle, useRef, useState, type FocusEvent, type PointerEvent, type RefObject } from "react";

import { TWEENS } from "../../lib/constants/motion";
import { cn } from "../../lib/utils";

type Box = { x: number; y: number; width: number; height: number };

/**
 * One hover light per list that glides to the row you point at (or reach with Tab), like a fader cap moving, instead
 * of each row lighting on its own. Spread `group` on the list (it must be `relative`), render `light` first inside it,
 * and spread `row` on each row (each `relative`, so it paints above the light). A touch shows nothing: there's no hover.
 * The light appears where it's first needed rather than sliding in from a corner, and fades when the pointer leaves.
 * `to` moves it from code (a listbox's ↑ ↓ highlight), or hides it with null.
 */
export function useHoverSlide(className = "rounded-2xl bg-accent-dim") {
    // The box lives in the light alone, so pointing along a list re-renders the light, not the list
    const set = useRef<(box: Box | null) => void>(() => {});
    const measure = (el: HTMLElement) => set.current({ x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    const row = {
        onPointerEnter: (event: PointerEvent<HTMLElement>) => event.pointerType !== "touch" && measure(event.currentTarget),
        onFocus: (event: FocusEvent<HTMLElement>) => event.target.matches(":focus-visible") && measure(event.currentTarget),
    };
    const group = {
        onPointerLeave: () => set.current(null),
        onBlur: (event: FocusEvent<HTMLElement>) => !event.currentTarget.contains(event.relatedTarget as Node | null) && set.current(null),
    };
    const light = <Light set={set} className={className} />;
    const to = (el: HTMLElement | null) => (el ? measure(el) : set.current(null));
    return { group, row, light, to };
}

function Light({ set, className }: { set: RefObject<(box: Box | null) => void>; className: string }) {
    const [box, setBox] = useState<Box | null>(null);
    useImperativeHandle(set, () => setBox);
    const shown = useRef(false);
    // Where it last was, so it fades out in place instead of collapsing.
    const last = useRef<Box>({ x: 0, y: 0, width: 0, height: 0 });
    if (box) last.current = box;
    useEffect(() => {
        shown.current = box !== null;
    }, [box]);
    return (
        <motion.span
            aria-hidden="true"
            className={cn("pointer-events-none absolute top-0 left-0", className)}
            initial={false}
            animate={{ ...last.current, opacity: box ? 1 : 0 }}
            // From hidden it jumps into place and only fades in; between rows it glides, swift and ease-out.
            transition={box && !shown.current ? { default: { duration: 0 }, opacity: TWEENS.FADE } : { default: TWEENS.FOLLOW, opacity: TWEENS.FADE }}
        />
    );
}
