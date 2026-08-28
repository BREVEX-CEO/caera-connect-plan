import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Ht as LockOpen, K as RotateCw, M as ShieldCheck, N as ShieldAlert, Nn as Copy, Qt as KeyRound, Vt as Lock, Wt as LoaderCircle, Y as RefreshCw, gn as FingerprintPattern, h as Trash2, k as Shield, m as TriangleAlert, on as HardDrive } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as useSession } from "./session-VpaXwoLS.mjs";
import { i as recordAction } from "./actions-DmZ4Jhtn.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { t as StatusBadge } from "./StatusBadge-B-3ICXuc.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as modelStore } from "./model-store-BPT0fGRD.mjs";
import { t as clearBenchmarks } from "./tier-benchmark-store-DlIk7w-n.mjs";
import { n as isUnlocked, o as subscribe, r as lock } from "./vault-session-Bh1128Qc.mjs";
import { a as countBrowserVaultRecords, y as webauthnPrfSupported } from "./indexeddb-adapter-D2eAwAIr.mjs";
import { a as setupWithWebAuthn, c as unlockWithWebAuthn, i as setupWithPassphrase, l as updateLockTimeout, n as loadVaultConfig, o as unlockWithPassphrase, r as rotatePassphrase, s as unlockWithRecoveryKit } from "./vault-Bo97usys.mjs";
import { t as LocalIntelligenceControl } from "./LocalIntelligenceControl-BFhpOPNh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.vault-Bk4sr1d5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* What OCADE is keeping in this browser, and the controls to change it.
*
* This is the surface that makes the browser engines honest. Weights are
* hundreds of megabytes; a product that stores them and gives no way to see or
* delete them has taken over part of someone's device without saying so. Every
* control here performs a real operation on real storage — nothing is a
* placeholder.
*
* PERSISTENCE IS ASKED FOR, NOT ASSUMED. Without it the browser may evict the
* weights whenever the device is short of space, so a user who downloaded 400
* MB finds it gone. The browser is allowed to refuse, and a refusal is
* reported as such rather than retried until it looks like it worked.
*/
function formatBytes(bytes) {
	if (bytes === null) return "not reported";
	if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
	if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
	return `${Math.round(bytes / 1024)} KB`;
}
function BrowserStoragePanel() {
	const [report, setReport] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(null);
	const refresh = (0, import_react.useCallback)(async () => {
		setBusy("refresh");
		try {
			setReport(await modelStore.report());
		} finally {
			setBusy(null);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		refresh();
	}, [refresh]);
	const askPersistence = (0, import_react.useCallback)(async () => {
		setBusy("persist");
		try {
			const granted = await modelStore.requestPersistence();
			toast[granted ? "success" : "error"](granted ? "This browser will now keep OCADE's engine between visits." : "The browser declined to make this storage permanent. The engine still works, but it may be cleared when the device runs low on space.");
			setReport(await modelStore.report());
		} finally {
			setBusy(null);
		}
	}, []);
	const removeOne = (0, import_react.useCallback)(async (key) => {
		setBusy(key);
		try {
			const removed = await modelStore.remove(key);
			toast[removed ? "success" : "error"](removed ? "Engine removed from this browser." : "That engine could not be removed.");
			setReport(await modelStore.report());
		} finally {
			setBusy(null);
		}
	}, []);
	const removeAll = (0, import_react.useCallback)(async () => {
		setBusy("all");
		try {
			const { installationAuthority } = await import("./installation-browser-cz2yGPNC.mjs").then((n) => n.n).then((n) => n.n);
			const { removed } = await installationAuthority().uninstall();
			clearBenchmarks();
			toast.success(removed === 0 ? "There was nothing stored to remove." : `Removed ${removed} stored engine${removed === 1 ? "" : "s"}.`);
			setReport(await modelStore.report());
		} finally {
			setBusy(null);
		}
	}, []);
	if (report && !report.supported) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-semibold text-foreground",
					children: "Engine storage"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[13px] text-muted-foreground",
				children: report.problem
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[12px] text-muted-foreground",
				children: "OCADE can still answer if an engine is already loaded for this session — it just cannot keep one here between visits, so it has to be prepared again each time."
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, { className: "h-4 w-4 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold text-foreground",
						children: "Engine storage in this browser"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [report ? report.persistent ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatusBadge, {
						status: "active",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "mr-1 inline h-3 w-3" }), "Permanent"]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatusBadge, {
						status: "setup_required",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "mr-1 inline h-3 w-3" }), "Can be cleared"]
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => void refresh(),
						disabled: busy !== null,
						children: [busy === "refresh" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "mr-2 h-4 w-4" }), "Refresh"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "mt-4 grid gap-2 text-[13px] sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Used by this site"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "text-foreground",
						children: formatBytes(report?.usedBytes ?? null)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Allowed in total"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "text-foreground",
						children: formatBytes(report?.quotaBytes ?? null)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Engines stored"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "text-foreground",
						children: report?.models.length ?? 0
					})] })
				]
			}),
			report && !report.persistent ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 rounded-md border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/5 p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] text-muted-foreground",
					children: "This browser may delete OCADE's engine when the device runs low on space, which would mean downloading it again."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					className: "mt-2",
					onClick: () => void askPersistence(),
					disabled: busy !== null,
					children: [busy === "persist" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }) : null, "Ask the browser to keep it"]
				})]
			}) : null,
			report && report.models.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 divide-y divide-border/60 rounded-md border border-border/60",
				children: report.models.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-center gap-3 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "truncate font-mono text-[12px] text-foreground",
							children: model.key
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatBytes(model.bytes) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: model.verified ? "fingerprint verified" : "not verified" })
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => void removeOne(model.key),
						disabled: busy !== null,
						children: [busy === model.key ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "mr-2 h-4 w-4" }), "Remove"]
					})]
				}, model.key))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-[13px] text-muted-foreground",
				children: "No engine is stored in this browser yet. One is downloaded the first time OCADE needs to answer here without a device engine."
			}),
			report && report.models.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "outline",
				className: "mt-3",
				onClick: () => void removeAll(),
				disabled: busy !== null,
				children: [busy === "all" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-2 h-4 w-4 animate-spin" }) : null, "Remove every stored engine"]
			}) : null
		]
	});
}
function VaultPage() {
	const { user } = useSession();
	const [cfg, setCfg] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [unlocked, setUnlocked] = (0, import_react.useState)(isUnlocked());
	const [count, setCount] = (0, import_react.useState)(null);
	const [recoveryKit, setRecoveryKit] = (0, import_react.useState)(null);
	const [err, setErr] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const refresh = (0, import_react.useCallback)(async () => {
		if (!user) {
			setLoading(false);
			return;
		}
		setLoading(true);
		const c = await loadVaultConfig(user.id);
		setCfg(c);
		setCount(await countBrowserVaultRecords().catch(() => 0));
		setLoading(false);
	}, [user]);
	(0, import_react.useEffect)(() => {
		refresh();
	}, [refresh]);
	(0, import_react.useEffect)(() => subscribe(() => setUnlocked(isUnlocked())), []);
	const run = async (fn, actionId) => {
		setErr(null);
		setBusy(true);
		try {
			await fn();
			if (actionId) await recordAction({ actionId });
			await refresh();
		} catch (e) {
			setErr(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	};
	if (loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2 p-6 text-sm text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Loading…"]
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Privacy and data",
		title: "Browser Vault",
		description: "Conversations kept only on this device, encrypted with a key derived from your passphrase or passkey."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex items-start gap-3 p-5 text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "rounded-md bg-primary/10 p-2 text-primary",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {
				className: "h-4 w-4",
				"aria-hidden": true
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0 space-y-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-foreground",
					children: "A vault belongs to an account, so there is nothing to unlock here yet."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs leading-relaxed text-muted-foreground",
					children: "Once you have one, Browser-Only conversations are encrypted with AES-GCM under a key that never leaves this device. OCADE cannot read them, and neither can anyone holding the database — which is also why a forgotten passphrase cannot be reset for you, only recovered with the recovery kit you save when you set it up."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2 pt-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/auth",
						className: "inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90",
						children: "Create an account"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/settings",
						className: "inline-flex h-8 items-center rounded-md border border-border/60 bg-background/40 px-3 text-xs text-foreground hover:bg-accent",
						children: "Back to Settings"
					})]
				})
			]
		})]
	})] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Account · Vault",
			title: "Browser Vault",
			description: "Encrypts every Browser Only record on this device with AES-GCM. The data key never leaves memory and auto-locks after inactivity.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/settings",
				className: "inline-flex min-h-[24px] items-center px-1 py-1 text-sm text-muted-foreground hover:text-foreground",
				children: "← Back to Settings"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocalIntelligenceControl, {})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrowserStoragePanel, {})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 flex items-start gap-3 p-4 text-xs text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
				className: "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
				"Browser Only data belongs to ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "this browser on this device" }),
				". Clearing site data, uninstalling the browser, or wiping the OS profile will delete it permanently. Losing every unlock method AND the recovery kit makes the encrypted data unrecoverable — CARCC CADANE cannot restore it."
			] })]
		}),
		err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
			children: err
		}) : null,
		recoveryKit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecoveryKitPanel, {
			kit: recoveryKit,
			onClose: () => setRecoveryKit(null)
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
			className: "mt-6 p-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [
					unlocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
						className: "h-5 w-5 text-[color:var(--state-success)]",
						"aria-hidden": true
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {
						className: "h-5 w-5 text-muted-foreground",
						"aria-hidden": true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm font-medium",
							children: cfg ? unlocked ? "Vault unlocked" : "Vault locked" : "Vault not configured"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-xs text-muted-foreground",
							children: [cfg ? `${cfg.credential_kind === "webauthn_prf" ? "WebAuthn (hardware)" : "Passphrase"} · auto-lock ${cfg.lock_timeout_seconds}s` : "Set up encryption to enable Browser Only storage.", count !== null ? ` · ${count} encrypted record${count === 1 ? "" : "s"} on this browser` : null]
						})]
					}),
					cfg && unlocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => run(async () => {
							lock();
						}, "vault.lock"),
						disabled: busy,
						className: "inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs hover:bg-accent",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "h-3.5 w-3.5" }), " Lock now"]
					}) : null
				]
			})
		}),
		!cfg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupPanel, {
			busy,
			onPassphrase: (pw) => run(async () => {
				const r = await setupWithPassphrase(user.id, pw);
				setRecoveryKit(r.recoveryKit);
			}, "vault.setup"),
			onWebAuthn: () => run(async () => {
				const r = await setupWithWebAuthn(user.id, user.email ?? user.id);
				setRecoveryKit(r.recoveryKit);
			}, "vault.setup")
		}) : !unlocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnlockPanel, {
			cfg,
			busy,
			onPassphrase: (pw) => run(() => unlockWithPassphrase(user.id, pw), "vault.unlock"),
			onWebAuthn: () => run(() => unlockWithWebAuthn(user.id), "vault.unlock"),
			onRecovery: (kit) => run(() => unlockWithRecoveryKit(user.id, kit), "vault.recovery_used")
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnlockedPanel, {
			cfg,
			busy,
			onRotate: (pw) => run(() => rotatePassphrase(user.id, pw), "vault.rotate"),
			onTimeout: (s) => run(() => updateLockTimeout(user.id, s))
		})
	] });
}
function RecoveryKitPanel({ kit, onClose }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "mt-4 border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-sm font-semibold text-[color:var(--state-warning)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "h-4 w-4" }), " Recovery kit — save now, we cannot show it again"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-[color:var(--state-warning)]/80",
				children: "Store this in a password manager or print it. If you lose your passphrase or authenticator AND this recovery kit, all Browser Only data on this device becomes permanently unreadable."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "mt-3 select-all rounded-md bg-background/60 p-3 font-mono text-sm tracking-wider text-foreground",
				children: kit
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => navigator.clipboard.writeText(kit),
					className: "inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs hover:bg-accent",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "h-3.5 w-3.5" }), " Copy"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onClose,
					className: "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90",
					children: "I have saved it"
				})]
			})
		]
	});
}
function SetupPanel({ busy, onPassphrase, onWebAuthn }) {
	const [pw, setPw] = (0, import_react.useState)("");
	const [pw2, setPw2] = (0, import_react.useState)("");
	const canPw = pw.length >= 12 && pw === pw2;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "mt-4 p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-sm font-semibold",
				children: "Set up Browser Vault"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Choose one primary unlock method. A recovery kit is always generated as a fallback."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-4 md:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border/40 bg-background/30 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-sm font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FingerprintPattern, { className: "h-4 w-4" }), " WebAuthn (hardware)"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: "Passkey or platform authenticator with the PRF extension. Recommended."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							disabled: busy || !webauthnPrfSupported(),
							onClick: onWebAuthn,
							className: "mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50",
							children: webauthnPrfSupported() ? "Register authenticator" : "Not supported in this browser"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border/40 bg-background/30 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-sm font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "h-4 w-4" }), " Passphrase"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: "PBKDF2-SHA256, 600k iterations. Minimum 12 characters."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							"aria-label": "New vault passphrase",
							type: "password",
							value: pw,
							onChange: (e) => setPw(e.target.value),
							placeholder: "Passphrase",
							className: "mt-2 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							"aria-label": "Repeat vault passphrase",
							type: "password",
							value: pw2,
							onChange: (e) => setPw2(e.target.value),
							placeholder: "Repeat passphrase",
							className: "mt-2 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							disabled: busy || !canPw,
							onClick: () => onPassphrase(pw),
							className: "mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50",
							children: "Create vault"
						})
					]
				})]
			})
		]
	});
}
function UnlockPanel({ cfg, busy, onPassphrase, onWebAuthn, onRecovery }) {
	const [pw, setPw] = (0, import_react.useState)("");
	const [kit, setKit] = (0, import_react.useState)("");
	const [showRecovery, setShowRecovery] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "mt-4 p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockOpen, { className: "h-4 w-4" }), " Unlock"]
			}),
			cfg.credential_kind === "webauthn_prf" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				disabled: busy,
				onClick: onWebAuthn,
				className: "mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FingerprintPattern, { className: "h-3.5 w-3.5" }), " Unlock with authenticator"]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"aria-label": "Vault passphrase",
					type: "password",
					value: pw,
					onChange: (e) => setPw(e.target.value),
					placeholder: "Passphrase",
					className: "flex-1 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					disabled: busy || !pw,
					onClick: () => onPassphrase(pw),
					className: "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50",
					children: "Unlock"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => setShowRecovery((s) => !s),
				className: "mt-4 text-xs text-muted-foreground underline",
				children: showRecovery ? "Hide recovery kit" : "Use recovery kit instead"
			}),
			showRecovery ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"aria-label": "Recovery kit",
					value: kit,
					onChange: (e) => setKit(e.target.value),
					placeholder: "XXXXX-XXXXX-XXXXX-…",
					className: "flex-1 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 font-mono text-xs"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					disabled: busy || !kit,
					onClick: () => onRecovery(kit),
					className: "rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs hover:bg-accent",
					children: "Recover"
				})]
			}) : null
		]
	});
}
function UnlockedPanel({ cfg, busy, onRotate, onTimeout }) {
	const [pw, setPw] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4 grid gap-4 md:grid-cols-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-sm font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCw, { className: "h-4 w-4" }), " Rotate passphrase"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Re-wraps the existing data key. Existing records stay readable."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					"aria-label": "New vault passphrase",
					type: "password",
					value: pw,
					onChange: (e) => setPw(e.target.value),
					placeholder: "New passphrase (min 12)",
					className: "mt-3 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					disabled: busy || pw.length < 12,
					onClick: () => {
						onRotate(pw);
						setPw("");
					},
					className: "mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50",
					children: "Rotate"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-semibold",
					children: "Auto-lock timeout"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Vault locks after this many seconds of inactivity."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					"aria-label": "Auto-lock timeout",
					defaultValue: cfg.lock_timeout_seconds,
					onChange: (e) => onTimeout(Number(e.target.value)),
					className: "mt-3 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: 60,
							children: "1 minute"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: 300,
							children: "5 minutes"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: 900,
							children: "15 minutes"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: 3600,
							children: "1 hour"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: 14400,
							children: "4 hours"
						})
					]
				})
			]
		})]
	});
}
//#endregion
export { VaultPage as component };
