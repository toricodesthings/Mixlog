import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronLeft, X } from "lucide-react";
import { useShellMode } from "../../hooks/ui/use-shell-mode";
import { useKeyboardInset } from "../../hooks/ui/use-keyboard-inset";
import { useSheetGesture } from "../../hooks/ui/use-sheet-gesture";
import { Tip } from "../primitives/Tooltip";
import { Tuning } from "../primitives/Tuning";

/** Focus the sheet's own first field (or its heading) instead of Radix's first focusable. */
function focusInitial(panel: HTMLElement | null, event: Event) {
    const target = panel?.querySelector<HTMLElement>("[data-initial-focus]") ?? panel?.querySelector<HTMLElement>("[data-sheet-heading]");
    if (!target) return;
    event.preventDefault();
    // The sheet is still sliding up from below the keyboard: a plain focus makes iOS pan the page to it.
    target.focus({ preventScroll: true });
}

/**
 * The one compact sheet, Cadence's: a glass bottom sheet on touch (grab anywhere, backdrop, focus trap), the side
 * panel on a mouse. X leads (the back chevron in its place on a drill-in), the heading sits centred the way iOS does,
 * and the one primary action is a ✓ opposite the X. An optional band sits under the header, then the scroll region,
 * then a pinned footer. Every compact panel and every creator on compact goes through here (`Composer`).
 */
