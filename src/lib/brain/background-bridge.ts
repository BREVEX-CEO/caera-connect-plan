/**
 * Handing model preparation to a native OCADE that can genuinely finish it.
 *
 * WHAT PROBLEM THIS ACTUALLY SOLVES.
 *
 * A browser tab cannot promise to keep downloading. Background Fetch is the one
 * web API that survives the tab closing, and it exists in Chromium only. On
 * every other browser OCADE persists a checkpoint and resumes on the next
 * visit, which is honest and is still worse than the thing an operating system
 * does routinely: Android's DownloadManager/WorkManager, iOS's background
 * `URLSession`, and an ordinary desktop process all keep transferring while the
 * app that asked is closed.
 *
 * So when a trusted OCADE companion is present on this device, preparation is
 * handed to it — not as a nicety, but because it converts "we will resume when
 * you come back" into "it will be there when you come back".
 *
 * THE FOUR RULES THIS FILE EXISTS TO ENFORCE
 *
 * 1. **Never two downloads of the same model.** The browser and the companion
 *    must not both transfer. Handoff is a TRANSFER OF OWNERSHIP, and the
 *    installation authority stops its own work before the companion starts.
 * 2. **One canonical identity.** The companion is asked for the exact version
 *    and digest the catalogue names. A companion offering something else is
 *    refused rather than trusted, because "the native app already has a model"
 *    is not the same claim as "it has THIS model".
 * 3. **Verification still belongs to OCADE.** The companion reports bytes and
 *    a digest; nothing is activated until the digest matches what was
 *    published. A native process is more trusted than a CDN, not infinitely
 *    trusted.
 * 4. **Uninstall reaches it.** Removing OCADE Intelligence has to remove what
 *    the companion holds too, or "removed" is a lie told over a full disk.
 *
 * TWO WAYS TO REACH A COMPANION, BECAUSE ONE OF THEM CANNOT WORK EVERYWHERE.
 *
 * On a desktop the companion is a separate process, and loopback HTTP is how a
 * page reaches it. Inside the mobile shell it is the SAME process — and
 * loopback is not merely unnecessary there, it is impossible: the shell serves
 * the application over `https`, `capacitor.config.json` sets `cleartext: false`
 * and `allowMixedContent: false`, so a request to `http://127.0.0.1:11801` is
 * blocked by the WebView before it reaches anything.
 *
 * That mattered more than it sounds. Android and iOS are the two platforms this
 * whole file exists for — they are the ones with real OS-level background
 * transfer — and loopback discovery could never have found a companion on
 * either of them. So a companion is reached through a TRANSPORT: loopback HTTP
 * where there is a separate process to talk to, and the native shell's own
 * bridge where the companion is the app itself.
 *
 * TRUST, AND WHY LOOPBACK ALONE IS NOT IT. The companion is reached on
 * loopback, which no remote attacker can bind — but any other application on
 * the same machine can. A listener that does not answer with the expected
 * product and protocol is treated as ABSENT rather than as a companion.
 *
 * WHAT IS DELIBERATELY NOT SENT: the desktop pairing secret.
 * `paired-credentials.ts` states that it "is used only to SIGN — it is never
 * sent anywhere, which is what makes storing it defensible at all", and putting
 * it in a header to a process that has not yet been authenticated would break
 * that invariant against a threat it does not address: a hostile local listener
 * would simply receive it. The `secret` field here exists for a dedicated
 * companion token when one is issued; the browser passes null today.
 *
 * The real defence is rule 3. Whatever the companion prepares is held to its
 * PUBLISHED DIGEST before anything is activated, so a hostile listener claiming
 * to have prepared the model is caught by exactly the check a hostile CDN is.
 */

import type { InstallTarget } from "./installation-authority";

/** Where a local companion listens. Loopback only, never a LAN address. */
export const COMPANION_ORIGINS = ["http://127.0.0.1:11801", "http://localhost:11801"] as const;

/** How the companion describes itself and what it can do. */
export interface CompanionIdentity {
  /** Must be exactly this, or it is not OCADE. */
  product: "ocade-companion";
  /** Protocol version this companion speaks. */
  protocol: number;
  platform: "android" | "ios" | "windows" | "macos" | "linux";
  /**
   * True when the platform genuinely continues transfers with the app closed.
   *
   * REPORTED BY THE COMPANION, because only it knows whether the OS granted
   * the background capability — an iOS build without the background-transfer
   * entitlement, or an Android build denied battery exemption, can be present
   * and still be no better than the tab. A companion that says false is not
   * used for handoff; there would be nothing to gain and a handoff to lose.
   */
  backgroundTransfer: boolean;
}

