import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { l as getBrowserBridge, s as detectTauri } from "./tauri-companion-u0J6qjWn.mjs";
import { t as useSession } from "./session-VpaXwoLS.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as useOnline } from "./use-online-DzqlfJYh.mjs";
import { t as getModeFor } from "./resolver-CR5RuR-0.mjs";
import { t as useLocalEngine } from "./use-local-engine-CD0fQoND.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-capabilities-CcKUWNkb.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var NOT_OBSERVED = "No probe has reported on this yet.";
function localAI(s) {
	const probe = s.localEngine;
	if (!probe) return {
		id: "localAI",
		label: "OCADE Local",
		status: "NOT_CONFIGURED",
		detail: "No on-device engine has been detected on this machine.",
		action: {
			label: "Set up the local engine",
			to: "/ocade/models"
		},
		evidence: NOT_OBSERVED
	};
	if (probe.checking) return {
		id: "localAI",
		label: "OCADE Local",
		status: "WORKING",
		detail: "Checking the on-device engine.",
		evidence: "Engine probe in flight."
	};
	if (!probe.reachable) return {
		id: "localAI",
		label: "OCADE Local",
		status: "NOT_CONFIGURED",
		detail: "The on-device engine is not running on this machine.",
		action: {
			label: "Set up the local engine",
			to: "/ocade/models"
		},
		evidence: "Loopback engine probe did not answer."
	};
	if (probe.modelCount === 0) return {
		id: "localAI",
		label: "OCADE Local",
		status: "DEGRADED",
		detail: "The engine is running but has no models installed, so it cannot answer yet.",
		action: {
			label: "Install a model",
			to: "/ocade/models"
		},
		evidence: "Engine reachable, zero models."
	};
	return {
		id: "localAI",
		label: "OCADE Local",
		status: "READY",
		detail: `${probe.modelCount} on-device engine${probe.modelCount === 1 ? "" : "s"} ready. Unlimited and never metered.`,
		evidence: "Engine reachable with installed models."
	};
}
function privateSync(s) {
	const sync = s.sync;
	if (!sync?.signedIn) return {
		id: "privateSync",
		label: "Private Sync",
		status: "NOT_CONFIGURED",
		detail: "Sign in to synchronise this account across your approved devices.",
		action: {
			label: "Privacy settings",
			to: "/settings/privacy"
		},
		evidence: sync ? "No signed-in account." : NOT_OBSERVED
	};
	if (sync.mode === "browser_only") return {
		id: "privateSync",
		label: "Private Sync",
		status: "UNAVAILABLE",
		detail: "Chats are set to Browser Only, so nothing is synchronised. That is a choice, not a fault.",
		action: {
			label: "Change storage mode",
			to: "/settings/privacy"
		},
		evidence: "Storage mode is browser_only."
	};
	if (sync.mode === "pc_vault") return {
		id: "privateSync",
		label: "Private Sync",
		status: "UNAVAILABLE",
		detail: "Chats are stored in the PC Vault on this machine and are not synchronised.",
		action: {
			label: "Change storage mode",
			to: "/settings/privacy"
		},
		evidence: "Storage mode is pc_vault."
	};
	if (s.online === false) return {
		id: "privateSync",
		label: "Private Sync",
		status: "OFFLINE",
		detail: "Offline. Changes stay on this device and sync when the connection returns.",
		evidence: "Browser reports offline."
	};
	if (sync.mode === "unknown") return {
		id: "privateSync",
		label: "Private Sync",
		status: "NOT_CONFIGURED",
		detail: "No storage mode has been chosen yet.",
		action: {
			label: "Choose a storage mode",
			to: "/settings/privacy"
		},
		evidence: "Storage mode unresolved."
	};
	return {
		id: "privateSync",
		label: "Private Sync",
		status: "READY",
		detail: "Chats are synchronised to your account across approved devices.",
		evidence: "Storage mode is private_sync and the device is online."
	};
}
function computerControl(s) {
	const c = s.companion;
	if (!c?.connected) return {
		id: "computerControl",
		label: "Computer control",
		status: "NOT_CONFIGURED",
		detail: "The native companion is not connected, so OCADE cannot touch this computer. Nothing is simulated in its place.",
		action: {
			label: "Control + Work",
			to: "/ocade/work"
		},
		evidence: c ? "Companion bridge reported disconnected." : NOT_OBSERVED
	};
	if (c.approved === false) return {
		id: "computerControl",
		label: "Computer control",
		status: "NEEDS_APPROVAL",
		detail: "The companion is connected but has no approved permissions yet.",
		action: {
			label: "Review permissions",
			to: "/ocade/permissions"
		},
		evidence: "Companion connected, permissions not granted."
	};
	return {
		id: "computerControl",
		label: "Computer control",
		status: "READY",
		detail: "The native companion is connected and permitted. Every action still asks before it runs.",
		evidence: "Companion connected and approved."
	};
}
function browser(s) {
	if (!s.browserBridge?.connected) return {
		id: "browser",
		label: "Browser control",
		status: "NOT_CONFIGURED",
		detail: "No browser bridge is paired, so OCADE cannot drive a browser tab.",
		action: {
			label: "Browser settings",
			to: "/settings/browser"
		},
		evidence: s.browserBridge ? "Bridge reported unpaired." : NOT_OBSERVED
	};
	return {
		id: "browser",
		label: "Browser control",
		status: "READY",
		detail: "A browser bridge is paired and responding.",
		evidence: "Bridge reported connected."
	};
}
function codeTerminal(s) {
	if (!s.companion?.connected) return {
		id: "codeTerminal",
		label: "Code terminal",
		status: "NOT_CONFIGURED",
		detail: "A real terminal needs the native host on this machine. Without it there is no shell — OCADE will not print output that never ran.",
		action: {
			label: "Code workspace",
			to: "/ocade/code"
		},
		evidence: "No native host connection."
	};
	return {
		id: "codeTerminal",
		label: "Code terminal",
		status: "READY",
		detail: "The native host is connected, so commands run in a real shell with your approval.",
		evidence: "Native host connected."
	};
}
function voice(s) {
	const sp = s.speech;
	if (!sp) return {
		id: "voice",
		label: "Voice",
		status: "NOT_CONFIGURED",
		detail: "Voice support has not been checked in this browser yet.",
		action: {
			label: "Voice settings",
			to: "/settings/voice"
		},
		evidence: NOT_OBSERVED
	};
	if (sp.permissionDenied) return {
		id: "voice",
		label: "Voice",
		status: "NEEDS_APPROVAL",
		detail: "Microphone access was refused, so speech input cannot start.",
		action: {
			label: "Voice settings",
			to: "/settings/voice"
		},
		evidence: "Microphone permission denied."
	};
	if (!sp.inputSupported && !sp.outputSupported) return {
		id: "voice",
		label: "Voice",
		status: "UNAVAILABLE",
		detail: "This browser offers neither speech input nor speech output.",
		evidence: "No speech APIs present."
	};
	if (!sp.inputSupported || !sp.outputSupported) return {
		id: "voice",
		label: "Voice",
		status: "DEGRADED",
		detail: sp.inputSupported ? "Speech input works here; read-aloud is not available in this browser." : "Read-aloud works here; speech input is not available in this browser.",
		action: {
			label: "Voice settings",
			to: "/settings/voice"
		},
		evidence: "Partial speech API support."
	};
	return {
		id: "voice",
		label: "Voice",
		status: "READY",
		detail: "Speech input and read-aloud are both available in this browser.",
		action: {
			label: "Voice settings",
			to: "/settings/voice"
		},
		evidence: "Speech APIs present."
	};
}
function vision(s) {
	if (s.vision?.engineSupportsImages) return {
		id: "vision",
		label: "Image understanding",
		status: "READY",
		detail: "The selected engine accepts images.",
		evidence: "Engine advertises image input."
	};
	return {
		id: "vision",
		label: "Image understanding",
		status: "NOT_CONFIGURED",
		detail: "No available engine accepts images, so attachments cannot be interpreted.",
		action: {
			label: "Model connections",
			to: "/ocade/models"
		},
		evidence: s.vision ? "No engine advertises image input." : NOT_OBSERVED
	};
}
function automationRunner(s) {
	const r = s.automationRunner;
	if (!r?.available) return {
		id: "automationRunner",
		label: "Automation runner",
		status: "NOT_CONFIGURED",
		detail: "No runner is attached, so scheduled automations will not execute on their own. Saved schedules are kept.",
		action: {
			label: "Automations",
			to: "/ocade/automations"
		},
		evidence: r ? "Runner reported unavailable." : NOT_OBSERVED
	};
	if (r.running && r.running > 0) return {
		id: "automationRunner",
		label: "Automation runner",
		status: "WORKING",
		detail: `${r.running} automation${r.running === 1 ? "" : "s"} running now.`,
		action: {
			label: "Automations",
			to: "/ocade/automations"
		},
		evidence: "Runner reported in-flight work."
	};
	return {
		id: "automationRunner",
		label: "Automation runner",
		status: "READY",
		detail: "A runner is attached and idle.",
		action: {
			label: "Automations",
			to: "/ocade/automations"
		},
		evidence: "Runner reported available."
	};
}
function monitors(s) {
	const m = s.monitors;
	if (!m) return {
		id: "monitors",
		label: "Monitors",
		status: "NOT_CONFIGURED",
		detail: "Monitors have not been checked yet.",
		action: {
			label: "Monitors",
			to: "/ocade/monitors"
		},
		evidence: NOT_OBSERVED
	};
	if (!m.runnerAvailable) return {
		id: "monitors",
		label: "Monitors",
		status: "NOT_CONFIGURED",
		detail: m.configuredCount > 0 ? `${m.configuredCount} monitor${m.configuredCount === 1 ? " is" : "s are"} defined, but nothing is polling them — no checks are running.` : "No monitors are defined, and no runner is attached to poll them.",
		action: {
			label: "Monitors",
			to: "/ocade/monitors"
		},
		evidence: "No runner attached."
	};
	if (m.configuredCount === 0) return {
		id: "monitors",
		label: "Monitors",
		status: "READY",
		detail: "A runner is attached. No monitors are defined yet.",
		action: {
			label: "Monitors",
			to: "/ocade/monitors"
		},
		evidence: "Runner attached, zero monitors."
	};
	return {
		id: "monitors",
		label: "Monitors",
		status: "READY",
		detail: `${m.configuredCount} monitor${m.configuredCount === 1 ? "" : "s"} being polled.`,
		action: {
			label: "Monitors",
			to: "/ocade/monitors"
		},
		evidence: "Runner attached with defined monitors."
	};
}
function payments() {
	return {
		id: "payments",
		label: "Payments",
		status: "UNAVAILABLE",
		detail: "Billing is switched off. OCADE is free for every signed-in account right now, so there is nothing to buy and no paid gate on any feature.",
		evidence: "FREE_LAUNCH_MODE is on."
	};
}
function desktopInstaller() {
	return {
		id: "desktopInstaller",
		label: "Desktop app",
		status: "COMING_SOON",
		detail: "No desktop installer is published for this release. The native source is in the repository but nothing signed and tested is available to download.",
		evidence: "No published installer artefact."
	};
}
var BUILDERS = {
	localAI,
	privateSync,
	browser,
	computerControl,
	codeTerminal,
	voice,
	vision,
	automationRunner,
	monitors,
	payments: () => payments(),
	desktopInstaller: () => desktopInstaller()
};
function allCapabilityReports(signals) {
	return Object.keys(BUILDERS).map((id) => BUILDERS[id](signals));
}
/** Coarse summary for a header pill: the worst thing currently true. */
function worstStatus(reports) {
	for (const status of [
		"FAILED",
		"OFFLINE",
		"NEEDS_APPROVAL",
		"DEGRADED",
		"NOT_CONFIGURED",
		"UNAVAILABLE",
		"COMING_SOON",
		"WAITING",
		"WORKING",
		"READY"
	]) if (reports.some((r) => r.status === status)) return status;
	return "READY";
}
var MONITOR_STORAGE_KEY = "ocade.monitors.v1";
/** Collect observed runtime signals. Unknown never defaults upward to ready. */
function useCapabilitySignals() {
	const online = useOnline();
	const { user } = useSession();
	const localEngine = useLocalEngine();
	const nativeHost = typeof window === "undefined" ? false : detectTauri();
	const [browserBridge, setBrowserBridge] = (0, import_react.useState)(void 0);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		getBrowserBridge().status().then((status) => {
			if (!cancelled) setBrowserBridge(status.available);
		}).catch(() => {
			if (!cancelled) setBrowserBridge(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	const [speech, setSpeech] = (0, import_react.useState)(void 0);
	(0, import_react.useEffect)(() => {
		if (typeof window === "undefined") return;
		setSpeech({
			inputSupported: "webkitSpeechRecognition" in window || "SpeechRecognition" in window,
			outputSupported: "speechSynthesis" in window
		});
	}, []);
	const storageMode = useQuery({
		queryKey: ["capability-storage-mode", user?.id],
		enabled: !!user?.id,
		staleTime: 6e4,
		queryFn: () => getModeFor(user.id, "chats")
	}).data ?? "unknown";
	const [configuredMonitors, setConfiguredMonitors] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
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
			checking: localEngine.status === "checking"
		},
		sync: {
			signedIn: !!user?.id,
			mode: storageMode
		},
		companion: nativeHost ? { connected: true } : { connected: false },
		browserBridge: browserBridge === void 0 ? void 0 : { connected: browserBridge },
		speech,
		vision: { engineSupportsImages: localEngine.models.some((model) => model.vision) },
		automationRunner: { available: false },
		monitors: {
			configuredCount: configuredMonitors,
			runnerAvailable: false
		}
	};
}
function useCapabilityReports() {
	return allCapabilityReports(useCapabilitySignals()).map((report) => {
		if (report.id === "desktopInstaller") return {
			...report,
			status: "UNAVAILABLE",
			detail: "Desktop downloads are disabled for the current free launch. Native source may exist in the repository, but no installer is offered to users.",
			evidence: "Desktop download surface is intentionally withdrawn for this launch."
		};
		if (report.id === "codeTerminal") return {
			...report,
			status: "NOT_CONFIGURED",
			detail: "A native shell alone is not proof that a Code terminal is alive. OCADE will not claim terminal readiness until a dedicated command-host heartbeat succeeds.",
			evidence: "No dedicated Code command-host heartbeat is wired into the capability probe yet.",
			action: {
				label: "Code workspace",
				to: "/ocade/code"
			}
		};
		if (report.id === "automationRunner") return {
			...report,
			status: "NOT_CONFIGURED",
			detail: "Automation source and queue logic are installed, but the global status has no live worker heartbeat. Saved schedules are not described as running until the worker itself proves it.",
			evidence: "No dedicated automation-worker heartbeat is wired into the global capability probe yet.",
			action: {
				label: "Automations",
				to: "/ocade/automations"
			}
		};
		return report;
	});
}
//#endregion
export { worstStatus as n, useCapabilityReports as t };
