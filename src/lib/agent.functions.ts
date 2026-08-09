/**
 * The agent loop's production owner (server function).
 *
 * WHY THIS FILE HAS TO EXIST
 * --------------------------
 * `agent/adapters.node.ts` spawns the Python native-control host and the
 * Playwright browser host. Both are `node:child_process`, so the module can
 * never be imported from the browser bundle — the same constraint that put the
 * generated-code sandbox behind `sandbox.functions.ts`. The `await import()`
 * inside each handler is what keeps Node builtins out of the client build.
 *
 * WHAT THE CALLER DOES NOT GET TO DECIDE
 * --------------------------------------
 * 1. **Where the sidecars live.** Paths are resolved on the server from the
 *    project root. A client-supplied interpreter path would be arbitrary code
 *    execution wearing a JSON hat.
 * 2. **Whether authentication applies.** `requireSupabaseAuth` is not optional
 *    on any handler here; this is the entry point to a real computer.
 * 3. **How many steps a task may take.** The loop's own ceiling applies and is
 *    not a parameter.
 *
 * WHAT IT DELIBERATELY DOES NOT DO YET
 * ------------------------------------
 * Run mutating tools. `permit` refuses every mutating call until the GUI
 * carries a real approval prompt, so this entry point can observe the machine
 * and answer questions about it but cannot change it. That is a smaller claim
 * than the loop supports, and it is the honest one while the confirmation UI is
 * still being built: an autonomous default here would be a permission model
 * that exists only in the type signature.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AgentStopReason } from "@/lib/agent/loop";

const observeInput = z.object({
  /** What the user typed. Bounded: this becomes a model prompt. */
  request: z.string().min(1).max(4_000),
  /** Optional window hint, so "what's in Chrome?" does not need a tool round trip. */
  windowTitle: z.string().max(256).optional(),
});

export interface AgentRunSummary {
  ok: boolean;
  reason: AgentStopReason | "unavailable";
  text: string;
  /** One line per tool call, safe to render. Never raw host output. */
  steps: { tool: string; outcome: string; detail: string; verified?: boolean }[];
  domains: string[];
  allVerified: boolean;
}

/**
 * Answer a question about this computer, using the observe → plan → verify loop.
 *
 * Read-only by construction. The tools the loop can reach here are the ones
 * marked non-mutating in the registry; anything else is refused by `permit`
 * before an adapter ever sees it.
 */
export const observeComputerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(observeInput)
  .handler(async ({ data }): Promise<AgentRunSummary> => {
    const [{ runAgentTask }, { OcadeAdapters }, { resolveAdapterConfig }, engine] =
      await Promise.all([
        import("@/lib/agent/loop"),
        import("@/lib/agent/adapters.node"),
        import("@/lib/agent/host-paths.node"),
        import("@/lib/agent/model-turn.node"),
      ]);

    const config = await resolveAdapterConfig();
    if (!config.ok) {
      return {
        ok: false,
        reason: "unavailable",
        text: config.reason,
        steps: [],
        domains: [],
        allVerified: false,
      };
    }

    const adapters = new OcadeAdapters(config.config);
    try {
      const result = await runAgentTask(
        {
          complete: engine.complete,
          turn: engine.turn,
          execute: (call, signal) => adapters.execute(call, signal),
          // Read-only entry point. See the note at the top of this file.
          permit: async () => false,
        },
        {
          request: data.windowTitle
            ? `${data.request}\n(The user is asking about the window titled "${data.windowTitle}".)`
            : data.request,
        },
      );
      return {
        ok: result.allVerified,
        reason: result.reason,
        text: result.text,
        steps: result.steps.map(({ call, outcome }) => ({
          tool: call.name,
          outcome: outcome.kind,
          detail: outcome.detail,
          verified: outcome.verified,
        })),
        domains: result.classification.domains,
        allVerified: result.allVerified,
      };
    } finally {
      // Always. An orphaned Python or Chrome process holding a screen-capture
      // device is a real cost to the person whose computer this is.
      adapters.dispose();
    }
  });

/** Whether this installation can reach its native hosts at all. */
export const agentReadinessFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ ready: boolean; reason: string; missing: string[] }> => {
    const { resolveAdapterConfig } = await import("@/lib/agent/host-paths.node");
    const config = await resolveAdapterConfig();
    return config.ok
      ? { ready: true, reason: "The computer-control hosts are installed.", missing: [] }
      : { ready: false, reason: config.reason, missing: config.missing };
  });
