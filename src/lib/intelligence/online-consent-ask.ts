/** Where the transport asks the mounted consent dialog (OnlineConsent.tsx). */
let ask: (() => Promise<boolean>) | null = null;
/** The question on screen now: everyone who asks while it is open gets its one answer. */
let open: Promise<boolean> | null = null;

export function setOnlineConsentAsk(next: (() => Promise<boolean>) | null): void {
  ask = next;
}

/**
 * Asks the person (when the dialog is mounted); false means nothing may be sent. Requests
 * that ask together share one question (PLAN Phase 08 V16): a second ask used to replace
 * the first, which then waited for ever.
 */
export function askOnlineConsent(): Promise<boolean> {
  if (!ask) return Promise.resolve(false);
  open ??= ask().finally(() => {
    open = null;
  });
  return open;
}
