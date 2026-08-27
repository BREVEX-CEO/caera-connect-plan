import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Vt as Lock } from "../_libs/lucide-react.mjs";
import { n as useSettingsAccess, t as SettingsAccessContext } from "./use-settings-access-CqrFa1Nj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/SettingsGate-BOwuQuSO.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Settings a signed-out visitor can read but not change.
*
* THE PATTERN THIS REPLACES. Settings screens usually hide themselves behind a
* sign-in wall, which means the one question a prospective user actually has —
* *what can this thing be made to do?* — cannot be answered before they hand
* over an email address. That is a conversion problem and a trust problem at
* once: the product looks like it has something to hide.
*
* So every category renders for everyone. Controls are DISABLED rather than
* absent, and each says why in the same words. Nothing is faked — a disabled
* toggle shows the real shipped default, not an invented value.
*
* WHY A CONTEXT AND NOT A PROP. A settings panel is a tree of inputs several
* levels deep, and threading `readOnly` through every one guarantees somebody
* misses one. A missed prop here is a control that looks live and silently
* discards what the user typed, which is worse than a wall.
*/
function SettingsAccessProvider({ canEdit, reason = "Sign in to change this setting.", children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsAccessContext.Provider, {
		value: {
			canEdit,
			reason
		},
		children
	});
}
/**
* One labelled setting, disabled as a whole when there is no account.
*
* `inert` is what makes it reliable: it removes the subtree from the tab order
* and from pointer events without every child remembering its own `disabled`.
* The dimming is separate and deliberate — `inert` alone is invisible, and an
* unreachable control that looks reachable is worse than a visibly dead one.
*/
function SettingsField({ label, description, children, className }) {
	const { canEdit, reason } = useSettingsAccess();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex flex-col gap-1.5 border-b border-border/50 py-3 last:border-b-0", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13.5px] font-medium text-foreground",
					children: label
				}), description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-[12px] leading-snug text-muted-foreground",
					children: description
				}) : null]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("shrink-0", !canEdit && "pointer-events-none opacity-50"),
				inert: !canEdit,
				children
			})]
		}), !canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "flex items-center gap-1.5 text-[11.5px] text-muted-foreground/80",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, {
				className: "h-3 w-3 shrink-0",
				"aria-hidden": true
			}), reason]
		}) : null]
	});
}
/**
* The panel-level read-only notice.
*
* Once at the top rather than repeated under every field, so a category with
* twelve settings does not repeat one sentence twelve times.
*/
function ReadOnlyBanner({ className }) {
	const { canEdit } = useSettingsAccess();
	if (canEdit) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5 text-[12.5px] text-muted-foreground", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, {
			className: "mt-0.5 h-3.5 w-3.5 shrink-0",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-medium text-foreground",
				children: "You are not signed in."
			}),
			" Every setting below is shown exactly as it ships, so you can see what OCADE does before creating an account. Changing one needs an account.",
			" ",
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/auth",
				className: "text-primary underline underline-offset-4",
				children: "Create one"
			}),
			"."
		] })]
	});
}
//#endregion
export { SettingsAccessProvider as n, SettingsField as r, ReadOnlyBanner as t };
