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
     * A Tauri host is evidence that a native process exists, but it is not by
     * itself evidence that the automation worker is healthy. The existing
     * automation runner uses that native host, so it may be available there;
     * its individual run state is still authoritative on the Tasks page.
     */
    automationRunner: { available: nativeHost },
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
  return allCapabilityReports(useCapabilitySignals()).map((report) =>
    report.id === "desktopInstaller"
      ? {
          ...report,
          status: "UNAVAILABLE" as const,
          detail:
            "Desktop downloads are disabled for the current free launch. Native source may exist in the repository, but no installer is offered to users.",
          evidence: "Desktop download surface is intentionally withdrawn for this launch.",
        }
      : report,
  );
}
