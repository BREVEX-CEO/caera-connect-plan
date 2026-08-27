import { a as __toESM } from "../_runtime.mjs";
import { s as performance_default } from "../_libs/h3+rou3+srvx+unenv.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as orbStateFor } from "./OcadeOrb-CAwPzlLl.mjs";
import { t as PLANETS } from "./solar-data-CBLxIq3U.mjs";
import { At as Mic, B as Search, Dt as MonitorSmartphone, E as Smartphone, En as Earth, Fn as Command, H as ScanEye, Mt as MicOff, N as ShieldAlert, Or as AppWindow, T as Sparkles, _n as Files, fr as BrainCircuit, hr as Bot, jt as MicVocal, pt as Pause, sn as Hand, st as Play, w as Square, z as Send } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { c as resumeRun, f as updateRun, i as finishRun, l as startRun, o as pauseRun, u as stopRun } from "./runs-Dy-PZWN-.mjs";
import { n as DialogContent, o as DialogTitle, t as Dialog } from "./dialog-CCT-3-fg.mjs";
import { a as toolsFor, n as schemasFor, t as findTool } from "./tool-registry-BXQ-LCdE.mjs";
import { c as missionSpeakFn, d as refreshMemoryFn, f as startMissionFn, l as noteApproved, m as stopMissionFn, n as decide, o as missionAudioInputsFn, r as executeToolCall, s as missionMicFn, t as currentPermissionContext, u as noteDenied } from "./permission-settings-DpY0ceJj.mjs";
import { c as runAgentTask, t as Revision } from "./loop-DydYwV0X.mjs";
import { n as useLocalChatEngine } from "./use-local-chat-engine-CA9YeR6B.mjs";
import { n as useVoicePrefs } from "./use-voice-prefs-CPa6Xy55.mjs";
import { t as GestureControlPanel } from "./GestureControlPanel-B_ZnCKnK.mjs";
import { n as useDictation } from "./use-dictation-4utRaPC4.mjs";
import { t as OcadeCompanion } from "./OcadeCompanion-ChgP1je7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-mission-brain-BInL-ocd.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var action = (id, label, description, prompt, risk = "read") => ({
	id,
	label,
	description,
	prompt,
	risk
});
/**
* The command deck is a discovery layer over OCADE's typed tool registry. It
* does not bypass the planner or invoke raw mouse/shell actions: selecting an
* item writes a plain-language instruction into the composer where it is
* visible and editable. Sending still passes scope, permission, risk,
* protected-input, emergency-stop and postcondition checks.
*/
var CONTROL_DOMAINS = [
	{
		id: "apps",
		label: "Apps & windows",
		shortLabel: "Apps",
		description: "Find, open, focus and arrange installed software.",
		launchers: [
			action("apps-observe", "Inspect active app", "Read the focused window before acting.", "Inspect the active application and tell me what is visible."),
			action("apps-list", "List open windows", "Show the real windows currently open.", "List the windows currently open on this computer."),
			action("apps-installed", "Installed apps", "Read the installed application catalogue.", "List the applications installed on this computer."),
			action("apps-open", "Open an app", "Choose an installed app after reviewing the prompt.", "Open the application I name after asking me which one.", "confirm"),
			action("apps-focus", "Focus a window", "Bring an existing window to the front.", "Bring the window I name to the front after asking which one.", "low"),
			action("apps-arrange", "Arrange workspace", "Place windows using verified screen geometry.", "Arrange my current work windows side by side and verify the result.", "confirm"),
			action("apps-displays", "Map displays", "Read connected displays and their bounds.", "List every connected display with its size and position.")
		]
	},
	{
		id: "browser",
		label: "Browser control",
		shortLabel: "Web",
		description: "Navigate and interact through named, permissioned elements.",
		launchers: [
			action("browser-read", "Read this page", "Read the current page without changing it.", "Read the current browser page and summarise what it contains."),
			action("browser-tabs", "List tabs", "Show the current browser tabs.", "List the browser tabs that OCADE is allowed to see."),
			action("browser-open", "Open a website", "Navigate to a reviewed address.", "Open the website I specify after asking for the address.", "confirm"),
			action("browser-find", "Find on page", "Locate visible text or controls.", "Ask what I want to find, then locate it on the current page."),
			action("browser-click", "Select a control", "Map named elements before clicking.", "Map the controls on this page, ask which one I mean, then select it.", "confirm"),
			action("browser-form", "Fill a form", "Fill ordinary fields but refuse protected inputs.", "Help fill the visible non-sensitive fields on this page and stop before submitting.", "confirm"),
			action("browser-verify", "Verify page change", "Read back the page after an action.", "Verify the last browser action by reading the resulting page state.")
		]
	},
	{
		id: "files",
		label: "Files & documents",
		shortLabel: "Files",
		description: "Work only inside folders the user has approved.",
		launchers: [
			action("files-list", "List a folder", "Read an approved folder.", "Ask which approved folder I want, then list its files."),
			action("files-find", "Find a file", "Search approved folders by name or pattern.", "Ask what file I am looking for, then find it inside approved folders."),
			action("files-read", "Read a document", "Parse PDF, Word, Excel, CSV or text.", "Ask which document I want, then read and summarise it."),
			action("files-create", "Create a note", "Create a new file with visible content.", "Ask for a note name and content, then create it in my approved workspace.", "confirm"),
			action("files-organise", "Organise a folder", "Preview moves before applying them.", "Inspect an approved folder and propose an organisation plan without moving anything yet."),
			action("files-rename", "Rename safely", "Rename one selected file with verification.", "Ask which approved file to rename and the new name, then verify it.", "confirm"),
			action("files-recycle", "Move to recycle bin", "Never permanently delete; always confirm.", "Ask which approved file I want moved to the recycle bin, then wait for confirmation.", "high")
		]
	},
	{
		id: "voice",
		label: "Voice & conversation",
		shortLabel: "Voice",
		description: "Prompt, dictation, hands-free listening and local speech.",
		launchers: [
			action("voice-dictate", "Dictate a command", "Use the selected microphone once.", "Start a one-time dictated command when I press the microphone button."),
			action("voice-handsfree", "Hands-free mode", "Keep stop and pause phrases available.", "Switch this task to voice mode and explain the emergency stop phrase.", "confirm"),
			action("voice-local", "Use local speech", "Prefer an installed offline voice.", "Use an on-device female voice for spoken replies when one is installed."),
			action("voice-language", "Match my language", "Detect the language without changing control rules.", "Reply and speak in the language I use while keeping technical terms unchanged."),
			action("voice-devices", "List microphones", "Read available input devices on demand.", "List the microphones available on this device."),
			action("voice-read", "Read aloud", "Speak a selected answer after redaction.", "Read the most recent OCADE answer aloud using my selected voice."),
			action("voice-stop", "Stop listening", "Release the microphone immediately.", "Stop voice listening now.", "low")
		]
	},
	{
		id: "vision",
		label: "Vision & gestures",
		shortLabel: "Vision",
		description: "Accessibility tree first, local camera gestures when enabled.",
		launchers: [
			action("vision-screen", "Describe screen", "Read structure and visible text.", "Describe the active screen using the accessibility map first."),
			action("vision-map", "Number controls", "Create a fresh expiring element map.", "Number the actionable controls in the focused window."),
			action("vision-ocr", "Read drawn text", "Use OCR only when structure is insufficient.", "Read the visible text in the current window, using OCR only if needed."),
			action("vision-preview", "Camera preview", "Open a local preview without cursor control.", "Open hand-gesture camera preview only; do not control the cursor."),
			action("vision-cursor", "Hand cursor", "Require the separate two-step activation.", "Open the hand-control activation panel and wait for my confirmation.", "high"),
			action("vision-verify", "Verify an action", "Compare before and after observations.", "Verify the last computer action from the current screen state."),
			action("vision-stop", "Emergency stop", "Release held keys, buttons, camera and tasks.", "Emergency stop all computer and gesture control now.", "high")
		]
	},
	{
		id: "mobile",
		label: "Mobile companion",
		shortLabel: "Mobile",
		description: "Supervise PC tasks from a short-lived signed phone session.",
		launchers: [
			action("mobile-status", "Connection status", "Show paired and revoked devices.", "Show the current mobile companion connection and trust status."),
			action("mobile-pair", "Pair a phone", "Open the signed pairing flow.", "Open mobile pairing and explain each security step.", "confirm"),
			action("mobile-task", "Send PC task", "Create a scoped task from the paired phone.", "Prepare a PC task that can be sent from my paired phone.", "confirm"),
			action("mobile-approve", "Review approvals", "Show waiting high-risk decisions.", "Show approvals waiting for a decision from my paired phone."),
			action("mobile-pause", "Pause remotely", "Pause only the currently scoped task.", "Pause the current PC task from the paired mobile session.", "confirm"),
			action("mobile-output", "Collect output", "Download only a task-scoped result.", "Show outputs available to my paired phone for the current task."),
			action("mobile-revoke", "Revoke session", "Invalidate the paired session and key.", "Revoke the current mobile control session after confirmation.", "high")
		]
	},
	{
		id: "system",
		label: "System & hardware",
		shortLabel: "System",
		description: "Measured health, devices, media and reversible controls.",
		launchers: [
			action("system-health", "System health", "Measure CPU, memory, storage and uptime.", "Measure this computer's current CPU, memory, storage and uptime."),
			action("system-battery", "Battery status", "Read charge and power state.", "Read the current battery and charging status."),
			action("system-storage", "Storage space", "Read mounted-drive free space.", "Show free and used storage for every available fixed drive."),
			action("system-bluetooth", "Bluetooth devices", "List adapter and paired device state.", "Show Bluetooth status and connected devices."),
			action("system-audio", "Audio devices", "List available input and output endpoints.", "List the audio devices currently enabled."),
			action("system-brightness", "Set brightness", "Set and independently read back the result.", "Ask for a brightness level, set it, then verify the display reports it.", "confirm"),
			action("system-media", "Media controls", "Use OS media keys with an honest receipt.", "Ask whether I want play, pause, next or previous, then perform it.", "confirm")
		]
	},
	{
		id: "automations",
		label: "Automations & safety",
		shortLabel: "Runs",
		description: "Bounded plans, reminders, pause, recovery and receipts.",
		launchers: [
			action("runs-plan", "Rehearse a task", "Check apps, permissions and recovery first.", "Rehearse my next task without changing anything and list every blocker."),
			action("runs-remind", "Create reminder", "Use the operating system scheduler.", "Ask for a reminder date, time and message, then show it before scheduling.", "confirm"),
			action("runs-list", "List reminders", "Read only reminders created by OCADE.", "List the reminders OCADE has scheduled."),
			action("runs-automation", "Create automation", "Preview scope and permissions before saving.", "Help design an automation and show a dry-run without enabling it."),
			action("runs-pause", "Pause current task", "Stop before the next action.", "Pause the current OCADE task.", "low"),
			action("runs-receipts", "Show receipts", "Show what was observed, changed and verified.", "Show the verification receipts for the current task."),
			action("runs-stop", "Stop everything", "Cancel tasks and release input immediately.", "Emergency stop every OCADE control session now.", "high")
		]
	}
];
var CONTROL_LAUNCHER_COUNT = CONTROL_DOMAINS.reduce((total, domain) => total + domain.launchers.length, 0);
/**
* Twenty-eight objects distributed across eight operational rings. The 4/3
* split is intentional: 4 + 4 + 4 + 4 + 3 + 3 + 3 + 3 = 28.
*/
var CONTROL_CONSTELLATION = CONTROL_DOMAINS.flatMap((domain, domainIndex) => domain.launchers.slice(0, domainIndex < 4 ? 4 : 3).map((launcher, objectIndex) => ({
	id: launcher.id,
	label: launcher.label,
	domainId: domain.id,
	domainIndex,
	objectIndex
})));
if (CONTROL_LAUNCHER_COUNT !== 56 || CONTROL_CONSTELLATION.length !== 28) throw new Error("The OCADE command deck must expose 56 launchers and a 28-object constellation.");
var ICONS = {
	apps: AppWindow,
	browser: Earth,
	files: Files,
	voice: MicVocal,
	vision: ScanEye,
	mobile: MonitorSmartphone,
	system: BrainCircuit,
	automations: Bot
};
function riskLabel(risk) {
	if (risk === "read") return "Read only";
	if (risk === "low") return "Reversible";
	if (risk === "confirm") return "Confirms first";
	return "Always asks";
}
function ControlCommandDeck({ onSelect, className }) {
	const [active, setActive] = (0, import_react.useState)("apps");
	const [query, setQuery] = (0, import_react.useState)("");
	const visible = (0, import_react.useMemo)(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return CONTROL_DOMAINS.find((domain) => domain.id === active)?.launchers ?? [];
		return CONTROL_DOMAINS.flatMap((domain) => domain.launchers).filter((launcher) => [
			launcher.label,
			launcher.description,
			launcher.prompt
		].join(" ").toLowerCase().includes(needle));
	}, [active, query]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "OCADE command deck",
		className: cn("ocade-relational-surface rounded-2xl border border-border/70 bg-background/82 p-3 shadow-2xl backdrop-blur-xl", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2 px-1 pb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent-ocade)]",
						children: "Command deck"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 text-[11px] text-muted-foreground",
						children: [CONTROL_LAUNCHER_COUNT, " launchers · every instruction remains reviewable before it runs"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "relative min-w-[180px] flex-1 sm:max-w-[260px]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
							className: "pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground",
							"aria-hidden": true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: "Search command launchers"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "search",
							value: query,
							onChange: (event) => setQuery(event.target.value),
							placeholder: "Search 56 controls",
							className: "h-8 w-full rounded-full border border-border/70 bg-black/25 pl-8 pr-3 text-[11.5px] text-foreground outline-none transition focus:border-[color:var(--accent-ocade)]/55"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				role: "tablist",
				"aria-label": "Control domains",
				className: "ocade-scroll flex gap-1 overflow-x-auto pb-2",
				children: CONTROL_DOMAINS.map((domain) => {
					const Icon = ICONS[domain.id];
					const selected = !query && active === domain.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						role: "tab",
						"aria-selected": selected,
						onClick: () => {
							setQuery("");
							setActive(domain.id);
						},
						className: cn("ocade-command-tab inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[10.5px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "border-[color:var(--accent-ocade)]/45 bg-[color:var(--accent-ocade)]/14 text-foreground" : "border-border/55 bg-white/[0.025] text-muted-foreground hover:border-border hover:text-foreground"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), domain.shortLabel]
					}, domain.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2",
				children: visible.map((launcher) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onSelect(launcher),
					className: "ocade-command-card group relative min-h-[74px] overflow-hidden rounded-xl border border-border/60 bg-white/[0.025] p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							"aria-hidden": true,
							className: "absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[color:var(--accent-ocade)]/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-start gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-[12px] font-medium text-foreground",
									children: launcher.label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-1 block text-[10.5px] leading-relaxed text-muted-foreground",
									children: launcher.description
								})]
							}), launcher.risk === "high" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
								className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive",
								"aria-hidden": true
							}) : null]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("mt-2 inline-flex rounded-full border px-2 py-0.5 text-[9.5px]", launcher.risk === "high" ? "border-destructive/30 text-destructive" : "border-border/60 text-muted-foreground/80"),
							children: riskLabel(launcher.risk)
						})
					]
				}, launcher.id))
			}),
			visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "px-3 py-8 text-center text-xs text-muted-foreground",
				children: [
					"No command launcher matches “",
					query,
					"”."
				]
			}) : null
		]
	});
}
/**
* The Control + Work system: the same eight planets, seen from above, reporting
* what OCADE is actually doing to this computer.
*
* WHY THIS IS A SECOND SCENE RATHER THAN THE LANDING ONE WITH A PROP
* -------------------------------------------------------------------
* The landing scene is an approved piece of identity. It has a camera you can
* drag, a full WebGL pipeline, custom shaders and a 600 KiB engine behind it,
* and it exists to be looked at. This one has a job: to say, without words and
* without a dashboard, whether OCADE is idle, listening, thinking, watching the
* screen, acting on it, speaking, paused or stopped.
*
* Bolting eight operational states onto the landing scene would have made the
* approved animation conditional on runtime state, which is how an approved
* thing stops being the thing that was approved. So the BODIES are shared —
* `solar-data` is imported, the same eight planets in the same order, Uranus
* with the same twenty-eight moons — and the rendering is its own.
*
* AND WHY IT IS 2D CANVAS RATHER THAN A SECOND WebGL CONTEXT
* -----------------------------------------------------------
* A browser keeps a small number of WebGL contexts alive and silently kills the
* oldest. A user who opens the landing page, goes to Control + Work and comes
* back would be the one who finds out. A top view also has no perspective to
* render: every orbit is a circle and every body is a disc, which canvas draws
* at 60fps on integrated graphics for a fraction of the cost.
*
* PURE, SO THE MOTION CAN BE ARGUED WITH
* ---------------------------------------
* `bodiesAt` and `motionFor` are functions of time and state. Whether "paused"
* is genuinely slower than "idle", and whether "stopped" genuinely freezes,
* are assertions a test makes rather than claims a comment makes.
*/
var BASE_CONNECTION_OPACITY = .06;
/**
* The motion for one state at one moment.
*
* The numbers are the design: nothing here exceeds a 1.6x orbit rate or a 0.22
* connection opacity, because a scene that shouts during execution is a scene
* the user turns off, and then it reports nothing at all.
*/
function motionFor({ state, time, amplitude = 0 }) {
	const wave = (period) => (Math.sin(time * Math.PI * 2 / period) + 1) / 2;
	switch (state) {
		case "listening": return {
			orbitRate: 1,
			sunPulse: .25 + wave(2.4) * .35,
			connectionOpacity: BASE_CONNECTION_OPACITY * 1.4,
			scan: null,
			frozen: false,
			caption: "Listening"
		};
		case "thinking": return {
			orbitRate: 1.45,
			sunPulse: .2 + wave(1.1) * .2,
			connectionOpacity: .16 + wave(1.7) * .06,
			scan: null,
			frozen: false,
			caption: "Thinking"
		};
		case "observing": return {
			orbitRate: .65,
			sunPulse: .12,
			connectionOpacity: .1,
			scan: time * .22 % 1,
			frozen: false,
			caption: "Looking at this computer"
		};
		case "controlling": return {
			orbitRate: 1.6,
			sunPulse: .3 + wave(.7) * .3,
			connectionOpacity: .22,
			scan: null,
			frozen: false,
			caption: "Working on this computer"
		};
		case "speaking": return {
			orbitRate: 1,
			sunPulse: .2 + Math.min(1, Math.max(0, amplitude)) * .65,
			connectionOpacity: BASE_CONNECTION_OPACITY * 1.6,
			scan: null,
			frozen: false,
			caption: "Speaking"
		};
		case "paused": return {
			orbitRate: .22,
			sunPulse: .08,
			connectionOpacity: BASE_CONNECTION_OPACITY,
			scan: null,
			frozen: false,
			caption: "Paused"
		};
		case "stopped": return {
			orbitRate: 0,
			sunPulse: 0,
			connectionOpacity: BASE_CONNECTION_OPACITY * .6,
			scan: null,
			frozen: true,
			caption: "Stopped"
		};
		case "error": return {
			orbitRate: 0,
			sunPulse: .14,
			connectionOpacity: BASE_CONNECTION_OPACITY * .6,
			scan: null,
			frozen: true,
			caption: "Could not finish"
		};
		default: return {
			orbitRate: 1,
			sunPulse: .1 + wave(6) * .06,
			connectionOpacity: BASE_CONNECTION_OPACITY,
			scan: null,
			frozen: false,
			caption: "Ready"
		};
	}
}
Math.max(...PLANETS.map((p) => p.orbit)) + 3;
PLANETS.map((_planet, index) => [index, (index + 1) % PLANETS.length]);
var SLOW_FRAME_MS = 11;
var FAST_FRAME_MS = 6.5;
var STATE_HUES = {
	idle: {
		blue: .58,
		red: .18,
		silver: .76
	},
	listening: {
		blue: .94,
		red: .28,
		silver: .82
	},
	thinking: {
		blue: .8,
		red: .45,
		silver: .9
	},
	observing: {
		blue: 1,
		red: .36,
		silver: .8
	},
	controlling: {
		blue: .96,
		red: .76,
		silver: .86
	},
	speaking: {
		blue: .88,
		red: .5,
		silver: .96
	},
	paused: {
		blue: .35,
		red: .32,
		silver: .66
	},
	stopped: {
		blue: .16,
		red: .5,
		silver: .55
	},
	error: {
		blue: .12,
		red: 1,
		silver: .45
	}
};
/**
* OCADE's operational constellation.
*
* Eight rings are the eight control domains. Twenty-eight objects are the
* visible, named parts of those domains. Unlike the old solar-system metaphor,
* the geometry is relational: every object connects to the central authority
* orb and to the neighbours in its own permission ring. State changes affect
* movement without resetting phase, and Stop/Error settle after one frame.
*
* This stays on Canvas 2D deliberately. The landing page already owns the
* heavyweight WebGL scene; loading another 3D engine beside a local model and
* a control loop would spend the response budget on decoration. Perspective,
* depth ordering, glow and parallax are calculated directly and the renderer
* drops quality if its own measured frame cost becomes expensive.
*/
function ControlSolarScene({ state, amplitude = 0, className }) {
	const wrapRef = (0, import_react.useRef)(null);
	const stateRef = (0, import_react.useRef)(state);
	const amplitudeRef = (0, import_react.useRef)(amplitude);
	stateRef.current = state;
	amplitudeRef.current = amplitude;
	(0, import_react.useEffect)(() => {
		const wrap = wrapRef.current;
		if (!wrap) return;
		const canvas = document.createElement("canvas");
		canvas.setAttribute("aria-hidden", "true");
		canvas.style.cssText = "display:block;width:100%;height:100%;";
		wrap.prepend(canvas);
		const context = canvas.getContext("2d", { alpha: true });
		if (!context) {
			canvas.remove();
			return;
		}
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		let width = 1;
		let height = 1;
		let quality = "full";
		let meanFrameMs = 0;
		let samples = 0;
		let phase = .45;
		let elapsed = 0;
		let last = performance_default.now();
		let frame = 0;
		let running = true;
		let settled = null;
		const resize = () => {
			const bounds = wrap.getBoundingClientRect();
			width = Math.max(1, bounds.width);
			height = Math.max(1, bounds.height);
			const dprCap = quality === "full" ? 1.75 : quality === "balanced" ? 1.25 : 1;
			const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		const draw = (dt) => {
			elapsed += dt;
			const control = motionFor({
				state: stateRef.current,
				time: elapsed,
				amplitude: amplitudeRef.current
			});
			phase += dt * control.orbitRate * .36;
			paintCommandConstellation(context, {
				width,
				height,
				phase,
				time: elapsed,
				state: stateRef.current,
				pulse: control.sunPulse,
				scanAngle: control.scan,
				quality
			});
		};
		resize();
		if (reduced) {
			quality = "balanced";
			resize();
			draw(0);
		} else {
			const loop = (now) => {
				if (!running) return;
				const dt = Math.min(.05, (now - last) / 1e3);
				last = now;
				const current = stateRef.current;
				const held = current === "stopped" || current === "error";
				if (!held || settled !== current) {
					const started = performance_default.now();
					draw(dt);
					const cost = performance_default.now() - started;
					meanFrameMs = samples === 0 ? cost : meanFrameMs * .9 + cost * .1;
					samples += 1;
					settled = held ? current : null;
					if (samples > 45) {
						if (meanFrameMs > SLOW_FRAME_MS && quality !== "minimal") {
							quality = quality === "full" ? "balanced" : "minimal";
							samples = 0;
							resize();
						} else if (meanFrameMs < FAST_FRAME_MS && quality !== "full") {
							quality = quality === "minimal" ? "balanced" : "full";
							samples = 0;
							resize();
						}
					}
				}
				frame = requestAnimationFrame(loop);
			};
			frame = requestAnimationFrame(loop);
		}
		const observer = new ResizeObserver(() => {
			resize();
			settled = null;
			if (reduced) draw(0);
		});
		observer.observe(wrap);
		return () => {
			running = false;
			cancelAnimationFrame(frame);
			observer.disconnect();
			canvas.remove();
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: wrapRef,
		className: cn("relative isolate", className),
		"data-control-state": state,
		"data-control-domain-count": CONTROL_DOMAINS.length,
		"data-control-object-count": CONTROL_CONSTELLATION.length,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			"aria-hidden": true,
			className: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,rgba(0,0,0,.18)_50%,rgba(0,0,0,.72)_100%)]"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				"aria-live": "polite",
				className: "whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.3em] text-foreground/70",
				children: motionFor({
					state,
					time: 0,
					amplitude
				}).caption
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 whitespace-nowrap text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/55",
				children: "8 domains · 28 command objects"
			})]
		})]
	});
}
function paintCommandConstellation(context, input) {
	const { width, height, state, phase, time, quality } = input;
	const cx = width * .5;
	const cy = height * .46;
	const compact = width < 600 || height < 390;
	const radius = Math.min(width * .43, height * .54);
	const palette = STATE_HUES[state];
	context.clearRect(0, 0, width, height);
	const field = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.3);
	field.addColorStop(0, `rgba(20, 38, 70, ${.18 * palette.blue})`);
	field.addColorStop(.52, "rgba(6, 9, 15, 0.34)");
	field.addColorStop(1, "rgba(2, 3, 6, 0.94)");
	context.fillStyle = field;
	context.fillRect(0, 0, width, height);
	const rings = CONTROL_DOMAINS.map((domain, index) => ({
		domain,
		index,
		radiusX: radius * (.32 + index * .085),
		radiusY: radius * (.13 + index * .04),
		tilt: -.23 + index * .065
	}));
	context.save();
	context.translate(cx, cy);
	for (const ring of rings) {
		context.save();
		context.rotate(ring.tilt);
		context.beginPath();
		context.ellipse(0, 0, ring.radiusX, ring.radiusY, 0, 0, Math.PI * 2);
		context.strokeStyle = `rgba(154, 183, 226, ${.055 + ring.index * .008})`;
		context.lineWidth = ring.index % 2 === 0 ? .8 : .55;
		context.stroke();
		context.restore();
	}
	context.restore();
	const points = CONTROL_CONSTELLATION.map((object, globalIndex) => {
		const ring = rings[object.domainIndex];
		const groupLength = object.domainIndex < 4 ? 4 : 3;
		const angle = phase * (object.domainIndex % 2 === 0 ? 1 : -.78) + object.objectIndex / groupLength * Math.PI * 2 + object.domainIndex * .41;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const x0 = cos * ring.radiusX;
		const y0 = sin * ring.radiusY;
		const c = Math.cos(ring.tilt);
		const s = Math.sin(ring.tilt);
		const x = cx + x0 * c - y0 * s;
		const y = cy + x0 * s + y0 * c;
		const depth = (sin + 1) / 2;
		return {
			...object,
			globalIndex,
			x,
			y,
			depth
		};
	}).sort((a, b) => a.depth - b.depth);
	if (quality !== "minimal") {
		context.save();
		context.lineWidth = .55;
		for (const point of points) {
			context.beginPath();
			context.moveTo(cx, cy);
			context.lineTo(point.x, point.y);
			context.strokeStyle = `rgba(85, 151, 255, ${.018 + point.depth * .035})`;
			context.stroke();
		}
		context.restore();
	}
	for (const point of points) {
		const active = (Math.floor(time * .7) + point.domainIndex) % 8 === point.domainIndex;
		const size = (compact ? 2.1 : 2.8) + point.depth * (compact ? 2.2 : 3.4);
		const base = state === "error" || state === "controlling" && point.globalIndex % 7 === 0 ? "238, 62, 74" : point.globalIndex % 5 === 0 ? "213, 220, 232" : "69, 139, 255";
		if (quality === "full") {
			const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, size * 4.5);
			glow.addColorStop(0, `rgba(${base}, ${.42 + point.depth * .24})`);
			glow.addColorStop(1, `rgba(${base}, 0)`);
			context.fillStyle = glow;
			context.beginPath();
			context.arc(point.x, point.y, size * 4.5, 0, Math.PI * 2);
			context.fill();
		}
		context.fillStyle = `rgba(${base}, ${.62 + point.depth * .35})`;
		context.beginPath();
		context.arc(point.x, point.y, active ? size * 1.2 : size, 0, Math.PI * 2);
		context.fill();
		if (!compact && quality === "full" && point.depth > .82 && point.objectIndex === 0) {
			context.font = "500 9px ui-sans-serif, system-ui, sans-serif";
			context.textAlign = "center";
			context.fillStyle = "rgba(214, 222, 236, 0.62)";
			context.fillText(point.label, point.x, point.y + size + 12);
		}
	}
	const pulse = Math.max(0, Math.min(1, input.pulse));
	const orbRadius = (compact ? 23 : 31) * (.92 + pulse * .13);
	const glow = context.createRadialGradient(cx, cy, 0, cx, cy, orbRadius * 3.8);
	glow.addColorStop(0, `rgba(228, 234, 244, ${.76 * palette.silver})`);
	glow.addColorStop(.19, `rgba(64, 137, 255, ${.55 * palette.blue})`);
	glow.addColorStop(.5, `rgba(235, 53, 68, ${.17 * palette.red})`);
	glow.addColorStop(1, "rgba(0,0,0,0)");
	context.fillStyle = glow;
	context.beginPath();
	context.arc(cx, cy, orbRadius * 3.8, 0, Math.PI * 2);
	context.fill();
	const metal = context.createLinearGradient(cx - orbRadius, cy - orbRadius, cx + orbRadius, cy + orbRadius);
	metal.addColorStop(0, "rgba(248,250,255,.96)");
	metal.addColorStop(.28, "rgba(85,96,116,.9)");
	metal.addColorStop(.52, "rgba(8,12,20,.98)");
	metal.addColorStop(.74, "rgba(60,128,238,.92)");
	metal.addColorStop(1, state === "error" ? "rgba(246,49,64,.94)" : "rgba(199,207,220,.9)");
	context.fillStyle = metal;
	context.beginPath();
	context.arc(cx, cy, orbRadius, 0, Math.PI * 2);
	context.fill();
	context.strokeStyle = state === "error" ? "rgba(255,70,82,.9)" : "rgba(119,171,255,.82)";
	context.lineWidth = 1.2;
	context.stroke();
	context.font = `600 ${compact ? 9 : 11}px ui-sans-serif, system-ui, sans-serif`;
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillStyle = "rgba(242,246,255,.9)";
	context.fillText("OCADE", cx, cy);
	if (input.scanAngle !== null) {
		context.save();
		context.translate(cx, cy);
		context.rotate(input.scanAngle);
		const sweep = context.createLinearGradient(0, 0, radius, 0);
		sweep.addColorStop(0, "rgba(82,145,255,.52)");
		sweep.addColorStop(1, "rgba(82,145,255,0)");
		context.strokeStyle = sweep;
		context.lineWidth = 1;
		context.beginPath();
		context.moveTo(orbRadius, 0);
		context.lineTo(radius, 0);
		context.stroke();
		context.restore();
	}
}
/**
* Multi-step goals: decompose once, then work through the parts.
*
* WHAT THE SINGLE LOOP ALREADY DID, AND WHERE IT STOPPED
* -------------------------------------------------------
* `runAgentTask` chains tool calls perfectly well. Give it "open Notepad and
* type an essay" and it opens, then types, then reports. What it does NOT do is
* hold a shape in mind across a goal with distinct phases:
*
*     "Research quantum computing, summarise it, and WhatsApp it to H."
*
* That is three jobs with three different tool sets and a data dependency
* running through them. A single flat loop handles it by keeping every tool
* loaded, every intermediate result in one growing transcript, and every
* decision made from a context that gets longer and noisier with each step.
* Around step six a 3B model starts re-reading its own earlier output as though
* it were new instructions.
*
* So the goal is decomposed ONCE, and each step runs in its own agent with only
* the tools that step needs.
*
* THE CONTEXT PROBLEM, WHICH IS THE REAL REASON THIS EXISTS
* ----------------------------------------------------------
* Perception tools are extraordinarily verbose. One `screen_find` returns every
* candidate with role, label, bounds, confidence and provenance; a `ui_tree` on
* a browser returns hundreds of elements. All of it is essential to the step
* doing the clicking and all of it is NOISE to the goal — the planner needs to
* know "the Send button was clicked", not the eleven rectangles considered on
* the way there.
*
* Each step therefore runs as a SUB-AGENT with its own message history, and
* only its closing sentence is returned. The bounding-box arithmetic happens
* inside a context that is thrown away. What reaches the main transcript is one
* line per step, which is what keeps a six-step goal as fast at the end as it
* was at the start.
*
* WHY DECOMPOSITION IS ONE CALL AND NOT A CONVERSATION
* -----------------------------------------------------
* A planner that re-plans after every step is a planner that can loop forever,
* and on a small model it does: step three fails, the re-plan produces step
* three again, and nothing else ever happens. Planning once and then EXECUTING
* is bounded by construction. When a step fails, the failure is carried forward
* to the next step as context rather than triggering a fresh plan — the later
* steps usually still make sense, and a goal that is genuinely dead stops at
* the end rather than spinning in the middle.
*/
/**
* Goals worth decomposing. Below this, planning costs more than it saves.
*
* A single-clause instruction goes straight to the ordinary loop: asking a
* model to decompose "open Notepad" wastes a round trip to be told that it is
* one step. The signal is a goal that names SEVERAL THINGS TO DO — a connector
* between two verb phrases, or an explicit enumeration.
*/
var MULTI_STEP = /\b(?:and then|then|after that|afterwards|followed by|and (?:also )?(?:send|share|message|whatsapp|email|write|save|summari[sz]e|post|tell))\b/i;
function looksMultiStep(goal) {
	const text = (goal ?? "").trim();
	if (text.length < 25) return false;
	return MULTI_STEP.test(text);
}
/**
* The decomposition prompt.
*
* Constrained hard, for the same reason the domain classifier is: a small model
* asked an open question about planning will write an essay about planning.
* It is given the domain vocabulary explicitly because a step whose domains are
* invented loads no tools at all and silently becomes a conversation.
*/
function planPrompt(goal) {
	return [
		"Break this goal into the fewest separate steps that actually do it.",
		"",
		`Goal: ${goal}`,
		"",
		"Answer with JSON only: {\"steps\":[{\"do\":\"...\",\"needs\":[\"os_app\"]}]}",
		"",
		"Each \"do\" is one instruction, phrased as a command, that can be carried out on its own.",
		"Each \"needs\" lists only the tool families that step requires:",
		"  os_app — applications, windows, typing, clicking, the screen",
		"  files  — reading and writing files on this computer",
		"  web    — searching the web and reading pages",
		"",
		"Rules:",
		`- At most 6 steps. Fewer is better.`,
		"- Do not invent steps the goal did not ask for.",
		"- If a later step needs something an earlier step produced, say so in the words of the instruction.",
		"- If the goal is really one action, return exactly one step."
	].join("\n");
}
var KNOWN_DOMAINS = /* @__PURE__ */ new Set([
	"os_app",
	"files",
	"web",
	"conversation"
]);
/**
* Read a plan out of the model's reply without trusting its formatting.
*
* Same tolerance as the domain classifier, for the same measured reason: small
* local models wrap JSON in prose, in code fences, and in `<think>` blocks.
* Returns null rather than a partial plan — half a plan executed is worse than
* no plan, because the goal ends up half done and reported as finished.
*/
function parsePlan(reply) {
	const cleaned = (reply ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "");
	const match = /\{[\s\S]*\}/.exec(cleaned);
	if (!match) return null;
	let parsed;
	try {
		parsed = JSON.parse(match[0]);
	} catch {
		return null;
	}
	const raw = parsed?.steps;
	if (!Array.isArray(raw) || raw.length === 0) return null;
	const steps = [];
	for (const item of raw.slice(0, 6)) {
		if (!item || typeof item !== "object") continue;
		const instruction = String(item.do ?? "").trim();
		if (!instruction) continue;
		const needs = item.needs;
		const domains = (Array.isArray(needs) ? needs : []).map((d) => String(d).trim().toLowerCase()).filter((d) => KNOWN_DOMAINS.has(d));
		steps.push({
			instruction,
			domains: domains.length > 0 ? [...new Set(domains)] : ["os_app"]
		});
	}
	return steps.length > 0 ? steps : null;
}
/**
* Remove structured payloads from a step's closing text.
*
* TRUNCATION WAS NOT ENOUGH, AND THE TEST FOR THIS FILE PROVED IT.
* A sub-agent that ends with "Found it. {"targets":[{"bounds":{...}} × 40]}"
* was trimmed to 240 characters — 240 characters OF BOUNDING BOXES, handed
* straight to the next step. The isolation was real only up to a length limit,
* which is another way of saying it was not real.
*
* A step summary is prose by definition: a sentence about what happened. JSON
* in it is a model quoting its own tool output, which is precisely the traffic
* being isolated, so it is cut out rather than shortened.
*/
function stripPayloads(text) {
	return text.replace(/[{[][\s\S]{80,}?[}\]]/g, " ").replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
}
/**
* The closing sentence of a sub-agent, trimmed to something a planner can hold.
*
* A step that returns four paragraphs defeats the isolation: the context saved
* by running it separately is spent again by quoting it in full. One or two
* sentences is what the next step actually needs.
*/
function summarise(result, limit = 240) {
	const text = stripPayloads(result.text ?? "");
	if (!text) {
		const last = result.steps[result.steps.length - 1];
		return last ? `Ran ${last.call.name}: ${last.outcome.detail}`.slice(0, limit) : "Nothing to report.";
	}
	if (text.length <= limit) return text;
	const cut = text.lastIndexOf(". ", limit);
	return cut > limit * .5 ? text.slice(0, cut + 1) : `${text.slice(0, limit).trim()}…`;
}
/**
* Decompose a goal and work through it, one isolated sub-agent per step.
*
* Falls back to a single ordinary run whenever planning does not apply or does
* not work — an unplanned goal still gets done, which is the behaviour that
* existed before this file and must survive it.
*/
async function runPlannedTask(deps, input) {
	const goal = (input.goal ?? "").trim();
	let steps = null;
	if (looksMultiStep(goal)) try {
		const reply = await deps.complete(planPrompt(goal), input.signal);
		steps = reply ? parsePlan(reply) : null;
	} catch {
		steps = null;
	}
	if (!steps || steps.length < 2) {
		const single = await runAgentTask(deps, {
			request: goal,
			signal: input.signal,
			memoryContext: input.memoryContext
		});
		return {
			goal,
			steps: [{
				instruction: goal,
				summary: summarise(single),
				ok: single.reason === "answered",
				toolCalls: single.steps.length,
				verified: single.allVerified
			}],
			text: single.text,
			ok: single.reason === "answered",
			planned: false
		};
	}
	const done = [];
	const carried = [];
	for (let index = 0; index < steps.length; index += 1) {
		if (input.signal?.aborted) break;
		const step = steps[index];
		deps.onStep?.(index, steps.length, step);
		const context = carried.length > 0 ? `${step.instruction}\n\nAlready done in this task:\n${carried.map((line, n) => `${n + 1}. ${line}`).join("\n")}` : step.instruction;
		let result;
		try {
			result = await runAgentTask(deps, {
				request: context,
				signal: input.signal,
				memoryContext: input.memoryContext,
				domains: step.domains
			});
		} catch (cause) {
			const why = cause instanceof Error ? cause.message : "that step failed";
			done.push({
				instruction: step.instruction,
				summary: why,
				ok: false,
				toolCalls: 0,
				verified: false
			});
			carried.push(`${step.instruction} — failed: ${why}`);
			continue;
		}
		const summary = summarise(result);
		const ok = result.reason === "answered";
		done.push({
			instruction: step.instruction,
			summary,
			ok,
			toolCalls: result.steps.length,
			verified: result.allVerified
		});
		carried.push(ok ? summary : `${step.instruction} — did not work: ${summary}`);
		if (result.reason === "cancelled") break;
	}
	const failed = done.filter((s) => !s.ok);
	return {
		goal,
		steps: done,
		text: done.map((s) => s.summary).join(" "),
		ok: failed.length === 0 && done.length === steps.length,
		planned: true
	};
}
/**
* The instruction block appended to the system prompt.
*
* Written as rules rather than as a schema dump: a 3B model follows "reply with
* one JSON object and nothing else" far more reliably than it follows a JSON
* Schema, and every extra token of schema is context the task itself needs.
*/
function toolInstructions(tools) {
	if (tools.length === 0) return "";
	return [
		"",
		"You can do things on this computer by calling one of these actions:",
		"",
		...tools.map((tool) => {
			const parameters = Object.entries(tool.parameters.properties).map(([name, spec]) => {
				const required = tool.parameters.required?.includes(name) ? "" : " (optional)";
				const choices = spec.enum ? ` [one of: ${spec.enum.join(", ")}]` : "";
				return `      ${name}${required}: ${spec.description}${choices}`;
			}).join("\n");
			return `  ${tool.name} — ${tool.description}\n${parameters || "      (no arguments)"}`;
		}),
		"",
		"TO CALL AN ACTION, reply with one JSON object and nothing else:",
		"{\"tool\": \"action_name\", \"arguments\": {\"name\": \"value\"}}",
		"",
		"Rules:",
		"- One action per reply. Take a step, see what happened, then decide the next one.",
		"- Look before you change anything, and look again afterwards.",
		"- When you have finished, or when no action is needed, reply in plain words with no JSON.",
		"- Never ask for or type passwords, one-time codes or payment details."
	].join("\n");
}
/**
* The first balanced JSON object in a string, ignoring braces inside strings.
*
* A regex cannot do this. `/\{[\s\S]*?\}/` stops at the first `}`, which is the
* end of the nested `arguments` object rather than the end of the call, and the
* greedy version swallows any prose that follows. This walks the text once.
*/
function firstJsonObject(text) {
	let depth = 0;
	let start = -1;
	let inString = false;
	let escaped = false;
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (inString) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === "\"") inString = false;
			continue;
		}
		if (character === "\"") {
			inString = true;
			continue;
		}
		if (character === "{") {
			if (depth === 0) start = index;
			depth += 1;
			continue;
		}
		if (character === "}") {
			depth -= 1;
			if (depth === 0 && start >= 0) return text.slice(start, index + 1);
			if (depth < 0) depth = 0;
		}
	}
	return null;
}
/**
* Read one model reply.
*
* Never throws, and never invents a call. A reply with no recognisable action
* is an answer — the loop treats that as the model having finished, which is
* the correct reading of "OCADE said something and asked for nothing".
*/
/**
* Runtime control directives that are not content.
*
* `/no_think` and `/think` are Qwen switches. They are meant for the runtime,
* not for anybody reading the reply, and the model echoes them back often
* enough that they end up in the output stream.
*
* OBSERVED, NOT ANTICIPATED. Asked "search youtube for" with no term, the model
* emitted a `youtube_search` call whose query was the literal string
* "/no_think" — and OCADE searched YouTube for it. A control token is never a
* search term, a filename or a sentence, so it is removed before anything reads
* the reply.
*/
var CONTROL_TOKEN = /(^|\s)\/(no_?think|think|nothink)\b/gi;
function stripControlTokens(text) {
	return text.replace(CONTROL_TOKEN, "$1").replace(/\s{2,}/g, " ").trim();
}
function parseModelReply(reply, known) {
	const withoutThinking = stripControlTokens(reply.replace(/<think>[\s\S]*?<\/think>/gi, ""));
	const candidate = firstJsonObject(withoutThinking);
	if (!candidate) return {
		text: withoutThinking.trim(),
		toolCalls: []
	};
	let parsed;
	try {
		parsed = JSON.parse(candidate);
	} catch {
		return {
			text: withoutThinking.trim(),
			toolCalls: []
		};
	}
	const record = parsed;
	let name = typeof record.tool === "string" ? record.tool : record.name;
	let rawArguments = record.arguments ?? record.args;
	if (typeof name !== "string" || !known.includes(name)) {
		const before = withoutThinking.slice(0, withoutThinking.indexOf(candidate));
		const prefixed = /([a-z_][a-z0-9_]{2,40})\s*:?\s*$/i.exec(before.trimEnd());
		if (prefixed && known.includes(prefixed[1])) {
			name = prefixed[1];
			rawArguments = parsed;
		}
	}
	if (typeof name !== "string" || !known.includes(name)) return {
		text: withoutThinking.trim(),
		toolCalls: []
	};
	const args = rawArguments && typeof rawArguments === "object" && !Array.isArray(rawArguments) ? rawArguments : {};
	return {
		text: withoutThinking.replace(candidate, "").replace(/```(json)?/gi, "").trim(),
		toolCalls: [{
			name,
			arguments: args
		}]
	};
}
/**
* Did the model announce a next step instead of taking it?
*
* THIS IS A REAL FAILURE MODE, NOT A HYPOTHETICAL. Measured on a live run: asked
* to open Notepad and type into it, a 1.5B model opened Notepad correctly and
* then replied "I have opened Notepad. Now, I will type ..." with no JSON. The
* loop reads "no tool call" as "the model has finished", so the task ended one
* step early while sounding like it was about to continue — the worst possible
* combination, because the transcript claims an intention the product never
* carried out.
*
* A model that says it is ABOUT to act has not finished. Recognising that and
* asking once for the action alone is a protocol repair rather than a
* workaround: the model's decision is unchanged, only its formatting is.
*
* Deliberately narrow. "I have opened Notepad" alone does not match — that is a
* completed report. It takes a forward-looking statement of intent.
*/
var ANNOUNCEMENT = /\b(?:i'?(?:m| am| will| shall|ll)|now i(?:'?ll| will)?|next(?:,| i)|let me|going to|i can now|i should)\b[^.!?]{0,90}\b(?:open|typ|click|press|writ|read|search|look|check|mov|switch|scroll|navigat|find|us|try|attempt|enter|fill)/i;
function announcesAnotherStep(text) {
	const trimmed = text.trim();
	if (!trimmed) return false;
	return ANNOUNCEMENT.test(trimmed.slice(-240));
}
/** The one-line correction sent when the model narrated instead of acting. */
var ACT_NOW_NUDGE = "You described the next step but did not take it. Reply with ONLY the JSON action object for that step and nothing else. If the task is genuinely finished, say so in one sentence without describing any further steps.";
/**
* Trim, collapse whitespace, and reject anything that is not real text.
*
* Returns null rather than "" so a caller cannot accidentally treat an absent
* argument as an empty one — the exact mistake that produced the blank YouTube
* search. Also rejects a capture that is only punctuation or a stray quote,
* which is what "search youtube for ." leaves behind.
*/
function requireText(value) {
	if (typeof value !== "string") return null;
	const cleaned = value.trim().replace(/\s+/g, " ").replace(/^["'`«»]+|["'`«».,!?]+$/g, "").trim();
	if (cleaned.length === 0) return null;
	if (!/[\p{L}\p{N}]/u.test(cleaned)) return null;
	return cleaned;
}
/**
* Words that cannot be a search on their own.
*
* FOUND BY THE TESTS FOR THIS FILE, WHICH IS THE POINT OF HAVING THEM.
* "search the web for" extracts cleanly to "for", and "search youtube for"
* extracts to "for": each pattern's optional `(?:for\s+)?` group needs a
* trailing space, so with nothing after it the preposition itself becomes the
* query. `requireText` was satisfied — "for" is real text — and OCADE would
* have searched YouTube for the word "for".
*
* That is the same failure as the blank query wearing a disguise, so it is
* caught in the same place.
*/
var NOT_A_QUERY = /* @__PURE__ */ new Set([
	"for",
	"the",
	"a",
	"an",
	"it",
	"this",
	"that",
	"them",
	"me",
	"up",
	"on",
	"in",
	"to",
	"about",
	"some",
	"something",
	"anything",
	"stuff",
	"and",
	"or",
	"please",
	"web",
	"internet",
	"online",
	"youtube",
	"google"
]);
/** A search term that is worth sending, or null. */
function meaningfulQuery(value) {
	const text = requireText(value);
	if (!text) return null;
	if (text.toLowerCase().split(/\s+/).every((word) => NOT_A_QUERY.has(word))) return null;
	return text;
}
/**
* Strip the sentence scaffolding off an extracted search query.
*
* THE BUG THIS FIXES, SEEN IN THE ADDRESS BAR.
* ---------------------------------------------
*     "open the song in youtube and play the best song"
*        -> youtube.com/results?search_query=and+play+the+best+song
*     "open chrome and open youtube and search for english song"
*        -> youtube.com/results?search_query=and+search+for+english+song
*
* Every pattern here captures "everything after the keyword", which on a
* compound sentence is the rest of the instruction rather than the thing to
* search for. The connector and the verb ride along into the query, and
* YouTube dutifully searches for them.
*
* Peeled from BOTH ENDS and repeatedly, because real sentences stack them:
* "and play the best song" is a connector, then a verb, then the query. Done
* once, "and" would come off and "play" would stay.
*
* This is deliberately a shared function rather than a tweak to one regex —
* the same leakage was live on the YouTube rules and the web-search rules, and
* the next rule someone adds inherits the cleaning instead of the bug.
*/
var QUERY_LEAD = /^(?:and|then|also|so|now|please|ok(?:ay)?|to|for|of|it|go|open|launch|start|play|put on|watch|listen to|stream|search(?: for)?|find|look(?: for| up)?|show me|get me|give me|the song|a song|some song|the video|a video|video of|song of|a)\b[\s,:-]*/i;
var QUERY_TAIL = /[\s,:-]*\b(?:please|thanks|thank you|for me|on youtube|in youtube|on the internet|on the web|online)\b\.?$/i;
/** Remove leading connectors/verbs and trailing site names, repeatedly. */
function cleanQuery(raw) {
	let text = requireText(raw);
	if (!text) return null;
	for (let pass = 0; pass < 8; pass += 1) {
		const before = text;
		text = text.replace(QUERY_LEAD, "").replace(QUERY_TAIL, "").trim();
		if (text === before) break;
		if (!text) return null;
	}
	return meaningfulQuery(text);
}
/**
* Local folders, which are not applications and must never become a web search.
*
* THE BUG, SEEN LIVE: "open downloads folder and open the folder named mummy"
* launched Bing and searched for "downloads folder". `app_open` looked for an
* installed program called that, found none, and the fallback path went to the
* web — so a request about this computer was answered by the internet.
*
* A shell folder has a canonical name Windows itself resolves, so this is a
* lookup rather than a guess. Listed once, here, and shared: the same names
* would otherwise have to be repeated in the app resolver, and the two copies
* would disagree the first time somebody added one.
*/
var SHELL_FOLDERS = {
	downloads: "Downloads",
	download: "Downloads",
	documents: "Personal",
	document: "Personal",
	desktop: "Desktop",
	pictures: "My Pictures",
	photos: "My Pictures",
	videos: "My Video",
	movies: "My Video",
	music: "My Music",
	"recycle bin": "RecycleBinFolder",
	"this pc": "MyComputerFolder",
	"my computer": "MyComputerFolder",
	computer: "MyComputerFolder",
	"c drive": "MyComputerFolder",
	home: "UsersFilesFolder",
	"user folder": "UsersFilesFolder",
	"home folder": "UsersFilesFolder"
};
/** The shell folder a phrase names, ignoring "folder"/"my" noise. */
function shellFolderFor(raw) {
	const text = requireText(raw);
	if (!text) return null;
	const key = text.toLowerCase().replace(/^(?:my|the)\s+/, "").replace(/\sfolder\b.*$/, "").replace(/\sdirectory\b.*$/, "").trim();
	return Object.prototype.hasOwnProperty.call(SHELL_FOLDERS, key) ? SHELL_FOLDERS[key] : null;
}
/**
* Peel the scaffolding off a named contact.
*
* "open whatsapp and search HE PERSON NAMED H" — the typo is real, taken from
* a live run, and it is why this is a loop rather than one optional group in
* the pattern. `(?:the\s+)?` does not match "he ", so the contact came out as
* "he person named H" and WhatsApp was searched for that whole phrase.
*
* Stripping repeatedly from the front handles any order and any subset of the
* filler words, and survives the next misspelling without a new branch.
*/
var CONTACT_NOISE = /^(?:the|he|a|an|for|to|of|my|person|contact|group|chat|named|called|nemed|calld)\b[\s,]*/i;
function contactName(raw) {
	let text = requireText(raw);
	if (!text) return null;
	for (let pass = 0; pass < 8; pass += 1) {
		const before = text;
		text = text.replace(CONTACT_NOISE, "").trim();
		if (text === before) break;
		if (!text) return null;
	}
	return requireText(text);
}
/**
* Split a message clause into "who it is for" and "what to say".
*
* THE BUG, FROM A LIVE RUN, VISIBLE IN THE TIMELINE.
* ---------------------------------------------------
* "open whatsapp and search for H and message H hi" reached the composer as
* the brief "message H hi" — the command verb and the recipient's name were
* still attached to the payload, so OCADE was asked to WRITE SOMETHING ABOUT
* the phrase "message H hi" rather than to type "hi".
*
* The instruction already contains the exact words. "message H hi" is not a
* brief; it is a quotation. So the verb comes off, the target comes off, and
* what remains is typed VERBATIM — no model involved, which also makes it
* instant and impossible to paraphrase.
*
* LITERAL AND BRIEF ARE DIFFERENT THINGS AND THE DIFFERENCE IS THE LEADING
* VERB. "message H hi" gives the words. "ask a question about computers" gives
* a job. Typing the second one verbatim would send the sentence "ask a
* question about computers" to somebody, which is exactly as wrong as
* paraphrasing the first.
*/
var MESSAGE_VERB = /^(?:message|msg|send|text|tell|write to|say to|speak to|type|write|say)\b[\s,:-]*/i;
/**
* A pronoun standing in for the recipient, which is also not the message.
*
* "tell him the build is done" lost "tell" and kept "him", so the typed text
* began with a word addressed to nobody. The recipient can be named or it can
* be a pronoun; either way it is the envelope, not the letter.
*/
var MESSAGE_OBJECT = /^(?:to\s+)?(?:him|her|them|it|everyone|the group)\b[\s,:-]*/i;
/** Verbs that describe a job rather than supply the words. */
var COMPOSE_VERB = /^(?:ask|write|compose|summari[sz]e|explain|describe|draft|tell (?:him|her|them) about|make up|think of|come up with|generate)\b/i;
/**
* Words that mean "operate the computer", not "say this to somebody".
*
* A payload containing these is not a message; it is the instruction that was
* supposed to produce one. See `messageClause` for why that distinction is a
* safety property rather than a nicety.
*/
var INSTRUCTION_WORDS = /\b(?:open|launch|search|find|look\s+for|navigate|click|scroll|contact named|the contact|whats+app?|browser|chrome)\b/i;
/**
* The noun people put AFTER the words they want sent.
*
* "send meta ai hi message" — the last word is a description of the thing, not
* part of it. Sending "hi message" is not badly wrong, but it is wrong, and it
* is wrong in a way the person reading the chat can see.
*/
var TRAILING_NOUN = /[\s,]*\b(?:as\s+(?:a|the)\s+)?(?:message|msg|text|note)\b[.!]?$/i;
/**
* The hinge between naming a message and quoting it.
*
* "send H a message saying good morning" — everything up to and including
* "saying" is grammar. The words start after it. Without this the payload
* began "saying good morning", which is not what anybody wants delivered.
*/
var QUOTE_HINGE = /^(?:(?:a|an|the)\s+)?(?:message|msg|text|note)?\s*(?:saying|that\s+says|which\s+says|reading|:)\b[\s,:-]*/i;
/**
* Does this look like a name with a message stuck to it?
*
* The cheap test that decides whether to spend a screen read. A single word is
* just a name -- "whatsapp find H" needs no resolving and should stay on the
* fast deterministic path. Two or more words MIGHT be "Meta AI" (a name), or
* "meta ai hi" (a name plus a message), and nothing about the words themselves
* distinguishes those two. Only the contact list does.
*
* So this is deliberately permissive: it decides "worth looking", not "is a
* message". `resolve_target` in `core/messaging.py` gives the real answer, and
* refuses rather than guessing when no conversation opens the phrase.
*/
function looksLikeNameAndMessage(phrase) {
	return phrase.trim().split(/\s+/).length >= 2;
}
function messageClause(rest, who) {
	const text = requireText(rest);
	if (!text) return {};
	const withoutNoun = text.replace(TRAILING_NOUN, "").trim() || text;
	const verb = /\b(?:message|msg|send|text|tell|say|write|type)\b/gi;
	let payloadFrom = -1;
	for (let hit = verb.exec(withoutNoun); hit; hit = verb.exec(withoutNoun)) payloadFrom = hit.index + hit[0].length;
	let body = payloadFrom >= 0 ? withoutNoun.slice(payloadFrom) : withoutNoun;
	for (let pass = 0; pass < 5; pass += 1) {
		const before = body;
		body = body.replace(/^[\s,:-]+/, "");
		body = body.replace(MESSAGE_VERB, "");
		body = body.replace(MESSAGE_OBJECT, "");
		body = body.replace(QUOTE_HINGE, "");
		if (who) {
			const name = who.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			body = body.replace(new RegExp(`^(?:to\\s+)?${name}\\b[\\s,:-]*`, "i"), "");
		}
		body = body.trim();
		if (body === before) break;
	}
	body = body.replace(TRAILING_NOUN, "").trim();
	const cleaned = requireText(body);
	if (!cleaned) return {};
	if (INSTRUCTION_WORDS.test(cleaned)) return { unclear: cleaned };
	return COMPOSE_VERB.test(cleaned) ? { brief: cleaned } : { literal: cleaned };
}
/**
* Words that mean "produce some prose", spelled correctly.
*
* Deliberately small. This is the difference between `type hello` (put those
* characters in the box) and `type a poem` (think of one first), and getting it
* wrong in either direction is bad: a literal treated as a brief comes back as
* a paragraph ABOUT the words, and a brief typed literally puts the
* instruction into the document.
*/
var CONTENT_WORDS = [
	"about",
	"regarding",
	"essay",
	"paragraph",
	"note",
	"poem",
	"story",
	"summary",
	"letter",
	"article",
	"list",
	"recipe",
	"song",
	"joke"
];
/** One insertion, deletion or substitution apart? */
function nearlyEqual(a, b) {
	if (a === b) return true;
	if (Math.abs(a.length - b.length) > 1) return false;
	const [short, long] = a.length <= b.length ? [a, b] : [b, a];
	let i = 0;
	let j = 0;
	let slack = 1;
	while (i < short.length && j < long.length) {
		if (short[i] === long[j]) {
			i += 1;
			j += 1;
			continue;
		}
		if (slack === 0) return false;
		slack -= 1;
		if (short.length === long.length) i += 1;
		j += 1;
	}
	return true;
}
/**
* Is this a brief to write from, rather than characters to type?
*
* THE TYPO THAT COST A WHOLE RUN. "open notepad and in notepad type a English
* porm" — `porm` for `poem`. The exact-match gate rejected it, so the leftover
* went to the model rather than the compose path; the model saw `app_open` in
* its tools and OPENED NOTEPAD A SECOND TIME, and nothing was ever written.
* The user watched a duplicated action and an empty document.
*
* People typo the very word that decides this. So each word is compared to the
* content words allowing ONE character of difference, which recovers `porm`,
* `eassy` and `stroy` without matching anything that is not trying to be one.
*
* A leading "a" or "an" also counts, and that is the part which catches a
* content word this list has never heard of: "type a X" asks for an X to be
* produced, and nobody types an indefinite article as literal content.
*/
function looksLikeWriting(brief) {
	const words = brief.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
	if (words.length === 0) return false;
	if (words[0] === "a" || words[0] === "an") return true;
	if (/\bon the topic of\b/i.test(brief)) return true;
	if (/\b(?:\d+|a few|several|two|three|four|five|ten)\s+(?:words?|lines?|sentences?|paragraphs?)\b/i.test(brief)) return true;
	return words.some((word) => CONTENT_WORDS.some((known) => nearlyEqual(word, known)));
}
/**
* Did the user actually ask for this to be SENT?
*
* "type hi to Meta AI" and "send hi to Meta AI" are different instructions, and
* the difference is the whole safety boundary here: a message reaching another
* person cannot be recalled. So the trigger is their own verb, never a default
* and never an inference from context.
*
* `type`, `write` and `draft` are deliberately absent. Somebody who used one of
* those asked for the words to be put in the box, and putting them there is the
* entire request.
*/
var SEND_VERB = /\b(?:send|sent|deliver|shoot|fire off|dispatch)\b/i;
function asksToSend(request) {
	return SEND_VERB.test(request);
}
/** Strip the polite scaffolding people put round an instruction. */
function core(request) {
	return request.trim().replace(/^(please|hey|ok(ay)?|now|could you|can you|would you|i want you to|i'?d like you to)\b[\s,]*/gi, "").replace(/\bfor me\b|\bplease\b/gi, "").replace(/\s+/g, " ").trim();
}
/** Words that begin a reference this layer cannot resolve. */
var VAGUE_HEAD = /^(it|that|this|these|those|them|there|the|a|an|my|your|our|their|his|her|its|some|any|another|up|whatever)$/i;
/** Words that only appear inside a clause — never inside a program's name. */
var CLAUSE_WORD = /\b(i|you|we|they|was|were|is|are|am|be|been|just|which|who|whom|whose|that|with|from|about|into|for)\b/i;
/** Where a second instruction starts, when one is glued to the first. */
var CLAUSE_BREAK = /\s+(?:and|then|&|,|so|to|but|plus|after that)\s+|\s*[,;]\s*/i;
/**
* Split "Notepad and write a 200-word essay" into the app and what is left.
*
* THE BUG THIS FIXES, MEASURED LIVE. The old extraction captured to the end of
* the string, so "Open Notepad and write a 200-word essay about fast cars"
* produced `app_open({name: "Notepad and write a 200-word essay about fast
* cars"})`. OCADE tried to launch a program by that name, the model was never
* consulted, and the essay was never written — while the run reported success.
*
* The remainder is RETURNED rather than discarded, because the half this pass
* cannot serve is still the user's instruction. The caller runs the open and
* then hands the rest to the model, which is what "open Notepad and write an
* essay" always meant.
*/
function splitAppAndRemainder(raw) {
	const text = requireText(raw);
	if (!text) return {
		name: null,
		remainder: null
	};
	const breakAt = text.search(CLAUSE_BREAK);
	const head = breakAt >= 0 ? text.slice(0, breakAt) : text;
	const tail = breakAt >= 0 ? text.slice(breakAt).replace(/^(?:\s*[,;]\s*|\s*(?:and|then|&|so|but|plus|after that)\s+)+/i, "").trim() : "";
	const name = requireText(head.replace(/\b(the|app|application|program|window|please)\b/gi, "").replace(/\s+/g, " ").trim());
	if (!name) return {
		name: null,
		remainder: null
	};
	const words = name.split(/\s+/);
	if (words.length > 4) return {
		name: null,
		remainder: null
	};
	if (VAGUE_HEAD.test(words[0])) return {
		name: null,
		remainder: null
	};
	if (CLAUSE_WORD.test(name)) return {
		name: null,
		remainder: null
	};
	return {
		name,
		remainder: tail ? tail : null
	};
}
var URL_LIKE = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)\b/i;
function asUrl(raw) {
	const text = requireText(raw);
	if (!text) return null;
	const match = URL_LIKE.exec(text);
	if (!match) return null;
	const found = match[1];
	return /^https?:\/\//i.test(found) ? found : `https://${found}`;
}
/**
* Sequencing words: this instruction asks for more than one thing.
*
* FOUND LIVE, AND IT WAS THE STALL EVERYTHING ELSE GOT BLAMED FOR.
*
* "Check how much memory this computer is using, THEN save that number into a
* file called memory-check.txt" contains the substring "how much memory". The
* system-status rule below matched it, the router answered the first clause,
* executed one tool, and ended the mission reporting success. The file was
* never written and nothing said so.
*
* Two model swaps and a classifier fix were made chasing that symptom, because
* from the outside it looks exactly like a model that gave up after one step.
* It never reached a model at all — one request in the whole run, and it went
* straight to the executor.
*
* The rule the router has to keep is not "match tightly" but "claim only what
* you can finish". Every pattern here answers with ONE action; an instruction
* naming a second one is, by construction, not something this pass can serve,
* however well its first half matches.
*
* Bare "and" is deliberately excluded: "open notepad and type hello" is two
* steps, but "search for cats and dogs" is one, and no cheap test separates
* them. The words below cannot mean anything but sequence.
*/
var SEQUENCING = /\bthen\b|\bafter (that|which|it)\b|\bfollowed by\b|\band (then|after|also)\b|\bnext,\s|\bonce (that|you)('?ve| have)?\b|;\s*\w/i;
/**
* Route a request without a model, or return null.
*
* Pure and synchronous. Every rule is one regular expression, one extraction and
* one validation, so the whole pass costs microseconds and can be reasoned about
* by reading it top to bottom.
*/
function routeDirect(request) {
	const text = core(request);
	if (!text) return null;
	const lower = text.toLowerCase();
	if (SEQUENCING.test(lower) && !/^(stop|halt|cancel|abort|pause|continue|resume)\b/i.test(lower)) {
		const lead = /^(?:open|launch|start|run)\s+(.+)$/i.exec(text);
		if (lead) {
			const { name, remainder } = splitAppAndRemainder(lead[1]);
			if (name && remainder) return {
				calls: [{
					name: "app_open",
					arguments: { name }
				}],
				say: `Opening ${name}, then carrying on.`,
				rule: "app.open",
				remainder
			};
		}
		return null;
	}
	const setVolume = /^(?:set\s+)?(?:the\s+)?(?:volume|sound)\s*(?:to|at|=)\s*(\d{1,3})\s*%?$/i.exec(lower) ?? /^(?:set|change|put)\s+(?:the\s+)?(?:volume|sound)\s+(\d{1,3})\s*%?$/i.exec(lower);
	if (setVolume) {
		const level = Number(setVolume[1]);
		if (Number.isFinite(level) && level <= 100) return {
			calls: [{
				name: "system_volume",
				arguments: {
					action: "set",
					level
				}
			}],
			say: `Setting the volume to ${level}%.`,
			rule: "system.volume.set"
		};
	}
	if (/^(?:mute|silence)(?:\s+(?:the\s+)?(?:pc|computer|sound|audio|volume|everything))?$/i.test(lower)) return {
		calls: [{
			name: "system_volume",
			arguments: { action: "mute" }
		}],
		say: "Muting.",
		rule: "system.volume.mute"
	};
	if (/^(?:unmute|unsilence)(?:\s+(?:the\s+)?(?:pc|computer|sound|audio|volume))?$/i.test(lower)) return {
		calls: [{
			name: "system_volume",
			arguments: { action: "unmute" }
		}],
		say: "Unmuting.",
		rule: "system.volume.unmute"
	};
	if (/^(?:turn\s+)?(?:the\s+)?(?:volume|sound)\s+up$|^louder$/i.test(lower)) return {
		calls: [{
			name: "system_volume",
			arguments: {
				action: "step",
				by: 10
			}
		}],
		say: "Turning it up.",
		rule: "system.volume.up"
	};
	if (/^(?:turn\s+)?(?:the\s+)?(?:volume|sound)\s+down$|^quieter$/i.test(lower)) return {
		calls: [{
			name: "system_volume",
			arguments: {
				action: "step",
				by: -10
			}
		}],
		say: "Turning it down.",
		rule: "system.volume.down"
	};
	if (/^(stop|halt|cancel|abort|stop it|stop now|that'?s enough|quit)\b\.?$/i.test(lower)) return {
		control: "stop",
		calls: [],
		say: "Stopping.",
		rule: "control.stop"
	};
	if (/^(pause|hold on|wait|hang on|freeze)\b\.?$/i.test(lower)) return {
		control: "pause",
		calls: [],
		say: "Paused.",
		rule: "control.pause"
	};
	if (/^(continue|resume|carry on|go on|keep going|proceed)\b\.?$/i.test(lower)) return {
		control: "continue",
		calls: [],
		say: "Carrying on.",
		rule: "control.continue"
	};
	const asksTheWeb = /^(?:search|google|look up|find out|browse)\b/i.test(lower) || /\bsearch (?:the )?(?:web|internet|online)\b/i.test(lower);
	if (/^(?:lock (?:the )?(?:pc|computer|screen|it)|lock)$/i.test(lower)) return {
		calls: [{
			name: "system_power",
			arguments: { action: "lock" }
		}],
		say: "Locking.",
		rule: "system.lock"
	};
	if (/^(?:go to sleep|sleep(?: the (?:pc|computer))?|put (?:the )?(?:pc|computer) to sleep)$/i.test(lower)) return {
		calls: [{
			name: "system_power",
			arguments: { action: "sleep" }
		}],
		say: "Going to sleep.",
		rule: "system.sleep"
	};
	const brightness = /^(?:set\s+)?(?:the\s+)?brightness\s*(?:to|at|=)?\s*(\d{1,3})\s*%?$/i.exec(lower) ?? /^(?:set|change|put)\s+(?:the\s+)?brightness\s+(\d{1,3})\s*%?$/i.exec(lower);
	if (brightness) {
		const percent = Number(brightness[1]);
		if (Number.isFinite(percent) && percent <= 100) return {
			calls: [{
				name: "system_brightness",
				arguments: {
					action: "set",
					percent
				}
			}],
			say: `Setting the brightness to ${percent}%.`,
			rule: "system.brightness.set"
		};
	}
	if (!asksTheWeb && /^(?:what(?:'?s| is) (?:the |my )?wifi|which (?:wifi|network) am i on|wifi status)\??$/i.test(lower)) return {
		calls: [{
			name: "system_wifi",
			arguments: { action: "status" }
		}],
		say: "Checking the network.",
		rule: "system.wifi"
	};
	if (!asksTheWeb && /\b(?:what(?:'?s| is) (?:on )?(?:my |the )?clipboard|what did i (?:just )?copy)\b/i.test(lower)) return {
		calls: [{
			name: "clipboard_read",
			arguments: {}
		}],
		say: "Reading the clipboard.",
		rule: "clipboard.read"
	};
	if (!asksTheWeb && /\bgames?\b/i.test(lower) && /\b(?:updat\w*|installed|behind|out of date)\b/i.test(lower) && !/\b(?:update (?:my |all )?games?\b|update all)\b/i.test(lower)) return {
		calls: [{
			name: "game_list",
			arguments: {}
		}],
		say: "Checking your games.",
		rule: "games.list"
	};
	if (/\b(?:phone dashboard|control (?:this|my) (?:pc|computer) from my phone|pair my phone)\b/i.test(lower)) return {
		calls: [{
			name: "phone_dashboard",
			arguments: { action: "start" }
		}],
		say: "Opening the phone dashboard.",
		rule: "remote.start"
	};
	if (/\b(?:start|launch|run)\b.{0,20}\b(?:with (?:windows|my computer)|at (?:start ?up|login|boot))\b/i.test(lower)) {
		const off = /\b(?:don'?t|do not|stop|no longer|disable)\b/i.test(lower);
		return {
			calls: [{
				name: "autostart",
				arguments: { enable: off ? "no" : "yes" }
			}],
			say: off ? "Turning off start-up." : "Starting with your computer from now on.",
			rule: "system.autostart"
		};
	}
	const mentionsCamera = /\b(?:webcam|my camera|the camera)\b/i.test(lower);
	if (mentionsCamera && /\b(?:look|see|check|what|show|through)\b/i.test(lower)) return {
		calls: [{
			name: "see",
			arguments: { source: "webcam" }
		}],
		say: "Looking through the camera.",
		rule: "vision.webcam"
	};
	if (!asksTheWeb && !mentionsCamera && /\b(what(?:'?s| is) on (my|the) screen|what (do|can) you see|read (my|the) screen|look at (my|the) screen|describe (my|the) screen|show me (my|the) screen)\b/i.test(lower)) return {
		calls: [{
			name: "screen_observe",
			arguments: {}
		}],
		say: "Looking at your screen.",
		rule: "observe.screen"
	};
	if (!asksTheWeb && /\b(what|which) (windows|apps|applications|programs) (are |do i have )?open\b|\blist (my |the )?(open )?windows\b|\bwhat(?:'?s| is) open\b/i.test(lower)) return {
		calls: [{
			name: "window_list",
			arguments: {}
		}],
		say: "Reading your open windows.",
		rule: "observe.windows"
	};
	if (!asksTheWeb && /\b(system status|how is my (pc|computer) doing|cpu usage|memory usage|how much (ram|memory)|battery (level|percentage|status)|why is my (pc|computer) slow|what(?:'?s| is) my (cpu|memory|ram|battery))\b/i.test(lower)) return {
		calls: [{
			name: "system_status",
			arguments: {}
		}],
		say: "Reading this computer's state.",
		rule: "observe.system"
	};
	if (!asksTheWeb && /\b(what|how many) (screens|displays|monitors)\b|\blist (my |the )?(screens|displays|monitors)\b/i.test(lower)) return {
		calls: [{
			name: "display_list",
			arguments: {}
		}],
		say: "Checking your screens.",
		rule: "observe.displays"
	};
	if (!asksTheWeb && /\bwhat (applications|apps|programs) (are |do i have )?installed\b/i.test(lower)) return {
		calls: [{
			name: "app_list_installed",
			arguments: {}
		}],
		say: "Checking what is installed.",
		rule: "observe.installed"
	};
	const whatsapp = /^(?:open|launch|start)?\s*(?:whats+app?|whatsap)\b[\s,]*(?:and\s+)?(?:then\s+)?(?:search|find|open|message|text)?\s*(?:for\s+)?(?:the\s+)?(?:person|contact|group|chat)?\s*(?:named\s+|called\s+)?(?<who>.+)?$/i.exec(text);
	if (/\b(?:whats+app?|whatsap)\b/i.test(lower) && whatsapp?.groups) {
		const raw = requireText(whatsapp.groups.who ?? null);
		const breakAt = raw ? raw.search(CLAUSE_BREAK) : -1;
		const who = contactName(breakAt >= 0 ? raw.slice(0, breakAt) : raw);
		const clause = messageClause(breakAt >= 0 && raw ? requireText(raw.slice(breakAt).replace(/^(?:\s*[,;]\s*|\s*(?:and|then|&|so|but|plus|after that)\s+)+/i, "")) : null, who);
		if (who && !clause.literal && !clause.brief && looksLikeNameAndMessage(who)) {
			const sending = asksToSend(text);
			return {
				calls: [{
					name: "whatsapp_open",
					arguments: {}
				}, {
					name: "message_to",
					arguments: {
						phrase: who,
						...sending ? { send: "yes" } : {}
					}
				}],
				say: sending ? `Opening WhatsApp, working out who you meant by “${who}”, and sending it.` : `Opening WhatsApp and working out who you meant by “${who}”.`,
				rule: "message.to.screen"
			};
		}
		if (who) return {
			calls: [
				{
					name: "whatsapp_open",
					arguments: {}
				},
				{
					name: "whatsapp_find_contact",
					arguments: { contact: who }
				},
				...clause.literal ? [{
					name: "whatsapp_type",
					arguments: { message: clause.literal }
				}, ...asksToSend(text) ? [{
					name: "whatsapp_send",
					arguments: { message: clause.literal }
				}] : []] : []
			],
			say: clause.literal ? `Opening WhatsApp, finding ${who} and typing “${clause.literal}”.` : clause.brief ? `Opening WhatsApp and finding ${who}, then writing.` : `Opening WhatsApp and finding ${who}.`,
			rule: "whatsapp.find",
			...clause.brief ? { compose: {
				brief: clause.brief,
				app: "whatsapp"
			} } : {},
			...clause.unclear ? { remainder: clause.unclear } : {}
		};
		return {
			calls: [{
				name: "whatsapp_open",
				arguments: {}
			}],
			say: "Opening WhatsApp.",
			rule: "whatsapp.open"
		};
	}
	if (/\byoutube\b/i.test(lower)) {
		const playPatterns = [
			/\b(?:play|put on|listen to|stream)\s+(.+?)\s+(?:on|in|from)\s+youtube\b/i,
			/\b(?:on|in)\s+youtube[,: ]+(?:play|put on|listen to)\s+(.+)$/i,
			/\byoutube[,: ]+(?:play|put on|listen to)\s+(.+)$/i
		];
		if (/\b(?:play|put on|listen to|stream)\b/i.test(lower)) for (const pattern of playPatterns) {
			const query = cleanQuery(pattern.exec(text)?.[1]);
			if (query) return {
				calls: [{
					name: "youtube_play",
					arguments: { query }
				}],
				say: `Playing “${query}” on YouTube.`,
				rule: "web.youtube.play"
			};
		}
		for (const pattern of [
			/\b(?:search (?:on |in )?youtube for|youtube search for|search youtube for)\s+(.+)$/i,
			/\b(?:play|put on|find|search for|look for)\s+(.+?)\s+(?:on|in)\s+youtube\b/i,
			/\bon youtube[,: ]+(?:search for|find|play|look for)\s+(.+)$/i,
			/\byoutube\s+(?:for\s+)?(.+)$/i
		]) {
			const query = cleanQuery(pattern.exec(text)?.[1]);
			if (query) return {
				calls: [{
					name: "youtube_search",
					arguments: { query }
				}],
				say: `Searching YouTube for “${query}”.`,
				rule: "web.youtube.search"
			};
		}
		if (/\b(open|go to|launch)\b/i.test(lower)) return {
			calls: [{
				name: "browser_navigate",
				arguments: { url: "https://www.youtube.com" }
			}],
			say: "Opening YouTube.",
			rule: "web.youtube.open"
		};
		return null;
	}
	if (/^(?:who|what|when|where|which|how much|how many|is|are|did|does|do)\b/i.test(lower) && (/\b(?:today|todays|tonight|right now|currently|current|latest|recent|this (?:week|month|year|morning|evening)|so far|as of now|up to date|breaking)\b/i.test(lower) || /\b(?:price|prices|cost of|score|scores|news|headlines|stock|shares|exchange rate|who won|what happened|release date)\b/i.test(lower))) {
		const asked = requireText(text);
		if (asked) return {
			calls: [{
				name: "parallel_search",
				arguments: { query: asked }
			}],
			say: "Checking that against live sources.",
			rule: "web.ask.live"
		};
	}
	const searchPatterns = [
		/^(?:search|google|look up|find out|find)\s+(?:the (?:web|internet)\s+)?(?:for\s+)?(.+)$/i,
		/\bsearch (?:the )?(?:web|internet|online) for\s+(.+)$/i,
		/\bwhat is (the )?(.+)$/i
	];
	if (/\b(search|google|look up)\b/i.test(lower)) {
		for (const pattern of searchPatterns) {
			const query = cleanQuery(pattern.exec(text)?.[1]);
			if (query) return {
				calls: [{
					name: "parallel_search",
					arguments: { query }
				}],
				say: `Looking that up: “${query}”.`,
				rule: "web.search"
			};
		}
		return null;
	}
	if (/\b(open|go to|navigate to|visit|browse to)\b/i.test(lower)) {
		const url = asUrl(text);
		if (url) return {
			calls: [{
				name: "browser_navigate",
				arguments: { url }
			}],
			say: `Opening ${url}.`,
			rule: "web.navigate"
		};
	}
	if (/\b(scroll (down|up)|page (down|up))\b/i.test(lower)) {
		const direction = /\b(up)\b/i.test(lower) ? "up" : "down";
		return {
			calls: [{
				name: "browser_scroll",
				arguments: { direction }
			}],
			say: `Scrolling ${direction}.`,
			rule: "web.scroll"
		};
	}
	if (/\b(what|which) tabs\b|\blist (my |the )?tabs\b|\bshow (my |the )?tabs\b/i.test(lower)) return {
		calls: [{
			name: "browser_tabs",
			arguments: {}
		}],
		say: "Reading your open tabs.",
		rule: "web.tabs"
	};
	const media = /\b(pause|play|resume|stop|mute|unmute)\b.{0,20}\b(video|music|song|audio|it|playback|media)\b/i.exec(lower);
	if (media) {
		const verb = media[1].toLowerCase();
		const action = verb === "resume" ? "play" : verb === "stop" ? "pause" : verb;
		if ([
			"play",
			"pause",
			"mute",
			"unmute"
		].includes(action)) return {
			calls: [{
				name: "browser_media",
				arguments: { action }
			}],
			say: `${action[0].toUpperCase()}${action.slice(1)}ing the media.`,
			rule: "web.media"
		};
	}
	const focus = /\b(?:switch to|focus|bring (?:up )?|go to)\s+(.+?)(?:\s+(?:app|application|window))?$/i.exec(text);
	if (focus) {
		const { name, remainder } = splitAppAndRemainder(focus[1]);
		if (name) return {
			calls: [{
				name: "app_focus",
				arguments: { name }
			}],
			say: remainder ? `Switching to ${name}, then carrying on.` : `Switching to ${name}.`,
			rule: "app.focus",
			...remainder ? { remainder } : {}
		};
	}
	const write = /^(?:in|on|into|inside)\s+(?<app>[\w.+-]+(?:\s[\w.+-]+){0,2}?)[,:]?\s+(?:type|write|compose|draft)\s+(?<brief>.+)$/i.exec(text) ?? /^(?:type|write|compose|draft)\s+(?<brief>.+)\s+(?:in|into|on)\s+(?<app>[\w.+-]+(?:\s[\w.+-]+){0,2})$/i.exec(text) ?? /^(?:type|write|compose|draft)\s+(?<brief>.+)$/i.exec(text);
	if (write?.groups) {
		const raw = (write.groups.brief ?? "").trim();
		const quoted = /^["'“”«](.+)["'”»]$/.exec(raw);
		const brief = requireText(write.groups.brief);
		const app = requireText(write.groups.app ?? null);
		const literal = quoted ? requireText(quoted[1]) : null;
		const describesContent = !literal && brief !== null && looksLikeWriting(brief);
		if (literal) return {
			calls: [...app ? [{
				name: "app_focus",
				arguments: { name: app }
			}] : [], {
				name: "type_text",
				arguments: { text: literal }
			}],
			say: app ? `Typing that into ${app}.` : "Typing that.",
			rule: "write.literal"
		};
		if (brief && describesContent) return {
			calls: app ? [{
				name: "app_focus",
				arguments: { name: app }
			}] : [],
			say: app ? `Writing that into ${app}.` : "Writing that.",
			rule: "write.compose",
			compose: {
				brief,
				...app ? { app } : {}
			}
		};
	}
	if (/\b(?:introduce|introduction)\b/i.test(lower) || /^(?:who are you|what are you|tell me about yourself|say hi|say hello)\b/i.test(lower)) return {
		calls: [{
			name: "introduce",
			arguments: { tone: text }
		}],
		say: "Introducing myself.",
		rule: "identity.introduce"
	};
	const clearFolder = /^(?:delete|remove|clear|empty|clean out)\s+(?:all\s+)?(?:the\s+)?(?:present\s+)?(?:files?|contents?|everything)\s*(?:that\s+are\s+)?(?:in|inside|within|from|out of)\s+(?:the\s+)?(?<where>.+)$/i.exec(text);
	if (clearFolder?.groups?.where) {
		const where = requireText(clearFolder.groups.where.replace(/\s+folder\s*$/i, ""));
		const shell = where ? shellFolderFor(where) : null;
		if (where) return {
			calls: [{
				name: "folder_empty",
				arguments: shell ? { folder: shell } : {
					folder: "downloads",
					inside: where
				}
			}],
			say: `Moving everything in ${where} to the recycle bin.`,
			rule: "files.empty"
		};
	}
	if (/^(?:skip|skip the|skip this)\s*(?:ad|ads|advert|advertisement|intro)s?\b/i.test(lower)) return {
		calls: [{
			name: "browser_skip_ad",
			arguments: {}
		}],
		say: "Skipping the advert.",
		rule: "web.media.skipad"
	};
	const seek = /\b(?:forward|skip|jump|go|seek|move)\s+(?:it\s+|ahead\s+|forward\s+)?to\s+(?<at>\d{1,4})\s*(?:seconds?|secs?|s)\b/i.exec(text);
	if (seek?.groups?.at) return {
		calls: [{
			name: "browser_media",
			arguments: {
				action: "seek",
				seconds: Number(seek.groups.at)
			}
		}],
		say: `Jumping to ${seek.groups.at} seconds.`,
		rule: "web.media.seek"
	};
	const nudge = /\b(?:skip|jump|go|move|fast[- ]?forward)\s+(?<dir>forward|ahead|back|backward)?\s*(?:by\s+)?(?<by>\d{1,4})\s*(?:seconds?|secs?|s)\b/i.exec(text);
	if (nudge?.groups?.by) {
		const back = /back/i.test(nudge.groups.dir ?? "");
		return {
			calls: [{
				name: "browser_media",
				arguments: {
					action: back ? "back" : "forward",
					seconds: Number(nudge.groups.by)
				}
			}],
			say: `Moving ${back ? "back" : "forward"} ${nudge.groups.by} seconds.`,
			rule: "web.media.nudge"
		};
	}
	const folder = /^(?:open|show|go to|browse)\s+(.+)$/i.exec(text);
	if (folder) {
		const { name, remainder } = splitAppAndRemainder(folder[1]);
		const shell = shellFolderFor(name) ?? shellFolderFor(folder[1]);
		if (shell) {
			const inner = /^(?:and\s+)?(?:then\s+)?(?:open|go into|enter|double[- ]?click)\s+(?:the\s+)?(?:folder\s+)?(?:named\s+|called\s+)?(.+)$/i.exec(remainder ?? "");
			const rawItem = inner ? inner[1] : "";
			const itemBreak = rawItem.search(CLAUSE_BREAK);
			const item = requireText((itemBreak >= 0 ? rawItem.slice(0, itemBreak) : rawItem).replace(/\s+folder\s*$/i, ""));
			const afterItem = itemBreak >= 0 ? requireText(rawItem.slice(itemBreak).replace(/^(?:\s*[,;]\s*|\s*(?:and|then|&|so|but|plus|after that)\s+)+/i, "")) : null;
			if (item) return {
				calls: [{
					name: "folder_open",
					arguments: { folder: shell }
				}, {
					name: "folder_item_open",
					arguments: { item }
				}],
				say: `Opening ${name}, then ${item}.`,
				rule: "folder.open.item",
				...afterItem ? { remainder: afterItem } : {}
			};
			return {
				calls: [{
					name: "folder_open",
					arguments: { folder: shell }
				}],
				say: remainder ? `Opening ${name}, then carrying on.` : `Opening ${name}.`,
				rule: "folder.open",
				...remainder ? { remainder } : {}
			};
		}
	}
	const open = /^(?:open|launch|start|run)\s+(.+)$/i.exec(text);
	if (open) {
		const { name, remainder } = splitAppAndRemainder(open[1]);
		if (name) return {
			calls: [{
				name: "app_open",
				arguments: { name }
			}],
			say: remainder ? `Opening ${name}, then carrying on.` : `Opening ${name}.`,
			rule: "app.open",
			...remainder ? { remainder } : {}
		};
	}
	const arrange = /\b(maximi[sz]e|full ?screen|left half|right half|centre|center)\b/i.exec(lower);
	if (arrange && /\bwindow\b/i.test(lower)) {
		const word = arrange[1].toLowerCase();
		return {
			calls: [{
				name: "window_arrange",
				arguments: { layout: word.startsWith("left") ? "left" : word.startsWith("right") ? "right" : word.startsWith("cent") ? "centre" : "maximise" }
			}],
			say: `Moving the window.`,
			rule: "window.arrange"
		};
	}
	const key = /^press (?:the )?(enter|return|escape|esc|tab|space|backspace|delete|page ?down|page ?up|home|end|f\d{1,2})\b/i.exec(text);
	if (key) {
		const named = key[1].toLowerCase().replace(/\s+/g, "").replace("return", "enter");
		return {
			calls: [{
				name: "press_key",
				arguments: { key: named }
			}],
			say: `Pressing ${named}.`,
			rule: "input.key"
		};
	}
	if (/\bwhat (files|notes) (are |do you have )?(in your folder|saved)\b|\blist your files\b/i.test(lower)) return {
		calls: [{
			name: "workspace_list",
			arguments: {}
		}],
		say: "Looking in my folder.",
		rule: "files.list"
	};
	const remember = /^(?:remember|note|make a note)\s+(?:that\s+|this[:,]?\s+)?(.+)$/i.exec(text) ?? /^don'?t forget\s+(?:that\s+)?(.+)$/i.exec(text);
	if (remember) {
		const fact = requireText(remember[1]);
		const looksLikeAReminder = /^to\s+\S/i.test(fact ?? "") && /\b(?:in\s+\d+\s*\w|at\s+\d{1,2}[:.]\d{2}|tomorrow|tonight|later|this (?:evening|afternoon))\b/i.test(fact ?? "");
		if (fact && !looksLikeAReminder) return {
			calls: [{
				name: "memory_remember",
				arguments: { fact }
			}],
			say: "Noted.",
			rule: "memory.remember"
		};
	}
	const forget = /^forget\s+(?:that\s+|about\s+)?(.+)$/i.exec(text);
	if (forget) {
		const query = requireText(forget[1]);
		if (query) return {
			calls: [{
				name: "memory_forget",
				arguments: { query }
			}],
			say: `Forgetting ${query}.`,
			rule: "memory.forget"
		};
	}
	if (/\bwhat do you (?:know|remember)(?: about me)?\b|\bshow (?:me )?(?:your |my )?memory\b|\bwhat(?:'?s| is) in your memory\b/i.test(lower)) return {
		calls: [{
			name: "memory_snapshot",
			arguments: {}
		}],
		say: "What I remember.",
		rule: "memory.snapshot"
	};
	const recall = /^(?:what do you (?:know|remember) about|do you remember)\s+(.+)$/i.exec(text);
	if (recall) {
		const query = requireText(recall[1]);
		if (query) return {
			calls: [{
				name: "memory_recall",
				arguments: { query }
			}],
			say: `Checking what I know about ${query}.`,
			rule: "memory.recall"
		};
	}
	const myName = /^(?:my name is|i'?m called|call me)\s+([\p{L}][\p{L}'-]{0,39})$/iu.exec(text) ?? null;
	if (myName) {
		const userName = requireText(myName[1]);
		if (userName) return {
			calls: [{
				name: "memory_identity",
				arguments: { userName }
			}],
			say: `I'll call you ${userName}.`,
			rule: "memory.identity.user"
		};
	}
	const yourName = /^(?:your name is|i'?ll call you|call yourself|rename yourself(?: to)?|from now on you'?re)\s+([\p{L}\p{N}][\p{L}\p{N} '-]{0,31})$/iu.exec(text);
	if (yourName) {
		const assistantName = requireText(yourName[1]);
		if (assistantName) return {
			calls: [{
				name: "memory_identity",
				arguments: { assistantName }
			}],
			say: `From now on I'm ${assistantName}.`,
			rule: "memory.identity.assistant"
		};
	}
	if (/\b(?:brief(?:ing)? me|give me (?:my |the )?briefing|catch me up|what did i (?:do|work on) (?:yesterday|last time))\b/i.test(lower)) return {
		calls: [{
			name: "morning_briefing",
			arguments: {}
		}],
		say: "Your briefing.",
		rule: "presence.briefing"
	};
	const watch = /^(?:watch|follow|keep an eye on|track)\s+(?:the\s+)?(?:news (?:on|about)\s+)?(.+)$/i.exec(text);
	if (watch && !/\b(?:my screen|the screen|this window)\b/i.test(lower)) {
		const topic = requireText(watch[1]);
		if (topic) return {
			calls: [{
				name: "topic_watch",
				arguments: { topic }
			}],
			say: `Watching ${topic}.`,
			rule: "presence.watch"
		};
	}
	if (/\b(?:anything new|any news for me|check (?:my )?topics|what(?:'?s| is) new)\b/i.test(lower)) return {
		calls: [{
			name: "topic_check",
			arguments: {}
		}],
		say: "Checking what you follow.",
		rule: "presence.check"
	};
	const reminder = /^remind me\s+(?:to\s+)?(.+?)\s+(in\s+\d{1,4}\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)|at\s+\d{1,2}[:.]\d{2}\s*(?:am|pm)?|tomorrow\s+(?:at\s+)?\d{1,2}[:.]\d{2}\s*(?:am|pm)?)$/i.exec(text);
	if (reminder) {
		const message = requireText(reminder[1]);
		const when = requireText(reminder[2]);
		if (message && when) return {
			calls: [{
				name: "reminder_set",
				arguments: {
					message,
					when
				}
			}],
			say: `Reminder set: ${message}.`,
			rule: "reminder.set"
		};
	}
	if (/\b(?:list|show|what are)\s+(?:my\s+)?reminders\b|\bmy reminders\b/i.test(lower)) return {
		calls: [{
			name: "reminder_list",
			arguments: {}
		}],
		say: "Your reminders.",
		rule: "reminder.list"
	};
	if (/\b(?:weather|forecast|going to rain|is it raining)\b/i.test(lower) && !asksTheWeb) {
		const named = /\b(?:in|for|at)\s+([\p{L}][\p{L}\s'-]{1,39})$/iu.exec(text);
		const city = named ? requireText(named[1]) : null;
		return {
			calls: [{
				name: "weather",
				arguments: city ? { city } : {}
			}],
			say: city ? `Checking the weather in ${city}.` : "Checking the weather.",
			rule: "web.weather"
		};
	}
	return null;
}
/**
* Whether a request is a pure control word.
*
* Separate from `routeDirect` because the caller needs this BEFORE it decides
* whether a message is a new task or a mid-task revision: "stop" typed while
* OCADE is working is not a change of plan, it is a stop.
*/
function directControl(request) {
	return routeDirect(request)?.control ?? null;
}
/** Approximate requests get ten per cent either way. */
var TOLERANCE = .1;
/**
* Counting words the way a person would.
*
* Hyphenated compounds are one word, as are contractions. Markdown bullets and
* stray punctuation are not words at all — a model that answers with a bulleted
* list would otherwise score its bullets as content.
*/
function countWords(text) {
	return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}
function countLines(text) {
	return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}
function countSentences(text) {
	return (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? []).length || (text.trim() ? 1 : 0);
}
/** Numbered or bulleted entries — what "list five things" is asking for. */
function countItems(text) {
	const bulleted = text.match(/^\s*(?:[-*•]|\d+[.)])\s+\S/gm);
	if (bulleted && bulleted.length > 0) return bulleted.length;
	return countLines(text);
}
var UNIT_WORDS = {
	word: "word",
	words: "word",
	line: "line",
	lines: "line",
	character: "character",
	characters: "character",
	char: "character",
	chars: "character",
	sentence: "sentence",
	sentences: "sentence",
	item: "item",
	items: "item",
	bullet: "item",
	bullets: "item",
	point: "item",
	points: "item"
};
var NUMBER_WORDS = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	twelve: 12,
	twenty: 20,
	fifty: 50,
	hundred: 100
};
function asCount(raw) {
	const digits = Number(raw.replace(/[,_]/g, ""));
	if (Number.isFinite(digits) && digits > 0) return digits;
	return NUMBER_WORDS[raw.toLowerCase()] ?? null;
}
/**
* Read every countable constraint out of an instruction.
*
* Returns an empty array far more often than not, and that is correct: most
* requests state no measurable property, and inventing one would make OCADE
* re-prompt over a target the user never set.
*/
function parseConstraints(request) {
	const text = (request || "").toLowerCase();
	const found = [];
	const seen = /* @__PURE__ */ new Set();
	const add = (constraint) => {
		const key = `${constraint.unit}:${constraint.kind}:${constraint.count}`;
		if (seen.has(key)) return;
		seen.add(key);
		found.push(constraint);
	};
	const units = Object.keys(UNIT_WORDS).join("|");
	const bounded = new RegExp(String.raw`\b(at least|no less than|minimum of|no more than|at most|under|fewer than|less than|maximum of)\s+(\d[\d,_]*|${Object.keys(NUMBER_WORDS).join("|")})[\s-]*(${units})\b`, "g");
	for (const match of text.matchAll(bounded)) {
		const count = asCount(match[2]);
		if (count === null) continue;
		const lower = /at least|no less than|minimum of/.test(match[1]);
		add({
			unit: UNIT_WORDS[match[3]],
			kind: lower ? "atLeast" : "atMost",
			count,
			source: match[0]
		});
	}
	const exact = new RegExp(String.raw`\b(?:exactly|precisely)\s+(\d[\d,_]*|${Object.keys(NUMBER_WORDS).join("|")})[\s-]*(${units})\b`, "g");
	for (const match of text.matchAll(exact)) {
		const count = asCount(match[1]);
		if (count === null) continue;
		add({
			unit: UNIT_WORDS[match[2]],
			kind: "exactly",
			count,
			source: match[0]
		});
	}
	const approx = new RegExp(String.raw`\b(\d[\d,_]*|${Object.keys(NUMBER_WORDS).join("|")})[\s-]*(${units})\b`, "g");
	for (const match of text.matchAll(approx)) {
		const count = asCount(match[1]);
		if (count === null) continue;
		const unit = UNIT_WORDS[match[2]];
		if (found.some((existing) => existing.unit === unit)) continue;
		add({
			unit,
			kind: "about",
			count,
			source: match[0]
		});
	}
	return found;
}
function measure(text, unit) {
	switch (unit) {
		case "word": return countWords(text);
		case "line": return countLines(text);
		case "character": return text.length;
		case "sentence": return countSentences(text);
		case "item": return countItems(text);
	}
}
/** Does the produced content satisfy what was asked for? */
function checkContent(text, constraints) {
	const results = constraints.map((constraint) => {
		const actual = measure(text, constraint.unit);
		let ok;
		switch (constraint.kind) {
			case "exactly":
				ok = actual === constraint.count;
				break;
			case "atLeast":
				ok = actual >= constraint.count;
				break;
			case "atMost":
				ok = actual <= constraint.count;
				break;
			case "about": {
				const slack = Math.max(1, Math.round(constraint.count * TOLERANCE));
				ok = Math.abs(actual - constraint.count) <= slack;
				break;
			}
		}
		return {
			constraint,
			actual,
			ok
		};
	});
	const missed = results.filter((result) => !result.ok);
	return {
		ok: missed.length === 0,
		results,
		shortfall: missed.length ? missed.map((result) => `${result.actual} ${result.constraint.unit}${result.actual === 1 ? "" : "s"} where you asked for ${result.constraint.source}`).join("; ") : null
	};
}
/**
* What to send back to the model so the next attempt is closer.
*
* Names the measurement rather than saying "try again", because a model told
* only that it failed produces another draft of the same length. The direction
* and the size of the miss are both stated.
*/
function correctionPrompt(original, produced, check) {
	return `Rewrite the text below so it meets the length the user asked for. ${check.results.filter((result) => !result.ok).map((result) => {
		const { constraint, actual } = result;
		const direction = actual < constraint.count ? "longer" : "shorter";
		return `It is ${actual} ${constraint.unit}s and needs to be ${constraint.count}. Make it ${direction} by about ${Math.abs(constraint.count - actual)} ${constraint.unit}s.`;
	}).join(" ")}\n\nThe user asked: ${original}\n\nCurrent text:\n${produced}\n\nReply with ONLY the corrected text — no preamble, no explanation, no quotes.`;
}
/**
* The tool arguments that carry authored content, and nothing else.
*
* `type_text` into a search box is not authored content, but there is no way to
* tell that apart from a field here — so the constraint check runs on whatever
* the model wrote and simply passes when no constraint was stated. That is the
* safe direction: a false constraint would rewrite somebody's text.
*/
var CONTENT_FIELDS = {
	type_text: "text",
	workspace_write: "content",
	office_write: "content",
	message_draft: "message"
};
/** The authored text inside a call, or null when the call carries none. */
function contentOf(toolName, args) {
	const field = CONTENT_FIELDS[toolName];
	if (!field || !args) return null;
	const value = args[field];
	if (typeof value !== "string" || value.trim().length === 0) return null;
	return {
		field,
		value
	};
}
/**
* The gate every tool call passes before anything happens to the machine.
*
* THREE FAILURES THIS EXISTS TO STOP, ALL OBSERVED ON LIVE RUNS
* --------------------------------------------------------------
* 1. **An empty required argument.** A YouTube navigation went out with
*    `search_query=` and OCADE opened a blank results page, then reported that
*    it had searched. The schema said `query` was required; nothing checked.
* 2. **The same action, again and again.** Asked to open a browser, the model
*    called `browser_open` on three consecutive turns because each result read
*    like a fresh start. Three Chrome windows, one task.
* 3. **A narrated action.** "Now I will type…" with no call at all — handled in
*    `tool-protocol.ts`, and mentioned here because the three together are the
*    same underlying problem: the model's output was trusted as an instruction
*    rather than checked as a request.
*
* WHERE THIS SITS
* ---------------
* Between the model and the adapters, on the client, and again on the server —
* `runControlActionFn` re-checks, because a client is a thing that can be
* bypassed. Argument validation is cheap and being wrong is expensive.
*/
/** How many times one identical call may run within a single task. */
var MAX_IDENTICAL = 1;
/**
* Tools that are legitimately repeated with the same arguments.
*
* Observation is the obvious case: "look again" is the entire point of
* observe → act → observe, and blocking a second identical `screen_observe`
* would break verification. Scrolling repeats by nature. Everything else that
* repeats identically is a loop, not a plan.
*/
var REPEATABLE = /* @__PURE__ */ new Set([
	"screen_observe",
	"window_list",
	"system_status",
	"display_list",
	"browser_read",
	"browser_tabs",
	"browser_scroll",
	"workspace_list",
	"control_find",
	"app_list_installed",
	"ui_tree",
	"screen_find",
	"app_discover",
	"bluetooth_status",
	"audio_devices",
	"media_control"
]);
function signature(call) {
	const args = call.arguments ?? {};
	const ordered = Object.keys(args).sort().map((key) => `${key}=${JSON.stringify(args[key])}`).join("&");
	return `${call.name}(${ordered})`;
}
/**
* Check one call against its own schema.
*
* Required strings must be present AND non-empty AND contain something other
* than punctuation. `enum` values must be one of the listed options. Unknown
* argument names are dropped rather than refused — a model adding a stray
* `reason` field is being chatty, not dangerous, and refusing the whole call
* over it costs a step for nothing.
*/
/**
* The shapes a model reaches for when it means "the value goes here".
*
* Shell substitution `$(...)` and `${...}`, template braces `{{...}}`, format
* specifiers `%s`, and angle-bracket slots `<value>`. Single braces are NOT
* included: `{ }` appears in ordinary JSON and code a user might legitimately
* ask OCADE to write down.
*/
var PLACEHOLDER = /\$\([^)]*\)|\$\{[^}]*\}|\{\{[^}]*\}\}|<[a-z_][a-z0-9_ ]{2,30}>|%[sdif]\b|\bYOUR_[A-Z_]{2,}\b|\bTODO:|\[(result|value|insert|output|the result)[^\]]{0,40}\]/i;
function validateArguments(definition, raw) {
	const schema = definition.parameters;
	const cleaned = {};
	for (const [name, spec] of Object.entries(schema.properties)) {
		const value = raw[name];
		if (value === void 0 || value === null) continue;
		if (spec.type === "string") {
			const text = String(value).trim();
			if (text.length === 0) continue;
			if (/^\/(no_?think|think|nothink)$/i.test(text)) return {
				ok: false,
				reason: `${name} was given an engine control token rather than a real value, so ${definition.name} was not run.`
			};
			if (spec.enum && !spec.enum.includes(text)) return {
				ok: false,
				reason: `${name} must be one of: ${spec.enum.join(", ")}. OCADE was given “${text}”.`
			};
			const placeholder = PLACEHOLDER.exec(text);
			if (placeholder) return {
				ok: false,
				reason: `${name} still contains the placeholder “${placeholder[0]}” instead of a real value. Substitute the actual value you were given in the previous result, then call ${definition.name} again.`
			};
			cleaned[name] = text;
			continue;
		}
		cleaned[name] = value;
	}
	for (const required of schema.required ?? []) {
		const value = cleaned[required];
		const text = typeof value === "string" ? value : "";
		if (value === void 0 || typeof value === "string" && !/[\p{L}\p{N}]/u.test(text)) return {
			ok: false,
			reason: `${definition.name} needs ${required}, and none was given. OCADE did not guess one.`
		};
	}
	return {
		ok: true,
		arguments: cleaned
	};
}
/**
* One task's memory of what it has already done.
*
* Held per task rather than per mission: "open Notepad" twice in one
* instruction is a loop, and "open Notepad" in a later instruction is a person
* asking again, which is allowed.
*/
var TaskLedger = class {
	counts = /* @__PURE__ */ new Map();
	/** Record a call that is about to run. */
	note(call) {
		const key = signature(call);
		this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
	}
	timesSeen(call) {
		return this.counts.get(signature(call)) ?? 0;
	}
	reset() {
		this.counts.clear();
	}
};
/**
* Validate a call and decide whether it may run.
*
* Returns a REASON rather than a boolean, because the reason goes back to the
* model as a tool result. "youtube_search needs query, and none was given" is
* something a model can correct on the next turn; a bare refusal is something
* it will retry identically until the step limit.
*/
function checkCall(call, ledger) {
	const definition = findTool(call.name);
	if (!definition) return {
		ok: false,
		code: "unknown_tool",
		reason: `There is no action called ${call.name}.`
	};
	const validated = validateArguments(definition, call.arguments ?? {});
	if (!validated.ok) return {
		ok: false,
		code: "bad_arguments",
		reason: validated.reason
	};
	const checked = {
		...call,
		arguments: validated.arguments
	};
	if (ledger && !REPEATABLE.has(call.name) && ledger.timesSeen(checked) >= MAX_IDENTICAL) return {
		ok: false,
		code: "repeated",
		reason: `OCADE has already done exactly this in the current task (${definition.name}). Repeating it would do the same thing twice — check the last result and take a different step, or finish.`
	};
	return {
		ok: true,
		call: checked
	};
}
/**
* A reply id that is unique even when two code paths answer the same turn.
*
* Both the fast-path reply and the mission-completion summary used to build
* their id as `${id}-r` from the SAME originating turn. When a mission produced
* both -- which is the ordinary case for anything multi-step -- React received
* two children with the same key and warned that it may duplicate or omit them.
* Omitting one means an answer OCADE actually produced never reaches the screen.
*
* The suffix names which reply it is, so the ids stay readable in a receipt, and
* a counter makes them unique even if one path runs twice for one turn.
*/
var replyCounter = 0;
function replyId(turnId, kind) {
	replyCounter += 1;
	return `${turnId}-${kind}-${replyCounter}`;
}
var SPOKEN = {
	screen_observe: "Looking at the screen",
	window_list: "Reading the open windows",
	window_focus: "Bringing a window forward",
	window_arrange: "Moving a window",
	display_list: "Checking the screens",
	app_open: "Opening an application",
	app_focus: "Switching to an application",
	youtube_play: "Playing it on YouTube",
	folder_open: "Opening a folder",
	folder_item_open: "Opening a folder inside it",
	app_list_installed: "Checking what is installed",
	control_find: "Looking for a control",
	control_activate: "Pressing a control",
	control_set_text: "Filling in a field",
	speak: "Speaking",
	listen: "Listening",
	office_read: "Reading a spreadsheet or document",
	office_write: "Saving a spreadsheet or document",
	message_draft: "Writing a message for you to check",
	message_send: "Sending a message",
	whatsapp_open: "Opening WhatsApp",
	whatsapp_find_contact: "Finding the chat",
	whatsapp_type: "Writing the message",
	whatsapp_send: "Sending the message",
	message_find_contact: "Opening a conversation",
	message_to: "Finding who you meant, then writing",
	file_list: "Looking through the folder",
	introduce: "Introducing itself",
	folder_empty: "Clearing the folder",
	browser_skip_ad: "Skipping the advert",
	screen_map: "Numbering what is on screen",
	screen_do: "Acting on the screen",
	document_read: "Reading the document",
	setup_status: "Checking setup",
	clipboard_watch: "Checking what you copied",
	screen_watch: "Watching the screen",
	message_pending: "Listing drafts",
	message_discard: "Discarding the draft",
	screen_find: "Looking for something on screen",
	screen_click: "Clicking with the mouse",
	parallel_search: "Asking every search engine at once",
	screen_type: "Typing, then checking the screen",
	screen_act: "Operating something on screen",
	screen_read: "Reading the screen",
	app_discover: "Checking what is installed",
	ui_tree: "Reading what is on screen",
	ui_act: "Operating a control",
	system_volume: "Changing the volume",
	system_brightness: "Changing the screen brightness",
	media_control: "Controlling playback",
	bluetooth_status: "Checking Bluetooth",
	audio_devices: "Checking the audio devices",
	type_text: "Typing",
	press_key: "Pressing a key",
	system_status: "Reading this computer's state",
	workspace_list: "Looking in OCADE's folder",
	workspace_read: "Reading a file",
	workspace_write: "Writing a file",
	workspace_open: "Opening a file",
	workspace_discard: "Discarding a file",
	file_search: "Looking for files",
	file_read: "Reading a file",
	file_copy: "Copying a file",
	file_move: "Moving a file",
	file_trash: "Moving a file to the trash",
	file_restore: "Restoring a file",
	browser_open: "Opening a browser",
	browser_navigate: "Opening a page",
	browser_read: "Reading the page",
	browser_click: "Clicking on the page",
	browser_type: "Typing on the page",
	browser_scroll: "Scrolling the page",
	browser_key: "Pressing a key on the page",
	browser_media: "Controlling the media",
	browser_tabs: "Reading the open tabs",
	web_search: "Searching the web",
	youtube_search: "Searching YouTube",
	memory_remember: "Remembering that",
	memory_recall: "Checking what I remember",
	memory_forget: "Forgetting that",
	memory_project: "Noting the project",
	memory_identity: "Updating who we are",
	memory_snapshot: "Reading my memory",
	session_summarise: "Writing down what we did",
	morning_briefing: "Putting your briefing together",
	proactive_check: "Seeing if anything is worth mentioning",
	topic_watch: "Following that topic",
	topic_check: "Checking your topics",
	language_note: "Noting the language",
	search_mode: "Searching the web",
	flight_search: "Looking up flights",
	weather: "Checking the weather",
	system_wifi: "Checking the network",
	system_power: "Changing the computer's power state",
	autostart: "Changing what starts at login",
	clipboard_read: "Reading the clipboard",
	clipboard_write: "Copying that",
	see: "Looking",
	camera_list: "Checking the cameras",
	reminder_set: "Setting a reminder",
	reminder_list: "Reading your reminders",
	reminder_cancel: "Cancelling a reminder",
	game_list: "Checking your games",
	game_update: "Asking the launcher to update",
	phone_dashboard: "Setting up your phone",
	code_review: "Reading the code",
	memory_preference: "Noting how you like things",
	clipboard_act: "Working on what you copied",
	engine_status: "Checking the engine",
	folder_create: "Making a folder",
	file_info: "Reading a file's details",
	disk_usage: "Checking your disk space",
	largest_files: "Finding your biggest files",
	desktop_organise: "Tidying your desktop"
};
function describeTool(name) {
	return SPOKEN[name] ?? "Working";
}
/**
* The tools that change what OCADE knows, and therefore invalidate the prompt.
*
* Only the WRITES. `memory_recall` and `memory_snapshot` read the same store
* and cannot change it, and refreshing after them would add a server round trip
* to the two tools whose whole value is being cheap.
*
* `session_summarise` is here because a summary is consumed by the next
* briefing, and `language_note` because the language changes how OCADE speaks
* from the following sentence onwards.
*/
var MEMORY_WRITES = /* @__PURE__ */ new Set([
	"memory_remember",
	"memory_forget",
	"memory_project",
	"memory_identity",
	"session_summarise",
	"language_note"
]);
/**
* The brief handed to the model when a deterministic step did not work.
*
* WHY A FAILED FAST PATH MUST NOT BE THE END OF THE RUN.
* ------------------------------------------------------
* The router is a set of rules about words. It is right almost always and
* wrong in exactly one way: it cannot see. Asked to open the chat called
* "Meta ai", it typed the name in the search box, WhatsApp answered "No chats,
* contacts or messages found", and OCADE reported that sentence back and
* stopped -- with the answer visible on screen the whole time, and a vision
* model, an accessibility tree, and an OCR search sitting unused in the
* toolbox.
*
* A person who typed a name and saw no results would LOOK at the screen. That
* is the entire content of this escalation: the rules did their turn and came
* up short, so the model takes over with the tools that observe. It is told
* what was attempted and what came back, because "it failed" is not something
* you can act on and "the search box says no results" is.
*
* WHAT IS DELIBERATELY NOT HERE
* -----------------------------
* No instruction to retry the same call, and no suggestion of what the real
* answer might be. Both are guesses this function is in no position to make --
* the name may be misspelled, the chat may not exist, the window may not have
* come to the front. Looking first is the only step that is right in all three
* cases.
*/
function recoveryBrief(request, attempted, failure) {
	return `The user asked: ${request}\n\nA direct attempt at "${attempted}" did not work. What came back was: ${failure}\n\nDo not repeat that attempt unchanged and do not ask the user what to do. Look at the screen first -- screen_map numbers everything you can act on, screen_observe reads the controls, and screen_find locates text by OCR -- then decide from what is actually there and carry on with the request. If the screen shows the step genuinely cannot be completed, say what you saw and why, in one or two sentences.`;
}
/**
* Does composed text belong in a chat conversation rather than a document?
*
* ONE FLAG, TWO DECISIONS, AND THAT IS DELIBERATE.
* ------------------------------------------------
* The destination changes both halves of the compose path: how the words are
* WRITTEN (a message, not an essay) and how they are DELIVERED (the app's own
* composer, not a generic value-pattern write). Both follow from the same fact,
* so they read it from the same place -- keeping them separate is how you get a
* four-paragraph essay typed correctly into a chat box.
*
* Only WhatsApp is here because WhatsApp is the only chat app with a measured
* skill behind it. The rest fall through to the document path, which is the
* honest answer for an app whose composer has never been driven.
*/
function isChatApp(app) {
	return typeof app === "string" && /^whats\s?app$/i.test(app.trim());
}
/**
* The approval question, in words about the thing rather than about the tool.
*
* "Allow control_set_text?" is a question nobody can answer. "Type into
* Notepad?" is one everybody can. The arguments carry the specifics, so they
* are what the sentence is built from.
*/
function approvalQuestion(call, tool) {
	const args = call.arguments ?? {};
	const named = (key) => typeof args[key] === "string" ? args[key] : "";
	switch (call.name) {
		case "app_open": return `Open ${named("name") || "an application"}?`;
		case "app_focus": return `Switch to ${named("name") || "another application"}?`;
		case "type_text": {
			const value = named("text");
			return `Type “${value.length > 60 ? `${value.slice(0, 60)}…` : value}”?`;
		}
		case "press_key": return `Press ${[named("modifiers"), named("key")].filter(Boolean).join("+")}?`;
		case "message_send": {
			const to = named("recipient");
			const body = named("message");
			if (to && body) return `Send this to ${to}?\n\n${body.length > 200 ? `${body.slice(0, 200)}…` : body}`;
			return to ? `Send the drafted message to ${to}?` : "Send the drafted message?";
		}
		case "office_write": {
			const file = named("path");
			return file ? `Save ${file}?` : "Save that file?";
		}
		case "ui_act": {
			const action = named("action").toLowerCase();
			if (action === "set_text") {
				const value = named("text");
				return `Type “${value.length > 60 ? `${value.slice(0, 60)}…` : value}” into that field?`;
			}
			if (action === "focus") return "Put the cursor in that field?";
			return `${action === "toggle" ? "Toggle" : action === "select" ? "Select" : "Press"} that control?`;
		}
		case "system_volume": {
			const action = named("action").toLowerCase();
			if (action === "mute") return "Mute the sound?";
			if (action === "unmute") return "Unmute the sound?";
			const level = args.level;
			return typeof level === "number" ? `Set the volume to ${level}%?` : "Change the volume?";
		}
		case "control_activate": return `Press “${named("name")}”?`;
		case "control_set_text": return `Fill in “${named("name")}”?`;
		case "window_arrange": return `Move the window ${named("layout") ? `to ${named("layout")}` : ""}?`.trim();
		case "workspace_open": return `Open ${named("name")} in an editor?`;
		case "workspace_discard": return `Move ${named("name")} to the recycle bin?`;
		case "browser_open": return `Use your own ${named("browser") === "edge" ? "Edge" : "Chrome"}, signed in? OCADE will be able to reach the accounts you are logged into.`;
		case "browser_navigate": return `Go to ${named("url")}?`;
		case "browser_click": return `Click “${named("text")}” on the page?`;
		case "browser_type": return `Type into “${named("selector")}” on the page?`;
		case "file_move": return `Move ${named("from")} to ${named("to")}?`;
		case "file_trash": return `Move ${named("path")} to the trash?`;
		default: return `${describeTool(call.name)}?`;
	}
}
/**
* Is the second attempt closer to what was asked for than the first?
*
* Total absolute distance across every constraint. A rewrite that fixes the
* word count by blowing the line count is not an improvement, and a model
* asked to add twenty-five words will sometimes add ninety.
*/
function betterOf(before, after) {
	const distance = (check) => check.results.reduce((total, result) => total + Math.abs(result.actual - result.constraint.count), 0);
	return distance(after) < distance(before);
}
function useMission(brain) {
	const [start, setStart] = (0, import_react.useState)(null);
	const [connecting, setConnecting] = (0, import_react.useState)(false);
	const [phase, setPhase] = (0, import_react.useState)("idle");
	const [turns, setTurns] = (0, import_react.useState)([]);
	const [live, setLive] = (0, import_react.useState)([]);
	const [approval, setApproval] = (0, import_react.useState)(null);
	const [paused, setPaused] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const memoryRef = (0, import_react.useRef)(null);
	/**
	* Re-read the memory context after something wrote to it.
	*
	* ITS OWN SERVER FUNCTION RATHER THAN A TOOL CALL, and the first attempt got
	* this wrong: it went through the control action path with the name
	* `memory_context_refresh`, which is not in the registry — and the server
	* refuses any tool it cannot look up, correctly. Registering one to get
	* around that would have advertised it to the model, which must never call
	* it: this is the mission preparing its own prompt, not an action the model
	* chooses.
	*
	* So it is a separate, minimal function that re-uses the same mission and the
	* same authorisation, and reaches nothing except the memory file.
	*/
	const refreshMemory = (0, import_react.useCallback)(async (missionId) => {
		try {
			const result = await refreshMemoryFn({ data: { missionId } });
			if (result.ok && typeof result.context === "string") memoryRef.current = result.context;
		} catch {}
	}, []);
	const [mode, setMode] = (0, import_react.useState)("prompt");
	const modeRef = (0, import_react.useRef)("prompt");
	(0, import_react.useEffect)(() => {
		modeRef.current = mode;
	}, [mode]);
	const [mic, setMic] = (0, import_react.useState)({
		enabled: false,
		deviceId: null,
		listening: false,
		devices: [],
		detail: "The microphone is off."
	});
	const missionRef = (0, import_react.useRef)(null);
	const abortRef = (0, import_react.useRef)(null);
	const revisionRef = (0, import_react.useRef)(null);
	const pausedRef = (0, import_react.useRef)(false);
	const grantedRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const permissionRef = (0, import_react.useRef)(currentPermissionContext());
	const stoppedRef = (0, import_react.useRef)(false);
	const ledgerRef = (0, import_react.useRef)(new TaskLedger());
	const latencyRef = (0, import_react.useRef)({
		routerMs: 0,
		modelMs: 0,
		toolMs: 0
	});
	pausedRef.current = paused;
	const connect = (0, import_react.useCallback)(async () => {
		setConnecting(true);
		setError(null);
		if (!stoppedRef.current) setPhase("observing");
		try {
			const result = await startMissionFn();
			missionRef.current = result.missionId;
			memoryRef.current = result.memory?.context ?? null;
			setStart(result);
			if (!result.ok) setError(result.detail);
		} catch (cause) {
			setStart(null);
			memoryRef.current = null;
			setError(cause instanceof Error ? cause.message : "OCADE could not reach this computer.");
		} finally {
			setConnecting(false);
			setPhase(stoppedRef.current ? "stopped" : "idle");
		}
	}, []);
	/** End the mission on the server: release input, drop the sidecars. */
	const release = (0, import_react.useCallback)(async () => {
		const id = missionRef.current;
		missionRef.current = null;
		if (!id) return;
		try {
			await stopMissionFn({ data: { missionId: id } });
		} catch {}
	}, []);
	(0, import_react.useEffect)(() => () => void release(), [release]);
	(0, import_react.useEffect)(() => () => {
		const runId = runIdRef.current;
		if (runId) updateRun(runId, { isBackgrounded: true });
	}, []);
	/**
	* Stop, and stay visibly stopped.
	*
	* The reconnect that follows is necessary — releasing the machine disposes
	* the sidecars, so the next instruction needs a fresh mission — but it USED
	* TO REPAINT THE SCENE AS "READY" about two seconds after the user pressed
	* Stop. Pressing stop and watching the system carry on turning is the exact
	* moment the interface must not be ambiguous, so the stopped state is sticky
	* until the user actually asks for something else.
	*/
	/**
	* The live run this mission is tracking, if any.
	*
	* Registered with the task registry so that "what is OCADE doing" and "stop
	* it" are answerable from anywhere — the Cowork panel, the task list, a tool
	* call in Chat — instead of only from the button inside this hook.
	*/
	const runIdRef = (0, import_react.useRef)(null);
	/**
	* Everything stopping actually does to the machine: drop the loop, refuse any
	* question still on screen, let go of the keyboard and mouse, then reconnect
	* so the next instruction has a mission to run in.
	*
	* Separated from `stop` because it is also what the registry's killer calls.
	* A stop issued from the task list has to do the same work as the button.
	*/
	/**
	* True while the user has taken the computer back.
	*
	* A ref as well as state because `teardown` runs from a killer that may fire
	* long after the render that set it, and it has to read the CURRENT answer to
	* "should OCADE reconnect".
	*/
	const handOverRef = (0, import_react.useRef)(false);
	const [handedOver, setHandedOver] = (0, import_react.useState)(false);
	const teardown = (0, import_react.useCallback)(async () => {
		abortRef.current?.abort();
		abortRef.current = null;
		approvalRefResolve.current?.(false);
		approvalRefResolve.current = null;
		setApproval(null);
		setPaused(false);
		await release();
		if (!handOverRef.current) connect();
	}, [release, connect]);
	const stop = (0, import_react.useCallback)(() => {
		stoppedRef.current = true;
		handOverRef.current = false;
		setHandedOver(false);
		setPhase("stopped");
		const runId = runIdRef.current;
		runIdRef.current = null;
		if (runId) stopRun(runId, "You stopped it.").catch(() => void teardown());
		else teardown();
	}, [teardown]);
	/**
	* Pause and resume, banked against the run so elapsed time stays honest.
	*
	* The registry subtracts paused time, which is why a task the user left
	* paused overnight does not report as having worked for nine hours.
	*/
	const changePaused = (0, import_react.useCallback)((next) => {
		setPaused(next);
		const runId = runIdRef.current;
		if (!runId) return;
		if (next) pauseRun(runId);
		else resumeRun(runId);
	}, []);
	/**
	* Hand the computer back to the user.
	*
	* This used to call `stop` — two buttons doing one thing, which is the kind
	* of control the specification calls fake. It now does the thing its label
	* promises: the run is stopped, the machine is released, and OCADE does NOT
	* take it again. The next instruction reconnects, because asking OCADE for
	* something is how the user gives it back.
	*/
	const takeOver = (0, import_react.useCallback)(() => {
		stoppedRef.current = true;
		handOverRef.current = true;
		setHandedOver(true);
		setPhase("stopped");
		const runId = runIdRef.current;
		runIdRef.current = null;
		if (runId) stopRun(runId, "You took over.").catch(() => void teardown());
		else teardown();
	}, [teardown]);
	const approvalRefResolve = (0, import_react.useRef)(null);
	const answer = (0, import_react.useCallback)((allowed) => {
		approvalRefResolve.current?.(allowed);
		approvalRefResolve.current = null;
		setApproval(null);
	}, []);
	const revise = (0, import_react.useCallback)((instruction) => {
		revisionRef.current?.submit(instruction);
		setLive((current) => [...current, {
			id: `r${Date.now()}`,
			kind: "said",
			label: "New instruction",
			detail: instruction
		}]);
	}, []);
	/**
	* Say something, without waiting for it to finish.
	*
	* FIRE-AND-FORGET IS THE POINT. The engine's `Speak` is asynchronous, so the
	* sentence plays on the audio thread while the mouse and keyboard carry on —
	* which is what makes hands-free mode feel like one continuous action rather
	* than a narrator taking turns with a robot. Awaiting it here would serialise
	* speech and execution and add the length of every sentence to the task.
	*
	* Failures are swallowed deliberately: a machine with no speech is a machine
	* that should still do the work.
	*/
	const speak = (0, import_react.useCallback)((text) => {
		const missionId = missionRef.current;
		if (!missionId || !text.trim()) return;
		missionSpeakFn({ data: {
			missionId,
			text: text.slice(0, 1200)
		} }).catch(() => {});
	}, []);
	/** Read the microphone list and current state from the engine. */
	const refreshAudio = (0, import_react.useCallback)(async () => {
		const missionId = missionRef.current;
		if (!missionId) return;
		try {
			const result = await missionAudioInputsFn({ data: { missionId } });
			if (!result.ok) return;
			setMic((current) => ({
				...current,
				devices: result.devices,
				deviceId: result.selected,
				enabled: result.micEnabled
			}));
		} catch {}
	}, []);
	/**
	* Turn the microphone on or off, or switch device.
	*
	* The state is set from what the ENGINE reports back, never from what was
	* asked for. A toggle that flips to "off" while the audio stream is still
	* open is the exact failure this control exists to prevent, so the UI is not
	* allowed to assume it succeeded.
	*/
	const setMicEnabled = (0, import_react.useCallback)(async (enabled) => {
		const missionId = missionRef.current;
		if (!missionId) return;
		const result = await missionMicFn({ data: {
			missionId,
			enabled
		} });
		setMic((current) => ({
			...current,
			enabled: result.micEnabled,
			listening: result.listening,
			detail: result.detail
		}));
		if (!result.ok) setError(result.detail);
	}, []);
	const selectMicDevice = (0, import_react.useCallback)(async (deviceId) => {
		const missionId = missionRef.current;
		if (!missionId) return;
		const result = await missionMicFn({ data: {
			missionId,
			deviceId
		} });
		setMic((current) => ({
			...current,
			deviceId: result.deviceId,
			enabled: result.micEnabled,
			listening: result.listening,
			detail: result.detail,
			devices: current.devices.map((d) => ({
				...d,
				isSelected: d.id === result.deviceId
			}))
		}));
	}, []);
	(0, import_react.useEffect)(() => {
		if (mode === "prompt" && mic.enabled) setMicEnabled(false);
	}, [
		mode,
		mic.enabled,
		setMicEnabled
	]);
	/**
	* Run one already-decided tool call, with permission and verification.
	*
	* Shared by the fast path and the model path so BOTH go through the same
	* contract check, the same approval bands and the same server. The fast
	* router decides what to do; it does not get a private route to the machine.
	*/
	const runOneCall = (0, import_react.useCallback)(async (call, missionId, askPermission) => {
		const checked = checkCall(call, ledgerRef.current);
		if (!checked.ok) return {
			ok: false,
			detail: checked.reason
		};
		const tool = findTool(checked.call.name);
		if (tool?.mutating) {
			if (!await askPermission(checked.call, tool.risk)) return {
				ok: false,
				detail: "You did not approve that, so it was not done."
			};
		}
		ledgerRef.current.note(checked.call);
		setPhase(tool?.mutating ? "controlling" : "observing");
		const outcome = await executeToolCall(checked.call, {
			missionId,
			confirmed: tool?.risk === "high"
		});
		return {
			ok: outcome.kind === "success",
			detail: outcome.detail,
			...outcome.verified === void 0 ? {} : { verified: outcome.verified }
		};
	}, []);
	const send = (0, import_react.useCallback)(async (request) => {
		if (handOverRef.current) {
			handOverRef.current = false;
			setHandedOver(false);
			stoppedRef.current = false;
			await connect();
		}
		const missionId = missionRef.current;
		if (!missionId) {
			setError("OCADE is not connected to this computer.");
			return;
		}
		const id = `${Date.now()}`;
		setTurns((current) => [...current, {
			id,
			role: "you",
			text: request
		}]);
		setLive([]);
		setPaused(false);
		setError(null);
		grantedRef.current = /* @__PURE__ */ new Set();
		permissionRef.current = {
			...currentPermissionContext(),
			denials: permissionRef.current.denials
		};
		stoppedRef.current = false;
		ledgerRef.current.reset();
		setPhase("thinking");
		const controller = new AbortController();
		abortRef.current = controller;
		const revision = new Revision();
		revisionRef.current = revision;
		const run = startRun({
			kind: "mission",
			description: request,
			kill: () => teardown()
		});
		runIdRef.current = run.id;
		let runFailed = false;
		/**
		* Close the run exactly once, whichever way the instruction ended.
		*
		* A run the user stopped is already terminal by the time this runs, and
		* the registry leaves it alone — "you stopped it" must not be overwritten
		* by "it finished".
		*/
		let runReceipt;
		const settleRun = (failed) => {
			const runId = runIdRef.current;
			runIdRef.current = null;
			if (runId) finishRun(runId, failed ? "failed" : "completed", runReceipt);
		};
		const entries = [];
		const push = (entry) => {
			entries.push(entry);
			setLive([...entries]);
		};
		/** Hold here while the user has pressed Pause. */
		const waitWhilePaused = async () => {
			while (pausedRef.current && !controller.signal.aborted) {
				setPhase("paused");
				await new Promise((resolve) => setTimeout(resolve, 150));
			}
		};
		const askPermission = async (call, risk) => {
			await waitWhilePaused();
			if (controller.signal.aborted) return false;
			const tool = findTool(call.name);
			if (!tool) return false;
			const signatureKey = `${call.name}:${JSON.stringify(call.arguments ?? {})}`;
			const decision = decide(call, tool, permissionRef.current);
			const question = approvalQuestion(call, tool);
			if (decision.outcome === "deny") {
				push({
					id: `d${Date.now()}${entries.length}`,
					kind: "refused",
					label: question.replace(/\?$/, ""),
					detail: decision.reason
				});
				if (modeRef.current === "voice") speak(decision.reason);
				return false;
			}
			if (decision.outcome === "allow") {
				grantedRef.current.add(signatureKey);
				if (tool.mutating) {
					push({
						id: `v${Date.now()}${entries.length}`,
						kind: "acting",
						label: question.replace(/\?$/, ""),
						detail: modeRef.current === "voice" ? "Say “stop” to interrupt." : decision.reason
					});
					if (modeRef.current === "voice") speak(question.replace(/\?$/, "."));
				}
				return true;
			}
			const repeatable = tool.risk !== "high" && !decision.warning;
			if (repeatable && grantedRef.current.has(signatureKey)) return true;
			setPhase("paused");
			const spoken = modeRef.current === "voice";
			if (spoken) speak(question);
			const allowed = await new Promise((resolve) => {
				approvalRefResolve.current = resolve;
				setApproval({
					call,
					tool,
					question,
					risk: tool.risk === "high" || decision.warning ? "high" : "medium",
					resolve,
					spoken
				});
			});
			approvalRefResolve.current = null;
			setApproval(null);
			push({
				id: `a${Date.now()}${entries.length}`,
				kind: allowed ? "asked" : "refused",
				label: question,
				detail: allowed ? "You allowed it." : "You said no."
			});
			permissionRef.current = allowed ? noteApproved(permissionRef.current) : noteDenied(permissionRef.current);
			if (allowed && repeatable) grantedRef.current.add(signatureKey);
			return allowed;
		};
		const routerStarted = performance_default.now();
		const direct = routeDirect(request);
		const routerMs = Math.round(performance_default.now() - routerStarted);
		const constraints = parseConstraints(request);
		let remainingWork = direct?.remainder ?? null;
		let recovering = false;
		let pendingCompose = direct?.compose ?? null;
		if (direct && direct.calls.length > 0) {
			push({
				id: `d${Date.now()}`,
				kind: "acting",
				label: direct.say,
				detail: ""
			});
			const lines = [];
			let allOk = true;
			let failed = null;
			try {
				for (const call of direct.calls) {
					if (controller.signal.aborted) break;
					await waitWhilePaused();
					const started = performance_default.now();
					const outcome = await runOneCall(call, missionId, askPermission);
					const elapsed = Math.round(performance_default.now() - started);
					push({
						id: `dr${Date.now()}${lines.length}`,
						kind: outcome.ok ? "done" : "problem",
						label: describeTool(call.name),
						detail: outcome.detail,
						verified: outcome.verified
					});
					lines.push(outcome.detail);
					if (!outcome.ok) {
						allOk = false;
						if (!failed) failed = {
							call: describeTool(call.name),
							detail: outcome.detail
						};
					}
					latencyRef.current = {
						routerMs,
						modelMs: 0,
						toolMs: elapsed,
						rule: direct.rule
					};
				}
				const escalating = Boolean(failed) && !remainingWork && !pendingCompose;
				recovering = escalating;
				if (escalating && failed) {
					remainingWork = recoveryBrief(request, failed.call, failed.detail);
					push({
						id: `esc${Date.now()}`,
						kind: "acting",
						label: "Looking at the screen",
						detail: failed.detail
					});
				}
				setTurns((current) => [...current, {
					id: replyId(id, "reply"),
					role: "ocade",
					text: escalating ? `${lines.join(" ")} Taking a look at the screen.` : lines.join(" ") || direct.say,
					entries: [...entries],
					verified: allOk
				}]);
			} finally {
				if (!remainingWork && !pendingCompose) {
					abortRef.current = null;
					revisionRef.current = null;
					setLive([]);
					setPhase((current) => current === "stopped" ? "stopped" : "idle");
				}
			}
			if (remainingWork && !recovering && !controller.signal.aborted) {
				const again = routeDirect(remainingWork);
				if (again && (again.calls.length > 0 || again.compose)) {
					for (const call of again.calls) {
						if (controller.signal.aborted) break;
						await waitWhilePaused();
						const outcome = await runOneCall(call, missionId, askPermission);
						push({
							id: `rr${Date.now()}${entries.length}`,
							kind: outcome.ok ? "done" : "problem",
							label: describeTool(call.name),
							detail: outcome.detail,
							verified: outcome.verified
						});
					}
					if (again.compose) pendingCompose = again.compose;
					remainingWork = null;
				}
			}
			if (!remainingWork && !pendingCompose || controller.signal.aborted) return;
		}
		if (pendingCompose) {
			try {
				push({
					id: `w${Date.now()}`,
					kind: "acting",
					label: "Writing the text",
					detail: pendingCompose.brief
				});
				const chatBox = isChatApp(pendingCompose.app);
				const written = await brain([{
					role: "user",
					content: chatBox ? `You are writing a chat message that will be sent as-is.

The message should: ${pendingCompose.brief}.\n\nWrite it the way a person types in a chat: one or two short sentences, plain words, no greeting block, no signature. Output ONLY the message itself - no preamble, no quotation marks around it, no markdown.` : `Write ${pendingCompose.brief}.\n\nOutput ONLY the finished text. No preamble, no explanation, no quotation marks around it, no markdown.`
				}], () => {}, controller.signal);
				if (!written.ok || !written.text.trim()) throw new Error(written.reason ?? "The engine did not return any text to type.");
				let body = stripControlTokens(written.text).trim();
				const wanted = parseConstraints(`${request} ${pendingCompose.brief}`);
				if (wanted.length > 0) {
					const check = checkContent(body, wanted);
					if (!check.ok) {
						const fixed = await brain([{
							role: "user",
							content: correctionPrompt(request, body, check)
						}], () => {}, controller.signal);
						if (fixed.ok && fixed.text.trim()) {
							const retry = checkContent(fixed.text, wanted);
							if (retry.ok || betterOf(check, retry)) body = fixed.text.trim();
						}
					}
				}
				const typeCall = chatBox ? {
					name: "whatsapp_type",
					arguments: { message: body }
				} : {
					name: "type_text",
					arguments: {
						text: body,
						...pendingCompose.app ? { windowTitle: pendingCompose.app } : {}
					}
				};
				const outcome = await runOneCall(typeCall, missionId, askPermission);
				push({
					id: `wt${Date.now()}`,
					kind: outcome.ok ? "done" : "problem",
					label: describeTool(typeCall.name),
					detail: outcome.detail,
					verified: outcome.verified
				});
				setTurns((current) => [...current, {
					id: `${id}-w`,
					role: "ocade",
					text: outcome.ok ? chatBox ? `${outcome.detail} Say send when you want it to go.` : `Wrote it into ${pendingCompose.app ?? "the window in front"}. ${outcome.detail}` : outcome.detail,
					entries: [...entries],
					verified: outcome.verified
				}]);
			} catch (cause) {
				runFailed = true;
				const message = cause instanceof Error ? cause.message : "OCADE could not write that.";
				setTurns((current) => [...current, {
					id: `${id}-we`,
					role: "ocade",
					text: message,
					entries: [...entries],
					verified: false
				}]);
				setError(message);
				setPhase("error");
			} finally {
				abortRef.current = null;
				revisionRef.current = null;
				setLive([]);
				settleRun(runFailed);
				setPhase((current) => current === "stopped" || current === "error" ? current : "idle");
			}
			return;
		}
		try {
			const agentDeps = {
				complete: async (prompt, signal) => {
					const reply = await brain([{
						role: "user",
						content: prompt
					}], () => {}, signal);
					return reply.ok ? reply.text : null;
				},
				turn: async (messages, tools, handlers) => {
					await waitWhilePaused();
					setPhase("thinking");
					const definitions = tools.map((tool) => findTool(tool.function.name)).filter((tool) => tool !== null);
					const local = messages.map((message) => ({
						role: message.role === "tool" ? "user" : message.role,
						content: message.role === "tool" ? `Result of ${message.toolName}:\n${message.content}` : message.content
					}));
					const names = definitions.map((tool) => tool.name);
					const wire = schemasFor([...new Set(definitions.map((tool) => tool.domain))], request);
					if (local[0]?.role === "system") local[0] = {
						...local[0],
						content: `${local[0].content}\n${toolInstructions(definitions)}`
					};
					const reply = await brain(local, handlers.onToken ?? (() => {}), handlers.signal, wire);
					if (!reply.ok) throw new Error(reply.reason ?? "The engine did not answer.");
					const native = (reply.calls ?? []).filter((call) => names.includes(call.name));
					const parsed = native.length ? {
						text: stripControlTokens(reply.text).trim(),
						toolCalls: native
					} : parseModelReply(reply.text, names);
					if (parsed.toolCalls.length === 0 && names.length > 0 && announcesAnotherStep(parsed.text) && !controller.signal.aborted) {
						const second = await brain([
							...local,
							{
								role: "assistant",
								content: reply.text
							},
							{
								role: "user",
								content: ACT_NOW_NUDGE
							}
						], () => {}, handlers.signal);
						if (second.ok) {
							const retried = parseModelReply(second.text, names);
							if (retried.toolCalls.length > 0) return {
								text: parsed.text,
								toolCalls: retried.toolCalls
							};
						}
					}
					return parsed;
				},
				permit: askPermission,
				execute: async (call, signal) => {
					await waitWhilePaused();
					if (signal?.aborted || controller.signal.aborted) return {
						kind: "cancelled",
						detail: "The task was stopped."
					};
					const checked = checkCall(call, ledgerRef.current);
					if (!checked.ok) return {
						kind: checked.code === "unknown_tool" ? "unsupported" : "state_changed",
						detail: checked.reason
					};
					ledgerRef.current.note(checked.call);
					const authored = contentOf(checked.call.name, checked.call.arguments);
					if (authored && constraints.length > 0) {
						const check = checkContent(authored.value, constraints);
						if (!check.ok) {
							push({
								id: `c${Date.now()}${entries.length}`,
								kind: "acting",
								label: "Checking the length",
								detail: `${check.shortfall} — rewriting.`
							});
							const corrected = await brain([{
								role: "user",
								content: correctionPrompt(request, authored.value, check)
							}], () => {}, controller.signal);
							if (corrected.ok && corrected.text.trim()) {
								const retry = checkContent(corrected.text, constraints);
								if (retry.ok || betterOf(check, retry)) checked.call.arguments = {
									...checked.call.arguments ?? {},
									[authored.field]: corrected.text.trim()
								};
								push({
									id: `c2${Date.now()}${entries.length}`,
									kind: retry.ok ? "done" : "problem",
									label: "Length",
									detail: retry.ok ? `Now ${retry.results[0]?.actual} ${retry.results[0]?.constraint.unit}s.` : `Still ${retry.shortfall}. Writing it anyway.`,
									verified: retry.ok
								});
							}
						}
					}
					const tool = findTool(checked.call.name);
					setPhase(tool?.mutating ? "controlling" : "observing");
					try {
						return await executeToolCall(checked.call, {
							missionId,
							confirmed: tool?.risk === "high"
						});
					} catch (cause) {
						return {
							kind: "retryable_failure",
							detail: cause instanceof Error ? cause.message : "That action could not be carried out."
						};
					}
				},
				onEvent: (event) => {
					if (event.kind === "tool_start") push({
						id: `s${Date.now()}${entries.length}`,
						kind: "acting",
						label: describeTool(event.call.name),
						detail: ""
					});
					else if (event.kind === "tool_end") {
						push({
							id: `e${Date.now()}${entries.length}`,
							kind: event.outcome.kind === "success" ? "done" : "problem",
							label: describeTool(event.call.name),
							detail: event.outcome.detail,
							verified: event.outcome.verified
						});
						if (event.outcome.kind === "success" && MEMORY_WRITES.has(event.call.name) && missionRef.current) refreshMemory(missionRef.current);
					} else if (event.kind === "refused") push({
						id: `x${Date.now()}${entries.length}`,
						kind: "refused",
						label: describeTool(event.call.name),
						detail: event.reason
					});
				}
			};
			const taskInput = {
				request: remainingWork ?? request,
				signal: controller.signal,
				revision,
				...recovering ? { domains: [
					"os_app",
					"files",
					"web"
				] } : {},
				memoryContext: memoryRef.current
			};
			const result = !recovering && !revision && looksMultiStep(taskInput.request) ? await (async () => {
				const plan = await runPlannedTask(agentDeps, {
					goal: taskInput.request,
					signal: taskInput.signal,
					memoryContext: taskInput.memoryContext
				});
				return {
					reason: plan.ok ? "answered" : "step_limit",
					text: plan.text,
					steps: [],
					classification: {
						domains: [],
						basis: "caller"
					},
					allVerified: plan.steps.every((step) => step.verified)
				};
			})() : await runAgentTask(agentDeps, taskInput);
			const ending = result.text || (result.reason === "cancelled" ? "You stopped this. OCADE let go of the keyboard and mouse and left everything as it was." : result.reason === "blocked" ? "OCADE stopped because it was not allowed to take the next step." : "OCADE finished without anything to report.");
			setTurns((current) => [...current, {
				id: replyId(id, "summary"),
				role: "ocade",
				text: ending,
				entries: [...entries],
				verified: result.allVerified
			}]);
			const stepCount = result.steps.length;
			runReceipt = stepCount === 0 ? ending.slice(0, 160) : `${stepCount} step${stepCount === 1 ? "" : "s"} — ${result.allVerified ? "all confirmed" : "not all confirmed"}.`;
			if (result.reason === "repeating" || result.reason === "step_limit") setPhase("error");
		} catch (cause) {
			runFailed = true;
			const message = cause instanceof Error ? cause.message : "OCADE could not complete that on this computer.";
			setTurns((current) => [...current, {
				id: `${id}-e`,
				role: "ocade",
				text: message,
				entries: [...entries],
				verified: false
			}]);
			setError(message);
			setPhase("error");
		} finally {
			abortRef.current = null;
			revisionRef.current = null;
			setLive([]);
			settleRun(runFailed);
			setPhase((current) => current === "stopped" || current === "error" ? current : "idle");
		}
	}, [
		brain,
		runOneCall,
		speak,
		refreshMemory,
		teardown,
		connect
	]);
	return {
		/** What the machine said when the mission opened. */
		start,
		connecting,
		connect,
		/** Ends the mission and lets go of the computer. */
		release,
		phase,
		busy: phase === "thinking" || phase === "observing" || phase === "controlling",
		paused,
		setPaused: changePaused,
		turns,
		live,
		approval,
		answer,
		revise,
		send,
		stop,
		/** Hand the keyboard and mouse back. OCADE holds nothing until asked. */
		takeOver,
		/** True while the user has control and OCADE is deliberately holding off. */
		handedOver,
		error,
		/** Prompt (typing) or voice (hands-free). Changes approvals, not powers. */
		mode,
		setMode,
		/** Microphone state, device list, and the controls for both. */
		mic,
		setMicEnabled,
		selectMicDevice,
		refreshAudio,
		/** Speak a line without blocking execution. */
		speak,
		/** Where the time went on the last step. */
		lastLatency: latencyRef.current,
		/** Which tools this device actually offers, for the capability line. */
		toolCount: toolsFor([
			"os_app",
			"files",
			"web"
		]).length
	};
}
/**
* OCADE Control + Work: the room where OCADE is asked to DO things to this
* computer, rather than asked about them.
*
* WHY IT IS NOT CHAT WITH A DIFFERENT HEADING
* -------------------------------------------
* Chat answers. This acts. They need different rooms because they need
* different consent: a sentence typed into Chat must never move the mouse, and
* an instruction typed here has a real machine on the other end. The two share
* authentication, the local engine and the history layer, and share no runtime
* path — Chat streams from the engine and stops there; this runs the agent loop
* and reaches the sidecars one approved action at a time.
*
* THE COMPOSITION
* ---------------
* The system fills the middle, because what OCADE is doing to the machine is
* the thing worth looking at while it does it. The task lives in a column on the
* right with the composer pinned to its bottom, so the conversation reads
* downward into the box you type in. There is no dashboard: no charts, no
* counters, no log pane. The one line of machine state sits over the scene, and
* everything else OCADE has to say, it says in words.
*
* WHAT THIS INTERFACE REFUSES TO SAY
* -----------------------------------
* Playwright. PyAutoGUI. UI Automation. Python. Port numbers. Model names.
* JSON. Tool identifiers. None of them appears here, because none is a thing
* the person asking OCADE to tidy their desktop needs to know, and every one of
* them makes the product look like a developer console pointed at their machine.
* What IS shown: what OCADE did, in the words a person would use, and whether it
* could confirm it.
*/
function ControlWorkPanel({ brain, headerNote, className }) {
	const mission = useMission(brain);
	const [prompt, setPrompt] = (0, import_react.useState)("");
	const [deckOpen, setDeckOpen] = (0, import_react.useState)(false);
	const [gestureOpen, setGestureOpen] = (0, import_react.useState)(false);
	const historyRef = (0, import_react.useRef)(null);
	const composerRef = (0, import_react.useRef)(null);
	const voicePrefs = useVoicePrefs();
	const dictation = useDictation({
		lang: "en-US",
		onTranscript: (text, isFinal) => {
			if (isFinal) setPrompt((current) => `${current} ${text}`.trim());
		}
	});
	(0, import_react.useEffect)(() => {
		mission.connect();
	}, []);
	(0, import_react.useEffect)(() => {
		if (mission.mode === "voice") mission.refreshAudio();
	}, [mission.mode]);
	(0, import_react.useEffect)(() => {
		const history = historyRef.current;
		if (typeof history?.scrollTo === "function") history.scrollTo({ top: history.scrollHeight });
	}, [mission.turns, mission.live]);
	const submit = (0, import_react.useCallback)(() => {
		const text = prompt.trim();
		if (!text) return;
		setPrompt("");
		const control = directControl(text);
		if (control === "stop") {
			mission.stop();
			return;
		}
		if (control === "pause") {
			mission.setPaused(true);
			return;
		}
		if (control === "continue") {
			mission.setPaused(false);
			return;
		}
		if (mission.busy) mission.revise(text);
		else mission.send(text);
	}, [prompt, mission]);
	const sceneState = mission.paused && mission.busy ? "paused" : mission.phase;
	const machineLine = (0, import_react.useMemo)(() => {
		const start = mission.start;
		if (!start) return mission.connecting ? "Reading this computer…" : null;
		if (!start.ok) return start.detail;
		const parts = [];
		if (start.activeWindow?.title) parts.push(`In front: ${start.activeWindow.title}`);
		if (typeof start.machine?.cpuPercent === "number") parts.push(`Processor ${Math.round(start.machine.cpuPercent)}%`);
		if (typeof start.machine?.memoryUsedPercent === "number") parts.push(`Memory ${Math.round(start.machine.memoryUsedPercent)}%`);
		return parts.join(" · ") || "Connected to this computer.";
	}, [mission.start, mission.connecting]);
	const connected = mission.start?.ok === true;
	const selectLauncher = (0, import_react.useCallback)((launcher) => {
		setPrompt(launcher.prompt);
		setDeckOpen(false);
		requestAnimationFrame(() => composerRef.current?.focus());
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex h-full min-h-0 w-full flex-col lg:flex-row", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-label": "What OCADE is doing on this computer",
				className: "relative min-h-[230px] min-w-0 flex-[0_0_38%] overflow-hidden bg-black lg:min-h-0 lg:flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ControlSolarScene, {
						state: sceneState,
						className: "absolute inset-0 h-full w-full"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OcadeCompanion, {
						compact: true,
						state: orbStateFor({
							phase: sceneState,
							awaitingApproval: mission.approval !== null,
							userHasControl: mission.handedOver
						}),
						label: mission.handedOver ? "You have the computer — OCADE is standing by" : connected ? "OCADE is connected to this device" : "OCADE is waiting for the companion on this computer",
						className: "absolute bottom-4 left-4 z-20"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "pointer-events-none absolute left-6 top-5 max-w-[70%]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-[11.5px] text-[oklch(0.85_0.05_82)]/70",
							children: machineLine
						}), connected && mission.start?.voice ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-0.5 truncate text-[10.5px] text-[oklch(0.8_0.04_82)]/45",
							children: [
								"Voice: ",
								mission.start.voice.voiceName,
								mission.start.voice.cloudRequired ? "" : " · on this device"
							]
						}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute right-3 top-3 flex max-w-[62%] flex-wrap justify-end gap-1.5 sm:right-6 sm:top-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SceneButton, {
								onClick: () => setDeckOpen((current) => !current),
								icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Command, { className: "h-3.5 w-3.5" }),
								label: deckOpen ? "Close deck" : "56 controls"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SceneButton, {
								onClick: () => setGestureOpen(true),
								icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hand, { className: "h-3.5 w-3.5" }),
								label: "Hand control"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SceneButton, {
								onClick: () => selectLauncher({
									id: "browser-control",
									label: "Browser control",
									description: "Work in an approved browser session.",
									prompt: "Open browser control and show which browser session is approved before taking any action.",
									risk: "read"
								}),
								icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Earth, { className: "h-3.5 w-3.5" }),
								label: "Browser"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SceneButton, {
								onClick: () => selectLauncher({
									id: "mobile-status",
									label: "Mobile status",
									description: "Show paired mobile control state.",
									prompt: "Show the current mobile companion connection and trust status.",
									risk: "read"
								}),
								icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "h-3.5 w-3.5" }),
								label: "Mobile"
							}),
							mission.busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SceneButton, {
									onClick: () => mission.setPaused(!mission.paused),
									icon: mission.paused ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "h-3.5 w-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "h-3.5 w-3.5" }),
									label: mission.paused ? "Resume" : "Pause"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SceneButton, {
									onClick: mission.stop,
									icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "h-3.5 w-3.5" }),
									label: "Stop"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SceneButton, {
									onClick: mission.takeOver,
									icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hand, { className: "h-3.5 w-3.5" }),
									label: "Take over"
								})
							] }) : null
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "flex min-h-0 w-full min-w-0 flex-1 flex-col border-t border-border/60 bg-background/96 lg:w-[38%] lg:min-w-[340px] lg:max-w-[460px] lg:shrink-0 lg:border-l lg:border-t-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "border-b border-border/60 px-5 py-3.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "h-1.5 w-1.5 rounded-full bg-[color:var(--accent-ocade)] shadow-[0_0_14px_var(--accent-ocade)]",
								"aria-hidden": true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-[14.5px] font-medium text-foreground",
								children: "OCADE Command Center"
							})]
						}), headerNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-[11px] text-muted-foreground/70",
							children: headerNote
						}) : null]
					}),
					deckOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ocade-scroll max-h-[58%] overflow-y-auto border-b border-border/60 p-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ControlCommandDeck, { onSelect: selectLauncher })
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						ref: historyRef,
						className: "min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4",
						children: [
							mission.turns.length === 0 && !mission.live.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[12.5px] leading-relaxed text-muted-foreground/75",
								children: connected ? "Ask OCADE to do something on this computer — open an application, read what is on screen, write a note, search the web. It looks first, works in small steps, and checks afterwards that what it did actually happened." : mission.error ?? "OCADE is connecting to this computer."
							}) : null,
							!connected && !mission.connecting ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								size: "sm",
								variant: "secondary",
								className: "h-7 rounded-full px-4 text-[12px]",
								onClick: () => void mission.connect(),
								children: "Try again"
							}) : null,
							mission.turns.map((turn) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: turn.role === "you" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex justify-end",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "max-w-[88%] rounded-2xl rounded-br-md bg-[oklch(0.72_0.13_82)]/15 px-3.5 py-2 text-[13px] leading-relaxed text-foreground",
									children: turn.text
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-2",
								children: [turn.entries && turn.entries.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Steps, { entries: turn.entries }) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90",
									children: turn.text
								})]
							}) }, turn.id)),
							mission.live.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Steps, {
								entries: mission.live,
								live: true
							}) : null,
							mission.approval ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: cn("rounded-xl border px-4 py-3", mission.approval.risk === "high" ? "border-destructive/45 bg-destructive/10" : "border-[oklch(0.72_0.13_82)]/40 bg-[oklch(0.72_0.13_82)]/10"),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[13px] font-medium text-foreground",
										children: mission.approval.question
									}),
									mission.approval.risk === "high" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 text-[11.5px] text-muted-foreground",
										children: ["This one changes something that is not trivial to undo.", mission.approval.spoken ? " OCADE read it out, and it waits here either way." : ""]
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2.5 flex gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											size: "sm",
											className: "h-7 rounded-full px-4 text-[12px]",
											onClick: () => mission.answer(true),
											children: "Yes, do it"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											size: "sm",
											variant: "ghost",
											className: "h-7 rounded-full px-4 text-[12px]",
											onClick: () => mission.answer(false),
											children: "No"
										})]
									})
								]
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-t border-[oklch(0.28_0.02_80)]/50 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-2xl border border-[oklch(0.3_0.02_80)]/60 bg-[oklch(0.155_0.008_75)] px-3 py-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									ref: composerRef,
									value: prompt,
									onChange: (event) => setPrompt(event.target.value),
									onKeyDown: (event) => {
										if (event.key === "Enter" && !event.shiftKey) {
											event.preventDefault();
											submit();
										}
									},
									rows: 2,
									placeholder: "Ask OCADE to control or work on this computer…",
									"aria-label": "Ask OCADE to control or work on this computer",
									className: "min-h-[40px] w-full resize-none bg-transparent text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1.5 flex items-center gap-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											size: "icon",
											variant: deckOpen ? "secondary" : "ghost",
											"aria-label": deckOpen ? "Close command deck" : "Open command deck",
											"aria-pressed": deckOpen,
											title: "Open 56 reviewed control launchers",
											className: "h-7 w-7 shrink-0 rounded-full text-muted-foreground/80",
											onClick: () => setDeckOpen((current) => !current),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Command, { className: "h-3.5 w-3.5" })
										}),
										dictation.supported ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											size: "icon",
											variant: "ghost",
											"aria-label": dictation.state === "listening" ? "Stop dictating" : "Dictate",
											"aria-pressed": dictation.state === "listening",
											className: "h-7 w-7 shrink-0 rounded-full text-muted-foreground/80",
											onClick: () => dictation.toggle(),
											children: dictation.state === "listening" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MicOff, { className: "h-3.5 w-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "h-3.5 w-3.5" })
										}) : null,
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											role: "radiogroup",
											"aria-label": "Interaction mode",
											className: "ml-1 inline-flex items-center rounded-full border border-[oklch(0.3_0.02_80)]/70 p-0.5",
											children: ["prompt", "voice"].map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												role: "radio",
												"aria-checked": mission.mode === option,
												onClick: () => mission.setMode(option),
												className: cn("rounded-full px-2.5 py-1 text-[10.5px] transition-colors", mission.mode === option ? "bg-[oklch(0.72_0.13_82)]/20 text-foreground" : "text-muted-foreground/70 hover:text-foreground"),
												children: option === "prompt" ? "Prompt" : "Voice"
											}, option))
										}),
										mission.mode === "voice" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												type: "button",
												size: "sm",
												variant: mission.mic.enabled ? "secondary" : "ghost",
												"aria-label": mission.mic.enabled ? "Turn the microphone off" : "Turn the microphone on",
												"aria-pressed": mission.mic.enabled,
												title: mission.mic.detail,
												className: "h-7 gap-1.5 rounded-full px-2.5 text-[10.5px]",
												onClick: () => void mission.setMicEnabled(!mission.mic.enabled),
												children: [mission.mic.enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "h-3.5 w-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MicOff, { className: "h-3.5 w-3.5" }), mission.mic.enabled ? "Listening" : "Mic off"]
											}),
											mission.mic.devices.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												"aria-label": "Microphone",
												value: mission.mic.deviceId ?? "",
												onChange: (event) => void mission.selectMicDevice(event.target.value === "" ? null : Number(event.target.value)),
												className: "h-7 max-w-[190px] rounded-full border border-[oklch(0.3_0.02_80)]/70 bg-transparent px-2.5 text-[10.5px] text-muted-foreground/90 outline-none",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "",
													children: "System default"
												}), mission.mic.devices.map((device) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: device.id,
													children: device.name
												}, device.id))]
											}) : null,
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												type: "button",
												size: "sm",
												variant: voicePrefs.prefs.gender === "female" ? "secondary" : "ghost",
												"aria-pressed": voicePrefs.prefs.gender === "female",
												title: "Prefer a locally installed female voice",
												className: "h-7 gap-1.5 rounded-full px-2.5 text-[10.5px]",
												onClick: () => voicePrefs.update({ gender: "female" }),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, {
													className: "h-3.5 w-3.5",
													"aria-hidden": true
												}), " Female voice"]
											})
										] }) : null,
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "ml-1 inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.3_0.02_80)]/70 px-2.5 py-1 text-[10.5px] text-muted-foreground/80",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												"aria-hidden": true,
												className: cn("h-1.5 w-1.5 rounded-full", connected ? "bg-[oklch(0.72_0.16_145)]" : "bg-muted-foreground/50")
											}), "On this device"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "ml-auto",
											children: mission.busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												type: "button",
												size: "icon",
												variant: "secondary",
												"aria-label": "Stop",
												className: "h-8 w-8 rounded-full",
												onClick: mission.stop,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "h-3.5 w-3.5" })
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												type: "button",
												size: "icon",
												"aria-label": "Send",
												disabled: !prompt.trim() || !connected,
												className: "h-8 w-8 rounded-full",
												onClick: submit,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "h-3.5 w-3.5" })
											})
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "px-1 pt-1.5 text-[10.5px] text-muted-foreground/50",
								children: mission.busy ? "Press Enter to change what OCADE is doing · Stop to end it" : "Press Enter to send · Shift+Enter for a new line"
							}),
							dictation.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "px-1 pt-1 text-[11px] text-muted-foreground",
								children: dictation.error
							}) : null
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: gestureOpen,
				onOpenChange: setGestureOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
					className: "max-h-[88svh] max-w-2xl overflow-y-auto border-border/70 bg-background/96 p-3 sm:p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
						className: "sr-only",
						children: "Hand gesture control"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GestureControlPanel, {})]
				})
			})
		]
	});
}
function SceneButton({ onClick, icon, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		type: "button",
		size: "sm",
		variant: "ghost",
		onClick,
		className: "h-7 gap-1.5 rounded-full border border-[oklch(0.35_0.03_80)]/60 bg-background/50 px-3 text-[11.5px] backdrop-blur hover:bg-background/70",
		children: [icon, label]
	});
}
/**
* What OCADE did, one line each.
*
* The dot carries the outcome and the sentence carries the detail. "Not
* confirmed on screen" is written out rather than left to a colour, because
* "done" and "done, and I checked" are different claims and the product rule is
* that OCADE never conflates them.
*/
function Steps({ entries, live = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-1",
		children: entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex items-start gap-2 text-[11.5px] leading-relaxed",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				"aria-hidden": true,
				className: cn("mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full", entry.kind === "problem" || entry.kind === "refused" ? "bg-destructive/70" : entry.kind === "asked" ? "bg-[oklch(0.72_0.13_82)]" : entry.verified === false ? "bg-muted-foreground/45" : "bg-[oklch(0.72_0.16_145)]/80", live && entry.kind === "acting" ? "animate-pulse" : "")
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-foreground/80",
						children: entry.label
					}),
					entry.detail ? ` — ${entry.detail}` : "",
					entry.verified === false ? " (not confirmed on screen)" : ""
				]
			})]
		}, entry.id))
	});
}
/**
* The same engine Chat uses, shaped for the mission loop.
*
* ONE BRAIN, TWO ROOMS. Control + Work does not get its own model, its own
* router or its own runtime — it gets the engine `useLocalChatEngine` already
* resolves, which is the one the signed-in chat and the demo both run on. What
* differs between the rooms is what the engine is allowed to reach afterwards,
* and that lives in the mission, not here.
*
* WHY THE TEXT IS ACCUMULATED RATHER THAN RETURNED. `send` streams tokens and
* resolves with success or a reason; the reply itself only exists as the tokens
* that went past. The loop needs the whole reply to look for an action in it,
* so it is collected here and handed over once the stream closes.
*/
function useMissionBrain() {
	const engine = useLocalChatEngine({ surface: "control" });
	const brain = (0, import_react.useCallback)(async (messages, onToken, signal, tools) => {
		let text = "";
		const calls = [];
		const result = await engine.send({
			messages,
			onToken: (chunk) => {
				text += chunk;
				onToken(chunk);
			},
			...tools?.length ? {
				tools,
				onToolCall: (call) => calls.push({
					name: call.name,
					arguments: call.arguments
				})
			} : {}
		});
		if (signal?.aborted) return {
			ok: false,
			text,
			reason: "The task was stopped."
		};
		if (!result.ok) return {
			ok: false,
			text,
			reason: result.reason ?? (result.cancelled ? "The task was stopped." : "OCADE's engine did not answer on this device.")
		};
		return {
			ok: true,
			text,
			calls
		};
	}, [engine]);
	return (0, import_react.useMemo)(() => ({
		brain,
		ready: engine.state.status === "ready" || engine.state.status === "generating",
		status: engine.state.status,
		stop: engine.stop,
		warm: engine.warm
	}), [
		brain,
		engine.state.status,
		engine.stop,
		engine.warm
	]);
}
//#endregion
export { useMissionBrain as n, ControlWorkPanel as t };
