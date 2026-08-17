import { FREE_LAUNCH_MODE } from "@/lib/launch-mode";
import type { CapabilityId, CapabilityReport, CapabilityStatus } from "./types";

/**
 * Signals in, statuses out. No I/O, no React, no guessing.
 *
 * Everything here is a pure function of observed facts so the rules can be
 * tested exhaustively — which matters more than usual, because the whole point
 * of the capability system is that it never claims something works. Each
 * signal is optional and `undefined` means "not observed"; an unobserved
 * capability resolves DOWNWARDS (NOT_CONFIGURED / UNAVAILABLE), never to READY.
 */

export interface CapabilitySignals {
  /** navigator.onLine, or whatever the shell believes. */
  online?: boolean;
  /** On-device engine probe. */
  localEngine?: { reachable: boolean; modelCount: number; checking?: boolean };
  /** Cloud chat: is a provider actually configured and permitted? */
  cloud?: { configured: boolean; blockedReason?: string };
  /** Encrypted account sync. */
  sync?: { signedIn: boolean; mode: "browser_only" | "pc_vault" | "private_sync" | "unknown" };
  /** Native companion / machine control bridge. */
  companion?: { connected: boolean; approved?: boolean };
  /** Browser automation surface (extension or CDP bridge). */
  browserBridge?: { connected: boolean };
  /** Speech input/output support in this environment. */
  speech?: { inputSupported: boolean; outputSupported: boolean; permissionDenied?: boolean };
  /** Image understanding depends on an engine that accepts images. */
  vision?: { engineSupportsImages: boolean };
  /** Automation execution host. */
  automationRunner?: { available: boolean; running?: number };
  /** Monitors need the same runner to actually fetch anything. */
  monitors?: { configuredCount: number; runnerAvailable: boolean };
}

const NOT_OBSERVED = "No probe has reported on this yet.";

function localAI(s: CapabilitySignals): CapabilityReport {
  const probe = s.localEngine;
  if (!probe) {
    return {
      id: "localAI",
      label: "OCADE Local",
      status: "NOT_CONFIGURED",
      detail: "No on-device engine has been detected on this machine.",
      action: { label: "Set up the local engine", to: "/ocade/models" },
      evidence: NOT_OBSERVED,
    };
  }
  if (probe.checking) {
    return {
      id: "localAI",
      label: "OCADE Local",
      status: "WORKING",
      detail: "Checking the on-device engine.",
      evidence: "Engine probe in flight.",
    };
  }
  if (!probe.reachable) {
    return {
      id: "localAI",
      label: "OCADE Local",
      status: "NOT_CONFIGURED",
      detail: "The on-device engine is not running on this machine.",
      action: { label: "Set up the local engine", to: "/ocade/models" },
      evidence: "Loopback engine probe did not answer.",
    };
  }
  if (probe.modelCount === 0) {
    return {
      id: "localAI",
      label: "OCADE Local",
      status: "DEGRADED",
      detail: "The engine is running but has no models installed, so it cannot answer yet.",
      action: { label: "Install a model", to: "/ocade/models" },
      evidence: "Engine reachable, zero models.",
    };
  }
  return {
    id: "localAI",
    label: "OCADE Local",
    status: "READY",
    detail: `${probe.modelCount} on-device engine${probe.modelCount === 1 ? "" : "s"} ready. Unlimited and never metered.`,
    evidence: "Engine reachable with installed models.",
  };
}

function cloudAI(s: CapabilitySignals): CapabilityReport {
  if (s.cloud?.blockedReason) {
    return {
      id: "cloudAI",
      label: "OCADE Cloud",
      status: "FAILED",
      detail: s.cloud.blockedReason,
      evidence: "Provider reported a blocking condition.",
    };
  }
  if (!s.cloud?.configured) {
    return {
      id: "cloudAI",
      label: "OCADE Cloud",
      status: "NOT_CONFIGURED",
      detail: "No cloud provider is configured for this deployment.",
      action: { label: "Review model connections", to: "/ocade/models" },
      evidence: s.cloud ? "Provider check reported not configured." : NOT_OBSERVED,
    };
  }
  if (s.online === false) {
    return {
      id: "cloudAI",
      label: "OCADE Cloud",
      status: "OFFLINE",
      detail: "This device is offline, so nothing can be sent to a cloud engine.",
      action: { label: "Use OCADE Local instead", to: "/ocade" },
      evidence: "Browser reports offline.",
    };
  }
  return {
    id: "cloudAI",
    label: "OCADE Cloud",
    status: "READY",
    detail: "A cloud engine is configured and reachable. Requests leave this device only when you choose it.",
    evidence: "Provider configured and browser online.",
  };
}

