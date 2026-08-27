import { n as useAppearance } from "./use-appearance-DRtxpe7r.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { Ct as MousePointer2, Pn as Contrast, T as Sparkles, _t as Palette, ir as Check } from "../_libs/lucide-react.mjs";
import { i as recordAction } from "./actions-CaB-ibgo.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { t as PerformanceFallbackNotice } from "./PerformanceFallbackNotice-BPDXFStg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.appearance-i8id66NG.js
var import_jsx_runtime = require_jsx_runtime();
var THEMES = [
	{
		id: "dark",
		label: "Dark",
		description: "OCADE's default black and silver environment."
	},
	{
		id: "light",
		label: "Light",
		description: "A brighter environment for daylight use."
	},
	{
		id: "real",
		label: "Immersive",
		description: "OCADE's animated depth palette for cinematic surfaces and the orb."
	}
];
/**
* Pointer choices, named for what the person sees rather than for the asset.
*
* "OCADE light" and "OCADE dark" describe the pointer's own colour, which is
* the thing being chosen. `auto_contrast` is offered as "Match the theme"
* because that is what it does, and it is the default worth reaching for.
*/
var CURSORS = [
	{
		id: "system",
		label: "System pointer"
	},
	{
		id: "auto_contrast",
		label: "Match the theme"
	},
	{
		id: "caera_white",
		label: "OCADE light"
	},
	{
		id: "caera_black",
		label: "OCADE dark"
	}
];
var EXPERIENCE = [
	{
		id: "calm",
		label: "Calm",
		description: "Minimal motion and a flat interface.",
		patch: {
			reducedMotion: true,
			lowPerformance: false,
			depth3d: false,
			depthStrength: 0
		}
	},
	{
		id: "balanced",
		label: "Balanced",
		description: "Fast transitions with restrained 3D depth.",
		patch: {
			reducedMotion: false,
			lowPerformance: false,
			depth3d: true,
			depthStrength: 85
		}
	},
	{
		id: "immersive",
		label: "Immersive",
		description: "Full OCADE motion, depth and responsive spatial effects.",
		patch: {
			reducedMotion: false,
			lowPerformance: false,
			depth3d: true,
			depthStrength: 145
		}
	}
];
function currentExperience(appearance) {
	if (appearance.reducedMotion || !appearance.depth3d) return "calm";
	if (appearance.depthStrength >= 120) return "immersive";
	return "balanced";
}
function AppearancePage() {
	const appearance = useAppearance();
	const experience = currentExperience(appearance);
	async function selectTheme(theme) {
		await appearance.update({ theme });
		await recordAction({
			actionId: "settings.theme.change",
			metadata: { theme }
		});
	}
	async function selectExperience(id) {
		const mode = EXPERIENCE.find((item) => item.id === id);
		if (!mode) return;
		await appearance.update(mode.patch);
		await recordAction({
			actionId: "settings.appearance.change",
			metadata: { experience: id }
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Settings",
		title: "Appearance",
		description: "Choose how OCADE looks and how much it moves. The rest is handled automatically."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-6 space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4 flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, {
						className: "h-4 w-4 text-primary",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold text-foreground",
						children: "Visual style"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-muted-foreground",
						children: "The selected style also drives supported 3D surfaces and orb lighting."
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-3 sm:grid-cols-3",
					children: THEMES.map((theme) => {
						const active = appearance.theme === theme.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"aria-pressed": active,
							onClick: () => void selectTheme(theme.id),
							className: cn("rounded-xl border p-4 text-left transition-colors", active ? "border-primary/60 bg-primary/10" : "border-border/60 bg-background/40 hover:bg-accent/40"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm font-semibold text-foreground",
									children: theme.label
								}), active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
									className: "h-4 w-4 text-primary",
									"aria-hidden": true
								}) : null]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: theme.description
							})]
						}, theme.id);
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-4 flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, {
							className: "h-4 w-4 text-primary",
							"aria-hidden": true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-semibold text-foreground",
							children: "Motion & depth"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-0.5 text-xs text-muted-foreground",
							children: ["One choice controls animation, 3D depth and visual intensity.", appearance.osReducedMotion ? " Your system has reduced motion enabled." : ""]
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-3 sm:grid-cols-3",
						children: EXPERIENCE.map((mode) => {
							const active = experience === mode.id;
							const unavailable = appearance.osReducedMotion && mode.id !== "calm";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								"aria-pressed": active,
								disabled: unavailable,
								onClick: () => void selectExperience(mode.id),
								className: cn("rounded-xl border p-4 text-left transition-colors", active ? "border-primary/60 bg-primary/10" : "border-border/60 bg-background/40 hover:bg-accent/40", unavailable && "cursor-not-allowed opacity-45"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm font-semibold text-foreground",
										children: mode.label
									}), active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
										className: "h-4 w-4 text-primary",
										"aria-hidden": true
									}) : null]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted-foreground",
									children: mode.description
								})]
							}, mode.id);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PerformanceFallbackNotice, {})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
				className: "p-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-start justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-2 text-sm font-medium text-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Contrast, {
								className: "h-4 w-4 text-primary",
								"aria-hidden": true
							}), " High contrast"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-1 block text-xs text-muted-foreground",
							children: "Stronger borders and less translucency for easier reading."
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						role: "switch",
						"aria-checked": appearance.highContrast,
						onClick: () => void appearance.update({ highContrast: !appearance.highContrast }),
						className: cn("relative mt-1 h-6 w-11 shrink-0 rounded-full border border-border transition-colors", appearance.highContrast ? "bg-primary" : "bg-muted"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform", appearance.highContrast ? "translate-x-5" : "translate-x-0.5") })
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-4 flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MousePointer2, {
							className: "h-4 w-4 text-primary",
							"aria-hidden": true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-semibold text-foreground",
							children: "Pointer"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-xs text-muted-foreground",
							children: "A larger pointer is easier to follow on a big or high-resolution screen."
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-3 sm:grid-cols-4",
						children: CURSORS.map((option) => {
							const active = appearance.cursor === option.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": active,
								onClick: () => void appearance.update({ cursor: option.id }),
								className: cn("rounded-xl border p-3 text-left text-sm transition-colors", active ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/60 bg-background/40 text-muted-foreground hover:bg-accent/40"),
								children: option.label
							}, option.id);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "mt-5 block",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-sm font-medium text-foreground",
								children: [
									"Pointer size — ",
									appearance.cursorSize,
									"px"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								"aria-label": "Cursor size",
								type: "range",
								min: 16,
								max: 64,
								step: 4,
								value: appearance.cursorSize,
								disabled: appearance.cursor === "system" || appearance.cursor === "accessibility",
								onChange: (event) => void appearance.update({ cursorSize: Number(event.target.value) }),
								className: "mt-2 w-full accent-primary disabled:opacity-40"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 block text-xs text-muted-foreground",
								children: appearance.cursor === "system" || appearance.cursor === "accessibility" ? "Your operating system is drawing the pointer, so it sets the size." : "Applies everywhere in OCADE."
							})
						]
					})
				]
			})
		]
	})] });
}
//#endregion
export { AppearancePage as component };
