/**
 * Error reporting for ported primary-logic modules.
 *
 * The donor wrote to a terminal logger that also shipped the message to a
 * hosted sink. OCADE keeps errors on the device: they go to the console in
 * development and to the in-app error capture everywhere, and nothing leaves
 * the machine.
 */

type Reporter = (error: unknown) => void;

let reporter: Reporter | null = null;

/** Install the host's error sink. Called once by the OCADE runtime. */
export function setErrorReporter(next: Reporter | null): void {
  reporter = next;
}

export function logError(error: unknown): void {
  if (reporter) {
    try {
      reporter(error);
      return;
    } catch {
      /* A failing reporter must never mask the original error. */
    }
  }
  if (import.meta.env?.DEV) console.error(error);
}
