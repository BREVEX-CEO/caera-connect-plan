import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Hand the browser a file to save.
 *
 * Defined once because the object URL is the part that is easy to get wrong:
 * forgetting to revoke it holds the whole blob in memory for the life of the
 * document, and a conversation export is not small.
 */
export function saveFile(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * What the person already typed into a server-rendered field before the page
 * hydrated. Hydration would otherwise replace it with the empty initial state,
 * so a quick typist on a slow phone lost their words and Send stayed off.
 */
export function typedBeforeHydration(id: string): string {
  if (typeof document === "undefined") return "";
  const field = document.getElementById(id);
  return field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement
    ? field.value
    : "";
}
