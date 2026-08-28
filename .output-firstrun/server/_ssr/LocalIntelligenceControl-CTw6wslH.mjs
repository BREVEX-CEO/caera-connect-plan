import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as useInstallation } from "./use-installation-CjTc3LjR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/LocalIntelligenceControl-CTw6wslH.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Remove — or put back — the intelligence OCADE stores on this device.
*
* WHY IT IS ONE COMPONENT USED IN THREE PLACES. The brief asks for this control
* on the public landing page, in signed-in Settings, and on the storage screen.
* Three implementations would be three chances for one of them to remove a
* slightly different set of things, and the one that removed too much would be
* discovered by somebody losing their conversations. There is one uninstall
* operation, owned by the installation authority, and this is its one button.
*
* WHAT IT IS CAREFUL TO SEPARATE. "Remove OCADE Intelligence" is not "Delete
* account" and not "Clear conversations". It removes model artifacts, staging
* leftovers, version metadata and the pointer that names the active version —
* and nothing else. The copy says so, because a destructive control that is
* vague about its blast radius is one people either avoid or regret.
*
* WHAT IT DOES NOT CLAIM. A web page cannot clear another site's storage, see
* the device's free disk, or open the browser's own settings. So it points at
* those controls rather than pretending to operate them.
*/
/**
* The quiet inline control on the landing page.
*
* `inline-flex` with a 24px minimum, and NOT just an underlined span.
*
* The first version was styled as a plain text link and measured 93x16 on a
* phone — under the 24x24 minimum a finger can reliably hit, which the route
* audit caught on both the signed-out and signed-in passes. A destructive
* control that is hard to tap is worse than one that is merely ugly: the near
* misses land on whatever is next to it.
*
* The negative margin keeps the visual rhythm of the footer line while the hit
* area grows past it, so it still reads as a quiet inline link.
*/
var QUIET_LINK = "-my-1 inline-flex min-h-6 items-center underline underline-offset-2 hover:text-foreground disabled:opacity-60";
function formatBytes(bytes) {
	if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
	if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
	return `${Math.round(bytes / 1024)} KB`;
}
function LocalIntelligenceControl({ variant = "full", className }) {
	const { state, ready, preparing, line } = useInstallation();
	const [confirming, setConfirming] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [installedBytes, setInstalledBytes] = (0, import_react.useState)(null);
	const refresh = (0, import_react.useCallback)(async () => {
		try {
			const { modelVault } = await import("./model-vault-Cdwm-pAI.mjs").then((n) => n.n).then((n) => n.n);
			const versions = await modelVault.listVersions();
			setInstalledBytes(versions.reduce((total, version) => total + version.bytes, 0));
		} catch {
			setInstalledBytes(null);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		refresh();
	}, [refresh, state.stage]);
	const remove = (0, import_react.useCallback)(async () => {
		setBusy(true);
		try {
			const { installationAuthority } = await import("./installation-browser-uqj4-qxw.mjs").then((n) => n.n).then((n) => n.n);
			const result = await installationAuthority().uninstall();
			await refresh();
			setConfirming(false);
			toast.success("OCADE Intelligence removed from this device.", { description: result.removed > 0 ? "Your conversations and your account are untouched." : "There was nothing stored here to remove." });
		} finally {
			setBusy(false);
		}
	}, [refresh]);
	const reinstall = (0, import_react.useCallback)(async () => {
		setBusy(true);
		try {
			const { installationAuthority } = await import("./installation-browser-uqj4-qxw.mjs").then((n) => n.n).then((n) => n.n);
			installationAuthority().reinstall();
			toast.info("Preparing OCADE on this device…");
		} finally {
			setBusy(false);
		}
	}, []);
	const hasSomething = (installedBytes ?? 0) > 0 || ready;
	if (variant === "compact") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("text-xs text-muted-foreground", className),
		"data-testid": "local-intelligence-control",
		"data-stage": state.stage,
		children: state.problem && !hasSomething ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [line, " "] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: reinstall,
			disabled: busy || preparing,
			className: QUIET_LINK,
			children: preparing ? "Preparing…" : "Try again"
		})] }) : hasSomething ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "OCADE keeps its intelligence on this device. " }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setConfirming(true),
				className: QUIET_LINK,
				children: "Uninstall OCADE Intelligence"
			}),
			confirming ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfirmRemoval, {
				busy,
				bytes: installedBytes,
				onCancel: () => setConfirming(false),
				onConfirm: remove
			}) : null
		] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "OCADE Intelligence is not installed on this device. " }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: reinstall,
			disabled: busy || preparing,
			className: QUIET_LINK,
			children: preparing ? "Preparing…" : "Reinstall OCADE"
		})] })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("rounded-xl border border-border/60 bg-secondary/25 p-4", className),
		"data-testid": "local-intelligence-control",
		"data-stage": state.stage,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium text-foreground",
				children: "OCADE Intelligence on this device"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-[13px] leading-6 text-muted-foreground",
				children: [ready ? "Ready. OCADE answers on this device, and works with no connection." : preparing || state.problem ? line : "Not installed on this device.", installedBytes !== null && installedBytes > 0 ? ` Using ${formatBytes(installedBytes)} of local storage.` : ""]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: hasSomething ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					onClick: () => setConfirming(true),
					disabled: busy,
					children: "Remove OCADE Intelligence"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					onClick: reinstall,
					disabled: busy || preparing,
					children: preparing ? "Preparing…" : "Reinstall OCADE"
				})
			}),
			confirming ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfirmRemoval, {
				busy,
				bytes: installedBytes,
				onCancel: () => setConfirming(false),
				onConfirm: remove
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-[11.5px] leading-5 text-muted-foreground",
				children: "You can also clear OCADE's site data from your browser or device settings. OCADE cannot reach another site's storage or your device's own controls, so that part is yours to do. Removing OCADE Intelligence here never touches your conversations, your account, or anything else on this device."
			})
		]
	});
}
/**
* The confirmation, which states the consequence rather than asking "are you
* sure".
*
* "Are you sure" is a question nobody can answer usefully, because it does not
* say what happens. The two things a person needs are: what will be gone, and
* what will not.
*/
function ConfirmRemoval({ busy, bytes, onCancel, onConfirm }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-3 rounded-lg border border-border bg-background/80 p-3 text-left",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[13px] leading-6 text-foreground",
				children: [
					"This removes OCADE's intelligence from this device",
					bytes !== null && bytes > 0 ? `, freeing about ${formatBytes(bytes)}` : "",
					". OCADE will stop working without a connection here until you install it again."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-[12px] leading-5 text-muted-foreground",
				children: "Your conversations, your account and your settings are not affected."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "destructive",
					onClick: onConfirm,
					disabled: busy,
					children: busy ? "Removing…" : "Remove"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "ghost",
					onClick: onCancel,
					disabled: busy,
					children: "Keep it"
				})]
			})
		]
	});
}
//#endregion
export { LocalIntelligenceControl as t };