function privateSync(s: CapabilitySignals): CapabilityReport {
  const sync = s.sync;
  if (!sync?.signedIn) {
    return {
      id: "privateSync",
      label: "Private Sync",
      status: "NOT_CONFIGURED",
      detail: "Sign in to synchronise this account across your approved devices.",
      action: { label: "Privacy settings", to: "/settings/privacy" },
      evidence: sync ? "No signed-in account." : NOT_OBSERVED,
    };
  }
  if (sync.mode === "browser_only") {
    return {
      id: "privateSync",
      label: "Private Sync",
      status: "UNAVAILABLE",
      detail: "Chats are set to Browser Only, so nothing is synchronised. That is a choice, not a fault.",
      action: { label: "Change storage mode", to: "/settings/privacy" },
      evidence: "Storage mode is browser_only.",
    };
  }
  if (sync.mode === "pc_vault") {
    return {
      id: "privateSync",
      label: "Private Sync",
      status: "UNAVAILABLE",
      detail: "Chats are stored in the PC Vault on this machine and are not synchronised.",
      action: { label: "Change storage mode", to: "/settings/privacy" },
      evidence: "Storage mode is pc_vault.",
    };
  }
  if (s.online === false) {
    return {
      id: "privateSync",
      label: "Private Sync",
      status: "OFFLINE",
      detail: "Offline. Changes stay on this device and sync when the connection returns.",
      evidence: "Browser reports offline.",
    };
  }
  if (sync.mode === "unknown") {
    return {
      id: "privateSync",
      label: "Private Sync",
      status: "NOT_CONFIGURED",
      detail: "No storage mode has been chosen yet.",
      action: { label: "Choose a storage mode", to: "/settings/privacy" },
      evidence: "Storage mode unresolved.",
    };
  }
  return {
    id: "privateSync",
    label: "Private Sync",
    status: "READY",
    detail: "Chats are synchronised to your account across approved devices.",
    evidence: "Storage mode is private_sync and the device is online.",
  };
}

function computerControl(s: CapabilitySignals): CapabilityReport {
  const c = s.companion;
  if (!c?.connected) {
    return {
      id: "computerControl",
      label: "Computer control",
      status: "NOT_CONFIGURED",
      detail:
        "The native companion is not connected, so OCADE cannot touch this computer. Nothing is simulated in its place.",
      action: { label: "Control + Work", to: "/ocade/work" },
      evidence: c ? "Companion bridge reported disconnected." : NOT_OBSERVED,
    };
  }
  if (c.approved === false) {
    return {
      id: "computerControl",
      label: "Computer control",
      status: "NEEDS_APPROVAL",
      detail: "The companion is connected but has no approved permissions yet.",
      action: { label: "Review permissions", to: "/ocade/permissions" },
      evidence: "Companion connected, permissions not granted.",
    };
  }
  return {
    id: "computerControl",
    label: "Computer control",
    status: "READY",
    detail: "The native companion is connected and permitted. Every action still asks before it runs.",
    evidence: "Companion connected and approved.",
  };
}

function browser(s: CapabilitySignals): CapabilityReport {
  if (!s.browserBridge?.connected) {
    return {
      id: "browser",
      label: "Browser control",
      status: "NOT_CONFIGURED",
      detail: "No browser bridge is paired, so OCADE cannot drive a browser tab.",
      action: { label: "Browser settings", to: "/settings/browser" },
      evidence: s.browserBridge ? "Bridge reported unpaired." : NOT_OBSERVED,
    };
  }
  return {
    id: "browser",
    label: "Browser control",
    status: "READY",
    detail: "A browser bridge is paired and responding.",
    evidence: "Bridge reported connected.",
  };
}

