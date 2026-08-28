import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { Ct as MousePointer2, M as ShieldCheck, cr as Camera, sn as Hand, xt as Octagon } from "../_libs/lucide-react.mjs";
import { s as getCompanion, t as COMPANION_UNAVAILABLE_REASON } from "./companion-bridge-CJ48JKAT.mjs";
import { r as bootstrapCompanion } from "./tauri-companion-u0J6qjWn.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/GestureControlPanel-B_ZnCKnK.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var unavailable = {
	available: false,
	running: false,
	controlEnabled: false,
	cameraIndex: null,
	reason: COMPANION_UNAVAILABLE_REASON
};
function message(error) {
	return error instanceof Error ? error.message : "Gesture control did not respond.";
}
/**
* Visible, two-step activation for native hand control.
*
* An ordinary web page can use a camera but cannot move the operating-system
* pointer. This panel therefore reports the real desktop companion state and
* never turns a browser-only button into a pretend success.
*/
function GestureControlPanel() {
	const [status, setStatus] = (0, import_react.useState)(unavailable);
	const [cameraIndex, setCameraIndex] = (0, import_react.useState)(0);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [confirming, setConfirming] = (0, import_react.useState)(false);
	const refresh = (0, import_react.useCallback)(async () => {
		const boot = await bootstrapCompanion();
		if (!boot.installed) {
			setStatus({
				...unavailable,
				reason: boot.reason
			});
			return;
		}
		setStatus(await getCompanion().gestureStatus());
	}, []);
	(0, import_react.useEffect)(() => {
		refresh().catch((error) => setStatus({
			...unavailable,
			reason: message(error)
		}));
	}, [refresh]);
	(0, import_react.useEffect)(() => {
		if (!status.running) return;
		const timer = window.setInterval(() => void refresh().catch(() => void 0), 1500);
		return () => window.clearInterval(timer);
	}, [refresh, status.running]);
	async function start(enableControl) {
		setBusy(true);
		try {
			const next = await getCompanion().startGestureControl({
				cameraIndex,
				enableControl
			});
			setStatus(next);
			setConfirming(false);
			toast.success(enableControl ? "Hand cursor control is active." : "Hand preview is running.");
		} catch (error) {
			toast.error(message(error));
			await refresh().catch(() => void 0);
		} finally {
			setBusy(false);
		}
	}
	async function stop() {
		setBusy(true);
		try {
			setStatus(await getCompanion().stopGestureControl());
			setConfirming(false);
			toast.success("Hand control stopped and the mouse button was released.");
		} catch (error) {
			toast.error(message(error));
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-5",
		"data-testid": "gesture-control-panel",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.03]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hand, {
							className: "h-5 w-5",
							"aria-hidden": true
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-foreground",
							children: "Hand gesture control"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[13px] text-muted-foreground",
							children: "MediaPipe reads the webcam locally. Frames are displayed for you, then discarded; they are not uploaded or recorded."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `rounded-full border px-2.5 py-1 text-[11px] ${status.controlEnabled ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]" : status.running ? "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]" : "border-white/10 text-muted-foreground"}`,
						children: status.controlEnabled ? "Cursor active" : status.running ? "Preview only" : "Stopped"
					})
				]
			}),
			!status.available ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 rounded-lg border border-[color:var(--state-warning)]/25 bg-[color:var(--state-warning)]/[0.06] p-3 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium text-foreground",
					children: "Desktop app required"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1",
					children: status.reason ?? "This build does not contain the gesture-control sidecar."
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center gap-2 text-xs text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, {
							className: "h-4 w-4",
							"aria-hidden": true
						}),
						" Camera",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: cameraIndex,
							onChange: (event) => setCameraIndex(Number(event.target.value)),
							disabled: busy || status.running,
							className: "h-9 rounded-md border border-white/10 bg-black/30 px-2 text-foreground",
							"aria-label": "Gesture camera",
							children: [
								0,
								1,
								2,
								3
							].map((index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: index,
								children: index + 1
							}, index))
						})
					]
				}), status.running ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "destructive",
					onClick: () => void stop(),
					disabled: busy,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Octagon, {
						className: "mr-2 h-4 w-4",
						"aria-hidden": true
					}), " Stop hand control"]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "outline",
					onClick: () => void start(false),
					disabled: busy,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, {
						className: "mr-2 h-4 w-4",
						"aria-hidden": true
					}), " Test preview"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => setConfirming(true),
					disabled: busy,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MousePointer2, {
						className: "mr-2 h-4 w-4",
						"aria-hidden": true
					}), " Activate cursor"]
				})] })]
			}), confirming && !status.running ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 rounded-lg border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/[0.06] p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
						className: "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium text-foreground",
							children: "Allow hand control?"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: "Your index finger will move the system cursor. Pinching can click and drag in every application, including File Explorer. Keep the preview visible and press Esc, Q or Ctrl+Shift+F12 to stop immediately."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								onClick: () => void start(true),
								disabled: busy,
								children: "Activate now"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "ghost",
								onClick: () => setConfirming(false),
								children: "Cancel"
							})]
						})
					] })]
				})
			}) : null] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "text-foreground",
						children: "Move:"
					}), " point with your index finger."] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "text-foreground",
						children: "Select:"
					}), " short thumb/index pinch."] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "text-foreground",
						children: "Drag files:"
					}), " hold that pinch, move, release."] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "text-foreground",
						children: "Open:"
					}), " thumb/middle pinch for double-click."] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "text-foreground",
						children: "Scroll:"
					}), " index and middle up; move vertically."] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "text-foreground",
						children: "Delete:"
					}), " intentionally not mapped to a gesture."] })
				]
			})
		]
	});
}
//#endregion
export { GestureControlPanel as t };
