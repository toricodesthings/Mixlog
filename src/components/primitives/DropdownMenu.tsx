/**
 * Primitive: DropdownMenu
 *
 * Pre-themed Radix DropdownMenu with Blue Hour.
 * Domain components import from here — never from @radix-ui/react-dropdown-menu directly.
 */
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { useOpeningReleaseGuard } from "../../hooks/ui/use-opening-release-guard";
import { FLOATING_MORPH, MENU_HOVER, MENU_ITEM, MENU_ITEM_DANGER, MENU_SURFACE, morphFrom } from "./menu-styles";

/* ── Re-exports (no styling needed) ─────────────────────────────── */
export const Root = RadixDropdownMenu.Root;
export const Trigger = RadixDropdownMenu.Trigger;
export const Portal = RadixDropdownMenu.Portal;
export const RadioGroup = RadixDropdownMenu.RadioGroup;

/* ── Content ────────────────────────────────────────────────────── */
export const Content = ({ className = "", sideOffset = 4, collisionPadding = 8, fromRadius, style, onCloseAutoFocus, ...props }: RadixDropdownMenu.DropdownMenuContentProps & { fromRadius?: string; ref?: React.Ref<HTMLDivElement> }) => {
    const guard = useOpeningReleaseGuard(onCloseAutoFocus);
    return (
    <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content
            {...guard}
            sideOffset={sideOffset}
            collisionPadding={collisionPadding}
            style={morphFrom(fromRadius, sideOffset, style)}
            className={`${MENU_SURFACE} max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto overscroll-contain ${FLOATING_MORPH} ${className}`}
            {...props}
        />
    </RadixDropdownMenu.Portal>
    );
};

/* ── Item ───────────────────────────────────────────────────────── */
export const Item = ({ className = "", variant = "default", ...props }: RadixDropdownMenu.DropdownMenuItemProps & { variant?: "default" | "danger" } & { ref?: React.Ref<HTMLDivElement> }) => {
    const variants = {
        default:
            `text-ink-soft hover:text-accent focus:text-accent cursor-pointer ${MENU_HOVER}`,
        danger: MENU_ITEM_DANGER,
    };

    return (
        <RadixDropdownMenu.Item
            className={`${MENU_ITEM} ${variants[variant]} ${className}`}
            {...props}
        />
    );
};

/** A selected menu choice, with the same focus and touch targets as other items. */
export const RadioItem = ({ className = "", children, ...props }: RadixDropdownMenu.DropdownMenuRadioItemProps & { ref?: React.Ref<HTMLDivElement> }) => (
    <RadixDropdownMenu.RadioItem className={`relative flex min-h-11 cursor-pointer items-center rounded-lg py-2 pl-9 pr-3 text-sm text-ink-soft outline-none transition-colors ${MENU_HOVER} focus:text-accent data-[state=checked]:font-medium data-[state=checked]:text-accent ${className}`} {...props}>
        <span className="absolute left-3 flex size-4 items-center justify-center">
            <RadixDropdownMenu.ItemIndicator><Check size={15} aria-hidden="true" /></RadixDropdownMenu.ItemIndicator>
        </span>
        {children}
    </RadixDropdownMenu.RadioItem>
);
