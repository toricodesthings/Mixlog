import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Text as search reads it: no case, no accents, no apostrophes (*beyonce* finds Beyoncé, *dont* finds Don’t). */
export const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f'’]/g, "").toLocaleLowerCase();
