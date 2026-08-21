/**
 * The website's end of the Cowork channel.
 *
 * OCADE is a web page. It cannot open a tab, read a DOM it does not own, or
 * click anything outside itself — and it should not be able to. The Cowork
 * extension can, and this is how the page asks it to.
 *
 * TRANSPORT. `chrome.runtime.sendMessage(extensionId, …)`, which a page may
 * only use when its own origin appears in the extension's
 * `externally_connectable.matches`. The origin check is therefore Chrome's,
 * performed before the message is delivered, rather than a comparison in our
 * code that could be written wrongly once and be wrong everywhere.
 *
 * WHAT THIS DELIBERATELY CANNOT DO. It cannot grant itself scope.
 * `scope.approve` and `scope.revoke` are refused here before they are sent, and
 * refused again by the extension when they arrive. Approval happens in the
 * extension's own popup, where the person is. A bug in this file, or a script
 * injected into the page, still cannot widen where OCADE may act.
 */

import {
  EXTENSION_PROTOCOL_VERSION,
  OCADE_EXTENSION_ID,
  WEBSITE_FORBIDDEN_COMMANDS,
  describeOutcome,
  type ExtensionCommand,
  type ExtensionResult,
  type ExtensionStatus,
  type StepOutcome,
} from "./extension-protocol";

interface ChromeRuntimeLike {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response: unknown) => void,
  ) => void;
  lastError?: { message?: string };
}

function runtime(): ChromeRuntimeLike | null {
  const candidate = (globalThis as { chrome?: { runtime?: unknown } }).chrome?.runtime;
  if (!candidate || typeof (candidate as ChromeRuntimeLike).sendMessage !== "function") return null;
  return candidate as ChromeRuntimeLike;
}

/** True when this browser could talk to an extension at all (Chrome or Edge). */
export function extensionChannelAvailable(): boolean {
  return runtime() !== null;
}

const NOT_INSTALLED: ExtensionResult = {
  ok: false,
  reason:
    "The OCADE Cowork extension is not installed in this browser, so OCADE cannot act in it. Install it and approve the sites you want OCADE to work on.",
  blocked: true,
};

export interface BridgeOptions {
  extensionId?: string;
  /** Milliseconds before an unanswered message is treated as no extension. */
  timeoutMs?: number;
}

/**
 * Send one command and get one result.
 *
 * Never throws. A missing extension, a dead service worker and a refusal are
 * all ordinary answers a caller has to handle, and turning any of them into an
 * exception only moves the handling somewhere less careful.
 */
export async function sendToExtension(
  command: ExtensionCommand,
  argument: Record<string, unknown> = {},
  options: BridgeOptions = {},
): Promise<ExtensionResult> {
  if (WEBSITE_FORBIDDEN_COMMANDS.has(command)) {
    return {
      ok: false,
      reason:
        "OCADE cannot approve a site for itself. Open the OCADE Cowork popup and approve it there.",
      blocked: true,
    };
  }

  const channel = runtime();
  if (!channel) return NOT_INSTALLED;

  const extensionId = options.extensionId ?? OCADE_EXTENSION_ID;
  const timeoutMs = options.timeoutMs ?? 15_000;

  return new Promise<ExtensionResult>((resolve) => {
    let settled = false;
    const finish = (result: ExtensionResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timer = setTimeout(
      () =>
        finish({
          ok: false,
          reason: "The OCADE Cowork extension did not answer in time.",
          blocked: true,
        }),
      timeoutMs,
    );

    try {
      channel.sendMessage(extensionId, { command, argument }, (response) => {
        clearTimeout(timer);
        // Chrome reports "could not establish connection" through lastError
        // rather than by throwing, and reads as a successful call with an
        // undefined response if it is not checked.
        const failure = channel.lastError?.message;
        if (failure) return finish(NOT_INSTALLED);
        if (!response || typeof response !== "object") {
          return finish({
            ok: false,
            reason: "The OCADE Cowork extension returned nothing.",
          });
        }
        finish(response as ExtensionResult);
      });
    } catch {
      clearTimeout(timer);
      finish(NOT_INSTALLED);
    }
  });
}

export interface Handshake {
  installed: boolean;
  version?: string;
  protocolVersion?: number;
  compatible: boolean;
  status?: ExtensionStatus;
  reason?: string;
}

/**
 * Ask what is on the other end before relying on it.
 *
 * A version mismatch is reported rather than worked around: an older extension
 * answering a newer command with a shape this code does not expect is exactly
 * how a "verified" flag goes missing and a mutation gets reported as done.
 */
export async function handshakeWithExtension(options: BridgeOptions = {}): Promise<Handshake> {
  const result = await sendToExtension("handshake", {}, { ...options, timeoutMs: 4000 });
  if (!result.ok) return { installed: false, compatible: false, reason: result.reason };

  const protocolVersion = Number(result.protocolVersion ?? 0);
  return {
    installed: true,
    version: typeof result.extension === "string" ? result.extension : undefined,
    protocolVersion,
    compatible: protocolVersion === EXTENSION_PROTOCOL_VERSION,
    status: result.status,
    reason:
      protocolVersion === EXTENSION_PROTOCOL_VERSION
        ? undefined
        : `The installed OCADE Cowork extension speaks protocol ${protocolVersion}; this site speaks ${EXTENSION_PROTOCOL_VERSION}. Update the extension.`,
  };
}

/**
 * Run one step and report it the way it may honestly be shown.
 *
 * The result is deliberately not the extension's raw answer: `describeOutcome`
 * is what decides whether a mutation may be called done, and every caller in
 * the product goes through here so that decision is made in exactly one place.
 */
export async function runExtensionStep(
  command: ExtensionCommand,
  argument: Record<string, unknown> = {},
  options: BridgeOptions = {},
): Promise<{ result: ExtensionResult; outcome: StepOutcome }> {
  const result = await sendToExtension(command, argument, options);
  return { result, outcome: describeOutcome(command, result) };
}

/** Pause, stop and take-over, reachable from the website's own controls. */
export const control = {
  pause: (o?: BridgeOptions) => sendToExtension("control.pause", {}, o),
  resume: (o?: BridgeOptions) => sendToExtension("control.resume", {}, o),
  stop: (reason?: string, o?: BridgeOptions) =>
    sendToExtension("control.stop", { reason: reason ?? "Stopped from OCADE." }, o),
  takeOver: (what?: string, o?: BridgeOptions) =>
    sendToExtension("control.takeover", { what: what ?? "this step" }, o),
  status: (o?: BridgeOptions) => sendToExtension("control.status", {}, o),
};
