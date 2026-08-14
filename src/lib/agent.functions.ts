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
 * TWO ENTRY POINTS, AND THE DIFFERENCE BETWEEN THEM IS THE PRODUCT
 * ----------------------------------------------------------------
 * `observeComputerFn` answers questions about this computer and refuses every
 * mutating tool. It is what ordinary OCADE Chat may reach, so a chat message can
 * never move the mouse.
 *
 * `controlWorkTaskFn` is Control + Work's own route, and the only one that may
 * change anything. Even there, autonomy is passed per task rather than stored,
 * and `high`-risk tools are refused outright — see the note on that handler.
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

export interface NativePreflight {
  reachable: boolean;
  detail: string;
  /** Plain readings a person can check against their own machine. */
  machine: { cpuPercent?: number; memoryUsedPercent?: number; displays?: number } | null;
  activeWindow: { title?: string; application?: string } | null;
  /** The one harmless real action, and whether it completed. */
  action: { name: string; ok: boolean; detail: string } | null;
  voice: { engine: string; voiceName: string; cloudRequired: boolean } | null;
  microphone: { count: number; detail: string } | null;
}

/**
 * Prove the whole native path, end to end, without changing anything.
 *
 * READ, THEN ACT, THEN REPORT. It reaches the Python host, reads the machine and
 * the focused window, and performs one real mutating call — releasing any held
 * keys and mouse buttons. On a machine where nothing is held that action does
 * precisely nothing, which is the point: it exercises the input path rather than
 * the screen, so proving control works costs the user nothing.
 *
 * This is what the Control + Work screen calls before it will offer to act.
 */
export const nativePreflightFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<NativePreflight> => {
    const [{ OcadeAdapters }, { resolveAdapterConfig }] = await Promise.all([
      import("@/lib/agent/adapters.node"),
      import("@/lib/agent/host-paths.node"),
    ]);
    const config = await resolveAdapterConfig();
    if (!config.ok) {
      return {
        reachable: false,
        detail: config.reason,
        machine: null,
        activeWindow: null,
        action: null,
        voice: null,
        microphone: null,
      };
    }

    const adapters = new OcadeAdapters(config.config);
    try {
      const [result, capability] = await Promise.all([
        adapters.preflight(),
        adapters.voiceCapability(),
      ]);

      const snapshot = result.snapshot as {
        cpuPercent?: number;
        memory?: { usedPercent?: number };
      } | null;
      const active = result.activeWindow as {
        title?: string;
        process?: string;
        displays?: unknown[];
      } | null;
      const speech = capability.speech.ok
        ? (capability.speech.data as {
            engine?: string;
            preferred?: { name?: string };
            cloudRequired?: boolean;
          })
        : null;
      const mic = capability.microphone.ok
        ? (capability.microphone.data as { count?: number; reason?: string })
        : null;

      return {
        reachable: result.reachable,
        detail: result.detail,
        machine: snapshot
          ? {
              cpuPercent: snapshot.cpuPercent,
              memoryUsedPercent: snapshot.memory?.usedPercent,
              displays: Array.isArray(active?.displays) ? active.displays.length : undefined,
            }
          : null,
        activeWindow: active ? { title: active.title, application: active.process } : null,
        action: result.action,
        voice: speech
          ? {
              engine: speech.engine ?? "unknown",
              voiceName: speech.preferred?.name ?? "the system default",
              cloudRequired: speech.cloudRequired === true,
            }
          : null,
        microphone: mic
          ? { count: mic.count ?? 0, detail: mic.reason ?? "" }
          : { count: 0, detail: "No microphone was found on this computer." },
      };
    } finally {
      adapters.dispose();
    }
  });

const controlInput = z.object({
  request: z.string().min(1).max(4_000),
  /**
   * `observe` looks and answers. `act` allows the loop to change things.
   *
   * A parameter rather than a setting, because the GUI arms it per task: the
   * user pressing "Let OCADE act" for one instruction has not consented to the
   * next one, and a stored preference would quietly turn that into standing
   * permission.
   */
  autonomy: z.enum(["observe", "act"]).default("observe"),
});

export interface ControlRunEvent {
  kind: string;
  label: string;
  detail: string;
  verified?: boolean;
}

export interface ControlRunSummary extends AgentRunSummary {
  autonomy: "observe" | "act";
  /** Every step as one readable line. No host payloads, no JSON, no tool names. */
  timeline: ControlRunEvent[];
}

