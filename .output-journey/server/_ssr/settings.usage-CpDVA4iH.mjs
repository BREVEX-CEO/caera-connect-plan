import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-YIOAnk22.mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Dt as MonitorSmartphone, On as Download, Z as ReceiptText, dn as Gauge, on as HardDrive, vn as FileText } from "../_libs/lucide-react.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as FREE_LAUNCH_NOTICE } from "./launch-mode-5950-vrz.mjs";
import { t as SetupRequiredState } from "./SetupRequiredState-CYfm-mjI.mjs";
import { t as classifyUnavailable } from "./unavailable-reason-BKLY-mVD.mjs";
import { t as useOnline } from "./use-online-DzqlfJYh.mjs";
import { t as useLocalEngine } from "./use-local-engine-CVYmYOFn.mjs";
import { n as inspect } from "./use-limits-hIa_un-u.mjs";
import { t as PlanComparison } from "./PlanComparison-CDAo4BIV.mjs";
import { n as entitlementState, r as offlineEntitlementValid } from "./ocade-allowance-DRczz3oN.mjs";
import { t as getEntitlement } from "./ocade-usage.functions-DLcfTTgF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.usage-CpDVA4iH.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function money(amountMinor, currency) {
	return new Intl.NumberFormat(void 0, {
		style: "currency",
		currency,
		maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2
	}).format(amountMinor / 100);
}
function BillingHistory() {
	const history = useQuery({
		queryKey: ["billing-history", "mine"],
		queryFn: async () => {
			const [payments, invoices] = await Promise.all([supabase.from("ocade_payment_events").select("id, provider, kind, status, amount_minor, currency, occurred_at, plan_id").order("occurred_at", { ascending: false }).limit(28), supabase.from("ocade_invoices").select("id, invoice_number, status, amount_minor, tax_minor, currency, issued_at, receipt_url").order("issued_at", { ascending: false }).limit(28)]);
			if (payments.error) throw payments.error;
			if (invoices.error) throw invoices.error;
			return {
				payments: payments.data ?? [],
				invoices: invoices.data ?? []
			};
		},
		retry: false
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReceiptText, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Payments and invoices"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Provider references, status, totals and your receipt copy appear here. OCADE never stores full card or UPI credentials."
			}),
			history.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground",
				children: "Billing history is prepared but its production database migration is not available in this environment yet. Live charging is disabled."
			}) : null,
			history.data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
					className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
					children: "Payment history"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 space-y-2",
					children: [history.data.payments.map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "rounded-lg border border-border/60 p-3 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium text-foreground",
								children: money(Number(event.amount_minor), event.currency)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: event.status })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-muted-foreground",
							children: [
								event.provider,
								" · ",
								event.kind,
								" · ",
								event.plan_id,
								" ·",
								` `,
								new Date(event.occurred_at).toLocaleString()
							]
						})]
					}, event.id)), history.data.payments.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground",
						children: "No payments yet."
					}) : null]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
					className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
					children: "Invoice copies"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 space-y-2",
					children: [history.data.invoices.map((invoice) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "rounded-lg border border-border/60 p-3 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-1.5 font-medium text-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "h-3.5 w-3.5" }),
									" ",
									invoice.invoice_number
								]
							}), invoice.receipt_url ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: invoice.receipt_url,
								target: "_blank",
								rel: "noreferrer",
								className: "flex items-center gap-1 text-primary hover:underline",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "h-3.5 w-3.5" }), " Copy"]
							}) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-muted-foreground",
							children: [
								money(Number(invoice.amount_minor), invoice.currency),
								" · tax",
								` `,
								money(Number(invoice.tax_minor), invoice.currency),
								" · ",
								invoice.status,
								" ·",
								` `,
								new Date(invoice.issued_at).toLocaleDateString()
							]
						})]
					}, invoice.id)), history.data.invoices.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground",
						children: "No invoices yet."
					}) : null]
				})] })]
			}) : null
		]
	});
}
/**
* How much OCADE has done recently, said in a way that is worth reading.
*
* WHY THIS IS SHOWN AT ALL, GIVEN THE PRODUCT IS FREE
* ---------------------------------------------------
* Not as a meter, and not as an upsell. There is a resource governor in the
* product — it stops a loop that got away from consuming the device — and a
* limit that can stop somebody's work while being invisible until the moment it
* does is a limit that reads as a fault. This is where a person can look before
* that happens.
*
* It shows a bar rather than a number of "credits", because credits imply a
* currency and there is none: nobody is charged, nothing is deducted from an
* allowance anybody bought, and the counter resets by itself.
*
* WHAT IT DOES NOT SAY. The window durations. "This session" and "today" are
* what the numbers mean; "5h / 8h / 28h rolling windows" is what they are
* implemented as, and a settings page is not the place for that. Advanced
* diagnostics has the exact figures.
*/
var BUCKETS = [
	{
		id: "inference",
		label: "Conversations and tasks",
		detail: "Answers, thinking and work OCADE does on this device."
	},
	{
		id: "research",
		label: "Looking things up",
		detail: "Fetching current information from the web."
	},
	{
		id: "control",
		label: "Using this computer",
		detail: "Actions OCADE takes on your machine."
	}
];
function ActivityAllowance() {
	const [readings, setReadings] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const read = () => setReadings(Object.fromEntries(BUCKETS.map((bucket) => [bucket.id, inspect(bucket.id)])));
		read();
		const timer = window.setInterval(read, 3e4);
		return () => window.clearInterval(timer);
	}, []);
	if (!readings) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex items-center gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gauge, {
				className: "h-4 w-4 text-primary",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-sm font-semibold text-foreground",
				children: "Recent activity"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: "OCADE paces heavy work so one runaway job cannot tie up your device. Nothing here is billed, and it clears on its own."
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "flex flex-col gap-4",
			children: BUCKETS.map((bucket) => {
				const decision = readings[bucket.id];
				if (!decision) return null;
				const tightest = decision.windows.reduce((a, b) => a.utilization >= b.utilization ? a : b);
				const pct = Math.round(tightest.utilization * 100);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm text-foreground",
							children: bucket.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs tabular-nums text-muted-foreground",
							children: pct < 1 ? "Barely used" : `${pct}% of what OCADE allows ${tightest.label}`
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary/40",
						role: "progressbar",
						"aria-valuenow": pct,
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-label": `${bucket.label}: ${pct}% used ${tightest.label}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: cn("h-full rounded-full transition-[width] duration-500", decision.outcome === "rejected" ? "bg-destructive" : decision.outcome === "allowed_warning" ? "bg-primary" : "bg-primary/50"),
							style: { width: `${Math.max(2, pct)}%` }
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[11.5px] text-muted-foreground",
						children: decision.message ?? bucket.detail
					})
				] }, bucket.id);
			})
		})]
	});
}
function UsagePage() {
	const online = useOnline();
	const local = useLocalEngine();
	const [entitlement, setEntitlement] = (0, import_react.useState)(null);
	const [unavailable, setUnavailable] = (0, import_react.useState)(null);
	const [lastVerified, setLastVerified] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let live = true;
		(async () => {
			try {
				const ent = await getEntitlement();
				if (!live) return;
				setLastVerified(/* @__PURE__ */ new Date());
				setEntitlement(ent ? {
					planId: ent.planId,
					startedAt: new Date(ent.startedAt),
					expiresAt: ent.expiresAt ? new Date(ent.expiresAt) : void 0
				} : null);
			} catch (e) {
				if (!live) return;
				setUnavailable(e instanceof Error ? e.message : "Usage isn't available until the database is set up.");
			}
		})();
		return () => {
			live = false;
		};
	}, []);
	const ent = (0, import_react.useMemo)(() => entitlementState(entitlement), [entitlement]);
	const graceOk = lastVerified ? offlineEntitlementValid(lastVerified) : true;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Settings",
		title: "Usage and plan",
		description: "OCADE runs on this device. Nothing you ask it is metered."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityAllowance, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanComparison, { currentPlan: entitlement?.planId ?? null }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BillingHistory, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "mb-1 flex items-center gap-2 text-sm font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), " OCADE Local"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [
						"Unlimited and never metered.",
						" ",
						local.status === "ready" ? `${local.models.length} on-device engine${local.models.length === 1 ? "" : "s"} ready.` : "No on-device engine detected yet."
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "mb-2 flex items-center gap-2 text-sm font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gauge, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Plan"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: FREE_LAUNCH_NOTICE
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted-foreground",
						children: "Chat generation stays on your device and is never counted or metered."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "mb-1 flex items-center gap-2 text-sm font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonitorSmartphone, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Devices"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted-foreground",
						children: [
							ent.desktopDevices,
							" desktop and ",
							ent.mobileDevices,
							" mobile devices per account.",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/settings/devices",
								className: "underline",
								children: "Manage devices"
							})
						]
					}),
					!online ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-xs text-muted-foreground",
						children: [
							"You're offline.",
							" ",
							graceOk ? `Your plan stays valid offline for up to 7 days after the last check.` : "Offline grace has run out — reconnect to re-verify your plan. Local features keep working."
						]
					}) : null
				]
			}),
			unavailable ? (() => {
				const state = classifyUnavailable(unavailable, {
					migrationTitle: "Live usage needs the database migration",
					migrationNote: "The migration, RLS, rollback and verification SQL are prepared and ready to apply.",
					loadTitle: "Live usage couldn't be loaded"
				});
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupRequiredState, {
					title: state.title,
					description: state.description,
					detail: state.detail,
					status: state.migrationMissing ? "setup_required" : "failed"
				});
			})() : null
		]
	})] });
}
//#endregion
export { UsagePage as component };
