import { useEffect, useRef, useState } from "react";

/** Files dragged anywhere over the window: true while they hover; `onFiles` when they land.
 *  Anything else dragged (text, a link) is left to the browser, and a drop on a `[data-own-drop]` target is that target's. */
export function useFileDrop(onFiles: (files: File[]) => void, enabled = true): boolean {
    const [dragging, setDragging] = useState(false);
    const latest = useRef(onFiles);
    latest.current = onFiles;
    useEffect(() => {
        if (!enabled) return;
        let depth = 0; // enter and leave fire for every child crossed
        const files = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
        const enter = (e: DragEvent) => {
            if (!files(e)) return;
            e.preventDefault();
            depth++;
            setDragging(true);
        };
        const over = (e: DragEvent) => {
            if (!files(e)) return;
            e.preventDefault(); // without it the browser opens the file
            e.dataTransfer!.dropEffect = "copy";
        };
        const leave = (e: DragEvent) => {
            if (files(e) && --depth <= 0) (depth = 0), setDragging(false);
        };
        const drop = (e: DragEvent) => {
            if (!files(e)) return;
            e.preventDefault();
            depth = 0;
            setDragging(false);
            if (e.target instanceof Element && e.target.closest("[data-own-drop]")) return;
            const dropped = [...e.dataTransfer!.files];
            if (dropped.length) latest.current(dropped);
        };
        window.addEventListener("dragenter", enter);
        window.addEventListener("dragover", over);
        window.addEventListener("dragleave", leave);
        window.addEventListener("drop", drop);
        return () => {
            window.removeEventListener("dragenter", enter);
            window.removeEventListener("dragover", over);
            window.removeEventListener("dragleave", leave);
            window.removeEventListener("drop", drop);
            setDragging(false);
        };
    }, [enabled]);
    return dragging;
}
