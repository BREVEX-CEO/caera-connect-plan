import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as PublicPage, r as PublicSection, t as Notice } from "./PublicPage-CTc9xZld.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/data-rights-CsnoiB03.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function DataRightsPage() {
	const [requestType, setRequestType] = (0, import_react.useState)("Access my data");
	const [account, setAccount] = (0, import_react.useState)("");
	const [details, setDetails] = (0, import_react.useState)("");
	const [copied, setCopied] = (0, import_react.useState)(false);
	const requestText = (0, import_react.useMemo)(() => [
		"OCADE data-rights request",
		`Request: ${requestType}`,
		`Account reference: ${account.trim() || "[add the email or account ID used with OCADE]"}`,
		`Details: ${details.trim() || "[describe the data, correction, deletion, consent or grievance]"}`,
		"Preferred response channel: [add a safe email address]",
		"Country/region: [add your country or region]",
		"Please explain any identity verification needed before I send sensitive documents."
	].join("\n"), [
		account,
		details,
		requestType
	]);
	async function copyRequest() {
		await navigator.clipboard.writeText(requestText);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 2500);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Private request preparation",
		title: "Data-rights request builder",
		summary: "Prepare a request without uploading identity documents or personal data to this website. Nothing entered here is transmitted or saved by this page.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, { children: "This page prepares your request; it does not send it. Nothing you type here leaves your browser. Copy the finished text and send it yourself when you are ready." }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Prepare your request",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4 rounded-lg border border-border/60 p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium text-foreground",
								children: "Request type"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: requestType,
								onChange: (event) => setRequestType(event.target.value),
								className: "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Access my data" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Correct my data" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Delete my data" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Withdraw consent" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Raise a privacy grievance" })
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium text-foreground",
								children: "Account reference"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: account,
								onChange: (event) => setAccount(event.target.value),
								placeholder: "Email or OCADE account ID",
								className: "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium text-foreground",
								children: "Request details"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								value: details,
								onChange: (event) => setDetails(event.target.value),
								rows: 5,
								placeholder: "Describe what you want OCADE to access, correct, delete or review.",
								className: "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: copyRequest,
							className: "rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground",
							children: copied ? "Copied" : "Copy request text"
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Before sending",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Do not send Aadhaar, PAN, passwords, payment credentials or one-time codes. The final launch process must publish a working privacy/grievance contact, acknowledgement deadline, verification method, decision log and appeal/escalation path. Until then, retain the copied text safely and do not treat it as submitted." })
			})
		]
	});
}
//#endregion
export { DataRightsPage as component };