/** The protocol version this client speaks. */
export const COMPANION_PROTOCOL = 1;

export type CompanionPhase =
  "idle" | "downloading" | "verifying" | "complete" | "failed" | "cancelled";

/** What the companion says about the job it is running. */
export interface CompanionProgress {
  phase: CompanionPhase;
  version: string;
  receivedBytes: number;
  totalBytes: number | null;
  /** Present once the companion has finished and hashed the artifact. */
  sha256?: string;
  /** Where the completed artifact can be read from, for import into the vault. */
  artifactUrl?: string;
  /** Set when the phase is `failed`. Shown only in diagnostics. */
  reason?: string;
}

export interface BridgeDeps {
  fetchImpl: typeof fetch;
  /** The pairing secret this device already holds, if any. */
  secret?: string | null;
  /** Origins to try. Injected so tests need no listener. */
  origins?: readonly string[];
  /**
   * The native shell's plugin, when there is one.
   *
   * Injected rather than only detected so the mobile path is testable without
   * a device: `nativeBackgroundPlugin()` is the default and reads the real
   * shell.
   */
  nativePlugin?: NativeBackgroundPlugin | null;
  timeoutMs?: number;
}

/**
 * A reply, in the one shape both transports can produce.
 *
 * Modelled on `Response` because the loopback transport IS one; the native
 * transport synthesises the two fields that are actually read. Anything richer
 * would be a shape only one of them could fill.
 */
export interface CompanionReply {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** How this build talks to a companion. */
export interface CompanionTransport {
  /** For diagnostics only. Never shown in ordinary UI. */
  label: string;
  request(
    path: string,
    init?: { method?: string; body?: unknown; timeoutMs?: number },
  ): Promise<CompanionReply>;
}

/**
 * The native shell's own bridge, when OCADE is running inside one.
 *
 * Capacitor exposes registered plugins on `window.Capacitor.Plugins`. Each
 * method takes and returns plain JSON, which is why the protocol's paths map
 * onto it without translation: `/ocade/companion/prepare` is `prepare`.
 */
export interface NativeBackgroundPlugin {
  identity(): Promise<unknown>;
  prepare(options: Record<string, unknown>): Promise<unknown>;
  progress(options: { jobId: string }): Promise<unknown>;
  cancel(options: { jobId: string }): Promise<unknown>;
  uninstall(): Promise<unknown>;
}

/** The plugin this shell registered, or null when there is no shell. */
export function nativeBackgroundPlugin(): NativeBackgroundPlugin | null {
  const capacitor = (
    globalThis as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: Record<string, unknown>;
      };
    }
  ).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return null;
  const plugin = capacitor.Plugins?.["OcadeBackground"] as NativeBackgroundPlugin | undefined;
  return plugin && typeof plugin.identity === "function" ? plugin : null;
}

/**
 * Reach the companion through the shell rather than through a socket.
 *
 * A rejected plugin call becomes a non-ok reply rather than an exception, so
 * every caller in this file keeps exactly one failure path whichever transport
 * it is holding.
 */
export function nativeShellTransport(plugin: NativeBackgroundPlugin): CompanionTransport {
  const reply = (ok: boolean, value: unknown): CompanionReply => ({
    ok,
    status: ok ? 200 : 503,
    json: async () => value,
  });

  return {
    label: "native-shell",
    async request(path, init) {
      const [, jobId] = /\/(?:progress|cancel)\/(.+)$/.exec(path) ?? [];
      try {
        if (path.endsWith("/identity")) return reply(true, await plugin.identity());
        if (path.endsWith("/prepare")) {
          return reply(true, await plugin.prepare((init?.body ?? {}) as Record<string, unknown>));
        }
        if (path.endsWith("/uninstall")) {
          const result = (await plugin.uninstall()) as { ok?: boolean } | undefined;
          return reply(result?.ok !== false, result);
        }
        if (jobId && path.includes("/progress/")) {
          return reply(true, await plugin.progress({ jobId: decodeURIComponent(jobId) }));
        }
        if (jobId && path.includes("/cancel/")) {
          const result = (await plugin.cancel({ jobId: decodeURIComponent(jobId) })) as
            { ok?: boolean } | undefined;
          return reply(result?.ok !== false, result);
        }
        return reply(false, null);
      } catch {
        return reply(false, null);
      }
    },
  };
}

