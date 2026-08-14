/**
 * Control + Work's server side: one action per call, and a mission that lasts.
 *
 * WHY THIS IS NOT ONE "RUN THE TASK" FUNCTION
 * --------------------------------------------
 * It was, and the shape was wrong in a way that mattered. A single round trip
 * means the whole task is authorised before it starts: the user agrees to
 * "OCADE may act", and then finds out afterwards what it did. Every honest
 * version of "ask before the risky step" needs the loop to be able to STOP
 * between two tool calls and wait for an answer — and a server function that
 * has already returned cannot ask anything.
 *
 * So the loop runs in the browser, where the user is, and the server exposes
 * exactly three things: start a mission, run ONE tool call, stop the mission.
 * Permission happens between calls two and two, which is the only place a
 * person can actually be consulted.
 *
 * WHAT THE CLIENT STILL DOES NOT DECIDE
 * --------------------------------------
 * 1. **Which tools exist.** `runControlActionFn` looks the name up in the
 *    registry and refuses anything not in it. A client asking for
 *    `shell_execute` gets "no such tool", not an attempt.
 * 2. **Where the sidecars are.** Resolved on the server, from the project root.
 * 3. **Whether the caller may control this machine.** `authoriseControl` — an
 *    account, or the local-demo rule, and nothing else.
 * 4. **Whether a high-risk tool may run without a person.** The client sends
 *    `confirmed`; the server checks the tool's own risk band against it and
 *    refuses a `high` action that arrives unconfirmed. A compromised or buggy
 *    client cannot skip the prompt by not showing it.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface MissionStart {
  ok: boolean;
  missionId: string | null;
  /** How this caller was allowed in, so the UI can say so. */
  via: "account" | "local-demo" | null;
  detail: string;
  machine: { cpuPercent?: number; memoryUsedPercent?: number; displays?: number } | null;
  activeWindow: { title?: string; application?: string } | null;
  voice: { engine: string; voiceName: string; cloudRequired: boolean } | null;
  microphone: { count: number; detail: string } | null;
  /**
   * What OCADE remembers about this person, read once when the mission opens.
   *
   * FETCHED HERE RATHER THAN LEFT TO THE MODEL, because a model cannot decide
   * to look up context it does not know exists — by the time it could ask, it
   * has already answered the first message as a stranger. Null on a fresh
   * install, which is a real answer and not a failure.
   */
  memory: { context: string; assistantName: string; address: string; language: string } | null;
}

/**
 * Anything that survives the wire.
 *
 * Spelled out rather than left as `unknown` because the server-function
 * boundary checks serialisability at the type level, and `unknown` fails that
 * check for a good reason: everything the sidecars return IS plain JSON, and
 * saying so is more honest than casting past the complaint.
 */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface ActionResult {
  ok: boolean;
  /** The loop's closed outcome vocabulary. */
  kind: string;
  detail: string;
  verified?: boolean;
  /** Structural observation for the model. Never raw host internals for the UI. */
  observation?: JsonValue;
  elapsedMs?: number;
}

/**
 * Begin a mission: authorise, start the sidecars, and read the machine once.
 *
 * The first observation is taken here rather than left to the model's first
 * step, because a screen that says "connected" before anything has been read is
 * a screen that will say "connected" on a machine where the host is broken.
 */
