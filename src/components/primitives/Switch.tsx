import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "../../lib/utils"

const Switch = ({ className, ...props }: React.ComponentProps<typeof SwitchPrimitives.Root>) => (
    <SwitchPrimitives.Root
        className={cn(
            "group peer relative inline-flex h-11 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-room-base disabled:cursor-not-allowed disabled:opacity-50",
            "after:absolute after:left-1 after:h-5 after:w-9 after:rounded-full after:border after:border-transparent after:shadow-sm after:transition-colors",
            "data-[state=checked]:after:bg-accent data-[state=unchecked]:after:bg-white/10 data-[state=unchecked]:after:border-white/5",
            className
        )}
        {...props}
    >
        <SwitchPrimitives.Thumb
            className={cn(
                "pointer-events-none relative z-10 ml-1 block h-4 w-4 rounded-full bg-ink shadow-sm ring-0 [transition:translate_var(--spring-snap),scale_var(--spring-snap),filter_var(--duration-fast)] data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 group-active:scale-x-125 group-active:brightness-110"
            )}
        />
    </SwitchPrimitives.Root>
);

/** A switch with something riding its knob (the sun or the moon), sliding on the shared snap spring. 44px to the touch. */
const IconSwitch = ({ className, children, ...props }: React.ComponentProps<typeof SwitchPrimitives.Root>) => (
    <SwitchPrimitives.Root
        className={cn(
            "group relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full bg-room-surface-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-colors duration-(--duration-normal) data-[state=checked]:bg-accent-soft",
            "before:absolute before:-inset-1.5 before:content-['']",
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-room-base",
            className
        )}
        {...props}
    >
        <SwitchPrimitives.Thumb className="pointer-events-none flex size-6 translate-x-1 items-center justify-center rounded-full bg-ink text-room-deep shadow-md [transition:translate_var(--spring-snap),scale_var(--spring-snap)] group-active:scale-x-110 data-[state=checked]:translate-x-7">
            {children}
        </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
);

export { IconSwitch, Switch }