/** Reach a companion process listening on this machine. */
export function loopbackTransport(origin: string, deps: BridgeDeps): CompanionTransport {
  return {
    label: origin,
    async request(path, init) {
      const headers: Record<string, string> = authHeaders(deps.secret);
      if (init?.body !== undefined) headers["content-type"] = "application/json";
      return withTimeout(
        deps.fetchImpl(`${origin}${path}`, {
          method: init?.method,
          headers,
          body: init?.body === undefined ? undefined : JSON.stringify(init.body),
        }),
        init?.timeoutMs ?? deps.timeoutMs ?? 3000,
      );
    },
  };
}

export interface DiscoveredCompanion {
  /** Loopback origin, or the shell's label. Diagnostics only. */
  origin: string;
  identity: CompanionIdentity;
  transport: CompanionTransport;
}

/**
 * Is a trusted OCADE companion listening on this device?
 *
 * Returns null for every ambiguous case — nothing listening, something
 * listening that is not OCADE, an OCADE that speaks a protocol this build does
 * not, or one that cannot authenticate. "Probably a companion" is not a state
 * this returns, because the next thing that happens is handing it a gigabyte
 * of work and the user's expectation that it will finish.
 */
export async function discoverCompanion(deps: BridgeDeps): Promise<DiscoveredCompanion | null> {
  /*
   * THE SHELL FIRST, AND NOT AS A PREFERENCE.
   *
   * Inside the mobile shell the companion IS this app, so there is nothing to
   * find on a socket and the loopback probe below would only spend the
   * first-paint budget failing. Where there is no shell this returns null
   * immediately and the loopback ladder runs exactly as before.
   */
  const plugin = deps.nativePlugin === undefined ? nativeBackgroundPlugin() : deps.nativePlugin;
  const candidates: CompanionTransport[] = [];
  if (plugin) candidates.push(nativeShellTransport(plugin));
  for (const origin of deps.origins ?? COMPANION_ORIGINS) {
    candidates.push(loopbackTransport(origin, deps));
  }

  for (const transport of candidates) {
    try {
      const response = await transport.request("/ocade/companion/identity", {
        timeoutMs: deps.timeoutMs ?? 1500,
      });
      if (!response.ok) continue;
      const identity = (await response.json()) as CompanionIdentity;

      /*
       * Every field is checked, and an unfamiliar protocol is a refusal rather
       * than a negotiation. A companion from a future build may have changed
       * what "hand off this version" means, and guessing at that is how two
       * processes end up downloading different things into the same place.
       */
      if (identity?.product !== "ocade-companion") continue;
      if (identity.protocol !== COMPANION_PROTOCOL) continue;
      if (typeof identity.backgroundTransfer !== "boolean") continue;

      return { origin: transport.label, identity, transport };
    } catch {
      // Nothing there, or it refused. Either way this is not a companion.
    }
  }
  return null;
}

/**
 * Should preparation be handed to this companion?
 *
 * ONLY WHEN IT IS GENUINELY STRONGER. A companion that cannot transfer in the
 * background offers nothing the tab does not already have, and handing over
 * would add a moving part, a second place for the model to live, and a second
 * thing that can be out of date — for no gain. The browser keeps the work.
 */
export function shouldHandOff(input: {
  companion: DiscoveredCompanion | null;
  /** True when the browser itself can continue with the tab closed. */
  browserCanContinueInBackground: boolean;
  /** True when the model is already installed and verified in the browser. */
  alreadyInstalled: boolean;
}): boolean {
  if (input.alreadyInstalled) return false;
  if (!input.companion) return false;
  if (!input.companion.identity.backgroundTransfer) return false;
  /*
   * Background Fetch already survives the tab closing, and it writes into the
   * SAME OPFS vault the engine loads from. Handing off on top of it would mean
   * two owners for one job — the exact thing rule 1 forbids — to gain nothing.
   */
  if (input.browserCanContinueInBackground) return false;
  return true;
}

export type HandoffResult =
  { ok: true; jobId: string } | { ok: false; reason: string; retriable: boolean };

/**
 * Ask the companion to prepare a specific, named version.
 *
 * THE TARGET IS SENT IN FULL — version, size and digest — and that is what
 * makes "one canonical identity" true rather than aspirational. The companion
 * is not asked to prepare "the model"; it is asked to prepare exactly the
 * artifact this build's catalogue names, and it will be held to that digest
 * when it reports back.
 */