function codeTerminal(s: CapabilitySignals): CapabilityReport {
  if (!s.companion?.connected) {
    return {
      id: "codeTerminal",
      label: "Code terminal",
      status: "NOT_CONFIGURED",
      detail:
        "A real terminal needs the native host on this machine. Without it there is no shell — OCADE will not print output that never ran.",
      action: { label: "Code workspace", to: "/ocade/code" },
      evidence: "No native host connection.",
    };
  }
  return {
    id: "codeTerminal",
    label: "Code terminal",
    status: "READY",
    detail: "The native host is connected, so commands run in a real shell with your approval.",
    evidence: "Native host connected.",
  };
}

function voice(s: CapabilitySignals): CapabilityReport {
  const sp = s.speech;
  if (!sp) {
    return {
      id: "voice",
      label: "Voice",
      status: "NOT_CONFIGURED",
      detail: "Voice support has not been checked in this browser yet.",
      action: { label: "Voice settings", to: "/settings/voice" },
      evidence: NOT_OBSERVED,
    };
  }
  if (sp.permissionDenied) {
    return {
      id: "voice",
      label: "Voice",
      status: "NEEDS_APPROVAL",
      detail: "Microphone access was refused, so speech input cannot start.",
      action: { label: "Voice settings", to: "/settings/voice" },
      evidence: "Microphone permission denied.",
    };
  }
  if (!sp.inputSupported && !sp.outputSupported) {
    return {
      id: "voice",
      label: "Voice",
      status: "UNAVAILABLE",
      detail: "This browser offers neither speech input nor speech output.",
      evidence: "No speech APIs present.",
    };
  }
  if (!sp.inputSupported || !sp.outputSupported) {
    return {
      id: "voice",
      label: "Voice",
      status: "DEGRADED",
      detail: sp.inputSupported
        ? "Speech input works here; read-aloud is not available in this browser."
        : "Read-aloud works here; speech input is not available in this browser.",
      action: { label: "Voice settings", to: "/settings/voice" },
      evidence: "Partial speech API support.",
    };
  }
  return {
    id: "voice",
    label: "Voice",
    status: "READY",
    detail: "Speech input and read-aloud are both available in this browser.",
    action: { label: "Voice settings", to: "/settings/voice" },
    evidence: "Speech APIs present.",
  };
}

function vision(s: CapabilitySignals): CapabilityReport {
  if (s.vision?.engineSupportsImages) {
    return {
      id: "vision",
      label: "Image understanding",
      status: "READY",
      detail: "The selected engine accepts images.",
      evidence: "Engine advertises image input.",
    };
  }
  return {
    id: "vision",
    label: "Image understanding",
    status: "NOT_CONFIGURED",
    detail: "No available engine accepts images, so attachments cannot be interpreted.",
    action: { label: "Model connections", to: "/ocade/models" },
    evidence: s.vision ? "No engine advertises image input." : NOT_OBSERVED,
  };
}

function automationRunner(s: CapabilitySignals): CapabilityReport {
  const r = s.automationRunner;
  if (!r?.available) {
    return {
      id: "automationRunner",
      label: "Automation runner",
      status: "NOT_CONFIGURED",
      detail:
        "No runner is attached, so scheduled automations will not execute on their own. Saved schedules are kept.",
      action: { label: "Automations", to: "/ocade/automations" },
      evidence: r ? "Runner reported unavailable." : NOT_OBSERVED,
    };
  }
  if (r.running && r.running > 0) {
    return {
      id: "automationRunner",
      label: "Automation runner",
      status: "WORKING",
      detail: `${r.running} automation${r.running === 1 ? "" : "s"} running now.`,
      action: { label: "Automations", to: "/ocade/automations" },
      evidence: "Runner reported in-flight work.",
    };
  }
  return {
    id: "automationRunner",
    label: "Automation runner",
    status: "READY",
    detail: "A runner is attached and idle.",
    action: { label: "Automations", to: "/ocade/automations" },
    evidence: "Runner reported available.",
  };
}