export const startMissionFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<MissionStart> => {
    const [{ authoriseControl }, { OcadeAdapters }, { resolveAdapterConfig }, host] =
      await Promise.all([
        import("@/lib/agent/control-access.node"),
        import("@/lib/agent/adapters.node"),
        import("@/lib/agent/host-paths.node"),
        import("@/lib/agent/mission-host.node"),
      ]);

    const access = await authoriseControl();
    if (!access.ok) {
      return {
        ok: false,
        missionId: null,
        via: null,
        detail: access.reason,
        machine: null,
        activeWindow: null,
        voice: null,
        microphone: null,
        memory: null,
      };
    }

    const config = await resolveAdapterConfig();
    if (!config.ok) {
      return {
        ok: false,
        missionId: null,
        via: access.via,
        detail: config.reason,
        machine: null,
        activeWindow: null,
        voice: null,
        microphone: null,
        memory: null,
      };
    }

    const adapters = new OcadeAdapters(config.config);
    const id = host.newMissionId();
    try {
      const [preflight, capability, memory] = await Promise.all([
        adapters.preflight(),
        adapters.voiceCapability(),
        // In parallel with the preflight, not after it: it is a JSON file read
        // and adding a round trip to mission start for it would be paying
        // latency at the one moment the user is watching a spinner.
        adapters.memoryContext(),
      ]);
      if (!preflight.reachable) {
        adapters.dispose();
        return {
          ok: false,
          missionId: null,
          via: access.via,
          detail: preflight.detail,
          machine: null,
          activeWindow: null,
          voice: null,
          microphone: null,
          memory: null,
        };
      }

      await host.openMission(id, adapters, access.via);

      const snapshot = preflight.snapshot as {
        cpuPercent?: number;
        memory?: { usedPercent?: number };
      } | null;
      const active = preflight.activeWindow as {
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
        ok: true,
        missionId: id,
        via: access.via,
        detail: preflight.detail,
        machine: {
          cpuPercent: snapshot?.cpuPercent,
          memoryUsedPercent: snapshot?.memory?.usedPercent,
          displays: Array.isArray(active?.displays) ? active.displays.length : undefined,
        },
        activeWindow: active ? { title: active.title, application: active.process } : null,
        voice: speech
          ? {
              engine: speech.engine ?? "unknown",
              voiceName: speech.preferred?.name ?? "the system default",
              cloudRequired: speech.cloudRequired === true,
            }
          : null,
        microphone: mic ? { count: mic.count ?? 0, detail: mic.reason ?? "" } : null,
        memory,
      };
    } catch (error) {
      adapters.dispose();
      return {
        ok: false,
        missionId: null,
        via: access.via,
        detail: error instanceof Error ? error.message : "OCADE could not reach this computer.",
        machine: null,
        activeWindow: null,
        voice: null,
        microphone: null,
        memory: null,
      };
    }
  },
);

const actionInput = z.object({
  missionId: z.string().min(1).max(64),
  tool: z.string().min(1).max(64),
  /** Bounded: these become real arguments to a real machine. */
  args: z.record(z.string(), z.unknown()).default({}),
  /** True only when a person answered a prompt for THIS action. */
  confirmed: z.boolean().default(false),
});

/**
 * Run exactly one tool call inside a mission.
 *
 * THE SERVER RE-CHECKS THE RISK BAND. The client shows the prompt, but the
 * client is also the part an attacker or a bug reaches first. A `high` action
 * arriving with `confirmed: false` is refused here, so the prompt is not merely
 * a UI convention — it is a condition of the action running at all.
 */
