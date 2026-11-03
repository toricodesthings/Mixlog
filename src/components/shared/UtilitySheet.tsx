import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { useShellMode } from "../../hooks/ui/use-shell-mode";
import { useKeyboardInset } from "../../hooks/ui/use-keyboard-inset";
import { useSheetGesture } from "../../hooks/ui/use-sheet-gesture";
import { Tip } from "../primitives/Tooltip";

/**
 * The one compact sheet: a bottom sheet on touch (drag handle, backdrop, focus trap), the side panel on a mouse,
 * with its header and scroll region. Every mobile panel goes through here so headings, close affordances and
 * spacing stay identical.
 */
export function UtilitySheet({
    title,
    open,
    onClose,
    onBack,
    backLabel = "Back to settings",
    children,
}: {
    title: string;
    open: boolean;
    onClose: () => void;
    onBack?: () => void;
    backLabel?: string;
    children: ReactNode;
}) {
    const shell = useShellMode();
    // A bottom sheet (with its drag handle) is a touch gesture: a mouse gets the side panel at any width.
    const isMobile = shell.isCompact && shell.isTouch;
    // The keyboard never covers a sheet: it rides on top. iOS keeps fixed elements in the layout viewport, under the keyboard.
    const { inset: keyboard } = useKeyboardInset(open && isMobile);
    const [panel, setPanel] = useState<HTMLElement | null>(null);
    // Grab anywhere. Enter and exit are CSS (`.sheet-*` in app.css), so a throw leaves from the finger.
    const { y, backdropOpacity } = useSheetGesture({ element: panel, enabled: open && isMobile, onDismiss: onClose });

    const scroll = useRef<HTMLDivElement>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    // The heading takes focus on open and on every drill-in, and the new tab starts at its top.
    useEffect(() => {
        if (scroll.current) scroll.current.scrollTop = 0;
        if (open) heading.current?.focus({ preventScroll: true });
    }, [title, open]);

    const height = keyboard ? `calc(100dvh - ${keyboard}px - max(0.5rem, env(safe-area-inset-top)))` : "min(92dvh, 52rem)";
    const shape = isMobile
        ? "sheet-up glass-edge safe-bottom fixed inset-x-0 bottom-0 top-auto h-[min(92dvh,48rem)] rounded-t-[2rem] border-t border-line"
        : "sheet-side safe-bottom safe-top inset-y-0 right-0 border-l border-line";

    return (
        <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="layer-route-backdrop sheet-fade fixed inset-0">
                    {/* Lightens as the sheet is pulled down; the outer layer keeps the enter/exit fade. */}
                    <motion.div style={{ opacity: backdropOpacity }} className="absolute inset-0 bg-room-void/85" />
                </DialogPrimitive.Overlay>

                <DialogPrimitive.Content asChild aria-describedby={undefined} onOpenAutoFocus={(event) => event.preventDefault()}>
                    <motion.aside
                        ref={setPanel}
                        style={isMobile ? { y, height, maxHeight: height, bottom: keyboard || undefined, width: "100%", maxWidth: shell.isTablet ? "48rem" : undefined, marginInline: "auto" } : undefined}
                        className={`mobile-sheet-shell layer-route-overlay surface-route-overlay fixed flex w-full flex-col shadow-2xl shadow-black/40 ${shape}`}
                    >
                        {isMobile && (
                            <div data-sheet-handle className="flex h-8 shrink-0 items-center justify-center" aria-hidden="true">
                                <div className="h-1 w-10 rounded-full bg-ink-soft/40" />
                            </div>
                        )}
                        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
                        <div className="flex min-h-0 flex-1 flex-col">
                            <header className="utility-sheet-header shrink-0 px-4 pb-3">
                                <div className="flex min-h-14 items-center gap-2">
                                    {onBack && <Tip label={backLabel}><button type="button" className="mobile-icon-button" aria-label={backLabel} onClick={onBack}><ChevronLeft size={22} aria-hidden="true" /></button></Tip>}
                                    <div className="min-w-0 flex-1">
                                        <h2 ref={heading} data-sheet-heading tabIndex={-1} className="truncate font-display text-xl font-semibold text-ink">{title}</h2>
                                    </div>
                                    <Tip label="Close"><button type="button" className="mobile-icon-button shrink-0 rounded-full bg-room-surface/70" aria-label={`Close ${title}`} onClick={onClose}><X size={20} aria-hidden="true" /></button></Tip>
                                </div>
                            </header>

                            <div ref={scroll} className="utility-sheet-content min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
                                <div className="mx-auto w-full max-w-3xl space-y-5">{children}</div>
                            </div>
                        </div>
                    </motion.aside>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
