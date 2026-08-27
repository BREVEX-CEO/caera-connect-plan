import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link, l as useLocation, p as Outlet } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as Search, D as SlidersHorizontal, Gt as ListChecks, Nt as MessageSquare, pn as FolderOpen } from "../_libs/lucide-react.mjs";
import { f as streamLocalChat, n as FIXED_MODEL, s as discoverLocalModels, t as DEFAULT_LOCAL_BRIDGE_URL } from "./ocade-local-CUSjQ2bI.mjs";
import { d as serverIsThisMachine, p as useDevicePolicy } from "./paired-credentials-CoRYM1DE.mjs";
import { i as useBrain, r as subscribeToPreparation, t as describePreparation } from "./use-brain-D4LGZB-g.mjs";
import { i as startSyncLoop } from "./sync-queue-Cda0l5N0.mjs";
import { n as registerDeviceForCurrentSession } from "./devices-B2UPh5_l.mjs";
import { t as reportLovableError } from "./lovable-error-reporting-2OGRNSh7.mjs";
import { i as pullModel, n as installLocalRuntimeFn, o as startLocalRuntimeFn, t as activateModel } from "./local-runtime.functions-DbppBIMv.mjs";
import { t as Route } from "./route-T_miY-dp.mjs";
import { n as SettingsAccessProvider } from "./SettingsGate-BOwuQuSO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-CFH8suCJ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* First-run engine setup — silent, automatic, and out of the way.
*
* WHAT THIS REPLACED, AND WHY
*
* This used to be a full-screen modal that blocked the entire application
* before the user had done anything, asked them to approve a 4.87 GB download,
* and — when the runtime was missing — presented a dead end reading "The OCADE
* Local Engine runtime is not installed in any known location on this machine."
* Two of those three states were also WRONG whenever OCADE was hosted rather
* than run locally, because the figures behind them came from the server, not
* the device. A person on a laptop was told their machine had 251.69 GB of
* memory.
*
* It now does its work in the background and shows a small status pill. OCADE
* decides which engine suits the device and fetches it without interrupting
* anyone.
*
* WHERE CONTROL LIVES. This surface informs; it does not control. Pause,
* resume, cancel, repair and remove all live in Settings › Local Engine, on the
* panel built for them. A transfer nobody can stop would be indefensible; a
* modal in front of someone who just wants to type is its own problem. So the
* controls exist, one click away, rather than in the doorway.
*
* WHEN IT RENDERS NOTHING AT ALL:
*  - a usable model is already installed;
*  - no local runtime is reachable AND the server is not this machine, so there
*    is nothing on the user's device to manage and cloud already serves them;
*  - setup failed, in which case Settings explains it rather than a popup.
*/
/**
* Remembered per browser so a SUCCESSFUL setup does not repeat on every
* navigation.
*
* THIS USED TO BE WRITTEN ON FAILURE TOO, WHICH MADE ONE BAD DOWNLOAD FINAL.
* A dropped connection, a full disk, a runtime that had not finished starting
* -- any of them set the flag, and `alreadyAttempted()` then short-circuited
* forever. The user was left with a product that never tried again and gave no
* reason. The comment here claimed the Local Engine settings page cleared it;
* it did not, and nothing else in the codebase ever referenced this key.
*
* Now only success is remembered. Failure is counted instead, so setup retries
* on the next visit but backs off rather than hammering a machine that is
* genuinely unable.
*/
var ENGINE_AUTOSETUP_KEY = "ocade.engine.autosetup.v1";
/** How many failed attempts have been made, so retries can back off. */
var ENGINE_AUTOSETUP_FAILURES = "ocade.engine.autosetup.failures.v1";
/**
* Stop retrying automatically after this many failures.
*
* Not one -- a transient network drop deserves another go. Not unlimited -- a
* machine with no disk space will fail identically every time, and a download
* that restarts on every navigation is worse than one that stops and says so.
*/
var MAX_AUTO_ATTEMPTS = 3;
function failureCount() {
	try {
		return Number(window.localStorage.getItem("ocade.engine.autosetup.failures.v1") ?? "0") || 0;
	} catch {
		return 0;
	}
}
function recordFailure() {
	try {
		window.localStorage.setItem(ENGINE_AUTOSETUP_FAILURES, String(failureCount() + 1));
	} catch {}
}
function clearFailures() {
	try {
		window.localStorage.removeItem(ENGINE_AUTOSETUP_FAILURES);
	} catch {}
}
function alreadyAttempted() {
	try {
		return window.localStorage.getItem(ENGINE_AUTOSETUP_KEY) === "done";
	} catch {
		return false;
	}
}
function markAttempted() {
	try {
		window.localStorage.setItem(ENGINE_AUTOSETUP_KEY, "done");
	} catch {}
}
function FirstRunEngineSetup() {
	const device = useDevicePolicy();
	const brain = useBrain();
	const [preparation, setPreparation] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => subscribeToPreparation(setPreparation), []);
	const [phase, setPhase] = (0, import_react.useState)("idle");
	const [progress, setProgress] = (0, import_react.useState)(null);
	const [selection, setSelection] = (0, import_react.useState)(null);
	const started = (0, import_react.useRef)(false);
	const controller = (0, import_react.useRef)(null);
	const run = (0, import_react.useCallback)(async () => {
		setPhase("checking");
		brain.warm();
		const first = await discoverLocalModels(DEFAULT_LOCAL_BRIDGE_URL);
		if (first.ok && first.models.length > 0) {
			setPhase("done");
			return;
		}
		if (!first.reachable) {
			if (!serverIsThisMachine()) {
				setPhase("done");
				return;
			}
			setPhase("starting");
			try {
				let startResult = await startLocalRuntimeFn();
				if (!startResult.ok && startResult.reason === "binary_not_found") {
					if ((await installLocalRuntimeFn()).ok) startResult = await startLocalRuntimeFn();
				}
				if (!startResult.ok) {
					recordFailure();
					setPhase("unavailable");
					return;
				}
			} catch {
				recordFailure();
				setPhase("unavailable");
				return;
			}
		}
		setSelection(FIXED_MODEL);
		setPhase("downloading");
		controller.current = new AbortController();
		if (!(await pullModel("http://localhost:11434", FIXED_MODEL.id, {
			expectedBytes: FIXED_MODEL.approxBytes,
			signal: controller.current.signal,
			onProgress: setProgress
		})).ok) {
			recordFailure();
			setPhase("done");
			return;
		}
		if (!(await activateModel(FIXED_MODEL.id, {
			runInference: async (id, prompt) => {
				let text = "";
				return {
					ok: (await streamLocalChat("http://localhost:11434", id, [{
						role: "user",
						content: prompt
					}], { onToken: (token) => text += token })).ok,
					text
				};
			},
			runCancellable: async (id) => {
				const abort = new AbortController();
				setTimeout(() => abort.abort(), 800);
				const reply = await streamLocalChat("http://localhost:11434", id, [{
					role: "user",
					content: "Count slowly from 1 to 900, one per line."
				}], {
					onToken: () => {},
					signal: abort.signal
				});
				return { cancelled: reply.ok === false && reply.reason === "cancelled" };
			}
		})).ok) {
			recordFailure();
			setPhase("done");
			return;
		}
		clearFailures();
		markAttempted();
		setPhase("done");
	}, [brain]);
	(0, import_react.useEffect)(() => {
		if (started.current) return;
		if (device.loading) return;
		started.current = true;
		if (!alreadyAttempted() && failureCount() >= MAX_AUTO_ATTEMPTS) {
			setPhase("unavailable");
			return;
		}
		if (alreadyAttempted()) {
			setPhase("done");
			return;
		}
		run();
	}, [device.loading, run]);
	(0, import_react.useEffect)(() => () => controller.current?.abort(), []);
	const browserBusy = preparation?.stage === "checking" || preparation?.stage === "downloading" || preparation?.stage === "loading" || preparation?.stage === "retrying";
	if (!browserBusy && !(phase === "downloading" || phase === "starting") && preparation?.stage !== "unsupported") return null;
	const percent = browserBusy ? preparation?.fraction === null || preparation?.fraction === void 0 ? null : preparation.fraction * 100 : progress?.percent ?? null;
	const label = browserBusy ? describePreparation(preparation) : preparation?.stage === "unsupported" ? describePreparation(preparation) : percent === null ? "Preparing OCADE Intelligence…" : `Preparing OCADE Intelligence — ${Math.round(percent)}%`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none fixed bottom-4 right-4 z-40 w-[min(19rem,calc(100vw-2rem))]",
		role: "status",
		"aria-live": "polite",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-lg backdrop-blur",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate text-[13px] font-medium text-foreground",
						children: label
					})]
				}),
				percent !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 h-1 w-full overflow-hidden rounded-full bg-muted",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-full rounded-full bg-primary transition-all duration-500",
						style: { width: `${Math.min(100, Math.max(0, percent))}%` }
					})
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1.5 text-[11px] leading-snug text-muted-foreground",
					children: preparation?.stage === "unsupported" ? "You can still use everything else. Manage this in Settings › Local Engine." : selection || browserBusy ? "Runs privately on this device. Nothing to install, and you can keep working." : "Getting this device ready."
				})
			]
		})
	});
}
var ITEMS = [
	{
		to: "/ocade",
		label: "Chat",
		icon: MessageSquare,
		exact: true
	},
	{
		to: "/ocade/projects",
		label: "Projects",
		icon: FolderOpen
	},
	{
		to: "/ocade/search",
		label: "Search",
		icon: Search
	},
	{
		to: "/ocade/tasks",
		label: "Tasks",
		icon: ListChecks
	},
	{
		to: "/ocade/system",
		label: "More",
		icon: SlidersHorizontal
	}
];
/**
* Mobile is not a squeezed desktop sidebar. This five-item rail keeps the most
* common destinations thumb-reachable; the complete tool set remains in the
* existing drawer and command palette. Hidden at md+ where WorkspaceShell owns
* navigation. Safe-area padding avoids the iOS home indicator.
*/
function OcadeMobileBottomNav() {
	const { pathname } = useLocation();
	if (!pathname.startsWith("/ocade")) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		"aria-label": "OCADE mobile navigation",
		className: "fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 backdrop-blur-md md:hidden",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mx-auto grid max-w-lg grid-cols-5 gap-1",
			children: ITEMS.map((item) => {
				const active = "exact" in item && item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
				const Icon = item.icon;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: item.to,
					"aria-current": active ? "page" : void 0,
					className: cn("flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium transition-colors", active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label })]
				}) }, item.to);
			})
		})
	});
}
/**
* Integration-managed protected layout. Runs client-only because the Supabase
* session lives in localStorage. All routes under src/routes/_authenticated/
* inherit this gate, plus the onboarding gate below.
*/
function AuthedLayout() {
	const context = Route.useRouteContext();
	const signedIn = Boolean(context?.user);
	(0, import_react.useEffect)(() => {
		if (!signedIn) return;
		registerDeviceForCurrentSession().catch((e) => reportLovableError(e, { boundary: "device_registration" }));
	}, [signedIn]);
	(0, import_react.useEffect)(() => {
		if (!signedIn) return;
		return startSyncLoop();
	}, [signedIn]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SettingsAccessProvider, {
		canEdit: signedIn,
		children: [
			signedIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FirstRunEngineSetup, {}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: signedIn ? "pb-16 md:pb-0" : void 0,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
			}),
			signedIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OcadeMobileBottomNav, {}) : null
		]
	});
}
//#endregion
export { AuthedLayout as component };
