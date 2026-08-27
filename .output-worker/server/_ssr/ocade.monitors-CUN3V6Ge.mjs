import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { $ as Radar, h as Trash2, it as Plus, m as TriangleAlert, pt as Pause, st as Play } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as EmptyState } from "./EmptyState-Bm7ErAtz.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as CapabilityBadge } from "./CapabilityBadge-Ci6Z_gpg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.monitors-CUN3V6Ge.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Rate floors per topic. A market can be polled more often than a regulation,
* but nothing may poll faster than its floor — this is the rate limit.
*/
var MIN_INTERVAL_MS = {
	local_incident: 300 * 1e3,
	weather: 1800 * 1e3,
	transport: 300 * 1e3,
	market: 60 * 1e3,
	company_news: 3600 * 1e3,
	regulation: 1440 * 60 * 1e3,
	outage: 300 * 1e3,
	security_advisory: 3600 * 1e3,
	project: 3600 * 1e3
};
var WorldScan = class WorldScan {
	monitors = /* @__PURE__ */ new Map();
	/**
	* Create a monitor. Refuses the two states that would break the contract: no
	* sources (untraceable alerts) and — handled by flooring — too-fast polling.
	*/
	create(input) {
		if (!input.subject.trim()) return {
			ok: false,
			reason: "A monitor needs a subject to watch."
		};
		if (input.sources.length === 0) return {
			ok: false,
			reason: "A monitor must name at least one source. OCADE won't raise an alert it can't trace back to where it came from."
		};
		if (this.monitors.has(input.id)) return {
			ok: false,
			reason: `A monitor with id “${input.id}” already exists.`
		};
		const floor = MIN_INTERVAL_MS[input.topic];
		const intervalMs = Math.max(input.intervalMs, floor);
		const monitor = {
			id: input.id,
			topic: input.topic,
			subject: input.subject.trim(),
			sources: [...input.sources],
			intervalMs,
			state: "active",
			createdAt: (input.now ?? /* @__PURE__ */ new Date()).toISOString(),
			lastCheckedAt: null
		};
		this.monitors.set(monitor.id, monitor);
		return {
			ok: true,
			data: monitor,
			evidence: intervalMs > input.intervalMs ? `Watching “${monitor.subject}”. Interval raised to the ${describeInterval(floor)} floor for ${input.topic} to protect the source.` : `Watching “${monitor.subject}” every ${describeInterval(intervalMs)}.`
		};
	}
	/** Which active monitors are due a check now, respecting their interval. */
	dueChecks(now = /* @__PURE__ */ new Date()) {
		const due = [];
		for (const m of this.monitors.values()) {
			if (m.state !== "active") continue;
			if (m.lastCheckedAt === null) {
				due.push(m);
				continue;
			}
			if (now.getTime() - Date.parse(m.lastCheckedAt) >= m.intervalMs) due.push(m);
		}
		return due;
	}
	/** Record that a monitor was checked, so it isn't due again until its interval elapses. */
	markChecked(id, now = /* @__PURE__ */ new Date()) {
		const m = this.monitors.get(id);
		if (!m) return {
			ok: false,
			reason: "No such monitor."
		};
		m.lastCheckedAt = now.toISOString();
		return {
			ok: true,
			data: m,
			evidence: `“${m.subject}” checked; next due in ${describeInterval(m.intervalMs)}.`
		};
	}
	pause(id) {
		const m = this.monitors.get(id);
		if (!m) return {
			ok: false,
			reason: "No such monitor."
		};
		m.state = "paused";
		return {
			ok: true,
			data: m,
			evidence: `Paused “${m.subject}”. It won't be checked until resumed.`
		};
	}
	resume(id) {
		const m = this.monitors.get(id);
		if (!m) return {
			ok: false,
			reason: "No such monitor."
		};
		m.state = "active";
		return {
			ok: true,
			data: m,
			evidence: `Resumed “${m.subject}”.`
		};
	}
	/**
	* Revoke a monitor — genuinely remove it. A revoked monitor can never be due
	* again because it no longer exists; revoking is distinct from pausing.
	*/
	revoke(id) {
		if (!this.monitors.delete(id)) return {
			ok: false,
			reason: "That monitor isn't here — nothing was revoked."
		};
		return {
			ok: true,
			data: { revoked: true },
			evidence: "Monitor revoked and removed."
		};
	}
	list() {
		return [...this.monitors.values()];
	}
	/**
	* Serialise for on-device persistence. Monitors are the user's own opt-in
	* watch list, so they survive a reload — nothing here leaves the device.
	*/
	toJSON() {
		return this.list();
	}
	/**
	* Rehydrate from persisted monitors, re-applying the rate floor to each so a
	* value tampered below the floor in storage can't survive a reload.
	*/
	static fromJSON(data) {
		const scan = new WorldScan();
		if (!Array.isArray(data)) return scan;
		for (const raw of data) {
			if (typeof raw !== "object" || raw === null) continue;
			const m = raw;
			if (typeof m.id !== "string" || typeof m.subject !== "string" || !Array.isArray(m.sources)) continue;
			if (m.sources.length === 0) continue;
			const topic = m.topic ?? "project";
			const floor = MIN_INTERVAL_MS[topic] ?? MIN_INTERVAL_MS.project;
			scan.monitors.set(m.id, {
				id: m.id,
				topic,
				subject: m.subject,
				sources: [...m.sources],
				intervalMs: Math.max(typeof m.intervalMs === "number" ? m.intervalMs : floor, floor),
				state: m.state === "paused" ? "paused" : "active",
				createdAt: typeof m.createdAt === "string" ? m.createdAt : (/* @__PURE__ */ new Date()).toISOString(),
				lastCheckedAt: typeof m.lastCheckedAt === "string" ? m.lastCheckedAt : null
			});
		}
		return scan;
	}
};
function describeInterval(ms) {
	const min = Math.round(ms / 6e4);
	if (min < 60) return `${min} min`;
	const hours = Math.round(min / 60);
	return hours < 24 ? `${hours} h` : `${Math.round(hours / 24)} d`;
}
var STORAGE_KEY = "ocade.monitors.v1";
var TOPIC_LABELS = {
	local_incident: "Local incidents",
	weather: "Weather",
	transport: "Transport",
	market: "Markets",
	company_news: "Company news",
	regulation: "Regulations",
	outage: "Outages",
	security_advisory: "Security advisories",
	project: "Project"
};
function MonitorsPage() {
	const [monitors, setMonitors] = (0, import_react.useState)(null);
	const [subject, setSubject] = (0, import_react.useState)("");
	const [topic, setTopic] = (0, import_react.useState)("market");
	const [sourceText, setSourceText] = (0, import_react.useState)("");
	const scan = (0, import_react.useMemo)(() => {
		try {
			const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
			return raw ? WorldScan.fromJSON(JSON.parse(raw)) : new WorldScan();
		} catch {
			return new WorldScan();
		}
	}, []);
	const persist = (0, import_react.useCallback)((state) => {
		try {
			if (!globalThis.localStorage) throw new Error("Local storage is unavailable.");
			globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch {
			toast.error("Couldn't save your monitors on this device.");
			return false;
		}
		setMonitors(scan.list());
		return true;
	}, [scan]);
	(0, import_react.useEffect)(() => setMonitors(scan.list()), [scan]);
	function add() {
		const sources = sourceText.split(",").map((source) => source.trim()).filter(Boolean);
		const result = scan.create({
			id: `mon-${Date.now()}`,
			topic,
			subject,
			sources,
			intervalMs: MIN_INTERVAL_MS[topic]
		});
		if (!result.ok) {
			toast.error(result.reason);
			return;
		}
		if (!persist(scan.toJSON())) {
			scan.revoke(result.data.id);
			setMonitors(scan.list());
			return;
		}
		toast.success("Monitor configuration saved. No background polling starts until a monitor runner is connected.");
		setSubject("");
		setSourceText("");
	}
	function toggle(monitor) {
		const wasActive = monitor.state === "active";
		if (!(wasActive ? scan.pause(monitor.id) : scan.resume(monitor.id)).ok) return;
		if (!persist(scan.toJSON())) {
			if (wasActive) scan.resume(monitor.id);
			else scan.pause(monitor.id);
			setMonitors(scan.list());
		}
	}
	function revoke(id) {
		const before = scan.toJSON();
		if (before.filter((monitor) => monitor.id !== id).length === before.length) {
			toast.error("That monitor isn't here — nothing was revoked.");
			return;
		}
		const result = scan.revoke(id);
		if (!result.ok) {
			toast.error(result.reason);
			return;
		}
		if (!persist(scan.toJSON())) return;
		toast.success("Monitor configuration revoked.");
	}
	const canAdd = subject.trim().length > 0 && sourceText.trim().length > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Monitors",
			description: "Define source-backed things OCADE should watch. Configuration is available; continuous background fetching is not connected in this launch.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CapabilityBadge, { status: "NOT_CONFIGURED" })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "status",
			className: "mb-5 flex items-start gap-3 rounded-xl border border-[color:var(--state-warning)]/35 bg-[color:var(--state-warning)]/5 p-4 text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
				className: "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium text-foreground",
					children: "No monitor runner is polling these definitions."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-muted-foreground",
					children: "Saving or marking a monitor active stores the watch configuration only. OCADE will not claim that checks or alerts are running until a real runner heartbeat is available."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/ocade/health",
					className: "mt-2 inline-block text-xs underline underline-offset-4",
					children: "View capability health"
				})
			] })]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "mb-3 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Define a monitor"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						htmlFor: "mon-subject",
						className: "text-xs font-medium",
						children: "What to watch"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "mon-subject",
						value: subject,
						onChange: (event) => setSubject(event.target.value),
						placeholder: "e.g. ACME Corp filings",
						className: "mt-1"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						htmlFor: "mon-topic",
						className: "text-xs font-medium",
						children: "Kind"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						id: "mon-topic",
						value: topic,
						onChange: (event) => setTopic(event.target.value),
						className: "mt-1 block h-9 w-full rounded-md border border-border/60 bg-transparent px-2 text-sm",
						children: Object.keys(TOPIC_LABELS).map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value,
							children: TOPIC_LABELS[value]
						}, value))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						htmlFor: "mon-sources",
						className: "text-xs font-medium",
						children: "Sources (comma-separated)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "mon-sources",
						value: sourceText,
						onChange: (event) => setSourceText(event.target.value),
						placeholder: "regulator.gov, official newsroom",
						className: "mt-1"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						className: "w-fit",
						disabled: !canAdd,
						onClick: add,
						children: "Save definition"
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-5",
			children: monitors === null ? null : monitors.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radar, {
					className: "h-8 w-8",
					"aria-hidden": true
				}),
				title: "No monitor definitions",
				description: "OCADE only stores watch definitions you explicitly add."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "flex flex-col gap-2",
				children: monitors.map((monitor) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-lg border border-border/60 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("inline-block h-2 w-2 rounded-full", monitor.state === "active" ? "bg-[color:var(--state-warning)]" : "bg-muted-foreground/40"),
									"aria-hidden": true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[13px] font-medium",
									children: monitor.subject
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground",
									children: TOPIC_LABELS[monitor.topic]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "ml-auto text-[11px] text-muted-foreground",
									children: [
										"configured every ",
										Math.round(monitor.intervalMs / 6e4),
										" min · ",
										monitor.state
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-[11px] text-muted-foreground",
							children: ["Sources: ", monitor.sources.join(", ")]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[11px] text-[color:var(--state-warning)]",
							children: "Runner: not connected · no checks are executing"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "ghost",
								className: "h-7 text-[11px]",
								onClick: () => toggle(monitor),
								children: monitor.state === "active" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "mr-1.5 h-3 w-3" }), " Mark paused"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "mr-1.5 h-3 w-3" }), " Mark active"] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "ghost",
								className: "h-7 text-[11px] text-destructive",
								onClick: () => revoke(monitor.id),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "mr-1.5 h-3 w-3" }), " Revoke"]
							})]
						})
					]
				}, monitor.id))
			})
		})
	] });
}
//#endregion
export { MonitorsPage as component };
