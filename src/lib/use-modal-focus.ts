import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const openModals: HTMLElement[] = [];

/**
 * A modal keeps keyboard focus inside itself while open and gives it back to
 * whatever opened it when it closes (F-048). Without this, Tab walked out of
 * the dialog into the page behind it, and closing left focus on nothing.
 */
export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose?: () => void,
): void {
  useEffect(() => {
    const modal = ref.current;
    if (!open || !modal) return;
    const opener = document.activeElement as HTMLElement | null;
    openModals.push(modal);
    const focusable = () =>
      [...modal.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility === "visible",
      );
    if (!modal.contains(document.activeElement)) focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || openModals.at(-1) !== modal) return;
      if (event.key === "Escape" && onClose) {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || event.ctrlKey || event.metaKey) return;
      const items = focusable();
      if (items.length === 0) return;
      // The browser may omit links from its native tab order, so handle each step.
      const index = items.findIndex((item) => item === document.activeElement);
      const next = event.shiftKey
        ? index <= 0
          ? items.length - 1
          : index - 1
        : (index + 1) % items.length;
      event.preventDefault();
      items[next]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const index = openModals.lastIndexOf(modal);
      openModals.splice(index, 1);
      if (index === openModals.length && opener?.isConnected) opener.focus();
    };
  }, [ref, open, onClose]);
}
