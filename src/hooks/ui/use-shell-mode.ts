import { useSyncExternalStore } from "react";

type ShellMode = "wide" | "laptop" | "tablet" | "phone";

/** Touch-first devices (phones, tablets). Hybrids with a mouse or trackpad don't match. */
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

let query: MediaQueryList | null | undefined;
const touchQuery = () => (query === undefined ? (query = window.matchMedia?.(TOUCH_QUERY) ?? null) : query);

/** No pointer info (no `matchMedia`): width alone decides, as for touch. */
export function isTouchFirst(): boolean {
    return touchQuery()?.matches ?? true;
}

/** Width picks the layout. A mouse or trackpad keeps the desktop one down to 768px, so a tall
 * narrow monitor never gets the touch shell; tablet exists only for touch-first devices. */
function getShellMode(width: number, touch: boolean): ShellMode {
    if (width >= 1440) return "wide";
    if (width >= 1120 || (!touch && width >= 768)) return "laptop";
    if (width >= 768) return "tablet";
    return "phone";
}

type Shell = { mode: ShellMode; isTouch: boolean };

/** One store for every caller: one media query, one `resize` listener, one cached snapshot, so a render reads a value
 * instead of asking the browser, and a resize that keeps the mode re-renders nothing. */
let snapshot: Shell | null = null;
const listeners = new Set<() => void>();
const read = (): Shell => {
    const isTouch = isTouchFirst();
    const mode = getShellMode(window.innerWidth, isTouch);
    return snapshot && snapshot.mode === mode && snapshot.isTouch === isTouch ? snapshot : (snapshot = { mode, isTouch });
};
const changed = () => {
    const before = snapshot;
    if (read() !== before) listeners.forEach((l) => l());
};

function subscribe(listener: () => void) {
    if (!listeners.size) {
        window.addEventListener("resize", changed);
        touchQuery()?.addEventListener("change", changed);
    }
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        window.removeEventListener("resize", changed);
        touchQuery()?.removeEventListener("change", changed);
    };
}

const getSnapshot = () => snapshot ?? read();
const SERVER: Shell = { mode: "wide", isTouch: false };

/** The one source of device class: layout (`mode`, from width + pointer) and input (`isTouch`).
 * Branch on these, never on raw widths or media queries in components. */
export function useShellMode() {
    const { mode, isTouch } = useSyncExternalStore(subscribe, getSnapshot, () => SERVER);

    return {
        mode,
        isTouch,
        isTablet: mode === "tablet",
        isPhone: mode === "phone",
        isDesktop: mode === "wide" || mode === "laptop",
        isCompact: mode === "tablet" || mode === "phone",
    };
}
