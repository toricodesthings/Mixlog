import type { ComponentProps, ComponentType, CSSProperties, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useShellMode } from "../../hooks/ui/use-shell-mode";
import { cn } from "../../lib/utils";
import { Button, Tuning } from "../primitives";
import * as DropdownMenu from "../primitives/DropdownMenu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../primitives/Dialog";
import { UtilitySheet } from "./UtilitySheet";

type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

export interface ComposerSubmit {
    label: string;
    onSubmit: () => void;
    icon?: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
    disabled?: boolean;
    /** Waiting on the server: the Tuning light on the button (or the ✓), and the sheet can't be thrown away. */
    busy?: boolean;
    /** The button's words while busy ("Saving 2 of 5…"); the ✓ only shows the light. */
    busyLabel?: string;
}

/**
 * The one layout for every dialog that makes or does something (Cadence's Composer): a dialog on desktop, the shared
 * glass sheet on compact (X · centred title · ✓, the band under its header, the body scrolling, `actions` pinned), so
 * the two never drift. `eyebrow` is the readout over the title (the sheet's subtitle); `description` sits under it.
 */
export function Composer({
    open = true,
    onClose,
    title,
    icon: TitleIcon,
    eyebrow,
    description,
    band,
    submit,
    actions,
    closeLabel = "Cancel",
    busy = submit?.busy ?? false,
    className,
    contentProps,
    tone,
    children,
}: {
    open?: boolean;
    onClose: () => void;
    title: string;
    /** Sits before the title at its size, in the accent. */
    icon?: Icon;
    eyebrow?: ReactNode;
    description?: ReactNode;
    /** Under the header: a save's progress. */
    band?: ReactNode;
    /** The primary action: the footer's button on desktop, the header ✓ on compact. None: X (or Escape) is the only way out. */
    submit?: ComposerSubmit;
    /** Controls beside the primary action: the footer's left on desktop, pinned under the sheet's body. */
    actions?: ReactNode;
    closeLabel?: string;
    /** Locks it open (no Escape, outside click, throw or Cancel). Defaults to `submit.busy`. */
    busy?: boolean;
    /** The desktop dialog's size and layout. */
    className?: string;
    contentProps?: Omit<ComponentProps<typeof DialogContent>, "className" | "children">;
    /** A release's light (`useRoomStyle`): its accent alone (`.art-tone`), for A/B's picker. */
    tone?: CSSProperties;
    children: ReactNode;
}) {
    const { isCompact } = useShellMode();
    const close = () => !busy && onClose();

    if (isCompact)
        return (
            <UtilitySheet
                title={title}
                icon={TitleIcon}
                subtitle={eyebrow ? <span className="readout inline-flex max-w-full items-center gap-2 text-accent">{eyebrow}</span> : undefined}
                open={open}
                onClose={close}
                locked={busy}
                band={band ? <div className="shrink-0 border-b border-line px-4 py-3">{band}</div> : undefined}
                footer={actions ? <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{actions}</div> : undefined}
                confirm={submit && { label: submit.label, onConfirm: submit.onSubmit, disabled: submit.disabled, busy: submit.busy }}
                tone={tone}
            >
                {description ? <p className="text-sm text-ink-soft">{description}</p> : null}
                {children}
            </UtilitySheet>
        );

    const Icon = submit?.icon;
    const hold = (event: Event) => busy && event.preventDefault();
    return (
        <Dialog open={open} onOpenChange={(next) => !next && close()}>
            <DialogContent
                className={cn(className, tone && "art-tone")}
                onEscapeKeyDown={hold}
                onPointerDownOutside={hold}
                {...contentProps}
                style={tone ? { ...contentProps?.style, ...tone } : contentProps?.style}
            >
                <DialogHeader className="gap-1 text-left">
                    {eyebrow ? <p className="readout flex items-center gap-2 text-accent">{eyebrow}</p> : null}
                    <DialogTitle className="flex items-center gap-2.5 font-display text-2xl">
                        {TitleIcon ? <TitleIcon size={22} className="shrink-0 text-accent" aria-hidden /> : null}
                        {title}
                    </DialogTitle>
                    {description ? <DialogDescription>{description}</DialogDescription> : null}
                    {band ? <div className="mt-2">{band}</div> : null}
                </DialogHeader>
                {children}
                {submit || actions ? (
                    <DialogFooter className="flex-wrap items-center">
                        {actions ? <div className="mr-auto flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
                        {submit ? (
                            <>
                                <Button variant="ghost" onClick={close} disabled={busy}>{closeLabel}</Button>
                                <Button onClick={submit.onSubmit} disabled={submit.disabled || submit.busy} aria-busy={submit.busy || undefined} className="gap-2">
                                    {submit.busy ? <Tuning className="text-current" /> : Icon ? <Icon size={16} aria-hidden /> : null}
                                    {submit.busy ? (submit.busyLabel ?? submit.label) : submit.label}
                                </Button>
                            </>
                        ) : null}
                    </DialogFooter>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

const TILE = "rounded-2xl border border-white/[0.06] bg-white/[0.03]";

/** An iOS-style grouped card (Cadence's): one setting per `ComposerRow`, hairlines between. */
export function ComposerRows({ children }: { children: ReactNode }) {
    return <div className={`${TILE} divide-y divide-white/[0.05]`}>{children}</div>;
}

/** A label (with its icon) on the left, its control on the right: a `ValueSelect`, a day, a switch. */
export function ComposerRow({ icon: RowIcon, label, children }: { icon?: Icon; label: string; children: ReactNode }) {
    return (
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
            <span className="flex shrink-0 items-center gap-2.5 text-sm text-ink">
                {RowIcon ? <RowIcon size={15} className="shrink-0 text-accent" aria-hidden /> : null}
                {label}
            </span>
            <div className="flex min-w-0 items-center justify-end gap-2">{children}</div>
        </div>
    );
}

/** A row's value that opens a menu of choices (Cadence's): the choice in words and a chevron, the menu under it. */
export function ValueSelect<T extends string>({ label, value, onChange, options, disabled }: {
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: readonly { value: T; label: string }[];
    disabled?: boolean;
}) {
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                aria-label={label}
                disabled={disabled}
                className="flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-right text-sm text-ink-soft transition-colors hover:bg-white/[0.06] hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-40 data-[state=open]:bg-white/[0.06]"
            >
                <span className="truncate">{options.find((o) => o.value === value)?.label}</span>
                <ChevronDown size={14} className="shrink-0 text-ink-muted" aria-hidden />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" className="min-w-40">
                <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
                    {options.map((o) => <DropdownMenu.RadioItem key={o.value} value={o.value}>{o.label}</DropdownMenu.RadioItem>)}
                </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}