function monitors(s: CapabilitySignals): CapabilityReport {
  const m = s.monitors;
  if (!m) {
    return {
      id: "monitors",
      label: "Monitors",
      status: "NOT_CONFIGURED",
      detail: "Monitors have not been checked yet.",
      action: { label: "Monitors", to: "/ocade/monitors" },
      evidence: NOT_OBSERVED,
    };
  }
  if (!m.runnerAvailable) {
    /*
     * The important honesty in the whole registry. A monitor list that looks
     * alive while nothing polls is the single most misleading state this
     * product could ship: the user believes they are being watched over.
     */
    return {
      id: "monitors",
      label: "Monitors",
      status: "NOT_CONFIGURED",
      detail:
        m.configuredCount > 0
          ? `${m.configuredCount} monitor${m.configuredCount === 1 ? " is" : "s are"} defined, but nothing is polling them — no checks are running.`
          : "No monitors are defined, and no runner is attached to poll them.",
      action: { label: "Monitors", to: "/ocade/monitors" },
      evidence: "No runner attached.",
    };
  }
  if (m.configuredCount === 0) {
    return {
      id: "monitors",
      label: "Monitors",
      status: "READY",
      detail: "A runner is attached. No monitors are defined yet.",
      action: { label: "Monitors", to: "/ocade/monitors" },
      evidence: "Runner attached, zero monitors.",
    };
  }
  return {
    id: "monitors",
    label: "Monitors",
    status: "READY",
    detail: `${m.configuredCount} monitor${m.configuredCount === 1 ? "" : "s"} being polled.`,
    action: { label: "Monitors", to: "/ocade/monitors" },
    evidence: "Runner attached with defined monitors.",
  };
}

function payments(): CapabilityReport {
  if (FREE_LAUNCH_MODE) {
    return {
      id: "payments",
      label: "Payments",
      status: "UNAVAILABLE",
      detail:
        "Billing is switched off. OCADE is free for every signed-in account right now, so there is nothing to buy and no paid gate on any feature.",
      evidence: "FREE_LAUNCH_MODE is on.",
    };
  }
  return {
    id: "payments",
    label: "Payments",
    status: "NOT_CONFIGURED",
    detail: "Billing is enabled in configuration but no checkout has been verified.",
    evidence: "FREE_LAUNCH_MODE is off.",
  };
}

function desktopInstaller(): CapabilityReport {
  return {
    id: "desktopInstaller",
    label: "Desktop app",
    status: "COMING_SOON",
    detail:
      "No desktop installer is published for this release. The native source is in the repository but nothing signed and tested is available to download.",
    evidence: "No published installer artefact.",
  };
}

const BUILDERS: Record<CapabilityId, (s: CapabilitySignals) => CapabilityReport> = {
  localAI,
  cloudAI,
  privateSync,
  browser,
  computerControl,
  codeTerminal,
  voice,
  vision,
  automationRunner,
  monitors,
  payments: () => payments(),
  desktopInstaller: () => desktopInstaller(),
};

export function capabilityReport(id: CapabilityId, signals: CapabilitySignals): CapabilityReport {
  return BUILDERS[id](signals);
}

export function allCapabilityReports(signals: CapabilitySignals): CapabilityReport[] {
  return (Object.keys(BUILDERS) as CapabilityId[]).map((id) => BUILDERS[id](signals));
}

/** Coarse summary for a header pill: the worst thing currently true. */
export function worstStatus(reports: CapabilityReport[]): CapabilityStatus {
  const severity: CapabilityStatus[] = [
    "FAILED",
    "OFFLINE",
    "NEEDS_APPROVAL",
    "DEGRADED",
    "NOT_CONFIGURED",
    "UNAVAILABLE",
    "COMING_SOON",
    "WAITING",
    "WORKING",
    "READY",
  ];
  for (const status of severity) {
    if (reports.some((r) => r.status === status)) return status;
  }
  return "READY";
}
