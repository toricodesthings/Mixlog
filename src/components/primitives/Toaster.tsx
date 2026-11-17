import { Toaster as Sonner, toast } from "sonner";

import { useShellMode } from "../../hooks/ui/use-shell-mode";
import { Tuning } from "./Tuning";

export { toast };

/** Where it lands: clear of the safe area, the phone dock and the docked player (`--toast-lift`, app.css "TOASTS"). */
const OFFSET = { top: "max(0.75rem, env(safe-area-inset-top))", right: "1rem", bottom: "var(--toast-lift)", left: "1rem" };

/** Toasts answer one question, "where did it go?" (src/AGENTS.md, "Words"): a failure, something that left the screen (with
 *  Undo), a result out of sight. Talkback on the desk: floating glass, a level trace lit along its top and an LED on
 *  the title, both in the toast's tone (Signal; feedback success or error; Tube for a warning). Sonner draws nothing
 *  of its own (`unstyled`); everything is app.css "TOASTS". Mounted once in `AppShell`; call `toast` from here. */
export function Toaster() {
    const { isDesktop } = useShellMode();
    return (
        <Sonner
            position={isDesktop ? "bottom-right" : "top-center"}
            offset={OFFSET}
            mobileOffset={OFFSET}
            gap={10}
            containerAriaLabel="Notifications"
            className="toaster"
            // The LED is the icon; only work in progress swaps it for the room tuning in.
            icons={{ success: null, error: null, warning: null, info: null, close: null, loading: <Tuning /> }}
            toastOptions={{
                unstyled: true,
                classNames: {
                    toast: "toast surface-floating",
                    icon: "toast-icon",
                    content: "toast-content",
                    title: "toast-title",
                    description: "toast-description",
                    actionButton: "toast-button toast-action press",
                    cancelButton: "toast-button toast-cancel press",
                },
            }}
        />
    );
}