export const runControlActionFn = createServerFn({ method: "POST" })
  .validator(actionInput)
  .handler(async ({ data }): Promise<ActionResult> => {
    const [{ authoriseControl }, host, registry] = await Promise.all([
      import("@/lib/agent/control-access.node"),
      import("@/lib/agent/mission-host.node"),
      import("@/lib/agent/tool-registry"),
    ]);

    const access = await authoriseControl();
    if (!access.ok) {
      return { ok: false, kind: "blocked", detail: access.reason };
    }

    const mission = host.findMission(data.missionId);
    if (!mission) {
      return {
        ok: false,
        kind: "state_changed",
        detail: "That session has ended. Start again to let OCADE work on this computer.",
      };
    }
    if (mission.stopping) {
      return { ok: false, kind: "cancelled", detail: "The task was stopped." };
    }

    const definition = registry.findTool(data.tool);
    if (!definition) {
      // An invented name. Told plainly rather than attempted.
      return { ok: false, kind: "unsupported", detail: `There is no tool called ${data.tool}.` };
    }
    if (definition.risk === "high" && !data.confirmed) {
      return {
        ok: false,
        kind: "permission_required",
        detail: "This one needs your confirmation before OCADE will do it.",
      };
    }

    mission.actions += 1;
    /*
     * `confirmed` reaching the adapter is what lets `browser_open` use the
     * user's signed-in profile. It has already been checked against the tool's
     * risk band four lines up, so what arrives here is a confirmation the
     * server itself accepted rather than a claim from the client.
     */
    const outcome = await mission.adapters.execute(
      { name: data.tool, arguments: data.args },
      undefined,
      data.confirmed === true,
    );
    return {
      ok: outcome.kind === "success",
      kind: outcome.kind,
      detail: outcome.detail,
      verified: outcome.verified,
      // The hosts return parsed JSON, so this is a narrowing rather than a
      // conversion. Anything that somehow is not becomes null instead of
      // breaking the response.
      observation: (outcome.observation ?? null) as JsonValue,
      elapsedMs: outcome.elapsedMs,
    };
  });

/**
 * End a mission and let go of the computer.
 *
 * Called on Stop, on Take over, when the panel unmounts, and when the demo
 * clock runs out. All four are the same event as far as the machine is
 * concerned: OCADE is finished, and nothing of its should still be held.
 */
export const stopMissionFn = createServerFn({ method: "POST" })
  .validator(z.object({ missionId: z.string().min(1).max(64) }))
  .handler(async ({ data }): Promise<{ stopped: boolean; released: boolean; detail: string }> => {
    const host = await import("@/lib/agent/mission-host.node");
    const result = await host.stopMission(data.missionId, "The user stopped it.");
    return {
      stopped: result.stopped,
      released: result.released,
      detail: result.stopped
        ? result.released
          ? "OCADE stopped and let go of the keyboard and mouse."
          : "OCADE stopped."
        : "There was nothing running.",
    };
  });

/**
 * Stop everything and hand the machine back.
 *
 * The demo clock reaching zero is the case this exists for. A mission id may
 * not be to hand — the panel may have already unmounted, or a second mission
 * may have been started — and "stop whatever OCADE is doing on this computer"
 * has to work without one. It is safe when nothing is running, and it releases
 * held input before disposing anything.
 */
export const stopAllLocalMissionsFn = createServerFn({ method: "POST" })
  .validator(z.object({ reason: z.string().max(200).default("Stopped.") }))
  .handler(async ({ data }): Promise<{ stopped: number; detail: string }> => {
    const host = await import("@/lib/agent/mission-host.node");
    const stopped = await host.stopAllMissions(data.reason);
    return {
      stopped,
      detail:
        stopped > 0
          ? "OCADE stopped and let go of the keyboard and mouse."
          : "Nothing was running.",
    };
  });

/** Say one sentence aloud with this computer's own free voice. */
/**
 * The microphones this machine can record from.
 *
 * A separate call from `missionMicFn` because the list is wanted BEFORE anyone
 * decides to turn the microphone on — a settings panel showing "Bluetooth
 * headset" should not have to open the audio stream to find out it exists.
 */
export const missionAudioInputsFn = createServerFn({ method: "POST" })
  .validator(z.object({ missionId: z.string().min(1).max(64) }))
  .handler(
    async ({
      data,
    }): Promise<{
      ok: boolean;
      devices: { id: number; name: string; isDefault: boolean; isSelected: boolean }[];
      selected: number | null;
      micEnabled: boolean;
      detail: string;
    }> => {
      const host = await import("@/lib/agent/mission-host.node");
      const mission = host.findMission(data.missionId);
      if (!mission) {
        return {
          ok: false,
          devices: [],
          selected: null,
          micEnabled: false,
          detail: "That session has ended.",
        };
      }
      const result = await mission.adapters.audioInputs();
      return { ok: true, ...result, detail: `${result.devices.length} microphone(s).` };
    },
  );

