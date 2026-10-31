import { useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { ResponsiveOverlayPanel } from "./ResponsiveOverlayPanel";
import { Tip } from "../primitives/Tooltip";

/**
 * The one compact sheet layout: drag handle + backdrop + focus trap come from
 * `ResponsiveOverlayPanel`, and this adds the header and the scroll region. Every
 * mobile panel goes through here so headings, close affordances and spacing stay identical.
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
    const scroll = useRef<HTMLDivElement>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (scroll.current) scroll.current.scrollTop = 0;
        if (open) (scroll.current?.querySelector<HTMLElement>("[data-initial-focus]") ?? heading.current)?.focus({ preventScroll: true });
    }, [title, open]);

    return <ResponsiveOverlayPanel open={open} onClose={onClose} ariaLabel={title}>
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
    </ResponsiveOverlayPanel>;
}
