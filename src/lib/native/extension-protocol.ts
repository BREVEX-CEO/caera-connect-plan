/**
 * The contract between the OCADE website and the Cowork browser extension.
 *
 * The website is the interface and cannot touch the browser; the extension is
 * the executor and has no interface. This module is the shape of what passes
 * between them, and the rules the WEBSITE applies to what comes back.
 *
 * WHY THE WEBSITE RE-CHECKS ANYTHING AT ALL. The extension already enforces the
 * approved-origin scope, the control latch and the protected-field refusal, and
 * it is the only side that can — it is the side holding the permissions. The
 * checks here are not a second opinion on those. They exist because a RESULT is
 * data arriving from a page the extension read, and the website is where that
 * result becomes a claim in a task timeline. A mutation that came back
 * unverified must never be rendered as done.
 */

/** Bumped when the message shape changes in a way an older peer cannot read. */
export const EXTENSION_PROTOCOL_VERSION = 1;

/** Published extension id. Stable across builds; see release/OCADE_H1_EXTENSION_PACKAGE.json. */
export const OCADE_EXTENSION_ID = "bkeedkfnbccjommjdgejlldbgibpghco";

export type ControlState = "running" | "paused" | "stopped" | "handed_over";

export type ExtensionCommand =
  | "handshake"
  | "tabs.list"
  | "tabs.open"
  | "tabs.switch"
  | "tabs.close"
  | "navigate"
  | "reload"
  | "observe"
  | "click"
  | "type"
  | "scroll"
  | "form.fill"
  | "media"
  | "screenshot"
  | "control.pause"
  | "control.resume"
  | "control.stop"
  | "control.takeover"
  | "control.status"
  | "scope.list";

/** Commands that change the page, and whose result must carry verification. */
export const MUTATING_COMMANDS: ReadonlySet<ExtensionCommand> = new Set([
  "media",
  "navigate",
  "reload",
  "click",
  "type",
  "scroll",
  "form.fill",
]);

/**
 * Commands the WEBSITE may never send.
 *
 * Scope is granted by the person in the extension's own popup. The extension
 * refuses these from an external sender, and the website refuses to send them,
 * so neither a bug here nor a compromised page turns into a widened scope.
 */
export const WEBSITE_FORBIDDEN_COMMANDS: ReadonlySet<string> = new Set([
  "scope.approve",
  "scope.revoke",
]);

export interface ExtensionStatus {
  control: ControlState;
  approvedOrigins: string[];
  reason: string | null;
  handover: { what: string; message: string; url?: string } | null;
}

export interface ObservedControl {
  ref: number;
  tag: string;
  type?: string;
  name?: string;
  id?: string;
  label?: string;
  text?: string;
  value?: string;
  disabled: boolean;
  visible: boolean;
}

export interface Observation {
  url: string;
  title: string;
  readyState: string;
  text: string;
  controls: ObservedControl[];
  signature: string;
  /** How many instruction-shaped passages the extension stripped from the page. */
  injectionAttempts: number;
}

export interface ExtensionSuccess {
  ok: true;
  verified?: boolean;
  evidence?: string;
  observation?: Observation;
  before?: { url: string; title: string; signature: string };
  after?: { url: string; title: string; signature: string } | null;
  status?: ExtensionStatus;
  [key: string]: unknown;
}

export interface ExtensionFailure {
  ok: false;
  reason: string;
  /** The run should stop asking: scope, a latch, or a hand-over. */
  blocked?: boolean;
  /** The capability is genuinely unavailable here, rather than refused. */
  unavailable?: boolean;
  handover?: { what: string; message: string };
  status?: ExtensionStatus;
}

export type ExtensionResult = ExtensionSuccess | ExtensionFailure;

/**
 * How a step may be reported to the person.
 *
 * "done" requires the extension to have OBSERVED a change, not merely to have
 * returned without error. A click that hit nothing is indistinguishable from a
 * click that worked until you look, which is why `verified` exists and why this
 * function refuses to collapse the two.
 */
export type StepOutcome =
  | { kind: "done"; evidence: string }
  | { kind: "unverified"; evidence: string }
  | { kind: "blocked"; reason: string; handover?: { what: string; message: string } }
  | { kind: "unavailable"; reason: string }
  | { kind: "failed"; reason: string };

export function describeOutcome(command: string, result: ExtensionResult): StepOutcome {
  if (!result.ok) {
    if (result.handover) {
      return { kind: "blocked", reason: result.reason, handover: result.handover };
    }
    if (result.unavailable) return { kind: "unavailable", reason: result.reason };
    if (result.blocked) return { kind: "blocked", reason: result.reason };
    return { kind: "failed", reason: result.reason };
  }

  if (MUTATING_COMMANDS.has(command as ExtensionCommand)) {
    if (result.verified === true) {
      return { kind: "done", evidence: result.evidence ?? `${command} changed the page.` };
    }
    return {
      kind: "unverified",
      evidence:
        result.evidence ??
        `${command} was performed but nothing measurable changed, so it is not reported as done.`,
    };
  }

  return { kind: "done", evidence: result.evidence ?? `${command} completed.` };
}

/** True when the run must stop and wait for the person rather than retry. */
export function requiresHuman(result: ExtensionResult): boolean {
  return !result.ok && (Boolean(result.handover) || result.status?.control === "handed_over");
}