export async function handOffToCompanion(
  companion: DiscoveredCompanion,
  target: InstallTarget,
  deps: BridgeDeps,
): Promise<HandoffResult> {
  if (!target.sha256) {
    /*
     * Refused, and this is deliberate. A handoff with no digest could never be
     * verified on return, so the companion's word would become the only
     * evidence — which is exactly the trust this module declines to extend.
     */
    return {
      ok: false,
      reason: "This artifact has no published fingerprint, so it cannot be handed to a companion.",
      retriable: false,
    };
  }

  try {
    const response = await companion.transport.request("/ocade/companion/prepare", {
      method: "POST",
      timeoutMs: deps.timeoutMs ?? 5000,
      body: {
        protocol: COMPANION_PROTOCOL,
        version: target.version,
        sha256: target.sha256,
        totalBytes: target.totalBytes,
        // The same ordered ladder the browser would have used, so the
        // companion fails over identically rather than inventing its own.
        sources: target.sources.map((source) => source.url),
      },
    });
    if (!response.ok) {
      return { ok: false, reason: `The companion answered ${response.status}.`, retriable: true };
    }
    const body = (await response.json()) as { jobId?: string };
    if (!body?.jobId) {
      return { ok: false, reason: "The companion did not start a job.", retriable: true };
    }
    return { ok: true, jobId: body.jobId };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "The companion could not be reached.",
      retriable: true,
    };
  }
}

/** What the companion is doing right now, or null when it cannot be asked. */
export async function readCompanionProgress(
  companion: DiscoveredCompanion,
  jobId: string,
  deps: BridgeDeps,
): Promise<CompanionProgress | null> {
  try {
    const response = await companion.transport.request(
      `/ocade/companion/progress/${encodeURIComponent(jobId)}`,
      { timeoutMs: deps.timeoutMs ?? 3000 },
    );
    if (!response.ok) return null;
    return (await response.json()) as CompanionProgress;
  } catch {
    return null;
  }
}

/**
 * Is what the companion finished with actually the thing that was asked for?
 *
 * THE COMPANION IS NOT THE JUDGE OF ITS OWN WORK. It reports a version and a
 * digest; this compares both against the catalogue's. A native process is more
 * trustworthy than a CDN and still not the authority — the same rule that makes
 * a verified download safe is what makes a handoff safe, and it is the same
 * rule rather than a weaker one.
 */
export function companionResultMatchesTarget(
  progress: CompanionProgress,
  target: InstallTarget,
): boolean {
  if (progress.phase !== "complete") return false;
  if (progress.version !== target.version) return false;
  if (!target.sha256 || !progress.sha256) return false;
  if (progress.sha256.toLowerCase() !== target.sha256.toLowerCase()) return false;
  if (target.totalBytes !== null && progress.receivedBytes !== target.totalBytes) return false;
  return true;
}

/** Stop a companion job. Used when the user pauses, or takes the work back. */
export async function cancelCompanionJob(
  companion: DiscoveredCompanion,
  jobId: string,
  deps: BridgeDeps,
): Promise<boolean> {
  try {
    const response = await companion.transport.request(
      `/ocade/companion/cancel/${encodeURIComponent(jobId)}`,
      { method: "POST", timeoutMs: deps.timeoutMs ?? 3000 },
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Remove what the companion holds.
 *
 * Called by the authority's uninstall. Without it, "OCADE Intelligence has been
 * removed from this device" would be false on precisely the devices that store
 * the most — the native ones — and the user would be looking at a full disk
 * and a product claiming it had let go of it.
 *
 * Returns false when it could not be done, which the caller reports rather than
 * papers over: a companion that is running but refuses to delete is a different
 * situation from one that is not installed.
 */
export async function uninstallFromCompanion(
  companion: DiscoveredCompanion,
  deps: BridgeDeps,
): Promise<boolean> {
  try {
    const response = await companion.transport.request("/ocade/companion/uninstall", {
      method: "POST",
      timeoutMs: deps.timeoutMs ?? 5000,
    });
    return response.ok;
  } catch {
    return false;
  }
}

function authHeaders(secret?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "x-ocade-client": "web",
    "x-ocade-protocol": String(COMPANION_PROTOCOL),
  };
  /*
   * Loopback is not authentication. Any other process on the machine can bind
   * a port and answer, so the pairing secret is what distinguishes OCADE's own
   * companion from something else that is listening.
   */
  if (secret) headers["x-ocade-pairing"] = secret;
  return headers;
}

/**
 * A bounded wait.
 *
 * A companion that accepts a connection and never answers would otherwise hang
 * the capability probe, and the probe runs on the path to first paint. Every
 * timeout here is short for that reason: a slow companion is treated as an
 * absent one, which costs a handoff and never costs a first run.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("The companion did not answer in time.")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
