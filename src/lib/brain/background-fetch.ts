/**
 * Handing the transfer to the browser, when the browser will actually take it.
 *
 * THE HONEST VERSION OF "IT KEEPS DOWNLOADING IN THE BACKGROUND".
 *
 * Ordinary page JavaScript cannot make that promise. When a browser decides to
 * kill a tab — a phone under memory pressure, a user switching apps, a laptop
 * going to sleep — the fetch dies with it, and any product that said otherwise
 * was describing a hope. Background Fetch is the one API that genuinely
 * survives it: the browser owns the transfer, shows its own progress, keeps
 * going with the tab closed, and wakes the service worker when it lands.
 *
 * So OCADE says the true thing in each case:
 *
 *   - Background Fetch available  → the transfer really can continue without
 *                                   the page, and `canContinueInBackground()`
 *                                   reports that so a screen may say so.
 *   - Not available               → nothing is claimed. Validated progress is
 *                                   persisted and resumed on the next visit,
 *                                   which is a smaller promise that is true.
 *
 * WHEN IT IS WORTH USING. Not always, and that is deliberate. Background Fetch
 * cannot resume from a checkpoint — it fetches whole requests — so handing it a
 * transfer that is already 80% done would throw away that 80%. It is offered
 * only for a FRESH install, where there is nothing to lose, and the foreground
 * chunked transfer keeps everything it has otherwise.
 *
 * IT NEVER VERIFIES ANYTHING. The worker writes bytes and says so; the
 * installation authority hashes them before anything is activated. One
 * implementation of "is this safe to run", in one place.
 */

const FETCH_ID_PREFIX = "ocade-model:";

interface BackgroundFetchRegistrationLike {
  id: string;
  downloaded: number;
  downloadTotal: number;
  result: string;
  addEventListener?: (type: string, listener: () => void) => void;
  abort?: () => Promise<boolean>;
}

interface BackgroundFetchManagerLike {
  fetch: (
    id: string,
    requests: string[],
    options?: { title?: string; icons?: { src: string; sizes?: string; type?: string }[]; downloadTotal?: number },
  ) => Promise<BackgroundFetchRegistrationLike>;
  get: (id: string) => Promise<BackgroundFetchRegistrationLike | undefined>;
  getIds: () => Promise<string[]>;
}

function manager(
  registration: ServiceWorkerRegistration | null,
): BackgroundFetchManagerLike | null {
  const candidate = (registration as ServiceWorkerRegistration & {
    backgroundFetch?: BackgroundFetchManagerLike;
  } | null)?.backgroundFetch;
  return candidate && typeof candidate.fetch === "function" ? candidate : null;
}

async function currentRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Can preparation genuinely continue while OCADE is not open?
 *
 * A SCREEN MAY ONLY SAY SO IF THIS IS TRUE. It is the difference between
 * telling somebody they can close the tab and telling them something that will
 * cost them a gigabyte when it turns out to be false.
 */
export async function canContinueInBackground(): Promise<boolean> {
  return manager(await currentRegistration()) !== null;
}

/** The registration id for one artifact path, and the path back out of it. */
export function backgroundFetchId(path: string): string {
  return `${FETCH_ID_PREFIX}${path}`;
}

export interface BackgroundFetchStart {
  /** The OPFS path the worker will write to, e.g. "versions/v1/v1.bin". */
  path: string;
  /** Where to fetch from. One URL: Background Fetch cannot fail over. */
  url: string;
  /** Published size, so the browser's own progress is accurate. */
  totalBytes?: number | null;
}

export type BackgroundFetchOutcome =
  | { started: true }
  /** Already running — joining it, not starting a second. */
  | { started: false; reason: "already_running" }
  | { started: false; reason: "unsupported" }
  | { started: false; reason: "refused" };

/**
 * Ask the browser to carry this transfer.
 *
 * IT NEVER CREATES A SECOND ONE. An existing registration under the same id is
 * joined rather than replaced, which matters because the whole point of the
 * installation authority is that there is one transfer — and a background fetch
 * started twice would be two, outside the page's own locking entirely.
 */
export async function startBackgroundFetch(
  input: BackgroundFetchStart,
): Promise<BackgroundFetchOutcome> {
  const registration = await currentRegistration();
  const backgroundFetch = manager(registration);
  if (!backgroundFetch) return { started: false, reason: "unsupported" };

  const id = backgroundFetchId(input.path);
  try {
    const existing = await backgroundFetch.get(id);
    if (existing) return { started: false, reason: "already_running" };
  } catch {
    /* An engine that cannot be asked is treated as having nothing. */
  }

  try {
    await backgroundFetch.fetch(id, [input.url], {
      /*
       * THE BROWSER SHOWS THIS TITLE IN ITS OWN DOWNLOAD UI, so the product
       * language rule reaches further than OCADE's own screens: no model name,
       * no vendor, no file, no size. The one place a size does appear is
       * `downloadTotal`, which the browser renders itself and which is the
       * platform being accurate rather than OCADE naming anything.
       */
      title: "Preparing OCADE",
      icons: [{ src: "/icons/ocade-192.png", sizes: "192x192", type: "image/png" }],
      ...(input.totalBytes ? { downloadTotal: input.totalBytes } : {}),
    });
    return { started: true };
  } catch {
    /*
     * Browsers refuse for reasons that are not errors: a user setting, a
     * private window, a quota decision. The foreground transfer is already the
     * correct fallback and it is not told about this at all.
     */
    return { started: false, reason: "refused" };
  }
}

/** Stop the browser-owned transfer, e.g. because the user uninstalled. */
export async function abortBackgroundFetch(path: string): Promise<void> {
  const backgroundFetch = manager(await currentRegistration());
  if (!backgroundFetch) return;
  try {
    const existing = await backgroundFetch.get(backgroundFetchId(path));
    await existing?.abort?.();
  } catch {
    /* Nothing to stop. */
  }
}

/**
 * Listen for the worker saying it has filed a completed transfer.
 *
 * The message says bytes were WRITTEN, never that they are good. The listener's
 * job is to ask the authority to look, and the authority hashes before it
 * activates — which is why a corrupt background fetch is caught by exactly the
 * same check as a corrupt foreground one.
 */
export function onBackgroundFetchStaged(listener: (ok: boolean) => void): () => void {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return () => {};
  const handler = (event: MessageEvent) => {
    const data = event.data as { type?: string; ok?: boolean } | null;
    if (data && data.type === "ocade:model-staged") listener(data.ok === true);
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
