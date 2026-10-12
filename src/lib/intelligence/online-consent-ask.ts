/** Where the transport asks the mounted consent dialog (OnlineConsent.tsx). */
let ask: (() => Promise<boolean>) | null = null;

export function setOnlineConsentAsk(next: (() => Promise<boolean>) | null): void {
  ask = next;
}

/** Asks the person (when the dialog is mounted); false means nothing may be sent. */
export function askOnlineConsent(): Promise<boolean> {
  return ask ? ask() : Promise.resolve(false);
}
