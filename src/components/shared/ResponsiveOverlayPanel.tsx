import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, type MotionValue } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { useShellMode } from "../../hooks/ui/use-shell-mode";
import { useKeyboardInset } from "../../hooks/ui/use-keyboard-inset";
import { useSheetGesture } from "../../hooks/ui/use-sheet-gesture";

interface ResponsiveOverlayPanelProps {
    ariaLabel: string;
    /** Own the full sheet body as a flex column (header, scroll region). */
    children: React.ReactNode;
    onClose: () => void;
    open: boolean;
}

/** A touch sheet follows the finger (`y`) and sits above the keyboard. */
function sheetStyle(isMobile: boolean, keyboard: number, aboveKeyboard: string | null, isTablet: boolean, y: MotionValue<number>) {
    if (!isMobile) return undefined;
    return {
        y,
        height: aboveKeyboard ?? "min(92dvh, 52rem)",
        maxHeight: aboveKeyboard ?? "min(92dvh, 52rem)",
        bottom: keyboard || undefined,
        width: "100%",
        maxWidth: isTablet ? "48rem" : undefined,
        marginInline: "auto",
    };
}

/** Bottom sheet on touch, the side panel on a mouse. */
function sheetClass(isMobile: boolean) {
    const shape = isMobile
        ? "sheet-up glass-edge safe-bottom fixed inset-x-0 bottom-0 top-auto h-[min(92dvh,48rem)] rounded-t-[2rem] border-t border-line"
        : "sheet-side safe-bottom safe-top inset-y-0 right-0 border-l border-line";
    return `mobile-sheet-shell layer-route-overlay surface-route-overlay fixed flex w-full flex-col shadow-2xl shadow-black/40 ${shape}`;
}

/** The tallest a sheet may be while the keyboard is up; null without a keyboard. */
const aboveKeyboardHeight = (keyboard: number) => (keyboard ? `calc(100dvh - ${keyboard}px - max(0.5rem, env(safe-area-inset-top)))` : null);

/** Focus the sheet's own first field (or its heading) instead of Radix's first focusable. */
function focusInitial(panel: HTMLElement | null, event: Event) {
    const target = panel?.querySelector<HTMLElement>("[data-initial-focus]") ?? panel?.querySelector<HTMLElement>("[data-sheet-heading]");
    if (!target) return;
    event.preventDefault();
    target.focus();
}

/** Radix sees Escape before any child; a control that keeps Escape for itself says so. */
function keepOwnedEscape(event: KeyboardEvent) {
    if ((event.target as Element | null)?.closest?.("[data-escape-owner]")) event.preventDefault();
}

export function ResponsiveOverlayPanel({ ariaLabel, children, onClose, open }: ResponsiveOverlayPanelProps) {
    const shell = useShellMode();
    // A bottom sheet (with its drag handle) is a touch gesture: a mouse gets the side panel at any width.
    const isMobile = shell.isCompact && shell.isTouch;
    // The keyboard never covers a sheet: it rides on top. iOS keeps fixed elements in the layout viewport, under the keyboard.
    const { inset: keyboard } = useKeyboardInset(open && isMobile);
    const panelRef = useRef<HTMLElement | null>(null);
    const [panel, setPanel] = useState<HTMLElement | null>(null);
    const attachPanel = useCallback((node: HTMLElement | null) => { panelRef.current = node; setPanel(node); }, []);
    // Grab anywhere. Enter and exit are CSS (`.sheet-*` in app.css), so a throw leaves from the finger.
    const { y, backdropOpacity } = useSheetGesture({ element: panel, enabled: open && isMobile, onDismiss: onClose });

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
                    onOpenAutoFocus={(event) => focusInitial(panelRef.current, event)}
                    onEscapeKeyDown={keepOwnedEscape}
                >
                    <motion.aside
                        ref={attachPanel}
                        style={sheetStyle(isMobile, keyboard, aboveKeyboardHeight(keyboard), shell.isTablet, y)}
                        className={sheetClass(isMobile)}
                    >
                        {isMobile && (
                            <div data-sheet-handle className="flex h-8 shrink-0 items-center justify-center" aria-hidden="true">
                                <div className="h-1 w-10 rounded-full bg-ink-soft/40" />
                            </div>
                        )}
                        <DialogPrimitive.Title className="sr-only">{ariaLabel}</DialogPrimitive.Title>
                        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
                    </motion.aside>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
