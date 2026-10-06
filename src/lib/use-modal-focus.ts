import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal keeps keyboard focus inside itself while open and gives it back to
 * whatever opened it when it closes (F-048). Without this, Tab walked out of
 * the dialog into the page behind it, and closing left focus on nothing.
 */
export function useModalFocus(ref: RefObject<HTMLElement | null>, open: boolean): void {
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusable = () =>
      [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
    if (!ref.current?.contains(document.activeElement)) focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [ref, open]);
}
