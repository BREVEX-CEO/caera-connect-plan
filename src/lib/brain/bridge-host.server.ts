import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  handleBridgeRequest,
  type BridgeDeps,
  type BridgeRequest,
  type ChatStreamHandle,
  type BridgeResponse,
} from "./bridge-server";
import {
  createPairingState,
  type PairedDevice,
  type PairingState,
  type PairingRequest,
} from "./pairing";
import { discoverLocalModels, streamLocalChat, DEFAULT_LOCAL_BRIDGE_URL } from "../ocade-local";
import { routeTask, PerfLedger, type RoutePolicy } from "../local/router-policy";
import { routePolicyFor } from "../local/device-route-policy";
import { detectPlatform, selectFixedModel } from "../local/fixed-model";

/**
 * The listener side of pairing: what actually runs `bridge-server` on a machine.
 *
 * WHY THIS FILE IS `.server` AND LOADED WITH `await import`. It signs with
 * `node:crypto` and reads the approved-device list off disk. Neither belongs in
 * a browser bundle, and a static import from a route would drag both into it.
 *
 * IT IS OFF UNTIL SOMEBODY TURNS IT ON, AND THAT SOMEBODY IS NOT THE NETWORK.
 * `OCADE_BRIDGE_ENABLED=1` is required, and so is a device file — an approved
 * pairing is a decision a human made at the machine, so there is no code path
 * here that creates one. A hosted deployment has neither, which is why the
 * endpoint 404s there: OCADE's cloud must never answer as though it were the
 * user's own computer, because the whole promise of a paired device is that the
 * hardware belongs to them.
 *
 * WITH THE FLAG SET AND NO APPROVED DEVICES, EVERY REQUEST IS REFUSED. That is
 * the correct behaviour, not an unfinished one: the device list is the
 * allowlist, and an empty allowlist allows nobody.
 */

/** Where the desktop shell writes the devices a human approved. */
const DEVICE_FILE_ENV = "OCADE_BRIDGE_DEVICES";
const ENABLE_ENV = "OCADE_BRIDGE_ENABLED";

export interface BridgeHostConfig {
  enabled: boolean;
  deviceFile: string | null;
}

export function readBridgeConfig(env: NodeJS.ProcessEnv = process.env): BridgeHostConfig {
  return {
    enabled: env[ENABLE_ENV] === "1",
    deviceFile: env[DEVICE_FILE_ENV] || null,
  };
}

/**
 * Parse the approved-device file.
 *
 * Strict, and silent about why on purpose: this runs on the machine's own disk,
 * so a malformed entry is a bug to fix locally, but a half-read allowlist that
 * silently admitted a device with no origin would be a hole. Anything that does
 * not carry all four fields is dropped rather than defaulted.
 */
export function parseDeviceFile(contents: string): PairedDevice[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return [];
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { devices?: unknown })?.devices)
      ? (parsed as { devices: unknown[] }).devices
      : [];

  const devices: PairedDevice[] = [];
  for (const row of rows) {
    const device = row as Partial<PairedDevice>;
    if (
      typeof device?.id !== "string" ||
      typeof device?.label !== "string" ||
      typeof device?.origin !== "string" ||
      typeof device?.secret !== "string" ||
      !device.id ||
      !device.origin ||
      !device.secret
    ) {
      continue;
    }
    devices.push({
      id: device.id,
      label: device.label,
      origin: device.origin,
      secret: device.secret,
      approvedAt: typeof device.approvedAt === "number" ? device.approvedAt : 0,
      ...(typeof device.revokedAt === "number" ? { revokedAt: device.revokedAt } : {}),
    });
  }
  return devices;
}

/**
 * The signature the browser adapter computes, recomputed here.
 *
 * It must stay byte-identical to `paired-desktop.ts`'s `authHeaders`, which is
 * why the field order is written out rather than derived from an object: a
 * reordering there and not here would refuse every genuine request, and the
 * only symptom would be "pair again" forever.
 */
export function signPairingRequest(
  secret: string,
  request: Omit<PairingRequest, "signature">,
): string {
  return createHmac("sha256", secret)
    .update(`${request.deviceId}|${request.origin}|${request.issuedAt}|${request.nonce}`)
    .digest("hex");
}

/** Length-safe constant-time compare; `===` on a signature leaks it by timing. */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/*
 * Pairing state lives for the life of the process, which is what makes replay
 * protection and the rate limit mean anything: both are memories of what has
 * already been asked, and rebuilding them per request would forget every nonce
 * the instant it mattered.
 */
let state: PairingState | null = null;
let loadedFrom: string | null = null;
const ledger = new PerfLedger();

/*
 * Measured once and kept.
 *
 * A paired request must be routed against THIS machine's policy — the same one
 * the local screen uses. Routing with no policy picks the largest installed
 * model regardless of whether the machine can run it well, which on the
 * reference machine meant a 14B model at roughly three minutes to the first
 * token in place of the tier it was matched to. The measurement is stable for
 * the life of the process, so it is taken lazily and cached rather than
 * repeated for every request.
 */
let cachedPolicy: RoutePolicy | null = null;

