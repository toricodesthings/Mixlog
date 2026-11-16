/** Shared by Dialog and AlertDialog so both render the same surface, layout and type. */
export const DIALOG_OVERLAY =
    "layer-system-dialog fixed inset-0 bg-black/55 pop [--pop-from:1]";

export const DIALOG_CONTENT =
    "surface-dialog layer-system-dialog fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] grid max-h-[calc(100dvh-2rem)] w-auto gap-4 overflow-y-auto rounded-[28px] p-6 pop [--pop-from:0.96] sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:w-full sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%]";

export const DIALOG_HEADER = "flex flex-col gap-1.5 text-center sm:text-left";
export const DIALOG_FOOTER = "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end";
export const DIALOG_TITLE = "text-lg font-semibold leading-tight tracking-tight text-ink";
export const DIALOG_DESCRIPTION = "text-sm leading-relaxed text-ink-muted";
