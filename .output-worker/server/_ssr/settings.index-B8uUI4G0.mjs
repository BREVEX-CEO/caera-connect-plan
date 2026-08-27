import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-BvyzyYvI.mjs";
import { _ as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { Wt as LoaderCircle, _t as Palette, d as User, ir as Check, zt as LogOut } from "../_libs/lucide-react.mjs";
import { t as useSession } from "./session-Bq1TXK1R.mjs";
import { i as recordAction } from "./actions-DvPqa8hX.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.index-B8uUI4G0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ACCEPT = "image/png,image/jpeg,image/webp";
function DeviceAvatarEditor({ storageKey, initials }) {
	const input = (0, import_react.useRef)(null);
	const [image, setImage] = (0, import_react.useState)(null);
	const [status, setStatus] = (0, import_react.useState)("No device avatar selected.");
	(0, import_react.useEffect)(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				setImage(saved);
				setStatus("Device avatar loaded.");
			}
		} catch {
			setStatus("Device avatar storage is unavailable.");
		}
	}, [storageKey]);
	function choose(file) {
		if (!file) return;
		if (!ACCEPT.split(",").includes(file.type) || file.size > 2e6) {
			setStatus("Choose a PNG, JPEG or WebP image up to 2 MB.");
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			const value = typeof reader.result === "string" ? reader.result : null;
			if (!value) return;
			try {
				localStorage.setItem(storageKey, value);
			} catch {
				setStatus("The image could not be saved on this device.");
				return;
			}
			setImage(value);
			setStatus("Device avatar updated.");
		};
		reader.onerror = () => setStatus("The image could not be read.");
		reader.readAsDataURL(file);
	}
	function remove() {
		try {
			localStorage.removeItem(storageKey);
		} catch {}
		setImage(null);
		setStatus("Device avatar removed.");
		if (input.current) input.current.value = "";
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-border/60 bg-secondary/60 text-sm font-semibold",
			children: image ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: image,
				alt: "Your device avatar",
				className: "h-full w-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				"aria-label": "Avatar initials",
				children: initials
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: input,
				type: "file",
				accept: ACCEPT,
				onChange: (event) => choose(event.target.files?.[0]),
				className: "sr-only",
				id: "device-avatar"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					htmlFor: "device-avatar",
					className: "inline-flex min-h-9 cursor-pointer items-center rounded-md border border-border/70 px-3 text-xs",
					children: image ? "Replace avatar" : "Select avatar"
				}), image ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: remove,
					className: "min-h-9 rounded-md border border-border/70 px-3 text-xs",
					children: "Remove"
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				role: "status",
				className: "mt-1 text-[11px] text-muted-foreground",
				children: [status, " PNG, JPEG or WebP · 2 MB max · device only."]
			})
		] })]
	});
}
var LOCALES = [
	{
		value: "en-US",
		label: "English (United States)"
	},
	{
		value: "en-GB",
		label: "English (United Kingdom)"
	},
	{
		value: "en-IN",
		label: "English (India)"
	},
	{
		value: "hi-IN",
		label: "हिन्दी (भारत)"
	},
	{
		value: "de-DE",
		label: "Deutsch (Deutschland)"
	},
	{
		value: "fr-FR",
		label: "Français (France)"
	},
	{
		value: "es-ES",
		label: "Español (España)"
	},
	{
		value: "ja-JP",
		label: "日本語"
	}
];
function guessTz() {
	const list = [
		"UTC",
		"Asia/Kolkata",
		"Asia/Tokyo",
		"Asia/Singapore",
		"Asia/Dubai",
		"Europe/London",
		"Europe/Berlin",
		"Europe/Paris",
		"America/New_York",
		"America/Chicago",
		"America/Los_Angeles",
		"America/Sao_Paulo",
		"Australia/Sydney"
	];
	try {
		const current = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (current && !list.includes(current)) list.unshift(current);
	} catch {}
	return list;
}
function GeneralPage() {
	const navigate = useNavigate();
	const { user } = useSession();
	const [row, setRow] = (0, import_react.useState)(null);
	const [dirty, setDirty] = (0, import_react.useState)({});
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [savedAt, setSavedAt] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [loadError, setLoadError] = (0, import_react.useState)(null);
	const [reloadKey, setReloadKey] = (0, import_react.useState)(0);
	const tzList = guessTz();
	(0, import_react.useEffect)(() => {
		if (!user) return;
		let cancelled = false;
		setLoading(true);
		setLoadError(null);
		(async () => {
			const { data, error } = await supabase.from("profiles").select("full_name, preferred_name, occupation, custom_instructions, locale, timezone").eq("id", user.id).maybeSingle();
			if (cancelled) return;
			if (error) {
				setLoadError(error.message);
				setLoading(false);
				return;
			}
			setRow(data ?? {
				full_name: null,
				preferred_name: null,
				occupation: null,
				custom_instructions: null,
				locale: "en-US",
				timezone: "UTC"
			});
			setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [user, reloadKey]);
	function update(key, value) {
		setDirty((current) => ({
			...current,
			[key]: value
		}));
	}
	const view = row ? {
		full_name: dirty.full_name ?? row.full_name,
		preferred_name: dirty.preferred_name ?? row.preferred_name,
		occupation: dirty.occupation ?? row.occupation,
		custom_instructions: dirty.custom_instructions ?? row.custom_instructions,
		locale: dirty.locale ?? row.locale,
		timezone: dirty.timezone ?? row.timezone
	} : null;
	const hasChanges = Object.keys(dirty).length > 0;
	async function save() {
		if (!user || !view || !hasChanges) return;
		setSaving(true);
		setError(null);
		try {
			const { error } = await supabase.from("profiles").update({
				full_name: view.full_name,
				preferred_name: view.preferred_name,
				occupation: view.occupation,
				custom_instructions: view.custom_instructions,
				locale: view.locale,
				timezone: view.timezone
			}).eq("id", user.id);
			if (error) throw error;
			setRow(view);
			setDirty({});
			setSavedAt(Date.now());
			await recordAction({
				actionId: "settings.profile.update",
				metadata: { fields: Object.keys(dirty) }
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSaving(false);
		}
	}
	async function signOut() {
		setSigningOut(true);
		await recordAction({ actionId: "auth.sign_out" });
		await supabase.auth.signOut();
		navigate({
			to: "/auth",
			replace: true
		});
	}
	const initials = (view?.preferred_name || view?.full_name || user?.email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Settings",
			title: "General",
			description: "Your identity, preferences and the short instructions OCADE should remember."
		}),
		error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			role: "alert",
			className: "mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
			children: error
		}) : null,
		loadError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "alert",
			className: "mb-4 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Could not load your profile." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => setReloadKey((key) => key + 1),
				className: "underline underline-offset-2",
				children: "Retry"
			})]
		}) : null,
		loading && !loadError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mb-4 flex items-center gap-2 p-4 text-sm text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
				className: "h-4 w-4 animate-spin",
				"aria-hidden": true
			}), " Loading your profile…"]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeading, {
				icon: User,
				title: "You"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex items-start gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeviceAvatarEditor, {
					storageKey: `ocade:device-avatar:${user?.id ?? "anonymous"}`,
					initials
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid min-w-0 flex-1 gap-3 sm:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Full name",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								"aria-label": "Full name",
								type: "text",
								value: view?.full_name ?? "",
								onChange: (event) => update("full_name", event.target.value),
								className: inputCls
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Preferred name",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								"aria-label": "Preferred name",
								type: "text",
								value: view?.preferred_name ?? "",
								onChange: (event) => update("preferred_name", event.target.value),
								className: inputCls
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Occupation or role",
							className: "sm:col-span-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								"aria-label": "Occupation or role",
								type: "text",
								value: view?.occupation ?? "",
								onChange: (event) => update("occupation", event.target.value),
								className: inputCls
							})
						})
					]
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeading, { title: "How OCADE should respond" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
				"aria-label": "Custom instructions",
				value: view?.custom_instructions ?? "",
				onChange: (event) => update("custom_instructions", event.target.value),
				placeholder: "Prefer concise replies. Use metric units.",
				rows: 3,
				maxLength: 2e3,
				className: "mt-3 w-full rounded-md border border-border/60 bg-background/60 px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeading, { title: "Language & region" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-3 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Language",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						"aria-label": "Language",
						value: view?.locale ?? "en-US",
						onChange: (event) => update("locale", event.target.value),
						className: inputCls,
						children: LOCALES.map((locale) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: locale.value,
							children: locale.label
						}, locale.value))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Time zone",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						"aria-label": "Time zone",
						value: view?.timezone ?? "UTC",
						onChange: (event) => update("timezone", event.target.value),
						className: inputCls,
						children: tzList.map((timezone) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: timezone,
							children: timezone
						}, timezone))
					})
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 flex items-center justify-between gap-4 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeading, {
					icon: Palette,
					title: "Appearance"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Visual style and 3D motion are managed in one place."
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/settings/appearance",
				className: "rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-accent",
				children: "Open appearance"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sticky bottom-3 mt-4 flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/90 px-4 py-2.5 backdrop-blur",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs text-muted-foreground",
				children: saving ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3 w-3 animate-spin" }), " Saving…"]
				}) : hasChanges ? "Unsaved changes" : savedAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-3 w-3 text-primary" }), " Saved"]
				}) : "All changes saved"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [hasChanges ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setDirty({}),
					disabled: saving,
					className: "rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50",
					children: "Discard"
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => void save(),
					disabled: saving || !hasChanges,
					className: "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50",
					children: "Save"
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 flex items-center justify-between gap-4 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-medium text-foreground",
					children: "Sign out"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted-foreground",
					children: "Ends this browser session only."
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => void signOut(),
				disabled: signingOut,
				className: "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-50",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}), " Sign out"]
			})]
		})
	] });
}
var inputCls = "h-9 w-full rounded-md border border-border/60 bg-background/60 px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40";
function Field({ label, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: cn("block", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground",
			children: label
		}), children]
	});
}
function SectionHeading({ icon: Icon, title }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [Icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
			className: "h-4 w-4 text-primary",
			"aria-hidden": true
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "text-sm font-semibold text-foreground",
			children: title
		})]
	});
}
//#endregion
export { GeneralPage as component };
