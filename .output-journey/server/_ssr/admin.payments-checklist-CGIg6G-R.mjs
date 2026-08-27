import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { Tn as ExternalLink, Wt as LoaderCircle, Xn as CircleCheck, Yn as CircleDashed, hn as FlaskConical, m as TriangleAlert, qn as CirclePlay, vr as Banknote } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as useSession } from "./session-C8v4p4SE.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as SELLABLE_PLANS } from "./paddle-plans-Pm8sU42X.mjs";
import { i as getPaddleEnvironment, s as isCheckoutConfigured } from "./paddle-B2RPBTmL.mjs";
import { i as usePaddleCheckout, r as runPaymentsChecklist, t as fastForwardTestRenewal } from "./payments-readiness.functions-BtU5VMvo.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.payments-checklist-CGIg6G-R.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* How money actually reaches the company's bank account.
*
* Selling and getting paid out are two separate things: the checkout can take
* card and UPI payments in test mode today, but the merchant of record only
* releases funds once the account is verified and a payout bank account is on
* file. This panel states the real order of those steps so nobody assumes a
* successful test checkout means money is on its way.
*/
var PAYOUT_STEPS = [
	{
		title: "Publish the site",
		detail: "The provider reviews a live, reachable site before approving an account. Publish CARCC CADANE, including the pricing, terms, privacy and refund pages, then start the review."
	},
	{
		title: "Complete the verification form",
		detail: "Business or sole-proprietor details, the country of registration, what you sell and expected volumes. This takes about ten minutes and starts domain, business and identity review.",
		fields: [
			"Legal entity name exactly as registered",
			"Registered address and country (India)",
			"PAN, and GSTIN if registered",
			"Government photo ID for the signing person"
		]
	},
	{
		title: "Add the Indian bank account for payouts",
		detail: "Once verified, open the provider's payout settings from the Payments tab and add the beneficiary account. The name on the account must match the verified legal entity, otherwise the transfer is rejected by the receiving bank.",
		fields: [
			"Beneficiary name (must match the verified entity)",
			"Account number and re-entry",
			"IFSC code (identifies bank and branch)",
			"Bank name, branch and bank address",
			"Account type: current for a company, savings for an individual",
			"Payout currency — INR where offered, otherwise USD converted by your bank"
		]
	},
	{
		title: "Handle the inbound-remittance paperwork",
		detail: "Foreign earnings arriving in India are export-of-service receipts. Your bank will ask for a purpose code and issue FIRC or e-BRC advice per payout; keep those with the invoices, because GST export treatment and income-tax filing both rely on them."
	},
	{
		title: "Wait for the first payout cycle",
		detail: "Payouts run on a schedule after a holding period, not immediately after each sale. Nothing is released until every verification step is green — a passing test checkout does not move real money."
	}
];
function PayoutSetupGuide() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Banknote, {
					className: "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-medium",
					children: "Getting paid into an Indian bank account"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Card, UPI and PayPal are all collected by one merchant of record, so there is a single payout account rather than one per method. These steps are done in the provider's own dashboard, reached from the Payments tab — CARCC CADANE never stores your bank details."
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-4 space-y-3",
				children: PAYOUT_STEPS.map((step, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex gap-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 shrink-0",
						"aria-hidden": true,
						children: index === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-3.5 w-3.5 text-muted-foreground" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleDashed, { className: "h-3.5 w-3.5 text-muted-foreground" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs font-medium",
							children: [
								index + 1,
								". ",
								step.title
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-xs text-muted-foreground",
							children: step.detail
						}),
						step.fields ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-1.5 space-y-0.5 text-xs text-muted-foreground",
							children: step.fields.map((field) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									"aria-hidden": true,
									children: "·"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: field })]
							}, field))
						}) : null
					] })]
				}, step.title))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-xs text-muted-foreground",
				children: "Tax and remittance rules change and depend on your registration. Treat this as an operational checklist, not tax advice — confirm the purpose code and GST export treatment with your CA before the first payout."
			})
		]
	});
}
var CHECKLIST_STEPS = [
	{
		id: "catalogue_inr",
		title: "Every plan has a rupee price",
		proves: "An Indian buyer is charged in INR, which is the precondition the provider uses to offer UPI at all.",
		requiresHuman: false
	},
	{
		id: "webhook_configured",
		title: "Webhook destinations and secrets exist",
		proves: "The provider has somewhere to send subscription events, and this app holds the signing secret needed to trust them.",
		requiresHuman: false
	},
	{
		id: "webhook_verified_delivery",
		title: "A signed event was accepted and written",
		proves: "Signature verification works end to end: a real delivery produced a subscription row for the signed-in account.",
		requiresHuman: false
	},
	{
		id: "upi_checkout",
		title: "UPI appears and completes in test checkout",
		proves: "The provider genuinely offers UPI to an Indian buyer here. Only a real test checkout can show this — the UPI toggle is not readable through the API.",
		requiresHuman: true
	},
	{
		id: "renewal_autopay",
		title: "Renewal and AutoPay state changes land",
		proves: "Pulling the billing date forward in test mode produces a renewal, and the resulting status change reaches this app's records.",
		requiresHuman: false
	}
];
function outcomeTone(outcome) {
	switch (outcome) {
		case "pass": return "text-[color:var(--state-success,theme(colors.emerald.400))]";
		case "fail": return "text-destructive";
		case "attention": return "text-[color:var(--state-warning)]";
		default: return "text-muted-foreground";
	}
}
function outcomeLabel(outcome) {
	switch (outcome) {
		case "pass": return "Verified";
		case "fail": return "Failed";
		case "attention": return "Needs attention";
		case "manual": return "Manual step";
		default: return "Not run";
	}
}
/**
* Internal end-to-end payments verification, in the test environment.
*
* Admin only. The steps are run against the real provider and this app's real
* records — no step reports success because the code path exists. The one step
* a machine cannot prove (UPI actually being offered in the checkout) is shown
* as a manual action with a button that opens the real test checkout.
*/
function PaymentsChecklistPage() {
	const { user } = useSession();
	const environment = getPaddleEnvironment();
	const { openCheckout, loading: checkoutLoading, error: checkoutError } = usePaddleCheckout();
	const [run, setRun] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [notice, setNotice] = (0, import_react.useState)(null);
	const execute = async () => {
		setBusy("run");
		setError(null);
		try {
			setRun(await runPaymentsChecklist({ data: { environment } }));
		} catch (e) {
			setError(e instanceof Error ? e.message : "The checklist could not be run.");
		} finally {
			setBusy(null);
		}
	};
	const renew = async () => {
		setBusy("renew");
		setError(null);
		setNotice(null);
		try {
			const result = await fastForwardTestRenewal({ data: { environment } });
			setNotice(`Next billing moved to ${new Date(result.nextBilledAt).toLocaleTimeString()} for ${result.subscriptionId}. The renewal runs shortly after that — re-run the checklist then to confirm the new state reached this app.`);
		} catch (e) {
			setError(e instanceof Error ? e.message : "The renewal could not be fast-forwarded.");
		} finally {
			setBusy(null);
		}
	};
	const monthly = SELLABLE_PLANS.find((p) => p.cadence === "monthly") ?? SELLABLE_PLANS[0];
	const resultFor = (id) => run?.results.find((r) => r.id === id);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
				eyebrow: "Internal",
				title: "Payments test checklist",
				description: "Verifies UPI checkout, webhook signature handling and renewal state changes end to end against the payment provider.",
				actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					onClick: () => void execute(),
					disabled: busy !== null,
					children: [busy === "run" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
						className: "h-3.5 w-3.5 animate-spin",
						"aria-hidden": true
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlay, {
						className: "h-3.5 w-3.5",
						"aria-hidden": true
					}), "Run checks"]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PayoutSetupGuide, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "flex items-start gap-2 p-3 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlaskConical, {
					className: "mt-0.5 h-3.5 w-3.5 shrink-0",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"This page is running against the",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium text-foreground",
						children: environment === "sandbox" ? "test" : "live"
					}),
					" ",
					"environment. Fast-forwarding a renewal is refused outside test mode, because the same action against live money would bill a real customer early."
				] })]
			}),
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "space-y-2",
				children: CHECKLIST_STEPS.map((step, index) => {
					const result = resultFor(step.id);
					const outcome = result?.outcome ?? (step.requiresHuman ? "manual" : "unknown");
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
						className: "p-4",
						"data-testid": `checklist-${step.id}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
									className: "text-sm font-semibold",
									children: [
										index + 1,
										". ",
										step.title
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-0.5 text-[11px] text-muted-foreground",
									children: step.proves
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `shrink-0 text-[11px] font-medium ${outcomeTone(outcome)}`,
									children: outcomeLabel(outcome)
								})]
							}),
							result?.detail ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-xs text-muted-foreground",
								children: result.detail
							}) : null,
							result?.evidence ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
								className: "mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2",
								children: Object.entries(result.evidence).map(([key, value]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-foreground/70",
										children: key
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "truncate",
										children: String(value)
									})]
								}, key))
							}) : null,
							step.id === "upi_checkout" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 space-y-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "flex items-start gap-1.5 text-[11px] text-muted-foreground",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
										className: "mt-0.5 h-3 w-3 shrink-0",
										"aria-hidden": true
									}), "Open the checkout, confirm a UPI option is listed, and complete it with a test method. If UPI is missing while prices are in rupees, the provider's own UPI setting is off or the account is not approved."]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "outline",
									disabled: checkoutLoading || !isCheckoutConfigured() || !user,
									onClick: () => void openCheckout({
										priceId: monthly.priceId,
										userId: user?.id ?? "",
										customerEmail: user?.email ?? void 0,
										successUrl: `${window.location.origin}/checkout/success`
									}),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, {
										className: "h-3.5 w-3.5",
										"aria-hidden": true
									}), "Open test checkout"]
								})]
							}) : null,
							step.id === "renewal_autopay" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "outline",
									disabled: busy !== null || environment !== "sandbox",
									onClick: () => void renew(),
									children: [busy === "renew" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
										className: "h-3.5 w-3.5 animate-spin",
										"aria-hidden": true
									}) : null, "Fast-forward next renewal"]
								})
							}) : null
						]
					}) }, step.id);
				})
			}),
			run ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[11px] text-muted-foreground",
				children: [
					"Last run ",
					new Date(run.ranAt).toLocaleString(),
					" against the",
					" ",
					run.environment === "sandbox" ? "test" : "live",
					" environment."
				]
			}) : null
		]
	});
}
//#endregion
export { PaymentsChecklistPage as component };
