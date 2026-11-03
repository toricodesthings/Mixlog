/** The one search box, so the icon, clear button and focus ring stay identical everywhere. */
import { useRef, type InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface SearchFieldProps
    extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type" | "value" | "onChange" | "aria-label"> {
    value: string;
    onValueChange: (value: string) => void;
    /** Required: a search box has no visible label. */
    "aria-label": string;
    /** Classes for the outer box (width, margins, `flex-1`). */
    className?: string;
}

export function SearchField({ value, onValueChange, className, disabled, ...inputProps }: SearchFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div
            className={cn(
                "flex min-h-11 min-w-0 items-center gap-2.5 px-3",
                "rounded-xl border border-line-light bg-white/[0.05] shadow-sm transition-colors focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/40",
                disabled && "opacity-50",
                className,
            )}
        >
            <Search size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
            <input
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                {...inputProps}
                value={value}
                disabled={disabled}
                onChange={(event) => onValueChange(event.target.value)}
                className={cn(
                    "min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted",
                    "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
                )}
            />
            {value.length > 0 && !disabled ? (
                <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                        onValueChange("");
                        inputRef.current?.focus();
                    }}
                    className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                    <X size={14} aria-hidden="true" />
                </button>
            ) : null}
        </div>
    );
}
