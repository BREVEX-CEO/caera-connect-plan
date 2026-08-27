import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Wt as LoaderCircle, Xn as CircleCheck } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { i as getPaddleEnvironment, r as getMySubscription } from "./paddle-B2RPBTmL.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/checkout.success-DteqHqOU.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Confirms a purchase from the SERVER's record, not from the fact that the
* browser arrived here.
*
* Anyone can open this URL. The only trustworthy signal that money moved is a
* subscription row written by the signature-verified webhook, so this page
* polls for that row and says plainly when it has not appeared yet rather than
* congratulating someone who has not paid.
*/
function CheckoutSuccessPage() {
	const [subscription, setSubscription] = (0, import_react.useState)(null);
	const [state, setState] = (0, import_react.useState)("checking");
	const [message, setMessage] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let live = true;
		const environment = getPaddleEnvironment();
		const startedAt = Date.now();
		const poll = async () => {
			try {
				const record = await getMySubscription({ data: { environment } });
				if (!live) return;
				if (record) {
					setSubscription(record);
					setState("confirmed");
					return;
				}
				if (Date.now() - startedAt < 3e4) setTimeout(() => void poll(), 2e3);
				else setState("pending");
			} catch (e) {
				if (!live) return;
				setState("error");
				setMessage(e instanceof Error ? e.message : "Your purchase state could not be checked right now.");
			}
		};
		poll();
		return () => {
			live = false;
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "mx-auto flex min-h-screen max-w-xl items-center px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "w-full p-6",
			children: [
				state === "checking" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "flex items-center gap-2 text-lg font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
						className: "h-4 w-4 animate-spin",
						"aria-hidden": true
					}), "Confirming your purchase"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "We are waiting for the payment provider to confirm the payment. This usually takes a few seconds. You can safely leave this page — your plan will be applied either way."
				})] }) : null,
				state === "confirmed" && subscription ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "flex items-center gap-2 text-lg font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, {
						className: "h-4 w-4 text-primary",
						"aria-hidden": true
					}), "Purchase confirmed"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: [
						"Your plan is active on this account",
						subscription.currentPeriodEnd ? ` until ${new Date(subscription.currentPeriodEnd).toLocaleDateString(void 0, { dateStyle: "medium" })}` : "",
						".",
						" ",
						subscription.environment === "sandbox" ? "This was a test purchase — no money was charged." : ""
					]
				})] }) : null,
				state === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-lg font-semibold",
					children: "Payment received, plan not applied yet"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "The confirmation from the payment provider has not reached us yet. Nothing is lost: once it arrives, the plan appears in Billing automatically. If it is still missing in an hour, contact support with the email you paid with."
				})] }) : null,
				state === "error" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-lg font-semibold",
					children: "We could not check your purchase"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: message
				})] }) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						size: "sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings/billing",
							children: "Go to billing"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						size: "sm",
						variant: "outline",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/home",
							children: "Open OCADE"
						})
					})]
				})
			]
		})
	});
}
//#endregion
export { CheckoutSuccessPage as component };
