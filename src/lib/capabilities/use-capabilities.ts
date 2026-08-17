import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useOnline } from "@/lib/use-online";
import { useLocalEngine } from "@/lib/use-local-engine";
import { useSession } from "@/lib/session";
import { getModeFor } from "@/lib/storage/resolver";
import { detectTauri } from "@/lib/native/tauri-companion";
import { getBrowserBridge } from "@/lib/native/browser-bridge";
import { getCapabilityEnvironment } from "./environment.functions";
import { allCapabilityReports, type CapabilitySignals } from "./registry";
import type { CapabilityReport } from "./types";

const MONITOR_STORAGE_KEY = "ocade.monitors.v1";

/** Collect observed runtime signals. Unknown never defaults upward to ready. */
export function useCapabilitySignals(): CapabilitySignals {
  const online = useOnline();
  const { user } = useSession();
  const localEngine = useLocalEngine();
  const fetchEnv = useServerFn(getCapabilityEnvironment);
  const env = useQuery({
    queryKey: ["capability-environment", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: () => fetchEnv(),
  });

  const nativeHost = typeof window === "undefined" ? false : detectTauri();

  const [browserBridge, setBrowserBridge] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void getBrowserBridge()
      .status()
      .then((status) => {
        if (!cancelled) setBrowserBridge(status.available);
      })
      .catch(() => {
        if (!cancelled) setBrowserBridge(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [speech, setSpeech] = useState<CapabilitySignals["speech"]>(undefined);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSpeech({
      inputSupported: "webkitSpeechRecognition" in window || "SpeechRecognition" in window,
      outputSupported: "speechSynthesis" in window,
    });
  }, []);

  const modeQuery = useQuery({
    queryKey: ["capability-storage-mode", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: () => getModeFor(user!.id, "chats"),
  });
  const storageMode: NonNullable<CapabilitySignals["sync"]>["mode"] = modeQuery.data ?? "unknown";

  const [configuredMonitors, setConfiguredMonitors] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(MONITOR_STORAGE_KEY) ?? "[]");
      setConfiguredMonitors(Array.isArray(parsed) ? parsed.length : 0);
    } catch {
      setConfiguredMonitors(0);
    }
  }, []);

  return {
    online,
    localEngine: {
      reachable: localEngine.reachable,
      modelCount: localEngine.models.length,
      checking: localEngine.status === "checking",
    },
    cloud: env.data ? { configured: env.data.cloudConfigured } : undefined,
    sync: { signedIn: !!user?.id, mode: storageMode },
    companion: nativeHost ? { connected: true } : { connected: false },
    browserBridge: browserBridge === undefined ? undefined : { connected: browserBridge },
    speech,
    vision: {
      engineSupportsImages:
        localEngine.models.some((model) => model.vision) || Boolean(env.data?.cloudConfigured),
    },
    /*
     * The repository contains a durable automation worker, but `detectTauri()`
     * only proves that the shell exists. It does NOT prove that the queue host
     * bootstrapped, owns a secure companion session, or is polling. Until a
     * dedicated worker heartbeat is wired into this hook, availability stays
     * false. The Automations surface may still start a worker and show its own
     * observed run state; the global capability badge will never infer it.
     */
    automationRunner: { available: false },
    /*
     * Monitor configuration currently lives in localStorage. There is no
     * dedicated monitor-runner heartbeat/probe in the product yet, so the
     * registry MUST NOT infer active polling from `detectTauri()`. Configured
     * monitors are counted truthfully while runnerAvailable stays false until a
     * real runner probe is implemented.
     */
    monitors: { configuredCount: configuredMonitors, runnerAvailable: false },
  };
}

export function useCapabilityReports(): CapabilityReport[] {
  const reports = allCapabilityReports(useCapabilitySignals());

  return reports.map((report) => {
    if (report.id === "desktopInstaller") {
      return {
        ...report,
        status: "UNAVAILABLE" as const,
        detail:
          "Desktop downloads are disabled for the current free launch. Native source may exist in the repository, but no installer is offered to users.",
        evidence: "Desktop download surface is intentionally withdrawn for this launch.",
      };
    }

    if (report.id === "codeTerminal") {
      return {
        ...report,
        status: "NOT_CONFIGURED" as const,
        detail:
          "A native shell alone is not proof that a Code terminal is alive. OCADE will not claim terminal readiness until a dedicated command-host heartbeat succeeds.",
        evidence: "No dedicated Code command-host heartbeat is wired into the capability probe yet.",
        action: { label: "Code workspace", to: "/ocade/code" },
      };
    }

    if (report.id === "automationRunner") {
      return {
        ...report,
        status: "NOT_CONFIGURED" as const,
        detail:
          "Automation source and queue logic are installed, but the global status has no live worker heartbeat. Saved schedules are not described as running until the worker itself proves it.",
        evidence: "No dedicated automation-worker heartbeat is wired into the global capability probe yet.",
        action: { label: "Automations", to: "/ocade/automations" },
      };
    }

    return report;
  });
}
