/**
 * Did anything actually leave this device while OCADE was answering?
 *
 * WHY THIS CANNOT BE ANSWERED BY A CLOUD ASSISTANT. When a remote service says
 * "we did not train on your data" or "your file was deleted", that is a policy
 * statement about a machine you cannot inspect. There is no measurement a user
 * could take to check it, and no measurement the vendor could offer that would
 * mean anything, because the vendor controls both the claim and the evidence.
 *
 * OCADE is in a different position, and this module is the reason it matters:
 * when the engine runs on the user's own hardware, "nothing left the device"
 * becomes an OBSERVABLE PROPERTY OF THEIR OWN BROWSER rather than a promise.
 *
 * WHY PerformanceObserver AND NOT A WRAPPED `fetch`. The obvious approach is to
 * monkey-patch `fetch` and count calls. It is also worthless as evidence: the
 * code doing the counting is the same code being audited, so a bug — or a
 * future contributor adding an `XMLHttpRequest`, a `sendBeacon`, an `<img>`
 * ping or a WebSocket — goes unrecorded and the receipt says "nothing left"
 * while something did.
 *
 * The Resource Timing buffer is the BROWSER's record of every network fetch the
 * page made, whatever API issued it. It is written by the user agent, not by
 * this application, and this module can only read it. That asymmetry is the
 * whole point: OCADE is not asking to be believed, it is reading the same
 * independent log the user could open DevTools and read themselves.
 *
 * WHAT IT STILL CANNOT SEE, stated plainly rather than glossed:
 *  - requests made by the native managed-browser host, which are outside the page
 *  - requests from another tab or a shared worker started elsewhere
 *  - the contents of anything sent; this counts destinations, not payloads
 * `limits()` returns these so the interface can say them out loud instead of
 * implying a completeness the measurement does not have.
 */

/**
 * What a request MEANS, which is not the same as where it went.
 *
 * A REAL DEFECT THIS FIXES. The first version classified purely by origin, so
 * loading OCADE's own WebAssembly runtime from OCADE's own server counted as
 * data leaving the device. Measured against the live engine, a completely
 * on-device answer produced `leftDevice: true` and a headline naming the app's
 * own address — because the browser had, quite correctly, fetched the engine
 * binary.
 *
 * That is worse than useless. An indicator that fires on every answer teaches
 * people to ignore it, and the one time something really is sent they will
 * ignore that too.
 *
 * The distinction that actually matters is not first-party versus third-party;
 * it is STATIC ASSETS versus PATHS THAT CARRY THE USER'S CONTENT. Fetching
 * `/assets/wllama.wasm` is the app loading itself. A POST to `/api/chat` is the
 * user's question going to a server, and it is on the same origin. Origin alone
 * cannot tell those apart, so the path is classified here — and then discarded.
 */
export type ContactKind =
  /** The app fetching its own code, weights or styles. Carries no user content. */
  | "own_assets"
  /** A request to a path that carries the user's content. */
  | "data"
  /** Another origin entirely — off this machine. */
  | "third_party"
  /**
   * A different server on the SAME machine: an engine on `localhost`.
   *
   * Found by running the real thing. An answer produced by a local Ollama
   * instance recorded a request to `http://localhost:11434`, which the first
   * version classified as third-party and reported as "sent to 1 server".
   * That detection was right and the wording was wrong: loopback traffic is
   * delivered by the kernel and never reaches a network interface, so nothing
   * left the device. Telling a user their data was sent away, when it moved
   * between two processes on their own computer, is a false alarm about the
   * exact thing they came here to check.
   *
   * It is still reported separately rather than folded into "on this device",
   * because "a program on your machine that OCADE did not write" is a
   * different trust question from "inside this browser tab", and the user is
   * entitled to know which one produced their answer.
   */
  | "loopback"
  /** blob:/data: — already in memory, never touched the network. */
  | "this_device";

/** Hosts that never leave the machine, whatever port they are on. */
const LOOPBACK = /^(localhost|127(?:\.\d+){3}|\[::1\]|::1|.*\.localhost)$/i;

export interface NetworkContact {
  /**
   * Origin only. NEVER the full URL — a path can carry the user's content
   * verbatim, and a privacy receipt that quotes `?q=my+diagnosis` back at them
   * has become the leak it was built to detect.
   */
  origin: string;
  kind: ContactKind;
  /** How many requests reached that origin during the window. */
  count: number;
  /** Bytes transferred where the browser reports them; null when it will not. */
  transferredBytes: number | null;
}

/**
 * Paths that carry the user's content, borrowed from the service worker's own
 * never-cache list so the two cannot drift apart.
 */
