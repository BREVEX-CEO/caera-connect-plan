import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-D46NpEQY.mjs";
import { _ as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { E as Smartphone, M as ShieldCheck, Qn as CircleAlert, Qt as KeyRound, Rt as Mail, Wt as LoaderCircle, Y as RefreshCw, zt as LogOut } from "../_libs/lucide-react.mjs";
import { t as useSession } from "./session-VpaXwoLS.mjs";
import { i as recordAction, n as executeAction, t as ActionConfirmationError } from "./actions-DmZ4Jhtn.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as listDevicesForCurrentUser } from "./devices-WauG9lZl.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.security-DeahnEdK.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SECURITY_ACTIONS = [
	"auth.sign_in",
	"auth.sign_out",
	"security.password_change",
	"security.sign_out_all",
	"devices.register",
	"devices.revoke",
	"devices.rename",
	"vault.setup",
	"vault.unlock",
	"vault.lock",
	"vault.rotate",
	"vault.recovery_used",
	"account.delete"
];
var inputCls = "w-full rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/60";
function SecurityPage() {
	const { user } = useSession();
	const navigate = useNavigate();
	const [currentPw, setCurrentPw] = (0, import_react.useState)("");
	const [pw, setPw] = (0, import_react.useState)("");
	const [pw2, setPw2] = (0, import_react.useState)("");
	const [pwBusy, setPwBusy] = (0, import_react.useState)(false);
	const [pwMsg, setPwMsg] = (0, import_react.useState)(null);
	const [resetBusy, setResetBusy] = (0, import_react.useState)(false);
	const [resetMsg, setResetMsg] = (0, import_react.useState)(null);
	const [confirmGlobal, setConfirmGlobal] = (0, import_react.useState)(false);
	const [globalBusy, setGlobalBusy] = (0, import_react.useState)(false);
	const [globalError, setGlobalError] = (0, import_react.useState)(null);
	const identities = useQuery({
		queryKey: [
			"security",
			"identities",
			user?.id
		],
		enabled: !!user?.id,
		queryFn: async () => {
			const { data, error } = await supabase.auth.getUser();
			if (error) throw error;
			const u = data.user;
			return {
				email: u?.email ?? null,
				phone: u?.phone ?? null,
				emailConfirmed: !!u?.email_confirmed_at,
				lastSignInAt: u?.last_sign_in_at ?? null,
				providers: (u?.identities ?? []).map((i) => i.provider)
			};
		}
	});
	const devices = useQuery({
		queryKey: [
			"security",
			"devices",
			user?.id
		],
		enabled: !!user?.id,
		queryFn: async () => {
			return (await listDevicesForCurrentUser()).filter((d) => !d.revoked_at);
		}
	});
	const events = useQuery({
		queryKey: [
			"security",
			"events",
			user?.id
		],
		enabled: !!user?.id,
		queryFn: async () => {
			const [op, comp] = await Promise.all([supabase.from("activity_log").select("id, created_at, action").in("action", SECURITY_ACTIONS).order("created_at", { ascending: false }).limit(25), supabase.from("compliance_audit_log").select("id, created_at, action").in("action", SECURITY_ACTIONS).order("created_at", { ascending: false }).limit(25)]);
			if (op.error) throw op.error;
			if (comp.error) throw comp.error;
			return [...(op.data ?? []).map((r) => ({
				...r,
				source: "operational"
			})), ...(comp.data ?? []).map((r) => ({
				...r,
				source: "compliance"
			}))].sort((a, b) => a.created_at < b.created_at ? 1 : -1).slice(0, 25);
		}
	});
	async function changePassword() {
		setPwMsg(null);
		if (pw.length < 10) {
			setPwMsg({
				kind: "error",
				text: "Use at least 10 characters."
			});
			return;
		}
		if (pw !== pw2) {
			setPwMsg({
				kind: "error",
				text: "The two passwords do not match."
			});
			return;
		}
		setPwBusy(true);
		try {
			const email = identities.data?.email;
			if (!email) throw new Error("OCADE cannot confirm this account's email address, so it will not change the password from here. Use the emailed reset link instead.");
			const { error: reauth } = await supabase.auth.signInWithPassword({
				email,
				password: currentPw
			});
			if (reauth) throw new Error("That current password did not match. If you have never set one — you sign in with Google, Apple or a one-time code — use “Email me a reset link” below instead.");
			const { error } = await supabase.auth.updateUser({ password: pw });
			if (error) throw error;
			setCurrentPw("");
			setPw("");
			setPw2("");
			setPwMsg({
				kind: "success",
				text: "Password updated on this account."
			});
			await recordAction({ actionId: "security.password_change" });
			events.refetch();
		} catch (e) {
			setPwMsg({
				kind: "error",
				text: e instanceof Error ? e.message : String(e)
			});
		} finally {
			setPwBusy(false);
		}
	}
	async function sendReset() {
		const email = identities.data?.email;
		if (!email) return;
		setResetBusy(true);
		setResetMsg(null);
		try {
			const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
			if (error) throw error;
			setResetMsg({
				kind: "success",
				text: `Reset link sent to ${email}.`
			});
		} catch (e) {
			setResetMsg({
				kind: "error",
				text: e instanceof Error ? e.message : String(e)
			});
		} finally {
			setResetBusy(false);
		}
	}
	async function signOutEverywhere() {
		setGlobalBusy(true);
		setGlobalError(null);
		try {
			await executeAction("security.sign_out_all", {
				confirmed: true,
				metadata: { active_devices: devices.data?.length ?? null },
				run: async () => {
					const { error } = await supabase.auth.signOut({ scope: "global" });
					if (error) throw error;
				}
			});
			try {
				window.localStorage.clear();
			} catch {}
			navigate({
				to: "/auth",
				replace: true
			});
		} catch (e) {
			if (e instanceof ActionConfirmationError) setGlobalError("Confirmation was not accepted.");
			else setGlobalError(e instanceof Error ? e.message : String(e));
			setGlobalBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Account · Security",
			title: "Security",
			description: "Sign-in methods, password, active sessions and the security events recorded on this account.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/settings",
				className: "inline-flex min-h-[24px] items-center px-1 py-1 text-sm text-muted-foreground hover:text-foreground",
				children: "← Back to Settings"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-6 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
				icon: ShieldCheck,
				title: "Sign-in methods"
			}), identities.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Loading, { label: "Reading account…" }) : identities.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorRow, {
				message: identities.error instanceof Error ? identities.error.message : "Could not load.",
				onRetry: () => void identities.refetch()
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "mt-4 grid gap-3 text-sm sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, {
						label: "Email",
						children: [identities.data.email ?? "—", identities.data.email ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-2 text-xs text-muted-foreground",
							children: identities.data.emailConfirmed ? "verified" : "not verified"
						}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Phone",
						children: identities.data.phone || "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Linked providers",
						children: identities.data.providers.length ? identities.data.providers.join(", ") : "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Last sign-in",
						children: identities.data.lastSignInAt ? new Date(identities.data.lastSignInAt).toLocaleString() : "—"
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
					icon: KeyRound,
					title: "Password"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Setting a password does not remove Google or OTP sign-in — it adds another way in."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid gap-3 sm:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "grid gap-1.5 sm:col-span-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted-foreground",
									children: "Current password"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "password",
									autoComplete: "current-password",
									value: currentPw,
									onChange: (e) => setCurrentPw(e.target.value),
									className: inputCls,
									"aria-label": "Current password"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[11px] text-muted-foreground",
									children: "Asked for so that somebody who finds this browser signed in cannot take the account over. No password yet? Use the reset link below."
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-muted-foreground",
								children: "New password"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "password",
								autoComplete: "new-password",
								value: pw,
								onChange: (e) => setPw(e.target.value),
								className: inputCls,
								"aria-label": "New password"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "grid gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-muted-foreground",
								children: "Repeat new password"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "password",
								autoComplete: "new-password",
								value: pw2,
								onChange: (e) => setPw2(e.target.value),
								className: inputCls,
								"aria-label": "Repeat new password"
							})]
						})
					]
				}),
				pwMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Msg, {
					kind: pwMsg.kind,
					text: pwMsg.text
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => void changePassword(),
						disabled: pwBusy || !pw || !pw2 || !currentPw,
						className: "inline-flex items-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/25 disabled:opacity-60",
						children: [pwBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }) : null, "Update password"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => void sendReset(),
						disabled: resetBusy || !identities.data?.email,
						className: "inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60",
						children: [resetBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "h-3.5 w-3.5" }), "Email me a reset link"]
					})]
				}),
				resetMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Msg, {
					kind: resetMsg.kind,
					text: resetMsg.text
				}) : null
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
					icon: Smartphone,
					title: "Active sessions and devices"
				}),
				devices.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Loading, { label: "Reading devices…" }) : devices.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorRow, {
					message: devices.error instanceof Error ? devices.error.message : "Could not load.",
					onRetry: () => void devices.refetch()
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 text-sm text-muted-foreground",
					children: [
						devices.data.length,
						" approved device",
						devices.data.length === 1 ? "" : "s",
						".",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings/devices",
							className: "text-foreground underline underline-offset-2",
							children: "Manage devices"
						})
					]
				}),
				globalError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Msg, {
					kind: "error",
					text: globalError
				}) : null,
				confirmGlobal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 rounded-md border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 p-3 text-xs text-foreground",
					children: ["This ends every session on every device, including this one. You will be signed out immediately.", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => void signOutEverywhere(),
							disabled: globalBusy,
							className: "inline-flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/15 px-3 py-1.5 font-medium text-destructive hover:bg-destructive/25 disabled:opacity-60",
							children: [globalBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }) : null, "Yes, sign out everywhere"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setConfirmGlobal(false),
							disabled: globalBusy,
							className: "rounded-md border border-border/60 bg-background/40 px-3 py-1.5 font-medium text-foreground hover:bg-accent",
							children: "Cancel"
						})]
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => setConfirmGlobal(true),
					className: "mt-4 inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "h-3.5 w-3.5" }), "Sign out of all devices"]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heading, {
					icon: ShieldCheck,
					title: "Recent security events"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => void events.refetch(),
					className: "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-3 w-3" }), " Refresh"]
				})]
			}), events.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Loading, { label: "Reading logs…" }) : events.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorRow, {
				message: events.error instanceof Error ? events.error.message : "Could not load.",
				onRetry: () => void events.refetch()
			}) : events.data.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted-foreground",
				children: "No security events recorded on this account yet."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border/40 text-sm",
				children: events.data.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-foreground",
						children: e.action
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs text-muted-foreground",
						children: [e.source === "compliance" ? "compliance · " : "", new Date(e.created_at).toLocaleString()]
					})]
				}, `${e.source}-${e.id}`))
			})]
		})
	] });
}
function Heading({ icon: Icon, title }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
			className: "h-4 w-4 text-primary",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "text-sm font-semibold text-foreground",
			children: title
		})]
	});
}
function Row({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
		className: "text-xs text-muted-foreground",
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
		className: "mt-0.5 text-foreground",
		children
	})] });
}
function Loading({ label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-3 flex items-center gap-2 text-sm text-muted-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
				className: "h-4 w-4 animate-spin",
				"aria-hidden": true
			}),
			" ",
			label
		]
	});
}
function ErrorRow({ message, onRetry }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "alert",
		className: "mt-3 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
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
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			onClick: onRetry,
			className: "underline underline-offset-2",
			children: "Retry"
		})]
	});
}
function Msg({ kind, text }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: kind === "error" ? "alert" : "status",
		className: kind === "error" ? "mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" : "mt-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground",
		children: text
	});
}
//#endregion
export { SecurityPage as component };
