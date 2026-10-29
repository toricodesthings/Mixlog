/**
 * Primitives barrel export.
 *
 * All Radix UI primitives are pre-themed here as the "base layer".
 * Domain components import from this barrel — never from @radix-ui/* directly.
 *
 * Usage:
 *   import * as Popover from "#/components/primitives/Popover";
 *   import { Button, Tip } from "#/components/primitives";
 */
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { ActivityBadge } from "./ActivityBadge";
export * as Popover from "./Popover";
export * as ScrollArea from "./ScrollArea";
export * as Tooltip from "./Tooltip";
export { Tip, type TipProps } from "./Tooltip";
export * from "./Skeleton";
export * from "./Switch";
export * from "./Input";