async function machinePolicy(): Promise<RoutePolicy> {
  if (cachedPolicy) return cachedPolicy;
  try {
    const [{ measureHardware }, { profileFrom }] = await Promise.all([
      import("../hardware/detect.node"),
      import("../hardware/detect"),
    ]);
    cachedPolicy = routePolicyFor(profileFrom(await measureHardware()), true);
  } catch {
    // An unmeasurable machine gets no constraints rather than invented ones —
    // the same direction the local screen takes when its probe fails.
    cachedPolicy = {};
  }
  return cachedPolicy;
}

async function pairingState(config: BridgeHostConfig): Promise<PairingState> {
  if (state && loadedFrom === config.deviceFile) return state;
  let devices: PairedDevice[] = [];
  if (config.deviceFile) {
    try {
      devices = parseDeviceFile(await readFile(config.deviceFile, "utf8"));
    } catch {
      // No file yet is the ordinary state before the first approval. It means
      // nobody is allowed, which is the safe direction.
      devices = [];
    }
  }
  state = createPairingState(devices);
  loadedFrom = config.deviceFile;
  return state;
}

/** Forget the cached allowlist, so the next request re-reads the file. */
export function reloadDevices(): void {
  state = null;
  loadedFrom = null;
}

/** Origins this machine will answer at all — exactly the approved ones. */
export async function approvedOrigins(config = readBridgeConfig()): Promise<Set<string>> {
  if (!config.enabled) return new Set();
  const current = await pairingState(config);
  return new Set(
    [...current.devices.values()]
      .filter((device) => device.revokedAt === undefined)
      .map((device) => device.origin),
  );
}

/** Describe this machine's engine, or null when it has none ready. */
/**
 * The one model, for the paired-device path too.
 *
 * A phone talking to this computer must get the SAME engine the computer's own
 * screen gets. When selection lived in `routeTask`, the paired path could pick
 * a different model than the local one on the same machine — so the answer a
 * user got depended on which device they asked from, which is indefensible for
 * a product whose whole promise is consistency.
 */
async function fixedModelFor(
  models: { id: string; vision?: boolean; sizeBytes?: number; isCloudPointer?: boolean }[],
  visionRequired: boolean,
): Promise<{ ok: boolean; modelId: string | null; reason?: string }> {
  const choice = selectFixedModel({
    platform: detectPlatform(),
    installed: models.map((m) => ({
      id: m.id,
      vision: m.vision,
      sizeBytes: m.sizeBytes,
      isCloudPointer: m.isCloudPointer,
    })),
    visionRequired,
  });
  return { ok: choice.ok, modelId: choice.modelId, reason: choice.reason };
}

async function describeEngine(engineUrl: string) {
  const discovery = await discoverLocalModels(engineUrl);
  if (!discovery.reachable || discovery.models.length === 0) return null;
  const chosen = await fixedModelFor(discovery.models, false);
  if (!chosen.ok || !chosen.modelId) return null;
  return {
    label: "Paired computer",
    modelId: chosen.modelId,
    vision: discovery.models.some((model) => model.vision),
    // Reported as absent rather than assumed: the classifier keeps the
    // runtime's vision capability but not its tool capability, and claiming a
    // capability that turns out to be missing fails at the point where a user
    // has already asked for something that depends on it.
    tools: false,
  };
}

export function bridgeDeps(state: PairingState, engineUrl = DEFAULT_LOCAL_BRIDGE_URL): BridgeDeps {
  return {
    state,
    now: () => Date.now(),
    sign: (device, request) => signPairingRequest(device.secret, request),
    constantTimeEqual,
    describeEngine: () => describeEngine(engineUrl),
    streamChat: async (messages, handlers) => {
      const discovery = await discoverLocalModels(engineUrl);
      if (!discovery.reachable) {
        return { ok: false, reason: "The engine on that computer is not running." };
      }
      // A picture in the request changes which model can serve it. Asking a
      // text-only model to look at an image does not fail loudly — it answers
      // about nothing, which is worse than refusing.
      const needsVision = messages.some((message) => (message.images?.length ?? 0) > 0);
      const chosen = await fixedModelFor(discovery.models, needsVision);
      if (!chosen.ok || !chosen.modelId) {
        return {
          ok: false,
          reason:
            chosen.reason ??
            (needsVision
              ? "That computer has no model installed that can read images."
              : "That computer does not have OCADE's engine installed."),
        };
      }
      const result = await streamLocalChat(
        engineUrl,
        chosen.modelId,
        messages.map((message) => ({
          role: message.role as "system" | "user" | "assistant",
          content: message.content,
          ...(message.images?.length ? { images: message.images } : {}),
        })),
        { onToken: handlers.onToken, signal: handlers.signal, think: handlers.think },
      );
      return { ...result, modelId: chosen.modelId };
    },
  };
}

/**
 * Serve one request, or refuse to exist.
 *
 * `null` means "this machine is not a bridge" and the caller should answer 404
 * rather than 401 — a disabled bridge should look like no endpoint at all, not
 * like a locked one, because a locked one advertises that there is something
 * behind it.
 */
export async function serveBridgeRequest(
  request: BridgeRequest,
  config = readBridgeConfig(),
  engineUrl = process.env.OCADE_ENGINE_URL || DEFAULT_LOCAL_BRIDGE_URL,
): Promise<BridgeResponse | ChatStreamHandle | null> {
  if (!config.enabled) return null;
  const current = await pairingState(config);
  return handleBridgeRequest(request, bridgeDeps(current, engineUrl));
}
