"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { DIALOG_CONTENT, DIALOG_DESCRIPTION, DIALOG_FOOTER, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_TITLE } from "./dialog-styles";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) => (
    <DialogPrimitive.Overlay
        className={cn(DIALOG_OVERLAY, className)}
        {...props}
    />
);

/** The dialog's X button; use it directly when a layout places close inside its own header. */
const DialogCloseButton = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) => (
    <DialogPrimitive.Close
        className={cn("btn-icon shrink-0 cursor-pointer text-ink-muted opacity-70 transition-[opacity,background-color] duration-150 hover:bg-white/[0.06] hover:text-ink hover:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none", className)}
        {...props}
    >
        <X className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
);

/** The desktop dialog. On compact, a creator is the shared glass sheet instead (`shared/Composer`). */
const DialogContent = ({ className, children, hideCloseButton, ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { hideCloseButton?: boolean }) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content data-dialog-content="true" aria-describedby={undefined} className={cn(DIALOG_CONTENT, className)} {...props}>
            {children}
            {!hideCloseButton && <DialogCloseButton data-dialog-x className="absolute right-4 top-4 sm:right-6 sm:top-5" />}
        </DialogPrimitive.Content>
    </DialogPortal>
);

/** A full-screen surface (the listening room): Radix's focus trap, Escape and labelling, with its own look and motion.
 *  Always mounted while its parent shows it, so a framer `exit` can play: wrap it in AnimatePresence. */
const DialogStage = ({ children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) => (
    <DialogPortal forceMount>
        <DialogPrimitive.Content forceMount asChild aria-describedby={undefined} {...props}>
            {children}
        </DialogPrimitive.Content>
    </DialogPortal>
);

const DialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        data-dialog-header
        className={cn(DIALOG_HEADER, "text-left", className)}
        {...props}
    />
);

const DialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        data-dialog-footer
        className={cn(DIALOG_FOOTER, className)}
        {...props}
    />
);

const DialogTitle = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) => (
    <DialogPrimitive.Title
        className={cn(DIALOG_TITLE, className)}
        {...props}
    />
);

const DialogDescription = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) => (
    <DialogPrimitive.Description
        className={cn(DIALOG_DESCRIPTION, className)}
        {...props}
    />
);

export {
    Dialog,
    DialogCloseButton,
    DialogTrigger,
    DialogContent,
    DialogStage,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
};