export function UtilitySheet({
    title,
    icon: Icon,
    subtitle,
    band,
    footer,
    open,
    onClose,
    onBack,
    backLabel = "Back to settings",
    confirm,
    fit = false,
    locked = false,
    tone,
    children,
}: {
    title: string;
    /** Sits before the title at its size, in the accent. */
    icon?: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
    /** Secondary line under the heading. */
    subtitle?: ReactNode;
    /** Sits between the header and the scroll region, e.g. a save's progress. */
    band?: ReactNode;
    /** Pinned under the scroll region, for controls beside the primary action. */
    footer?: ReactNode;
    open: boolean;
    onClose: () => void;
    onBack?: () => void;
    backLabel?: string;
    /** The sheet's one primary action: a ✓ at the header's right, opposite the X. `busy` turns it into the tuning light. */
    confirm?: { label: string; onConfirm: () => void; disabled?: boolean; busy?: boolean };
    /** Short sheets: height follows the content instead of the tall default. */
    fit?: boolean;
    /** While something is saving: no throw, no Escape, no backdrop, no X. */
    locked?: boolean;
    /** A release's light (`useRoomStyle`): its accent alone (`.art-tone`). */
    tone?: CSSProperties;
    children: ReactNode;
}) {
    const shell = useShellMode();
    // A bottom sheet (with its drag handle) is a touch gesture: a mouse gets the side panel at any width.
    const isMobile = shell.isCompact && shell.isTouch;
    // The keyboard never covers a sheet: it rides on top. iOS keeps fixed elements in the layout viewport, under the keyboard.
    const live = useKeyboardInset(open && isMobile).inset;
    // Closing keeps the open shape, so the exit slides from where the sheet was instead of jumping first.
    const [held, setHeld] = useState(0);
    if (open && held !== live) setHeld(live);
    const keyboard = open ? live : held;
    const [panel, setPanel] = useState<HTMLElement | null>(null);
    // Grab anywhere. Enter and exit are CSS (`.sheet-*` in app.css), so a throw leaves from the finger.
    const { y, backdropOpacity } = useSheetGesture({ element: panel, enabled: open && isMobile && !locked, onDismiss: onClose });

    const scroll = useRef<HTMLDivElement>(null);
    // A drill-in (a new title) starts at its top with its heading focused.
    useEffect(() => {
        if (scroll.current) scroll.current.scrollTop = 0;
        if (open) panel?.querySelector<HTMLElement>("[data-sheet-heading]")?.focus({ preventScroll: true });
    }, [title]); // eslint-disable-line react-hooks/exhaustive-deps -- only on a drill-in: opening focuses through Radix (`focusInitial`)

    const aboveKeyboard = keyboard ? `calc(100dvh - ${keyboard}px - max(0.5rem, env(safe-area-inset-top)))` : null;
    const tall = "min(92dvh, 52rem)";
    const shape = isMobile
        ? `sheet-up glass-edge safe-bottom fixed inset-x-0 bottom-0 top-auto ${fit ? "" : "h-[min(92dvh,48rem)]"} rounded-t-[2rem] border-t border-line`
        : "sheet-side safe-bottom safe-top inset-y-0 right-0 border-l border-line";
    const style = isMobile
        ? { y, height: fit ? "auto" : (aboveKeyboard ?? tall), maxHeight: aboveKeyboard ?? tall, bottom: keyboard || undefined, width: "100%", maxWidth: shell.isTablet ? "48rem" : undefined, marginInline: "auto", ...tone }
        : tone;
    const hold = (event: Event) => locked && event.preventDefault();

    const closeButton = (
        <Tip label="Close">
            <button type="button" className="mobile-icon-button size-11 shrink-0 rounded-full! bg-room-surface/70 disabled:opacity-40" aria-label={`Close ${title}`} disabled={locked} onClick={onClose}>
                <X size={20} aria-hidden="true" />
            </button>
        </Tip>
    );

    return (
        <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="layer-route-backdrop sheet-fade fixed inset-0">
                    {/* Lightens as the sheet is pulled down; the outer layer keeps the enter/exit fade. */}
                    <motion.div style={{ opacity: backdropOpacity }} className="absolute inset-0 bg-room-void/85" />
                </DialogPrimitive.Overlay>

                <DialogPrimitive.Content
                    asChild
                    aria-describedby={undefined}
                    onOpenAutoFocus={(event) => focusInitial(panel, event)}
                    onEscapeKeyDown={(event) => (hold(event), (event.target as Element | null)?.closest?.("[data-escape-owner]") && event.preventDefault())}
                    onPointerDownOutside={hold}
                    onInteractOutside={hold}
                >
                    <motion.aside
                        ref={setPanel}
                        style={style}
                        className={`mobile-sheet-shell layer-route-overlay surface-route-overlay fixed flex w-full flex-col shadow-2xl shadow-black/40 ${shape}${tone ? " art-tone" : ""}`}
                    >
                        {isMobile && (
                            <div data-sheet-handle className="flex h-8 shrink-0 items-center justify-center" aria-hidden="true">
                                <div className="h-1 w-10 rounded-full bg-ink-soft/40" />
                            </div>
                        )}
                        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>

                        <header className={`utility-sheet-header shrink-0 px-4 pb-3 ${band || footer ? "border-b border-line" : ""}`}>
                            <div className="flex min-h-14 items-center gap-2">
                                {onBack ? (
                                    <Tip label={backLabel}>
                                        <button type="button" className="mobile-icon-button" aria-label={backLabel} onClick={onBack}><ChevronLeft size={22} aria-hidden="true" /></button>
                                    </Tip>
                                ) : closeButton}
                                <div className="min-w-0 flex-1 text-center">
                                    <h2 data-sheet-heading tabIndex={-1} className="flex items-center justify-center gap-2 font-display text-xl font-semibold text-ink">
                                        {Icon ? <Icon size={20} className="shrink-0 text-accent" aria-hidden /> : null}
                                        <span className="truncate">{title}</span>
                                    </h2>
                                    {subtitle ? <div className="mt-0.5 truncate text-sm text-ink-soft">{subtitle}</div> : null}
                                </div>
                                {onBack ? closeButton : null}
                                {/* X alone: an empty twin on the right keeps the heading truly centred. */}
                                {!onBack && !confirm ? <span aria-hidden="true" className="size-11 shrink-0" /> : null}
                                {confirm ? (
                                    <Tip label={confirm.label}>
                                        {/* Keeps focus in the field: a blur would drop the keyboard mid-tap. */}
                                        <button
                                            type="button"
                                            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full accent-fill disabled:cursor-not-allowed disabled:opacity-40"
                                            aria-label={confirm.label}
                                            aria-busy={confirm.busy || undefined}
                                            disabled={confirm.disabled || confirm.busy}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={confirm.onConfirm}
                                        >
                                            {confirm.busy ? <Tuning className="text-current" /> : <Check size={20} aria-hidden="true" />}
                                        </button>
                                    </Tip>
                                ) : null}
                            </div>
                        </header>

                        {band}

                        <div ref={scroll} className="utility-sheet-content min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-6">
                            <div className="mx-auto w-full max-w-3xl space-y-5">{children}</div>
                        </div>

                        {/* A footer button keeps focus in the field: a blur would close the keyboard and move the footer
                            out from under the finger before the tap lands. */}
                        {footer ? <div role="presentation" className="shrink-0 border-t border-line" onMouseDown={(e) => { if ((e.target as Element).closest("button")) e.preventDefault(); }}>{footer}</div> : null}
                    </motion.aside>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
