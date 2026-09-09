import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOnline } from "@/lib/use-online";
import { useLocalEngine } from "@/lib/use-local-engine";
import { useSession } from "@/lib/session";
import { detectTauri } from "@/lib/native/tauri-companion";
import { getBrowserBridge } from "@/lib/native/browser-bridge";
import { loadPolicyCeiling } from "@/lib/organizations/authority";
import { NO_CEILING, withheldExplanation, type PolicyCeiling } from "@/lib/organizations/policy";
import { allCapabilityReports, type CapabilitySignals } from "./registry";
import type { CapabilityReport } from "./types";

const MONITOR_STORAGE_KEY = "ocade.monitors.v1";

/** Collect observed runtime signals. Unknown never defaults upward to ready. */
export function useCapabilitySignals(): CapabilitySignals {
  const online = useOnline();
  const { user } = useSession();
  const localEngine = useLocalEngine();
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
    /*
     * "Signed in" is the whole question now. It used to also report which of
     * three storage modes the account had chosen for chats; `PLAN.md` Phase 2
     * leaves one, so a mode signal could only ever say the same thing.
     */
    sync: { signedIn: !!user?.id },
    companion: nativeHost ? { connected: true } : { connected: false },
    browserBridge: browserBridge === undefined ? undefined : { connected: browserBridge },
    speech,
    vision: {
      engineSupportsImages: localEngine.models.some((model) => model.vision),
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
     * Monitor configuration currently lives in localStorage. There is
     * no dedicated monitor-runner heartbeat in the product yet, so the
     * registry MUST NOT infer active polling from `detectTauri()`. Configured
     * monitors are counted truthfully while runnerAvailable stays false until a
     * real runner probe is implemented.
     */
    monitors: { configuredCount: configuredMonitors, runnerAvailable: false },
  };
}

/**
 * What the organizations this account belongs to have turned off — PLAN.md §21.
 *
 * Cached for five minutes and refetched on nothing else: a workspace policy
 * changes on the order of months, and the capability badge is on every screen,
 * so asking on every mount would be a query per navigation for an answer that
 * is almost always the same empty set.
 *
 * Signed-out sessions belong to no organization and skip the read entirely.
 * `loadPolicyCeiling` already resolves an unreadable policy to "nothing
 * withheld"; this is the case where there is nothing to read at all.
 */
export function usePolicyCeiling(): PolicyCeiling {
  const { user } = useSession();
  const ceiling = useQuery({
    queryKey: ["organization-policy-ceiling", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    queryFn: loadPolicyCeiling,
  });
  return ceiling.data ?? NO_CEILING;
}

export function useCapabilityReports(): CapabilityReport[] {
  const reports = allCapabilityReports(useCapabilitySignals());
  const ceiling = usePolicyCeiling();

  return reports.map((report) => {
    /*
     * A WORKSPACE'S DECISION OUTRANKS EVERY PROBE BELOW IT.
     *
     * Applied first, and it replaces the status rather than adding to it. A
     * capability an organization has turned off is not "ready but blocked" —
     * the person cannot use it, and any other status here would be OCADE
     * offering something that will not work. The reason is named so the
     * sentence is actionable: somebody whose machine control has gone should
     * be able to tell "your workspace turned this off" from "your companion is
     * not running", because only one of those is theirs to fix.
     */
    if (ceiling.capabilities.has(report.id)) {
      return {
        ...report,
        status: "UNAVAILABLE" as const,
        detail: withheldExplanation(ceiling, report.id),
        evidence: "Withheld by an organization policy.",
      };
    }

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
        evidence:
          "No dedicated Code command-host heartbeat is wired into the capability probe yet.",
        action: { label: "Code workspace", to: "/ocade/code" },
      };
    }

    if (report.id === "automationRunner") {
      return {
        ...report,
        status: "NOT_CONFIGURED" as const,
        detail:
          "Automation source and queue logic are installed, but the global status has no live worker heartbeat. Saved schedules are not described as running until the worker itself proves it.",
        evidence:
          "No dedicated automation-worker heartbeat is wired into the global capability probe yet.",
        action: { label: "Automations", to: "/ocade/automations" },
      };
    }

    return report;
  });
}
