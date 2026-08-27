import { n as useAppearance } from "./use-appearance-DRtxpe7r.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { Bt as LogIn, Ct as MousePointer2, _t as Palette, q as RotateCcw, yr as Ban } from "../_libs/lucide-react.mjs";
import { t as WorkspaceShell } from "./WorkspaceShell-CPYZEH23.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as useDemo } from "./use-demo-Cag2FHQT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/demo.settings-BCqfzG9K.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Demo variant of the single OCADE shell. Demo isolation is unchanged: state
* lives in DemoProvider (in-memory, never Supabase); this only supplies the
* demo chrome — badge, sign-in CTA, reset/exit.
*/
function DemoShell({ children }) {
	const { reset, exit } = useDemo();
	const navigate = useNavigate();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkspaceShell, {
		variant: "demo",
		onDemoReset: () => reset(),
		onDemoExit: () => {
			exit();
			navigate({ to: "/" });
		},
		children
	});
}
var themes = [
	"dark",
	"light",
	"real"
];
var cursors = [
	"system",
	"caera_black",
	"caera_white",
	"auto_contrast"
];
function DemoSettings() {
	const { reset, exit } = useDemo();
	const navigate = useNavigate();
	const { theme, cursor, update } = useAppearance();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DemoShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Settings — demo",
		title: "Appearance and demo controls",
		description: "Theme and cursor apply to your browser. Nothing is saved to a real account."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-6 grid gap-4 lg:grid-cols-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "mb-3 flex items-center gap-2 text-sm font-semibold text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), "Theme"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-3 gap-2",
					children: themes.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						"aria-pressed": theme === t,
						onClick: () => update({ theme: t }),
						className: "rounded-lg border px-3 py-2 text-xs capitalize " + (theme === t ? "border-primary bg-primary/10 text-foreground" : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"),
						children: t
					}, t))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "mb-3 flex items-center gap-2 text-sm font-semibold text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MousePointer2, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), "Cursor"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 gap-2",
						children: cursors.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							"aria-pressed": cursor === c,
							onClick: () => update({ cursor: c }),
							className: "rounded-lg border px-3 py-2 text-xs capitalize " + (cursor === c ? "border-primary bg-primary/10 text-foreground" : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"),
							children: c.replace("_", " ")
						}, c))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-xs text-muted-foreground",
						children: "Custom cursor upload is available after sign-in."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "flex flex-col gap-3 p-5 lg:col-span-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold text-foreground",
						children: "Demo controls"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "Reset restores the initial sample state. Exit clears the demo flag and returns to the landing page. Sign-in never copies demo content into your account."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => reset(),
								className: "inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground hover:bg-accent",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
									className: "h-4 w-4",
									"aria-hidden": true
								}), "Reset demo"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									exit();
									navigate({ to: "/" });
								},
								className: "inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground hover:bg-accent",
								children: "Exit demo"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/auth",
								className: "inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogIn, {
									className: "h-4 w-4",
									"aria-hidden": true
								}), "Create your account"]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex items-center gap-2 rounded-lg border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/5 px-3 py-2 text-xs text-[color:var(--state-warning)]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ban, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), "Payments, filings, e-signatures, native device control and destructive account actions are disabled in demo."]
					})
				]
			})
		]
	})] });
}
//#endregion
export { DemoSettings as component };
