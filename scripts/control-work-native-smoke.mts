/**
 * Control + Work, proved against this actual computer.
 *
 * WHY A SCRIPT AS WELL AS THE GUI
 * -------------------------------
 * The GUI is the proof that matters and is where the real acceptance happens.
 * This exists for the other half of the job: when something fails in the GUI,
 * the question is always "was that the model, the loop, the transport or the
 * machine?", and a script that drives the same adapters with a FIXED sequence
 * answers it in one run instead of five prompts.
 *
 * It exercises the same modules the Control + Work server functions use —
 * `agent/host-paths.node` to find the sidecars, `agent/adapters.node` to talk to
 * them — in the same order and with the same concurrency as a real mission
 * start. The only thing not exercised is the access gate, which is an
 * authorisation check rather than a control path.
 *
 * WHAT IT WILL AND WILL NOT DO TO YOUR MACHINE
 * ---------------------------------------------
 * Reads: the system snapshot, the open windows, the focused window, its
 * accessibility tree, visible text, the installed voices, the microphones, the
 * displays, and OCADE's own temporary folder.
 *
 * Changes: releases any held modifier key and mouse button, and writes one text
 * file into OCADE's temporary folder. Both are chosen because they exercise a
 * real write path and leave nothing behind that matters.
 *
 *   npm run control:native-smoke
 */

import { resolveAdapterConfig } from "@/lib/agent/host-paths.node";
import { OcadeAdapters } from "@/lib/agent/adapters.node";

function line(label: string, value: unknown): void {
  process.stdout.write(`  ${label.padEnd(26)} ${String(value)}\n`);
}

async function timed<T>(label: string, work: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const result = await work();
  line(label, `${Date.now() - started}ms`);
  return result;
}

async function main(): Promise<number> {
  const config = await resolveAdapterConfig();
  if (!config.ok) {
    process.stdout.write(`NOT READY — ${config.reason}\n`);
    for (const missing of config.missing) process.stdout.write(`  missing: ${missing}\n`);
    return 1;
  }

  const adapters = new OcadeAdapters(config.config);
  let failures = 0;
  try {
    /*
     * MISSION START, WITH ITS REAL CONCURRENCY.
     *
     * `startMissionFn` fires the preflight and the voice capability probe
     * together, so this does too. The timings printed here are the ones that
     * matter: the first live GUI run spent thirty seconds inside this step and
     * the transport had to be fixed because of it, not because a unit test said
     * anything was wrong.
     */
    process.stdout.write("\nMission start (concurrent, as the GUI does it)\n");
    const [preflight, capability] = await Promise.all([
      timed("preflight", () => adapters.preflight()),
      timed("voice + microphone probe", () => adapters.voiceCapability()),
    ]);
    line("host reachable", preflight.reachable);
    if (!preflight.reachable) {
      line("detail", preflight.detail);
      return 1;
    }

    const snapshot = preflight.snapshot as {
      cpuPercent?: number;
      memory?: { usedPercent?: number };
    } | null;
    const active = preflight.activeWindow as { title?: string; process?: string } | null;
    line("processor", `${snapshot?.cpuPercent ?? "?"}%`);
    line("memory used", `${snapshot?.memory?.usedPercent ?? "?"}%`);
    line("window in front", active?.title ?? "(none)");
    line("its application", active?.process ?? "(unknown)");
    line("one real action", `${preflight.action?.name} — ${preflight.action?.ok}`);
    if (!preflight.action?.ok) failures += 1;

    process.stdout.write("\nActions, in the order a task uses them\n");
    for (const call of [
      { name: "screen_observe", arguments: {} },
      { name: "window_list", arguments: {} },
      { name: "display_list", arguments: {} },
      { name: "system_status", arguments: {} },
      { name: "app_list_installed", arguments: {} },
      { name: "workspace_write", arguments: { name: "smoke.txt", content: "OCADE smoke test." } },
      { name: "workspace_read", arguments: { name: "smoke.txt" } },
      { name: "workspace_list", arguments: {} },
    ]) {
      const started = Date.now();
      const outcome = await adapters.execute(call);
      const elapsed = Date.now() - started;
      line(call.name, `${elapsed}ms ${outcome.kind} — ${outcome.detail.slice(0, 70)}`);
      if (outcome.kind !== "success") failures += 1;
    }

    process.stdout.write("\nThe free voice on this device\n");
    const speech = capability.speech.ok
      ? (capability.speech.data as {
          engine?: string;
          preferred?: { name?: string; language?: string; gender?: string };
          cloudRequired?: boolean;
          count?: number;
        })
      : null;
    if (!speech) {
      line("speech", capability.speech.error ?? "unavailable");
      failures += 1;
    } else {
      line("engine", speech.engine);
      line("voices installed", speech.count);
      line("OCADE would use", speech.preferred?.name ?? "(system default)");
      line("its language", speech.preferred?.language ?? "?");
      line("its gender", speech.preferred?.gender ?? "?");
      line("needs a cloud service", speech.cloudRequired);
      if (speech.cloudRequired) failures += 1;
    }
    const mic = capability.microphone.ok
      ? (capability.microphone.data as { count?: number; reason?: string })
      : null;
    line("microphones", mic ? `${mic.count} — ${mic.reason}` : "unavailable");

    process.stdout.write(
      failures === 0
        ? "\nControl + Work reached this computer, read it, and acted on it.\n"
        : `\n${failures} check(s) did not pass.\n`,
    );
    return failures === 0 ? 0 : 1;
  } finally {
    // Always: an orphaned Python process holding a screen-capture device is a
    // real cost to the person whose computer this is.
    adapters.dispose();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  },
);
