import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { E as Smartphone, M as ShieldCheck, Qn as CircleAlert, Wn as CircleX, Wt as LoaderCircle, Xt as Laptop, Y as RefreshCw, dt as Pencil } from "../_libs/lucide-react.mjs";
import { t as useSession } from "./session-C8v4p4SE.mjs";
import { i as recordAction, n as executeAction, t as ActionConfirmationError } from "./actions-CaB-ibgo.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { t as StatusBadge } from "./StatusBadge-B-3ICXuc.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as useServerFn } from "./useServerFn-CrZF2pjq.mjs";
import { i as revokeDevice, r as renameDevice, t as listDevicesForCurrentUser } from "./devices-ZeXjtcTz.mjs";
import { n as entitlementState, t as canRegisterDevice } from "./ocade-allowance-DRczz3oN.mjs";
import { t as getEntitlement } from "./ocade-usage.functions-DLcfTTgF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.devices-CDIDFLox.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function DevicesPage() {
	const { user } = useSession();
	const [busyId, setBusyId] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [confirmId, setConfirmId] = (0, import_react.useState)(null);
	const [phrase, setPhrase] = (0, import_react.useState)("");
	const [editId, setEditId] = (0, import_react.useState)(null);
	const [editName, setEditName] = (0, import_react.useState)("");
	const fetchEntitlement = useServerFn(getEntitlement);
	const devicesQuery = useQuery({
		queryKey: ["devices", user?.id],
		enabled: !!user?.id,
		queryFn: () => listDevicesForCurrentUser()
	});
	/**
	* The allowance shown must be the allowance enforced. Reading the real
	* subscription rather than passing `null` means a paid plan's extra slots
	* appear here instead of the free-plan default.
	*/
	const entitlementQuery = useQuery({
		queryKey: ["entitlement", user?.id],
		enabled: !!user?.id,
		queryFn: () => fetchEntitlement()
	});
	const devices = devicesQuery.data ?? null;
	const active = (devices ?? []).filter((d) => !d.revoked_at);
	const desktopCount = active.filter((d) => d.kind === "desktop").length;
	const mobileCount = active.filter((d) => d.kind === "mobile").length;
	const ent = entitlementQuery.data ?? null;
	const entitlement = entitlementState(ent ? {
		planId: ent.planId,
		startedAt: new Date(ent.startedAt),
		expiresAt: ent.expiresAt ? new Date(ent.expiresAt) : void 0
	} : null);
	const room = (kind) => canRegisterDevice({
		kind,
		currentDesktop: desktopCount,
		currentMobile: mobileCount,
		state: entitlement
	});
	const desktopRoom = room("desktop");
	const mobileRoom = room("mobile");
	async function onRevoke(d) {
		setBusyId(d.id);
		setError(null);
		try {
			await executeAction("devices.revoke", {
				confirmed: true,
				confirmPhrase: phrase,
				metadata: {
					device_id: d.id,
					kind: d.kind
				},
				run: async () => {
					const res = await revokeDevice(d.id);
					if (res.error) throw new Error(res.error);
				}
			});
			setConfirmId(null);
			setPhrase("");
			await devicesQuery.refetch();
		} catch (e) {
			if (e instanceof ActionConfirmationError) setError("Type \"revoke\" exactly to confirm.");
			else setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusyId(null);
		}
	}
	async function onRename(d) {
		setBusyId(d.id);
		setError(null);
		try {
			const res = await renameDevice(d.id, editName);
			if (res.error) throw new Error(res.error);
			await recordAction({
				actionId: "devices.rename",
				metadata: { device_id: d.id }
			});
			setEditId(null);
			setEditName("");
			await devicesQuery.refetch();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusyId(null);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Account · Devices",
			title: "Approved devices",
			description: "One physical PC counts as one desktop device. Extra browsers on the same PC will share that slot once the Native Companion ships.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/settings",
				className: "inline-flex min-h-[24px] items-center px-1 py-1 text-sm text-muted-foreground hover:text-foreground",
				children: "← Back to Settings"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-4 sm:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Allowance, {
				icon: Laptop,
				label: "Desktop",
				count: desktopCount,
				limit: entitlement.desktopDevices,
				loading: entitlementQuery.isPending || devicesQuery.isPending,
				warning: desktopRoom.allowed ? null : desktopRoom.reason ?? null
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Allowance, {
				icon: Smartphone,
				label: "Mobile",
				count: mobileCount,
				limit: entitlement.mobileDevices,
				loading: entitlementQuery.isPending || devicesQuery.isPending,
				warning: mobileRoom.allowed ? null : mobileRoom.reason ?? null
			})]
		}),
		entitlementQuery.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorRow, {
			message: "Could not read your plan, so the limits above show the default allowance.",
			onRetry: () => void entitlementQuery.refetch()
		}) : null,
		error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			role: "alert",
			className: "mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
			children: error
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
			className: "mt-6 divide-y divide-border/40",
			children: devicesQuery.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Loading devices…"]
			}) : devicesQuery.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorRow, {
					message: devicesQuery.error instanceof Error ? devicesQuery.error.message : "Could not load your devices.",
					onRetry: () => void devicesQuery.refetch()
				})
			}) : (devices ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-6 text-sm text-muted-foreground",
				children: "No devices registered yet. This device will register on next sign-in."
			}) : (devices ?? []).map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 items-center gap-3",
						children: [d.kind === "mobile" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, {
							className: "h-5 w-5 flex-none text-muted-foreground",
							"aria-hidden": true
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Laptop, {
							className: "h-5 w-5 flex-none text-muted-foreground",
							"aria-hidden": true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [editId === d.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										"aria-label": "Device name",
										value: editName,
										onChange: (e) => setEditName(e.target.value),
										className: "w-56 rounded-md border border-border/60 bg-background/50 px-2 py-1 text-sm text-foreground outline-none focus:border-primary/60"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => void onRename(d),
										disabled: busyId === d.id || !editName.trim(),
										className: "rounded-md border border-primary/50 bg-primary/15 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-primary/25 disabled:opacity-60",
										children: "Save"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setEditId(null),
										className: "rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-foreground hover:bg-accent",
										children: "Cancel"
									})
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-sm font-medium text-foreground",
								children: d.name ?? "Unnamed device"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: d.revoked_at ? "planned" : "active" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"Last active",
									" ",
									d.last_active_at ? new Date(d.last_active_at).toLocaleString() : "—"
								] })]
							})]
						})]
					}), d.revoked_at ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground",
						children: "Revoked"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-none items-center gap-2",
						children: [editId === d.id ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								setEditId(d.id);
								setEditName(d.name ?? "");
							},
							className: "inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "h-3.5 w-3.5" }), " Rename"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								setConfirmId(d.id);
								setPhrase("");
								setError(null);
							},
							disabled: busyId === d.id,
							className: "inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60",
							children: [busyId === d.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "h-3.5 w-3.5" }), "Revoke"]
						})]
					})]
				}), confirmId === d.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 rounded-md border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 p-3 text-xs text-foreground",
					children: [
						"Revoking removes an approved access surface. The device stays revoked even if it reconnects, so a lost or stolen device cannot let itself back in. Type",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "revoke" }),
						" to confirm.",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									"aria-label": "Type revoke to confirm",
									value: phrase,
									onChange: (e) => setPhrase(e.target.value),
									className: "w-40 rounded-md border border-border/60 bg-background/50 px-2 py-1 text-xs text-foreground outline-none focus:border-primary/60"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => void onRevoke(d),
									disabled: busyId === d.id,
									className: "inline-flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/15 px-3 py-1 font-medium text-destructive hover:bg-destructive/25 disabled:opacity-60",
									children: [busyId === d.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }) : null, "Revoke device"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setConfirmId(null),
									className: "rounded-md border border-border/60 bg-background/40 px-3 py-1 font-medium text-foreground hover:bg-accent",
									children: "Cancel"
								})
							]
						})
					]
				}) : null]
			}, d.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 flex items-start gap-3 p-4 text-xs text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
				className: "mt-0.5 h-4 w-4 flex-none text-primary",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Cross-browser grants on the same physical PC will consolidate into one desktop slot once the Native Companion is installed (planned slice P35+). Until then, each browser install registers as its own device." })]
		})
	] });
}
function Allowance({ icon: Icon, label, count, limit, loading, warning }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex items-center gap-3 p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
			className: "h-5 w-5 text-primary",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm font-medium text-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs text-muted-foreground",
				children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3 w-3 animate-spin" }), " Reading plan…"]
				}) : `${count} / ${limit} active`
			}),
			!loading && warning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-0.5 text-[11px] text-[color:var(--state-warning)]",
				children: warning
			}) : null
		] })]
	});
}
function ErrorRow({ message, onRetry }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "alert",
		className: "mt-4 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}),
				" ",
				message
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick: onRetry,
			className: "inline-flex items-center gap-1 underline underline-offset-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-3 w-3" }), " Retry"]
		})]
	});
}
//#endregion
export { DevicesPage as component };
