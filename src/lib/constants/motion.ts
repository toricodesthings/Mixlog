/** Calm springs: bounce ≤ 0.15, motion for orientation, never reward. Opening and closing chrome (menus, sheets) is CSS ease-out instead (`--morph-*`, `--sheet-*`). */
export const SPRINGS = {
    SNAP: { type: "spring", visualDuration: 0.2, bounce: 0.1 },
    GLIDE: { type: "spring", visualDuration: 0.32, bounce: 0.06 },
} as const;

/** Tweens for what follows the pointer: short and strongly ease-out, so it lands as your eye does and never lags behind
 *  (Emil Kowalski's curve). A spring's settling tail feels slow when you're moving along a list. */
export const TWEENS = {
    FOLLOW: { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
    FADE: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
} as const;
