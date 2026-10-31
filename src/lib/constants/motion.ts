/** Calm springs: bounce ≤ 0.15, motion for orientation, never reward. Opening and closing chrome (menus, sheets) is CSS ease-out instead (`--morph-*`, `--sheet-*`). */
export const SPRINGS = {
    SNAP: { type: "spring", visualDuration: 0.2, bounce: 0.1 },
    GLIDE: { type: "spring", visualDuration: 0.32, bounce: 0.06 },
} as const;
