import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useOnline } from "@/lib/use-online";
import { useLocalEngine } from "@/lib/use-local-engine";
import { useSession } from "@/lib/session";
import { useChatPrefs } from "@/lib/use-chat-prefs";
import { detectTauri } from "@/lib/native/tauri-companion";
import { getBrowserBridge } from "@/lib/native/browser-bridge";
import { getCapabilityEnvironment } from "./environment.functions";
import { allCapabilityReports, type CapabilitySignals } from "./registry";
import type { CapabilityReport } from "./types";

/**
 * Collect the real signals and hand them to the pure registry.
 *
 * The rule that governs every line here: a signal is only reported when it has
 * actually been observed. Where a probe cannot run in this environment the
 * field is left `undefined` and the registry resolves downwards — no field is
 * ever defaulted to `true` to make a screen look healthier than the machine is.
 */
export function useCapabilitySignals(): CapabilitySignals {
  const online = useOnline();
  const { user } = useSession();
  const localEngine = useLocalEngine();
  const { prefs: chatPrefs } = useChatPrefs();

  const fetchEnv = useServerFn(getCapabilityEnvironment);
  const env = useQuery({
    queryKey: ["capability-environment", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: () => fetchEnv(),
  });

  /*
   * The native host. `detectTauri()` is the only truthful client-side answer:
   * in a browser tab there is no host, and no amount of UI can create one.
   * Automations and monitors run on that same desktop worker, so they inherit
   * this signal rather than inventing one of their own.
   */
  const nativeHost = typeof window === "undefined" ? false : detectTauri();

  const [browserBridge, setBrowserBridge] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void getBrowserBridge()
      .status()
      .then((s) => {
        if (!cancelled) setBrowserBridge(s.available);
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

  const storageMode: NonNullable<CapabilitySignals["sync"]>["mode"] =
    chatPrefs.storageMode === "private_sync"
      ? "private_sync"
      : chatPrefs.storageMode === "pc_vault"
        ? "pc_vault"
        : chatPrefs.storageMode === "browser_only"
          ? "browser_only"
          : "unknown";

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
    /*
     * Image understanding follows the engine actually available, not a wish:
     * the local discovery already classifies which installed engines accept
     * images, and a cloud engine only counts once one is configured.
     */
    vision: {
      engineSupportsImages:
        localEngine.models.some((m) => m.supportsImages) || Boolean(env.data?.cloudConfigured),
    },
    automationRunner: { available: nativeHost },
    monitors: { configuredCount: 0, runnerAvailable: nativeHost },
  };
}

export function useCapabilityReports(): CapabilityReport[] {
  return allCapabilityReports(useCapabilitySignals());
}