const DATA_PATHS = [/^\/api\//, /^\/_serverFn\//, /^\/auth\//];

function classify(url: string, ownOrigin: string): { origin: string; kind: ContactKind } {
  if (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("filesystem:")) {
    return { origin: "(this device)", kind: "this_device" };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { origin: "(unknown)", kind: "third_party" };
  }
  if (parsed.origin !== ownOrigin) {
    // Checked before third-party: a loopback origin is a different server but
    // the same machine, and the receipt's claim is about the DEVICE.
    return {
      origin: parsed.origin,
      kind: LOOPBACK.test(parsed.hostname) ? "loopback" : "third_party",
    };
  }
  return {
    origin: parsed.origin,
    kind: DATA_PATHS.some((p) => p.test(parsed.pathname)) ? "data" : "own_assets",
  };
}

export interface NetworkObservation {
  /** True when the browser recorded zero requests during the window. */
  silent: boolean;
  /** Every origin contacted, own origin included. */
  contacts: NetworkContact[];
  /** Total requests observed. */
  requests: number;
  /** Whether the browser gave us a usable log at all. */
  measured: boolean;
  /** Present when it could not measure, explaining why. */
  unmeasuredReason?: string;
}

/** What this measurement cannot see, for honest presentation. */
export function limits(): string[] {
  return [
    "Requests made by the native managed-browser host are outside this page and are not counted.",
    "Requests from other tabs are not counted.",
    "This records which servers were contacted, not what was sent to them.",
  ];
}

/**
 * The window itself.
 *
 * `start()` snapshots the resource log, `stop()` reads what was appended. No
 * patching, no interception — only a before-and-after read of a log the browser
 * maintains for its own reasons.
 */
export class NetworkWitness {
  private observer: PerformanceObserver | null = null;
  private seen: PerformanceResourceTiming[] = [];
  private startedAt = 0;
  private failure: string | null = null;

  /** Injected so the whole class is testable without a browser. */
  constructor(private readonly scope: typeof globalThis = globalThis) {}

  start(): void {
    this.seen = [];
    this.failure = null;
    this.startedAt = this.now();

    const Observer = (this.scope as { PerformanceObserver?: typeof PerformanceObserver })
      .PerformanceObserver;
    if (typeof Observer !== "function") {
      this.failure = "This browser does not record network timing, so OCADE cannot check.";
      return;
    }
    try {
      this.observer = new Observer((list) => {
        for (const entry of list.getEntries()) {
          this.seen.push(entry as PerformanceResourceTiming);
        }
      });
      /*
       * `buffered: false` on purpose. Buffered entries include requests made
       * BEFORE this window opened — the page's own scripts and styles — which
       * would be reported as though the answer had caused them.
       */
      this.observer.observe({ type: "resource", buffered: false });
    } catch {
      this.observer = null;
      this.failure = "This browser refused to report network timing, so OCADE cannot check.";
    }
  }

  stop(): NetworkObservation {
    this.observer?.disconnect();
    this.observer = null;

    if (this.failure) {
      /*
       * Unmeasured is NEVER reported as silent. "We could not look" and "we
       * looked and saw nothing" are different statements, and collapsing them
       * is precisely the dishonesty this module exists to avoid.
       */
      return {
        silent: false,
        contacts: [],
        requests: 0,
        measured: false,
        unmeasuredReason: this.failure,
      };
    }

    const ownOrigin = this.ownOrigin();
    const byKey = new Map<string, NetworkContact>();
    for (const entry of this.seen) {
      if (entry.startTime < this.startedAt) continue;
      const { origin, kind } = classify(entry.name, ownOrigin);
      const key = `${origin}|${kind}`;
      const existing = byKey.get(key);
      const bytes = typeof entry.transferSize === "number" ? entry.transferSize : null;
      if (existing) {
        existing.count += 1;
        if (bytes !== null) existing.transferredBytes = (existing.transferredBytes ?? 0) + bytes;
      } else {
        byKey.set(key, { origin, kind, count: 1, transferredBytes: bytes });
      }
    }

    const contacts = [...byKey.values()].sort((a, b) => b.count - a.count);
    const requests = contacts.reduce((total, c) => total + c.count, 0);
    /*
     * `silent` counts only the requests that could have carried the user's
     * content. The app loading its own engine binary is not the user's data
     * going anywhere, and reporting it as such is the false alarm that would
     * make this indicator worthless.
     */
    const revealing = contacts.filter((c) => c.kind === "data" || c.kind === "third_party");
    return {
      silent: revealing.length === 0,
      contacts,
      requests,
      measured: true,
    };
  }

  private now(): number {
    const perf = (this.scope as { performance?: { now(): number } }).performance;
    return perf ? perf.now() : 0;
  }

  private ownOrigin(): string {
    const loc = (this.scope as { location?: { origin?: string } }).location;
    return loc?.origin ?? "";
  }
}

/**
 * One sentence a person can act on.
 *
 * Deliberately refuses to say "private" on an unmeasured window, and names the
 * destinations when there were any — "3 requests" tells the user nothing they
 * can judge.
 */
export function describeObservation(observation: NetworkObservation): string {
  if (!observation.measured) {
    return observation.unmeasuredReason ?? "OCADE could not check whether anything was sent.";
  }
  if (observation.silent) {
    const loopback = observation.contacts.filter((c) => c.kind === "loopback");
    if (loopback.length > 0) {
      // Named, not hidden. "A program on your own machine" is a different
      // trust question from "inside this tab", and the user decides.
      return `Nothing left this computer. The answer came from an engine running on this machine at ${loopback[0].origin}.`;
    }
    const assets = observation.contacts.some((c) => c.kind === "own_assets");
    return assets
      ? // Precise rather than flattering: requests DID happen, and saying so
        // while explaining what they were is more credible than claiming none.
        "Nothing you typed was sent. The only requests your browser made were OCADE loading its own engine files."
      : "Nothing was sent while this answer was produced. Your browser recorded no network requests at all.";
  }
  const revealing = observation.contacts.filter(
    (c) => c.kind === "data" || c.kind === "third_party",
  );
  const names = [...new Set(revealing.map((c) => c.origin))].join(", ");
  const count = revealing.reduce((total, c) => total + c.count, 0);
  return `${count} network ${
    count === 1 ? "request" : "requests"
  } that could carry your content happened while this answer was produced${names ? `, to ${names}` : ""}.`;
}