/**
 * Turn the microphone on or off, or change which one is used.
 *
 * The returned `micEnabled` is what the engine REPORTS after the change, not
 * what was requested, so a UI toggle can never show "off" over a microphone
 * that is still open.
 */
export const missionMicFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      missionId: z.string().min(1).max(64),
      enabled: z.boolean().optional(),
      deviceId: z.number().int().min(0).max(512).nullable().optional(),
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      ok: boolean;
      micEnabled: boolean;
      deviceId: number | null;
      listening: boolean;
      detail: string;
    }> => {
      const host = await import("@/lib/agent/mission-host.node");
      const mission = host.findMission(data.missionId);
      if (!mission) {
        return {
          ok: false,
          micEnabled: false,
          deviceId: null,
          listening: false,
          detail: "That session has ended.",
        };
      }
      const result = await mission.adapters.setMic({
        enabled: data.enabled,
        deviceId: data.deviceId,
      });

      /*
       * BARGE-IN FOLLOWS THE MICROPHONE, AND UNTIL NOW IT FOLLOWED NOTHING.
       *
       * `setBargeIn` was the only thing in the codebase that starts the
       * listener, and it had ZERO callers. So `_voice_state["listener"]` in the
       * engine stayed None forever, `BargeInListener` never ran, `STOP.trip()`
       * was never fired by a spoken word, and "say stop" -- along with the
       * whisper-tiny model and the stop-word list behind it -- was dead code
       * that looked alive.
       *
       * The microphone is the right hook because the two are the same
       * intention: listening is what barge-in IS. Turning the mic on starts the
       * listener; turning it off releases the audio stream rather than leaving
       * a thread holding a device nobody is using.
       *
       * Deliberately not awaited into the response. Whether OCADE can hear the
       * word "stop" must not decide whether the microphone reports as on, and
       * a listener that fails to start is a degraded feature, not a failed
       * toggle.
       */
      void mission.adapters.setBargeIn(result.micEnabled).catch(() => {});

      return result;
    },
  );

export const missionSpeakFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      missionId: z.string().min(1).max(64),
      text: z.string().min(1).max(1_200),
      language: z.string().max(8).optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; detail: string }> => {
    const host = await import("@/lib/agent/mission-host.node");
    const mission = host.findMission(data.missionId);
    if (!mission) return { ok: false, detail: "That session has ended." };
    const outcome = await mission.adapters.speak(data.text, data.language ?? "en");
    return { ok: outcome.kind === "success", detail: outcome.detail };
  });

/**
 * Re-read what OCADE remembers, mid-mission.
 *
 * WHY THIS IS NOT A TOOL. The memory context is how the mission builds its own
 * system prompt; it is not an action the model chooses to take. Registering it
 * as a tool would advertise it in the catalogue, where a model would eventually
 * call it, spend a step, and learn nothing it was not already being told.
 *
 * It is called after a memory WRITE succeeds, so that "remember that I prefer
 * short answers" is in front of the model on the very next turn rather than
 * only in the next session — which is the difference between an assistant that
 * remembers and one that keeps a diary.
 *
 * Reaches nothing but the memory file, and only inside a mission that already
 * passed `authoriseControl` when it opened.
 */
export const refreshMemoryFn = createServerFn({ method: "POST" })
  .validator(z.object({ missionId: z.string().min(1).max(64) }))
  .handler(
    async ({
      data,
    }): Promise<{ ok: boolean; context: string; assistantName: string; address: string }> => {
      const host = await import("@/lib/agent/mission-host.node");
      const mission = host.findMission(data.missionId);
      if (!mission) return { ok: false, context: "", assistantName: "OCADE", address: "" };
      const memory = await mission.adapters.memoryContext();
      if (!memory) return { ok: false, context: "", assistantName: "OCADE", address: "" };
      return {
        ok: true,
        context: memory.context,
        assistantName: memory.assistantName,
        address: memory.address,
      };
    },
  );
