import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { $t as Info, An as CreditCard, En as Earth, M as ShieldCheck, Tn as ExternalLink, Wt as LoaderCircle, Y as RefreshCw, m as TriangleAlert } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as useSession } from "./session-Bq1TXK1R.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { a as describeSellablePlan, l as sellablePlanByPriceId, n as SELLABLE_PLANS, o as detectRegion, r as currencyForRegion } from "./paddle-plans-Pm8sU42X.mjs";
import { i as getPaddleEnvironment, n as createBillingPortalSession, r as getMySubscription, s as isCheckoutConfigured, t as cancelMySubscription } from "./paddle-CUtji1G5.mjs";
import { i as usePaddleCheckout, n as getUpiReadiness } from "./payments-readiness.functions-DUwUYJZ4.mjs";
import { i as summariseUpiReadiness, n as UPI_TOGGLE_IS_NOT_MACHINE_VERIFIABLE, t as UPI_REASON_COPY } from "./upi-readiness-qtJ_WsAa.mjs";
import { t as PAYMENT_METHODS } from "./methods-Bgfx_DTi.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.billing-DNKybvFA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Says out loud when a purchase is not a purchase.
*
* The preview runs against the test environment, where a checkout looks
* identical but no money moves. Letting that look real is the single easiest
* way to make someone believe they have paid when they have not.
*/
function PaymentTestModeBanner() {
	if (!isCheckoutConfigured() || getPaddleEnvironment() !== "sandbox") return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "status",
		className: "rounded-lg border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-3 py-2 text-xs text-[color:var(--state-warning)]",
		children: "Test mode. Checkouts opened here use the payment provider's test environment: no card is charged and no real subscription is created."
	});
}
/**
* What a customer can pay with here, and the exact reason anything is missing.
*
* The panel distinguishes two states that look the same from outside but have
* nothing in common: a method that is correctly configured yet simply not
* offered where this buyer lives, and a method that is unavailable because the
* operator's provider account or catalogue is not ready. Merging them would
* either blame the customer for an operator problem or hide an operator
* problem behind geography.
*/
function PaymentMethodsPanel({ readiness, loading, error }) {
	const upiState = readiness?.state ?? null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), "Payment methods"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-xs text-muted-foreground",
				children: "Which methods appear depends on your country and the provider's checkout. Approval always happens on the provider's surface — OCADE never sees a card number, a UPI PIN or a PayPal password."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "grid gap-2 sm:grid-cols-3",
				children: PAYMENT_METHODS.map((method) => {
					const isUpi = method.id === "upi";
					const unavailable = isUpi && upiState !== null && upiState !== "available";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						"data-testid": `payment-method-${method.id}`,
						"data-state": isUpi ? upiState ?? "unknown" : "available",
						className: unavailable ? "rounded-lg border border-border/60 bg-black/20 p-3 opacity-70" : "rounded-lg border border-border/60 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium text-foreground",
								children: method.label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-[11px] text-muted-foreground",
								children: method.markets
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-[11px] text-muted-foreground",
								children: method.disclosure
							}),
							isUpi && loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
									className: "h-3 w-3 animate-spin",
									"aria-hidden": true
								}), "Checking whether UPI can be offered to you…"]
							}) : null,
							isUpi && !loading && upiState === "region_not_eligible" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Earth, {
									className: "mt-0.5 h-3 w-3 shrink-0",
									"aria-hidden": true
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium text-foreground",
									children: "Not shown for your region. "
								}), UPI_REASON_COPY.region_not_eligible.body] })]
							}) : null,
							isUpi && !loading && upiState === "setup_required" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 flex items-start gap-1.5 text-[11px] text-[color:var(--state-warning)]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
									className: "mt-0.5 h-3 w-3 shrink-0",
									"aria-hidden": true
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: "Temporarily unavailable. "
								}), "This is on our side, not yours — UPI is switched off until our payment account setup is finished. Cards and PayPal still work."] })]
							}) : null,
							isUpi && !loading && upiState === "available" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[11px] text-[color:var(--state-success,theme(colors.emerald.400))]",
								children: "Offered at checkout in rupees, including UPI AutoPay for renewals."
							}) : null
						]
					}, method.id);
				})
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-[11px] text-muted-foreground",
				children: [
					"The UPI availability check could not run (",
					error,
					"), so the note above may be out of date."
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-[11px] text-muted-foreground",
				children: UPI_TOGGLE_IS_NOT_MACHINE_VERIFIABLE
			})
		]
	});
}
/**
* A single plain-language line at the top of billing when UPI cannot appear.
*
* It says one thing, and it says whose problem it is. Operator faults are
* phrased as our work, not the customer's; region ineligibility is phrased as
* a fact about the method, not a failure of anything.
*/
function UpiSetupBanner({ readiness }) {
	if (!readiness) return null;
	const summary = summariseUpiReadiness(readiness);
	if (!summary) return null;
	const operatorFault = readiness.state === "setup_required";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		"data-testid": "upi-setup-banner",
		"data-state": readiness.state,
		className: operatorFault ? "flex items-start gap-2 border-[color:var(--state-warning)]/40 p-3 text-xs" : "flex items-start gap-2 p-3 text-xs text-muted-foreground",
		children: [operatorFault ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
			className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--state-warning)]",
			"aria-hidden": true
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {
			className: "mt-0.5 h-3.5 w-3.5 shrink-0",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-medium text-foreground",
			children: operatorFault ? "Setup required: UPI is not available yet. " : "About UPI. "
		}), operatorFault ? "UPI payments are switched off until our payment account setup is finished. Cards and PayPal are unaffected." : summary] })]
	});
}
/** Statuses that still grant access, in the words a customer would use. */
function describeStatus(sub) {
	const ends = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
	const endsText = ends ? ends.toLocaleDateString(void 0, { dateStyle: "medium" }) : "—";
	switch (sub.status) {
		case "trialing": return {
			label: "Trial",
			tone: "text-primary",
			detail: `Trial runs until ${endsText}.`
		};
		case "active": return {
			label: "Active",
			tone: "text-[color:var(--state-success,theme(colors.emerald.400))]",
			detail: sub.cancelAtPeriodEnd ? `Cancelled. Access continues until ${endsText}, then it will not renew.` : `Renews on ${endsText}.`
		};
		case "past_due": return {
			label: "Payment failed",
			tone: "text-[color:var(--state-warning)]",
			detail: "The last payment did not go through. The provider will retry — update your payment method to avoid losing access."
		};
		case "paused": return {
			label: "Paused",
			tone: "text-muted-foreground",
			detail: "Billing is paused."
		};
		case "canceled": return {
			label: "Cancelled",
			tone: "text-muted-foreground",
			detail: ends && ends.getTime() > Date.now() ? `Access continues until ${endsText} — you keep the time you paid for.` : "This subscription has ended."
		};
		default: return {
			label: sub.status,
			tone: "text-muted-foreground",
			detail: `Period ends ${endsText}.`
		};
	}
}
function BillingPage() {
	const { user } = useSession();
	const environment = getPaddleEnvironment();
	const { openCheckout, loading: checkoutLoading, error: checkoutError } = usePaddleCheckout();
	const [subscription, setSubscription] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(null);
	const [notice, setNotice] = (0, import_react.useState)(null);
	const [currency, setCurrency] = (0, import_react.useState)("USD");
	(0, import_react.useEffect)(() => {
		setCurrency(currencyForRegion(detectRegion()));
	}, []);
	const [upi, setUpi] = (0, import_react.useState)(null);
	const [upiLoading, setUpiLoading] = (0, import_react.useState)(true);
	const [upiError, setUpiError] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		setUpiLoading(true);
		getUpiReadiness({ data: {
			environment,
			currency
		} }).then((result) => {
			if (!cancelled) setUpi(result);
		}).catch((e) => {
			if (!cancelled) setUpiError(e instanceof Error ? e.message : "check failed");
		}).finally(() => {
			if (!cancelled) setUpiLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [environment, currency]);
	const load = (0, import_react.useCallback)(async () => {
		setError(null);
		try {
			const record = await getMySubscription({ data: { environment } });
			setSubscription(record);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Your billing details could not be loaded.");
		} finally {
			setLoading(false);
		}
	}, [environment]);
	(0, import_react.useEffect)(() => {
		load();
	}, [load]);
	const currentPlan = (0, import_react.useMemo)(() => subscription ? sellablePlanByPriceId(subscription.priceId) : void 0, [subscription]);
	const openPortal = async () => {
		setBusy("portal");
		setNotice(null);
		try {
			const { url } = await createBillingPortalSession();
			window.open(url, "_blank", "noopener,noreferrer");
		} catch (e) {
			setError(e instanceof Error ? e.message : "The billing portal could not be opened.");
		} finally {
			setBusy(null);
		}
	};
	const cancel = async () => {
		if (!window.confirm("Cancel this subscription? You keep access until the end of the period you have already paid for, and it will not renew after that.")) return;
		setBusy("cancel");
		setNotice(null);
		try {
			await cancelMySubscription();
			setNotice("Cancellation requested. Access continues until the end of the paid period; the confirmed state appears here once the provider confirms it.");
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "The subscription could not be cancelled.");
		} finally {
			setBusy(null);
		}
	};
	const buy = (priceId) => void openCheckout({
		priceId,
		userId: user?.id ?? "",
		customerEmail: user?.email ?? void 0,
		successUrl: `${window.location.origin}/checkout/success`
	});
	const canCancel = subscription && !subscription.cancelAtPeriodEnd && [
		"active",
		"trialing",
		"past_due",
		"paused"
	].includes(subscription.status) && currentPlan?.cadence !== "one-time";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				eyebrow: "Subscription",
				title: "Billing",
				description: "Your current plan, what happens next, and how to change or cancel it.",
				actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "outline",
					onClick: () => void load(),
					disabled: loading,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
						className: loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5",
						"aria-hidden": true
					}), "Refresh"]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PaymentTestModeBanner, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UpiSetupBanner, { readiness: upi }),
			!isCheckoutConfigured() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
				className: "p-4 text-sm text-muted-foreground",
				children: "Checkout is not configured on this deployment, so no plan can be bought here yet."
			}) : null,
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
				className: "border-destructive/40 p-3 text-xs text-destructive",
				children: error
			}) : null,
			checkoutError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
				className: "border-destructive/40 p-3 text-xs text-destructive",
				children: checkoutError
			}) : null,
			notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
				className: "p-3 text-xs text-muted-foreground",
				children: notice
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				"data-testid": "current-plan",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "mb-3 flex items-center gap-2 text-sm font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreditCard, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), "Current plan"]
				}), loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-center gap-2 text-xs text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
						className: "h-3.5 w-3.5 animate-spin",
						"aria-hidden": true
					}), "Checking your account…"]
				}) : !subscription ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "No paid plan on this account. Choose one below — you will be taken to the payment provider, and this page updates once the purchase is confirmed."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "grid grid-cols-2 gap-3 text-xs sm:grid-cols-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Plan"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "font-medium",
								children: currentPlan?.planId ?? subscription.productId
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Status"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: `font-medium ${describeStatus(subscription).tone}`,
								children: describeStatus(subscription).label
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Billing"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: currentPlan?.cadence ?? "—" })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: "Environment"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: subscription.environment === "sandbox" ? "Test" : "Live" })] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-xs text-muted-foreground",
						children: describeStatus(subscription).detail
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => void openPortal(),
							disabled: busy !== null,
							children: [busy === "portal" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
								className: "h-3.5 w-3.5 animate-spin",
								"aria-hidden": true
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, {
								className: "h-3.5 w-3.5",
								"aria-hidden": true
							}), "Manage payment and invoices"]
						}), canCancel ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => void cancel(),
							disabled: busy !== null,
							children: [busy === "cancel" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
								className: "h-3.5 w-3.5 animate-spin",
								"aria-hidden": true
							}) : null, "Cancel subscription"]
						}) : null]
					})
				] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mb-1 text-sm font-semibold",
						children: subscription ? "Change plan" : "Choose a plan"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 text-xs text-muted-foreground",
						children: "Prices are shown and charged by the payment provider, which acts as merchant of record and handles tax for your country."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-3 sm:grid-cols-3",
						children: SELLABLE_PLANS.map((plan) => {
							const described = describeSellablePlan(plan, currency);
							const isCurrent = subscription?.priceId === plan.priceId;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
								className: "flex flex-col rounded-lg border border-border/60 bg-black/15 p-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-sm font-semibold text-foreground",
										children: described.name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-0.5 text-lg font-semibold",
										children: described.price
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-xs text-muted-foreground",
										children: described.summary
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-[11px] text-muted-foreground",
										children: plan.cadenceNote
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										className: "mt-3",
										variant: isCurrent ? "outline" : "default",
										disabled: isCurrent || checkoutLoading || !isCheckoutConfigured() || !user,
										onClick: () => buy(plan.priceId),
										children: isCurrent ? "Current plan" : checkoutLoading ? "Opening…" : "Continue to payment"
									})
								]
							}, plan.priceId);
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PaymentMethodsPanel, {
				readiness: upi,
				loading: upiLoading,
				error: upiError
			})
		]
	});
}
//#endregion
export { BillingPage as component };
