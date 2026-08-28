import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { o as streamLocalChat, t as DEFAULT_LOCAL_BRIDGE_URL } from "./ocade-local-D4ziVbup.mjs";
import { t as useLocalEngine } from "./use-local-engine-CD0fQoND.mjs";
import { a as removeModel, c as verifyInstalled, i as pullModel, o as startLocalRuntimeFn, r as localRuntimeStatusFn, s as stopLocalRuntimeFn, t as activateModel } from "./local-runtime.functions-D7k5JAT3.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/LocalEngineControl-C-EOGLvZ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Customer-facing names for local engine implementations.
*
* Runtime identifiers are implementation/provenance details. They are needed
* by the local bridge, verification receipts and Advanced diagnostics, but they
* are not product choices a normal OCADE user should have to understand.
*
* This deliberately does NOT mutate or disguise the actual runtime id. The id
* continues to flow to the bridge unchanged; only presentation is mapped here.
*/
var PRESENTATION_BY_RUNTIME_ID = {
	"smollm2:135m": {
		label: "OCADE Compact",
		description: "Smallest download for lightweight local tasks."
	},
	"qwen2.5:0.5b": {
		label: "OCADE Standard",
		description: "Balanced local intelligence for everyday work."
	},
	"qwen2.5-coder:1.5b": {
		label: "OCADE Code",
		description: "Local engine tuned for code and technical work."
	}
};
function presentOcadeEngine(runtimeId) {
	return PRESENTATION_BY_RUNTIME_ID[runtimeId] ?? {
		label: "OCADE Local Intelligence",
		description: "On-device intelligence managed by OCADE."
	};
}
/**
* Production owner for the local-model lifecycle (P05).
*
* Runtime model ids stay internal. A customer chooses an OCADE capability,
* while the local bridge still receives the exact verified runtime id it needs.
*/
var SUGGESTED = [
	{
		id: "smollm2:135m",
		approxBytes: 271e6
	},
	{
		id: "qwen2.5:0.5b",
		approxBytes: 398e6
	},
	{
		id: "qwen2.5-coder:1.5b",
		approxBytes: 986e6
	}
];
var gb = (b) => b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`;
function LocalModelLifecyclePanel({ bridgeUrl = DEFAULT_LOCAL_BRIDGE_URL }) {
	const engine = useLocalEngine(bridgeUrl);
	const [phase, setPhase] = (0, import_react.useState)("idle");
	const [target, setTarget] = (0, import_react.useState)(SUGGESTED[0].id);
	const [progress, setProgress] = (0, import_react.useState)(null);
	const [controller, setController] = (0, import_react.useState)(null);
	const [log, setLog] = (0, import_react.useState)([]);
	const say = (0, import_react.useCallback)((line) => setLog((l) => [line, ...l].slice(0, 8)), []);
	const install = (0, import_react.useCallback)(async () => {
		const suggestion = SUGGESTED.find((s) => s.id === target);
		const presentation = presentOcadeEngine(target);
		const ac = new AbortController();
		setController(ac);
		setPhase("downloading");
		setProgress(null);
		say(`Downloading ${presentation.label}…`);
		const pulled = await pullModel(bridgeUrl, target, {
			signal: ac.signal,
			expectedBytes: suggestion?.approxBytes,
			onProgress: setProgress
		});
		setController(null);
		if (!pulled.ok) {
			setPhase("idle");
			if (pulled.failure === "cancelled") {
				say(pulled.reason);
				toast.info(pulled.reason);
			} else {
				say(pulled.reason);
				toast.error(pulled.reason);
			}
			return;
		}
		setPhase("verifying");
		say("Checking the download…");
		const verified = await verifyInstalled(bridgeUrl, target);
		if (!verified.ok) {
			setPhase("idle");
			say(verified.reason);
			toast.error(verified.reason);
			return;
		}
		say(verified.digestVerified ? "Installed and verified." : "Installed. Integrity proof is unavailable from this runtime.");
		setPhase("activating");
		say("Testing OCADE Local Intelligence…");
		const activated = await activateModel(target, {
			runInference: async (id, prompt) => {
				let text = "";
				return {
					ok: (await streamLocalChat(bridgeUrl, id, [{
						role: "user",
						content: prompt
					}], { onToken: (t) => text += t })).ok,
					text
				};
			},
			runCancellable: async (id) => {
				const a = new AbortController();
				setTimeout(() => a.abort(), 800);
				const r = await streamLocalChat(bridgeUrl, id, [{
					role: "user",
					content: "Count slowly from 1 to 900, one per line."
				}], {
					onToken: () => {},
					signal: a.signal
				});
				return { cancelled: r.ok === false && r.reason === "cancelled" };
			}
		});
		setPhase("idle");
		if (!activated.ok) {
			say(activated.reason);
			toast.error(activated.reason);
			return;
		}
		say("Ready.");
		toast.success(`${presentation.label} is ready.`);
		engine.refresh(true);
	}, [
		bridgeUrl,
		target,
		say,
		engine
	]);
	const remove = (0, import_react.useCallback)(async (modelId) => {
		const presentation = presentOcadeEngine(modelId);
		setPhase("removing");
		const r = await removeModel(bridgeUrl, modelId);
		setPhase("idle");
		if (!r.ok) {
			say(r.reason);
			toast.error(r.reason);
			return;
		}
		say(`${presentation.label} removed.`);
		toast.success(`${presentation.label} removed.`);
		engine.refresh(true);
	}, [
		bridgeUrl,
		say,
		engine
	]);
	const busy = phase !== "idle";
	const suggestion = SUGGESTED.find((s) => s.id === target);
	const selectedPresentation = presentOcadeEngine(target);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-lg border border-border p-4",
		"data-testid": "local-model-lifecycle",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-sm font-medium",
				children: "OCADE Local Intelligence"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Choose the level you want. OCADE handles the underlying runtime and keeps generation on this device."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						className: "rounded border border-border bg-background px-2 py-1 text-xs",
						value: target,
						disabled: busy,
						onChange: (e) => setTarget(e.target.value),
						"aria-label": "OCADE local intelligence level",
						children: SUGGESTED.map((s) => {
							const presentation = presentOcadeEngine(s.id);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: s.id,
								children: [
									presentation.label,
									" · ",
									gb(s.approxBytes)
								]
							}, s.id);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50",
						onClick: () => void install(),
						disabled: busy,
						children: phase === "downloading" ? "Downloading…" : phase === "verifying" ? "Checking…" : phase === "activating" ? "Testing…" : "Install"
					}),
					controller && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded border border-border px-3 py-1 text-xs",
						onClick: () => controller.abort(),
						children: "Cancel"
					})
				]
			}),
			suggestion ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-xs text-muted-foreground",
				children: [
					selectedPresentation.description,
					" Download size is about ",
					gb(suggestion.approxBytes),
					"."
				]
			}) : null,
			progress && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-1.5 w-full overflow-hidden rounded bg-muted",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-full bg-primary transition-all",
						style: { width: `${progress.percent ?? 0}%` }
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: [progress.status, progress.totalBytes > 0 && ` · ${Math.round(progress.percent ?? 0)}%`]
				})]
			}),
			engine.models.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 space-y-1",
				children: engine.models.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-3 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: presentOcadeEngine(m.id).label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded border border-border px-2 py-0.5 disabled:opacity-50",
						onClick: () => void remove(m.id),
						disabled: busy,
						children: "Remove"
					})]
				}, m.id))
			}),
			log.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-0.5 text-xs text-muted-foreground",
				children: log.map((l, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: l }, i))
			})
		]
	});
}
function LocalEngineControl() {
	const [status, setStatus] = (0, import_react.useState)(null);
	const [phase, setPhase] = (0, import_react.useState)("idle");
	const [problem, setProblem] = (0, import_react.useState)(null);
	const refresh = (0, import_react.useCallback)(async () => {
		setPhase("checking");
		try {
			setStatus(await localRuntimeStatusFn());
			setProblem(null);
		} catch (error) {
			setProblem(`Could not read the engine status: ${String(error)}`);
		} finally {
			setPhase("idle");
		}
	}, []);
	(0, import_react.useEffect)(() => {
		refresh();
	}, [refresh]);
	const start = (0, import_react.useCallback)(async () => {
		setPhase("starting");
		setProblem(null);
		try {
			const result = await startLocalRuntimeFn();
			if (result.ok) toast.success(result.alreadyRunning ? "OCADE Local Intelligence was already running." : "OCADE Local Intelligence is ready.");
			else {
				setProblem(result.reason);
				toast.error("OCADE Local Intelligence did not start.");
			}
		} catch (error) {
			setProblem(String(error));
			toast.error("OCADE Local Intelligence did not start.");
		} finally {
			setPhase("idle");
			refresh();
		}
	}, [refresh]);
	const stop = (0, import_react.useCallback)(async () => {
		setPhase("stopping");
		setProblem(null);
		try {
			const result = await stopLocalRuntimeFn();
			if (result.ok) toast.success(result.alreadyStopped ? "OCADE Local Intelligence was already stopped." : "OCADE Local Intelligence stopped.");
			else {
				setProblem(result.reason);
				toast.error("OCADE Local Intelligence did not stop.");
			}
		} catch (error) {
			setProblem(String(error));
			toast.error("OCADE Local Intelligence did not stop.");
		} finally {
			setPhase("idle");
			refresh();
		}
	}, [refresh]);
	const busy = phase !== "idle";
	const running = status?.running === true;
	const installed = status?.binaryFound === true;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-lg border border-border p-4",
		"aria-labelledby": "local-engine-heading",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				id: "local-engine-heading",
				className: "text-sm font-medium",
				children: "OCADE Local Intelligence"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Runs only on this device. OCADE manages the local runtime automatically; network addresses, process details and engine identifiers stay in Advanced diagnostics."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-xs",
				"aria-live": "polite",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: "Status: "
					}),
					phase === "checking" && "Checking…",
					phase === "starting" && "Starting…",
					phase === "stopping" && "Stopping…",
					phase === "idle" && status === null && "Unknown",
					phase === "idle" && status !== null && (running ? "Ready" : "Stopped")
				]
			}),
			status !== null && !installed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-muted-foreground",
				children: "Local Intelligence is not installed on this device yet."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50",
						onClick: () => void start(),
						disabled: busy || running || !installed,
						children: phase === "starting" ? "Starting…" : "Start"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded border border-border px-3 py-1 text-xs disabled:opacity-50",
						onClick: () => void stop(),
						disabled: busy || !running,
						children: phase === "stopping" ? "Stopping…" : "Stop"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded border border-border px-3 py-1 text-xs disabled:opacity-50",
						onClick: () => void refresh(),
						disabled: busy,
						children: "Refresh"
					})
				]
			}),
			problem && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "mt-3 text-xs text-destructive",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
					className: "cursor-pointer",
					children: "Technical details"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 break-words",
					role: "alert",
					children: problem
				})]
			})
		]
	});
}
//#endregion
export { LocalModelLifecyclePanel as n, LocalEngineControl as t };
