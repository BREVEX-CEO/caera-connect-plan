/**
 * THE MISSING LINK: agent-loop browser tools, executed by the MV3 extension.
 *
 * OCADE is browser-first, and the intended path is
 *
 *     website → local model → agent loop → EXTENSION ADAPTER → extension
 *     bridge → MV3 extension → the user's own browser
 *
 * That adapter did not exist. The extension was built, tested and reachable —
 * `extension-bridge.ts` was imported by exactly one component, a UI gate, and
 * by its own test, and by nothing that ever runs a task. Every `browser_*` tool
 * the model can call went the other way instead: `use-mission` → a server
 * function → the Node adapters → a native host driving Playwright/CDP. So the
 * extension was a working executor that nothing executed through, and browser
 * Cowork could not run without a desktop sidecar.
 *
 * This file is that link. It translates the loop's tool vocabulary into the
 * extension's command vocabulary, in the browser, with no server round trip and
 * no native host.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not decide whether a mutation succeeded. `describeOutcome` in
 * extension-protocol.ts owns that, and owns it alone, because "the click
 * returned without error" and "the page changed" are different facts and the
 * whole design rests on not collapsing them. This adapter maps the answer;
 * it never upgrades it.
 *
 * It also does not widen scope. Approval lives in the extension and is granted
 * by the person in the popup under a real Chrome permission prompt. Nothing
 * here can approve an origin, and a refusal comes back as a refusal.
 */

import {
  describeOutcome,
  type ExtensionCommand,
  type Observation,
  type StepOutcome,
} from "./extension-protocol";
import {
  extensionChannelAvailable,
  runExtensionStep,
  type BridgeOptions,
} from "./extension-bridge";
import { ok, fail, type ToolOutcome } from "@/lib/agent/outcomes";
import type { ToolCall } from "@/lib/agent/loop";

/** The loop's browser tools, and nothing else, are handled here. */
export const EXTENSION_TOOLS: ReadonlySet<string> = new Set([
  "browser_open",
  "browser_navigate",
  "browser_read",
  "browser_click",
  "browser_type",
  "browser_scroll",
  "browser_key",
  "browser_tabs",
  "browser_media",
  "browser_skip_ad",
]);

export function isExtensionTool(name: string): boolean {
  return EXTENSION_TOOLS.has(name);
}

/** One screen of scrolling, in CSS pixels. Matches what a PageDown does. */
const ONE_SCREEN = 700;

interface Translated {
  command: ExtensionCommand;
  argument: Record<string, unknown>;
}

/**
 * Tool call in, extension command out.
 *
 * `null` means this tool cannot be expressed as an extension command, which is
 * a real answer and not a failure to handle: `browser_key` has no counterpart
 * because the content script exposes no key dispatch, and pretending otherwise
 * would produce a step that reports success while pressing nothing.
 */
export function translate(call: ToolCall): Translated | { unsupported: string } | null {
  const a = (call.arguments ?? {}) as Record<string, unknown>;
  switch (call.name) {
    case "browser_open":
      /*
       * There is no window to open. The extension lives INSIDE the browser the
       * person is already using, which is the entire point of the browser-first
       * design — so this becomes a read of what is already there rather than a
       * launch. The model's next turn sees real tabs.
       */
      return { command: "tabs.list", argument: {} };

    case "browser_tabs":
      return { command: "tabs.list", argument: {} };

    case "browser_navigate":
      return { command: "navigate", argument: { url: String(a.url ?? "") } };

    case "browser_read":
      return { command: "observe", argument: {} };

    case "browser_click":
      // `text` is how the model refers to things it read, and the content
      // script resolves by visible text, so the two already agree.
      return { command: "click", argument: { target: { text: String(a.text ?? "") } } };

    case "browser_type":
      return {
        command: "type",
        argument: {
          target: { selector: String(a.selector ?? "") },
          text: String(a.value ?? ""),
        },
      };

    case "browser_scroll":
      return {
        command: "scroll",
        argument: { by: a.direction === "up" ? -ONE_SCREEN : ONE_SCREEN },
      };

    case "browser_media":
      return {
        command: "media",
        argument: { action: String(a.action ?? "play"), seconds: Number(a.seconds ?? 10) },
      };

    case "browser_skip_ad":
      /*
       * Honestly unavailable rather than guessed at.
       *
       * Skipping an advert means finding the right button among several that
       * look alike, and a wrong click on a page mid-advert is a click on
       * whatever the advertiser put there. The tool exists for the desktop
       * path, which watches the player; the extension has no such view, and a
       * heuristic that is usually right is not good enough for a click.
       */
      return {
        unsupported:
          "The Cowork extension cannot skip adverts. Skip it yourself, or ask OCADE to wait until it has finished.",
      };

    case "browser_key":
      return {
        unsupported:
          "The Cowork extension cannot press keys on the page yet. Click the button you want instead, or ask the person to press the key.",
      };

    default:
      return null;
  }
}

/**
 * A StepOutcome is about a browser step; a ToolOutcome is about a tool call.
 * They are close enough to look interchangeable and different enough that
 * conflating them loses the one distinction that matters — `unverified`.
 *
 * `unverified` maps to `state_changed`, NOT to success and NOT to a retryable
 * failure. Success would report a click that moved nothing as done. A retryable
 * failure would send the model round again with the same arguments against a
 * page that may well have changed underneath it. `state_changed` puts the
 * evidence in front of the model and lets it decide, which is what a person
 * would do.
 */
export function toToolOutcome(step: StepOutcome, observation?: Observation): ToolOutcome {
  switch (step.kind) {
    case "done":
      return ok(observation ?? null, step.evidence, {
        verified: true,
        observation,
      });
    case "unverified":
      return { kind: "state_changed", detail: step.evidence, verified: false, observation };
    case "blocked":
      return {
        kind: step.handover ? "permission_required" : "blocked",
        detail: step.handover ? step.handover.message : step.reason,
      };
    case "unavailable":
      return fail("unsupported", step.reason);
    case "failed":
      return fail("retryable_failure", step.reason);
  }
}

/**
 * Run one browser tool call through the extension.
 *
 * Returns `null` when the call is not a browser tool, so a caller can fall
 * through to whatever else it does. An unavailable extension is NOT null — it
 * is an honest `unsupported` naming what to install, because silently falling
 * back to a desktop sidecar is how a browser-first product grows a hidden
 * dependency on one.
 */
export async function runBrowserToolViaExtension(
  call: ToolCall,
  options: BridgeOptions = {},
): Promise<ToolOutcome | null> {
  if (!isExtensionTool(call.name)) return null;

  if (!extensionChannelAvailable()) {
    return fail(
      "unsupported",
      "OCADE Cowork needs its browser extension to work in this browser. Open Cowork and follow the steps to add it, then try again.",
    );
  }

  const translated = translate(call);
  if (translated === null) {
    return fail("unsupported", `${call.name} has no browser equivalent.`);
  }
  if ("unsupported" in translated) {
    return fail("unsupported", translated.unsupported);
  }

  const { result, outcome } = await runExtensionStep(
    translated.command,
    translated.argument,
    options,
  );
  const observation = result.ok ? result.observation : undefined;
  return toToolOutcome(outcome, observation);
}

export { describeOutcome };