/**
 * Control + Work's own entry point. The only one that may change this computer.
 *
 * THE PERMISSION RULE, IN ONE PLACE
 * ---------------------------------
 * `observe` refuses every mutating tool, exactly as the read-only entry point
 * does. `act` permits `low` and `medium` risk and still refuses `high` —
 * anything in that band (moving a file to the trash, and whatever joins it)
 * needs a person looking at the specific thing, and a checkbox pressed before
 * the task started is not that person.
 *
 * There is no autonomy level here that permits everything. That is deliberate:
 * a level that exists gets used.
 */
export const controlWorkTaskFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(controlInput)
  .handler(async ({ data }): Promise<ControlRunSummary> => {
    const [{ runAgentTask }, { OcadeAdapters }, { resolveAdapterConfig }, engine, registry] =
      await Promise.all([
        import("@/lib/agent/loop"),
        import("@/lib/agent/adapters.node"),
        import("@/lib/agent/host-paths.node"),
        import("@/lib/agent/model-turn.node"),
        import("@/lib/agent/tool-registry"),
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
        autonomy: data.autonomy,
        timeline: [],
      };
    }

    const adapters = new OcadeAdapters(config.config);
    const timeline: ControlRunEvent[] = [];
    try {
      const result = await runAgentTask(
        {
          complete: engine.complete,
          turn: engine.turn,
          execute: (call, signal) => adapters.execute(call, signal),
          /*
           * Spoken barge-in reaches the loop here. The engine has already gone
           * quiet and released the mouse by the time this is polled; what this
           * decides is whether the remaining steps run at all.
           */
          stopRequested: () => adapters.stopRequested(),
          permit: async (call) => {
            if (data.autonomy !== "act") return false;
            const definition = registry.findTool(call.name);
            return definition !== null && definition.risk !== "high";
          },
          onEvent: (event) => {
            if (event.kind === "tool_start") {
              timeline.push({
                kind: "acting",
                label: describeTool(event.call.name),
                detail: "",
              });
            } else if (event.kind === "tool_end") {
              timeline.push({
                kind: event.outcome.kind === "success" ? "done" : "problem",
                label: describeTool(event.call.name),
                detail: event.outcome.detail,
                verified: event.outcome.verified,
              });
            } else if (event.kind === "refused") {
              timeline.push({
                kind: "refused",
                label: describeTool(event.call.name),
                detail: event.reason,
              });
            }
          },
        },
        { request: data.request },
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
        autonomy: data.autonomy,
        timeline,
      };
    } finally {
      adapters.dispose();
    }
  });

/**
 * A tool name as a person would say it.
 *
 * The GUI must not show `control_set_text`, and translating in the component
 * would put half the vocabulary in a React file. One table, on the server, next
 * to the only thing that produces those names.
 */
function describeTool(name: string): string {
  const spoken: Record<string, string> = {
    screen_observe: "Looking at the screen",
    window_list: "Reading the open windows",
    window_focus: "Bringing a window forward",
    window_arrange: "Moving a window",
    display_list: "Checking the screens",
    app_open: "Opening an application",
    app_focus: "Switching to an application",
    app_list_installed: "Checking what is installed",
    control_find: "Looking for a control",
    control_activate: "Pressing a control",
    control_set_text: "Filling in a field",
    system_status: "Reading this computer's state",
    browser_open: "Opening a browser",
    browser_navigate: "Opening a page",
    browser_read: "Reading the page",
    browser_click: "Clicking on the page",
    browser_tabs: "Reading the open tabs",
    web_search: "Searching the web",
    file_search: "Looking for files",
    file_read: "Reading a file",
    file_copy: "Copying a file",
    file_move: "Moving a file",
  };
  return spoken[name] ?? "Working";
}

/** Say one sentence aloud with this computer's own free voice. */
export const speakAloudFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({ text: z.string().min(1).max(1_200), language: z.string().max(8).optional() }),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; detail: string }> => {
    const [{ OcadeAdapters }, { resolveAdapterConfig }] = await Promise.all([
      import("@/lib/agent/adapters.node"),
      import("@/lib/agent/host-paths.node"),
    ]);
    const config = await resolveAdapterConfig();
    if (!config.ok) return { ok: false, detail: config.reason };

    const adapters = new OcadeAdapters(config.config);
    try {
      const outcome = await adapters.speak(data.text, data.language ?? "en");
      return { ok: outcome.kind === "success", detail: outcome.detail };
    } finally {
      adapters.dispose();
    }
  });
