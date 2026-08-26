/**
 * One executor for every tool call, whichever room asked for it.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE ROOMS
 * -----------------------------------------
 * Cowork already routed browser work through the extension and machine work
 * through the companion, and it did it inside a hook that also owns a timeline,
 * a microphone, a voice and an approval card. Chat could not reach any of that
 * without either importing Cowork wholesale or growing a second executor — and
 * a second executor is how two rooms end up disagreeing about who runs a click.
 *
 * So the routing lives here, in a plain function with no React in it, and both
 * rooms call it. The rule it encodes is the one Cowork already kept: the
 * browser executes browser work, the companion executes machine work, and
 * nothing else may reach either.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ----------------------------------
 * It does not ask permission. Permission is decided before a call gets here, by
 * `@/lib/runtime/permissions`, so that "was this allowed" and "did this work"
 * stay two separable questions. An executor that also gated itself would let a
 * caller skip the gate by calling the executor directly, which is exactly the
 * hole the old split had.
 */

import { runBrowserToolViaExtension } from "@/lib/native/extension-adapter";
import { runControlActionFn } from "@/lib/control-work.functions";
import { findTool } from "@/lib/agent/tool-registry";
import type { ToolOutcome } from "@/lib/agent/outcomes";
import type { ToolCallLike } from "./permissions";

export interface ExecuteContext {
  /**
   * The live control session on this device, when there is one.
   *
   * Chat may have none — a browser tab with no companion paired can still use
   * web and conversation tools. A machine call with no session is refused here
   * with a sentence the user can act on, rather than sent to a server function
   * that would refuse it in server language.
   */
  missionId: string | null;
  /**
   * True when the layer above already put this call in front of the user.
   *
   * The companion refuses a high-risk action that arrives unconfirmed, and it
   * is right to: this flag is the only thing that says a person saw it.
   */
  confirmed?: boolean;
}

export async function executeToolCall(
  call: ToolCallLike,
  context: ExecuteContext,
): Promise<ToolOutcome> {
  const tool = findTool(call.name);
  if (!tool) {
    return { kind: "unsupported", detail: `OCADE has no action called ${call.name}.` };
  }

  /*
   * The browser first. A click in a web page belongs to the extension that is
   * already in that page; sending it to the companion would move the mouse on
   * the desktop instead, which looks like the same action and is not.
   */
  const viaExtension = await runBrowserToolViaExtension(call);
  if (viaExtension) {
    return viaExtension;
  }

  if (!context.missionId) {
    return {
      kind: "blocked",
      detail:
        "That needs OCADE on this computer. Open Devices to connect the companion, and OCADE can do it from there.",
    };
  }

  const result = await runControlActionFn({
    data: {
      missionId: context.missionId,
      tool: call.name,
      args: (call.arguments ?? {}) as Record<string, unknown>,
      confirmed: context.confirmed === true,
    },
  });

  /*
   * The server function answers in its own shape, which carries an `ok` the
   * agent loop has no use for and a `kind` typed as a plain string across the
   * boundary. Narrowed here, once, so every caller downstream reads one type.
   */
  return {
    kind: result.kind as ToolOutcome["kind"],
    detail: result.detail,
    ...(result.verified === undefined ? {} : { verified: result.verified }),
    ...(result.observation === null || result.observation === undefined
      ? {}
      : { observation: result.observation }),
    ...(result.elapsedMs === undefined ? {} : { elapsedMs: result.elapsedMs }),
  };
}
