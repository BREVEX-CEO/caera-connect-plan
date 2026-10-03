/**
 * HYDRATION FIRST, THEN CLIENT-ONLY ROUTE CHECKS.
 *
 * An `ssr: false` route's `beforeLoad` runs in the browser right after the router hydrates.
 * When it redirected (to the second-factor page) before React had finished hydrating, the
 * tree React was matching against the server's HTML changed under it: React #418 on the
 * console. Such checks wait for the root to commit; later navigations do not wait at all.
 */
let markDone: (() => void) | undefined;
const hydrated =
  typeof window === "undefined"
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        markDone = resolve;
      });

/** Called once by the root, after its first commit. */
export function markHydrated(): void {
  markDone?.();
}

export function whenHydrated(): Promise<void> {
  return hydrated;
}
