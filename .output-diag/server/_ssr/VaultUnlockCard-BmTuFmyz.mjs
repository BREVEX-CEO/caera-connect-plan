import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Ht as LockOpen, Wt as LoaderCircle, gn as FingerprintPattern } from "../_libs/lucide-react.mjs";
import { t as useSession } from "./session-VpaXwoLS.mjs";
import { i as recordAction } from "./actions-DmZ4Jhtn.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { n as isUnlocked, o as subscribe } from "./vault-session-Bh1128Qc.mjs";
import { c as unlockWithWebAuthn, n as loadVaultConfig, o as unlockWithPassphrase, s as unlockWithRecoveryKit } from "./vault-Bo97usys.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/VaultUnlockCard-BmTuFmyz.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* UNLOCK WHERE THE LOCK BITES, NOT TWO SCREENS AWAY.
*
* The vault key is held in memory and nowhere else — deliberately, and it is
* the strongest privacy property this product has: nothing on disk can be
* decrypted without a person present. The cost is that the key is gone on
* every page load, and a page load is not an unusual event. A refresh, a link
* opened in a new tab, closing the laptop lid, coming back tomorrow: each one
* lands somebody in a workspace where Projects, files and saved outputs cannot
* be read.
*
* What the product did with that was name a Settings page. The person is on
* Projects, looking at a panel that says their work is locked, and the way
* back to it is to leave, find Settings, find Vault inside it, type a
* passphrase, and navigate back — and if they take the direct route and reload
* the page they have just started over, because that reload dropped the key
* again.
*
* So the unlock is here instead, on whatever surface needed it. Same three
* credentials the Settings screen offers, same functions behind them; the only
* difference is that using it does not cost the page you were on.
*/
function VaultUnlockCard({ what = "Your saved records", onUnlocked }) {
	const { user } = useSession();
	const [cfg, setCfg] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [passphrase, setPassphrase] = (0, import_react.useState)("");
	const [kit, setKit] = (0, import_react.useState)("");
	const [showRecovery, setShowRecovery] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!user) return;
		let live = true;
		loadVaultConfig(user.id).then((row) => {
			if (live) setCfg(row);
		}).catch(() => {}).finally(() => {
			if (live) setLoading(false);
		});
		return () => {
			live = false;
		};
	}, [user]);
	(0, import_react.useEffect)(() => subscribe(() => {
		if (isUnlocked()) onUnlocked?.();
	}), [onUnlocked]);
	async function run(action, event) {
		setBusy(true);
		setError(null);
		try {
			await action();
			recordAction({ actionId: event });
			setPassphrase("");
			setKit("");
			onUnlocked?.();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not unlock the vault.");
		} finally {
			setBusy(false);
		}
	}
	if (!user) return null;
	if (loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex items-center gap-2 p-4 text-xs text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
			className: "h-4 w-4 animate-spin",
			"aria-hidden": true
		}), " Checking this browser's vault…"]
	});
	if (!cfg) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-sm font-semibold text-foreground",
				children: "This browser has no vault yet"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: [what, " never leave this device unencrypted, and that needs a key this browser does not have yet. Setting one up hands you a recovery kit to keep."]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/settings/vault",
				className: "mt-3 inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90",
				children: "Set up the vault"
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-sm font-semibold text-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockOpen, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Unlock this browser's vault"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: [what, " never leave this device unencrypted, and the key that opens them is never written down — so it is asked for again after every page load."]
			}),
			cfg.credential_kind === "webauthn_prf" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				disabled: busy,
				onClick: () => void run(() => unlockWithWebAuthn(user.id), "vault.unlock"),
				className: "mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FingerprintPattern, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}), " Unlock with authenticator"]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3 flex gap-2",
				onSubmit: (event) => {
					event.preventDefault();
					if (passphrase) run(() => unlockWithPassphrase(user.id, passphrase), "vault.unlock");
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"aria-label": "Vault passphrase",
					type: "password",
					autoComplete: "current-password",
					value: passphrase,
					onChange: (event) => setPassphrase(event.target.value),
					placeholder: "Passphrase",
					className: "min-w-0 flex-1 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					disabled: busy || !passphrase,
					className: "shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50",
					children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
						className: "h-3.5 w-3.5 animate-spin",
						"aria-hidden": true
					}) : "Unlock"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setShowRecovery((current) => !current),
				className: "mt-3 text-xs text-muted-foreground underline",
				children: showRecovery ? "Hide recovery kit" : "Use recovery kit instead"
			}),
			showRecovery ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"aria-label": "Recovery kit",
					value: kit,
					onChange: (event) => setKit(event.target.value),
					placeholder: "XXXXX-XXXXX-XXXXX-…",
					className: "min-w-0 flex-1 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: busy || !kit,
					onClick: () => void run(() => unlockWithRecoveryKit(user.id, kit), "vault.recovery_used"),
					className: "shrink-0 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50",
					children: "Unlock"
				})]
			}) : null,
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "mt-3 text-xs text-[color:var(--state-danger)]",
				children: error
			}) : null
		]
	});
}
//#endregion
export { VaultUnlockCard as t };
