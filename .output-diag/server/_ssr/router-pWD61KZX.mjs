import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as useAppearance, t as ThemeContext } from "./use-appearance-DRtxpe7r.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as readDeviceSignals, n as assessDevice, t as FALLBACK_CHANGES } from "./perf-fallback-BFzNUEP9.mjs";
import { t as createClient } from "../_libs/supabase__supabase-js.mjs";
import { n as supabase, t as getSupabaseBrowserConfiguration } from "./client-D46NpEQY.mjs";
import { N as redirect, _ as Link, b as useRouter, c as HeadContent, f as createRouter, g as createRootRouteWithContext, h as createFileRoute, m as lazyRouteComponent, p as Outlet, s as Scripts, u as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { M as ShieldCheck } from "../_libs/lucide-react.mjs";
import { t as Route$1$1 } from "../_._lovable.oauth.consent-CQgZlkXy.mjs";
import { t as SiteFooterLinks } from "./SiteFooter-CIpVmEmM.mjs";
import { n as PublicPage, r as PublicSection } from "./PublicPage-CTc9xZld.mjs";
import { t as Route } from "./access-denied-DYoxy-Nb.mjs";
import { n as chooseRenderTier } from "./universe-CvRdDAaW.mjs";
import { i as closeActiveCompanionSession } from "./tauri-companion-u0J6qjWn.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as useSession } from "./session-VpaXwoLS.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { r as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
import { l as sellablePlanByPriceId, u as sellablePlanByProductId } from "./paddle-plans-Pm8sU42X.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
import { a as DialogHeader, i as DialogFooter, n as DialogContent, o as DialogTitle, r as DialogDescription, t as Dialog } from "./dialog-CCT-3-fg.mjs";
import { n as Route$80, t as LegalDialog } from "./auth-ClbsO0Dd.mjs";
import { t as Route$81 } from "./auth.callback-jjvNKSnL.mjs";
import { t as Route$82 } from "./auth.verify-B2tlJ-CV.mjs";
import { t as Route$83 } from "./blog._slug-rgKjX30A.mjs";
import { a as verifyWebhook, r as isPaddleEnv } from "./paddle.server-Dss6Gr3S.mjs";
import { n as useInstallationBootstrap } from "./use-installation-MYZC-XQ5.mjs";
import { n as invalidateModeCache } from "./resolver-CR5RuR-0.mjs";
import { t as reportRuntimeError } from "./runtime-error-reporting-CAHLHbAu.mjs";
import { n as Route$1$84, t as ErrorBoundary } from "./ocade.index-C84M5DfZ.mjs";
import { a as clearApprovals } from "./approval-store-Co53E13u.mjs";
import { r as checkServerLimit } from "./server-D2G3TBGg.mjs";
import { t as Route$85 } from "./pricing-CwijGzXu.mjs";
import { t as Route$84 } from "./route-DgYgABs2.mjs";
import { n as Route$86, t as DepthContext } from "./settings._section-D6SV4Knm.mjs";
import { n as clearDevices } from "./device-store-CRf9IOAa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-pWD61KZX.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Product-surface polish for the packaged desktop shell.
*
* WHAT THIS IS, STATED PLAINLY: it is not a security boundary. Anyone who wants
* the running code can attach a debugger to a local process, and no key handler
* in a webview changes that. What stops binary tampering is code signing; what
* stops a hostile page reaching the engine is the CSP and the origin lock; what
* stops an injected command running is the allow-list. Those are the boundaries.
*
* What this stops is the accidental and the casual: an Inspect Element in a
* right-click menu that hands a customer the internals of a product they bought,
* and a stray Ctrl+R that reloads the shell into a state the native host is not
* expecting mid-task. That is worth having, and it is worth not mistaking for
* armour.
*
* DESKTOP ONLY, AND DELIBERATELY.
* -------------------------------
* The same code shipped to the website would be user-hostile and pointless.
* Pointless because the page source is already served to the browser and
* "view source" is one menu away regardless; hostile because right-click on the
* web is how people copy text, open links in new tabs, use a spell-checker, and
* drive a screen reader's context actions. Breaking all of that to inconvenience
* somebody who can press Ctrl+U anyway is a bad trade. So it is gated on the
* Tauri shell being present, and the web app is left alone.
*
* TEXT SELECTION AND COPY ARE NOT TOUCHED, on the desktop either. A person must
* be able to copy an answer OCADE gave them; a product that fights its own user
* over their clipboard has confused them with an attacker.
*/
/** True only inside the packaged Tauri shell. */
function inDesktopShell() {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
/** Keystrokes that open developer tooling or reload the shell. */
function isDeveloperShortcut(event) {
	const key = (event.key || "").toLowerCase();
	const mod = event.ctrlKey || event.metaKey;
	if (key === "f12") return true;
	if (mod && event.shiftKey && [
		"i",
		"j",
		"c"
	].includes(key)) return true;
	if (mod && !event.shiftKey && ["r", "u"].includes(key)) return true;
	return false;
}
/**
* Install the handlers. Returns a function that removes them again.
*
* A no-op outside the desktop shell, so calling it unconditionally from the app
* root is safe — the web build installs nothing.
*/
function hardenDesktopShell(target = typeof window !== "undefined" ? window : null) {
	if (!target || !inDesktopShell()) return () => {};
	const onContextMenu = (event) => event.preventDefault();
	const onKeyDown = (event) => {
		if (isDeveloperShortcut(event)) event.preventDefault();
	};
	target.addEventListener("contextmenu", onContextMenu);
	target.addEventListener("keydown", onKeyDown);
	return () => {
		target.removeEventListener("contextmenu", onContextMenu);
		target.removeEventListener("keydown", onKeyDown);
	};
}
var styles_default = "/assets/styles-C-fHYRT0.css";
/**
* CARCC CADANE ThemeProvider.
*
* Owns the visual mode (dark | light | real), reduced-motion preference,
* low-performance mode (auto-detected via rAF FPS sampling), and cursor
* preferences. Persists to Supabase user_settings when signed in; falls back
* to localStorage otherwise. Applies classes / data attributes / CSS
* variables on <html> so styles.css tokens do the rest.
*
* No hardcoded page colors — everything flows through CSS variables.
*/
var DEFAULT = {
	theme: "dark",
	reducedMotion: false,
	highContrast: false,
	lowPerformance: false,
	cursor: "system",
	cursorSize: 24,
	depth3d: true,
	depthStrength: 100
};
/** Keep a stored or typed pointer size inside the range the artwork stays legible at. */
function clampCursorSize(value) {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return 24;
	return Math.max(16, Math.min(64, Math.round(n)));
}
/** Keep a stored or typed strength inside the range the geometry is tuned for. */
function clampDepthStrength(value) {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return 100;
	return Math.max(0, Math.min(200, Math.round(n)));
}
var LS_KEY = "caera:appearance:v1";
/**
* "Keep full quality on this device anyway" lives per browser, not per
* account: it is a judgement about this machine, and syncing it would force a
* fast desktop's choice onto a struggling phone.
*/
var LS_PERF_OVERRIDE = "caera:appearance:perf-override:v1";
function readFallbackOverride() {
	if (typeof window === "undefined") return false;
	try {
		return window.localStorage.getItem(LS_PERF_OVERRIDE) === "1";
	} catch {
		return false;
	}
}
function writeFallbackOverride(value) {
	if (typeof window === "undefined") return;
	try {
		if (value) window.localStorage.setItem(LS_PERF_OVERRIDE, "1");
		else window.localStorage.removeItem(LS_PERF_OVERRIDE);
	} catch {}
}
function readLocal() {
	if (typeof window === "undefined") return DEFAULT;
	try {
		const raw = window.localStorage.getItem(LS_KEY);
		if (!raw) return DEFAULT;
		const parsed = JSON.parse(raw);
		return {
			...DEFAULT,
			...parsed
		};
	} catch {
		return DEFAULT;
	}
}
/**
* Persist to this browser. Returns whether it actually landed — a private
* window with storage blocked, or a full quota, must surface as "not saved"
* rather than being swallowed and later mistaken for a lost setting.
*/
function writeLocal(prefs) {
	if (typeof window === "undefined") return false;
	try {
		window.localStorage.setItem(LS_KEY, JSON.stringify(prefs));
		return true;
	} catch {
		return false;
	}
}
/** Apply prefs to the document element via classes + CSS vars. */
function applyToDocument(prefs, osReducedMotion, autoLowPerf) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.classList.remove("theme-dark", "theme-light", "theme-real", "light", "real");
	root.classList.add(`theme-${prefs.theme}`);
	if (prefs.theme === "light") root.classList.add("light");
	if (prefs.theme === "real") root.classList.add("real");
	root.classList.toggle("high-contrast", prefs.highContrast);
	const motionOff = prefs.reducedMotion || osReducedMotion;
	root.classList.toggle("reduce-motion", motionOff);
	root.classList.toggle("low-perf", prefs.lowPerformance || autoLowPerf);
	const lowPerf = prefs.lowPerformance || autoLowPerf;
	root.style.setProperty("--depth-strength", lowPerf ? "0" : (clampDepthStrength(prefs.depthStrength) / 100).toFixed(2));
	root.classList.toggle("cursor-accessibility", prefs.cursor === "accessibility");
	const size = clampCursorSize(prefs.cursorSize);
	const fill = prefs.cursor === "caera_black" ? "black" : prefs.cursor === "caera_white" ? "white" : prefs.cursor === "auto_contrast" ? prefs.theme === "light" ? "black" : "white" : null;
	if (fill) {
		root.style.setProperty("--app-cursor", `${pointerDataUri(fill, size)} ${hotspotFor(size)}, auto`);
		root.classList.add("has-custom-cursor");
	} else {
		root.style.removeProperty("--app-cursor");
		root.classList.remove("has-custom-cursor");
	}
}
/** The pointer artwork, at a given size, as a `url()` value. */
function pointerDataUri(fill, size) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M3 2 L3 20 L8 15.5 L11 22 L14 20.5 L11 14 L18 14 Z" fill="${fill === "white" ? "#f5f7fa" : "#0a0d12"}" stroke="${fill === "white" ? "#0a0d12" : "#f5f7fa"}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
/** The click point, scaled with the artwork so it stays on the arrow tip. */
function hotspotFor(size) {
	const offset = Math.round(2 / 24 * size);
	return `${offset} ${offset}`;
}
function ThemeProvider({ children }) {
	const [prefs, setPrefs] = (0, import_react.useState)(() => readLocal());
	const [osReducedMotion, setOsReducedMotion] = (0, import_react.useState)(false);
	/**
	* The automatic fallback: whether it is active, what tripped it, and whether
	* the person has told us to keep full quality anyway. The override is held
	* per browser (not per account) because it is a statement about THIS machine.
	*/
	const [perfFallback, setPerfFallback] = (0, import_react.useState)(() => ({
		active: false,
		trigger: null,
		reason: null,
		overridden: readFallbackOverride(),
		changes: FALLBACK_CHANGES
	}));
	const autoLowPerf = perfFallback.active && !perfFallback.overridden;
	const keepFullQuality = (0, import_react.useCallback)(() => {
		writeFallbackOverride(true);
		setPerfFallback((s) => ({
			...s,
			overridden: true
		}));
	}, []);
	const resumeAutoFallback = (0, import_react.useCallback)(() => {
		writeFallbackOverride(false);
		setPerfFallback((s) => ({
			...s,
			overridden: false
		}));
	}, []);
	(0, import_react.useEffect)(() => {
		const assessment = assessDevice(readDeviceSignals());
		if (!assessment.lowEnd) return;
		setPerfFallback((s) => s.active ? s : {
			...s,
			active: true,
			trigger: "device",
			reason: assessment.reason
		});
	}, []);
	const userIdRef = (0, import_react.useRef)(null);
	const [persistence, setPersistence] = (0, import_react.useState)({
		status: "idle",
		scope: "local",
		message: null,
		loadedFromCloud: false,
		loadError: null,
		lastSavedAt: null,
		hasPendingChanges: false
	});
	/**
	* The accumulated columns of every write that has not been confirmed yet.
	* Retrying replays the whole set, so a switch flipped after a failure is not
	* silently dropped just because the earlier one is what the user retried.
	*/
	const pendingRowRef = (0, import_react.useRef)({});
	const prefsRef = (0, import_react.useRef)(prefs);
	prefsRef.current = prefs;
	(0, import_react.useEffect)(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const handler = () => setOsReducedMotion(mq.matches);
		handler();
		mq.addEventListener?.("change", handler);
		return () => mq.removeEventListener?.("change", handler);
	}, []);
	(0, import_react.useEffect)(() => {
		if (typeof window === "undefined") return;
		let raf = 0;
		let last = performance.now();
		let slowFrames = 0;
		let fastFrames = 0;
		const tick = (now) => {
			const dt = now - last;
			last = now;
			if (dt > 40) {
				slowFrames++;
				fastFrames = 0;
				if (slowFrames > 90) setPerfFallback((s) => s.active ? s : {
					...s,
					active: true,
					trigger: "frames",
					reason: null
				});
			} else if (dt < 20) {
				fastFrames++;
				slowFrames = 0;
				if (fastFrames > 300) setPerfFallback((s) => s.active && s.trigger === "frames" ? {
					...s,
					active: false,
					trigger: null,
					reason: null
				} : s);
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!getSupabaseBrowserConfiguration().configured) return;
		let cancelled = false;
		async function load(userId) {
			const { data, error } = await supabase.from("user_settings").select("theme, reduced_motion, high_contrast, appearance_cursor, appearance_cursor_custom, appearance_cursor_size, appearance_cursor_trail, appearance_low_performance, appearance_depth_3d, appearance_depth_strength").eq("user_id", userId).maybeSingle();
			if (cancelled) return;
			if (error) {
				setPersistence((p) => ({
					...p,
					scope: "local",
					loadedFromCloud: false,
					loadError: "We couldn't load the preferences saved to your account. You're seeing this browser's settings."
				}));
				return;
			}
			if (!data) {
				setPersistence((p) => ({
					...p,
					scope: "cloud",
					loadedFromCloud: true,
					loadError: null
				}));
				return;
			}
			const rec = data;
			const theme = rec.theme ?? "dark";
			const next = {
				theme: theme === "light" || theme === "real" || theme === "dark" ? theme : "dark",
				reducedMotion: !!rec.reduced_motion,
				highContrast: !!rec.high_contrast,
				lowPerformance: !!rec.appearance_low_performance,
				cursor: rec.appearance_cursor ?? "system",
				cursorSize: clampCursorSize(rec.appearance_cursor_size),
				depth3d: rec.appearance_depth_3d === void 0 || rec.appearance_depth_3d === null ? true : !!rec.appearance_depth_3d,
				depthStrength: clampDepthStrength(rec.appearance_depth_strength ?? 100)
			};
			setPrefs(next);
			const localOk = writeLocal(next);
			setPersistence((p) => ({
				...p,
				scope: "cloud",
				loadedFromCloud: true,
				loadError: null,
				status: p.hasPendingChanges ? p.status : "idle",
				message: localOk ? p.hasPendingChanges ? p.message : null : "This browser is blocking local storage, so preferences are kept in your account only."
			}));
		}
		supabase.auth.getSession().then(({ data }) => {
			userIdRef.current = data.session?.user.id ?? null;
			if (userIdRef.current) load(userIdRef.current);
		});
		const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
			const nextId = session?.user.id ?? null;
			userIdRef.current = nextId;
			if (nextId) load(nextId);
			else setPersistence((p) => ({
				...p,
				scope: "local",
				loadedFromCloud: false,
				loadError: null
			}));
		});
		return () => {
			cancelled = true;
			sub.subscription.unsubscribe();
		};
	}, []);
	(0, import_react.useEffect)(() => {
		applyToDocument(prefs, osReducedMotion, autoLowPerf);
	}, [
		prefs,
		osReducedMotion,
		autoLowPerf
	]);
	/**
	* Push whatever is queued to the account.
	*
	* UPSERT, NOT UPDATE. A plain update against a missing settings row reports
	* success while changing nothing, which is exactly the failure this task is
	* about: the switch moves, the refresh reverts it, and nothing ever said why.
	*/
	const flush = (0, import_react.useCallback)(async () => {
		const uid = userIdRef.current;
		const row = pendingRowRef.current;
		if (!uid || Object.keys(row).length === 0) return;
		setPersistence((p) => ({
			...p,
			status: "saving"
		}));
		const payload = {
			user_id: uid,
			...row
		};
		const { error } = await supabase.from("user_settings").upsert(payload, { onConflict: "user_id" });
		if (error) {
			setPersistence((p) => ({
				...p,
				status: "error",
				hasPendingChanges: true,
				message: "We couldn't save this to your account. It still applies here and on this browser after a refresh."
			}));
			return;
		}
		pendingRowRef.current = {};
		setPersistence((p) => ({
			...p,
			status: "saved",
			scope: "cloud",
			hasPendingChanges: false,
			message: null,
			lastSavedAt: Date.now()
		}));
	}, []);
	const update = (0, import_react.useCallback)(async (patch) => {
		const next = {
			...prefsRef.current,
			...patch
		};
		prefsRef.current = next;
		setPrefs(next);
		const localOk = writeLocal(next);
		const uid = userIdRef.current;
		const row = {};
		if (patch.theme !== void 0) row.theme = patch.theme;
		if (patch.reducedMotion !== void 0) row.reduced_motion = patch.reducedMotion;
		if (patch.highContrast !== void 0) row.high_contrast = patch.highContrast;
		if (patch.lowPerformance !== void 0) row.appearance_low_performance = patch.lowPerformance;
		if (patch.cursor !== void 0) row.appearance_cursor = patch.cursor;
		if (patch.cursorSize !== void 0) row.appearance_cursor_size = clampCursorSize(patch.cursorSize);
		if (patch.depth3d !== void 0) row.appearance_depth_3d = patch.depth3d;
		if (patch.depthStrength !== void 0) row.appearance_depth_strength = clampDepthStrength(patch.depthStrength);
		if (!uid) {
			setPersistence((p) => ({
				...p,
				status: localOk ? "saved" : "error",
				scope: localOk ? "local" : "none",
				lastSavedAt: localOk ? Date.now() : p.lastSavedAt,
				message: localOk ? null : "This browser is blocking local storage, so this change will be lost when the page reloads. Sign in, or allow site data, to keep it."
			}));
			return;
		}
		if (Object.keys(row).length === 0) return;
		pendingRowRef.current = {
			...pendingRowRef.current,
			...row
		};
		await flush();
	}, [flush]);
	const retryPersist = (0, import_react.useCallback)(async () => {
		if (!userIdRef.current) {
			const localOk = writeLocal(prefsRef.current);
			setPersistence((p) => ({
				...p,
				status: localOk ? "saved" : "error",
				scope: localOk ? "local" : "none",
				lastSavedAt: localOk ? Date.now() : p.lastSavedAt,
				message: localOk ? null : p.message
			}));
			return;
		}
		if (Object.keys(pendingRowRef.current).length === 0) {
			const p = prefsRef.current;
			pendingRowRef.current = {
				theme: p.theme,
				reduced_motion: p.reducedMotion,
				high_contrast: p.highContrast,
				appearance_low_performance: p.lowPerformance,
				appearance_cursor: p.cursor,
				appearance_cursor_size: clampCursorSize(p.cursorSize),
				appearance_depth_3d: p.depth3d,
				appearance_depth_strength: clampDepthStrength(p.depthStrength)
			};
		}
		await flush();
	}, [flush]);
	const value = (0, import_react.useMemo)(() => ({
		...prefs,
		osReducedMotion,
		autoLowPerf,
		perfFallback,
		keepFullQuality,
		resumeAutoFallback,
		update,
		persistence,
		retryPersist
	}), [
		prefs,
		osReducedMotion,
		autoLowPerf,
		perfFallback,
		keepFullQuality,
		resumeAutoFallback,
		update,
		persistence,
		retryPersist
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeContext.Provider, {
		value,
		children
	});
}
/** Clamp to [-1, 1]; NaN becomes 0 rather than propagating through the scene. */
function unit(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(-1, Math.min(1, value));
}
function depthMode(input) {
	if (!input.hasDom) return "flat";
	if (input.supports3d === false) return "flat";
	if (input.userDepth3d === false) return "flat";
	if (input.reducedMotion || input.osReducedMotion) return "flat";
	if (input.tier === "static") return "static";
	return input.tier === "reduced" ? "static" : "full";
}
/**
* Normalise a pointer position within a rectangle to [-1, 1].
*
* A zero-sized rectangle returns the centre rather than dividing by zero — an
* element that has not been laid out yet is a real state during the first
* frame, and `NaN` in a transform silently removes the element from the scene.
*/
function normalisePointer(clientX, clientY, rect) {
	if (rect.width <= 0 || rect.height <= 0) return {
		x: 0,
		y: 0
	};
	return {
		x: unit((clientX - rect.left) / rect.width * 2 - 1),
		y: unit((clientY - rect.top) / rect.height * 2 - 1)
	};
}
/**
* The camera the whole application is seen through.
*
* ONE SCENE, ONE POINTER LISTENER. Every surface in the product reads its tilt
* from here rather than attaching its own `pointermove`. That is not a
* micro-optimisation: a workspace route renders forty-odd panels, and forty
* listeners each doing their own `getBoundingClientRect` on every mouse event
* is a layout thrash that turns the depth effect into the reason the app feels
* slow. The scene measures once per frame and publishes two numbers.
*
* THE POINTER IS PUBLISHED AS CSS VARIABLES, not as React state. Re-rendering
* the tree on pointer movement would be the same mistake one level up — it
* would run every panel's render function at pointer rate. `--pointer-x` and
* `--pointer-y` inherit to every descendant, so the browser recomputes the
* transforms on the compositor and React does no work at all while the pointer
* moves.
*
* WRITTEN TO `document.documentElement`, NOT TO A WRAPPER, and that is not
* incidental. Dialogs, popovers, menus and tooltips all render through a React
* PORTAL into `document.body` — outside this component's subtree entirely. A
* wrapper div would leave every one of them with `--depth-active` unset, so the
* surfaces that most need to read as "in front" would be the only ones with no
* depth at all. The document element is the one ancestor everything shares.
*
* The component still renders `display: contents`, so it disturbs no layout —
* the same reason `MotionScope` renders no box of its own.
*/
/** Does this browser composite 3D transforms? */
function supports3d() {
	if (typeof window === "undefined" || typeof CSS === "undefined" || !CSS.supports) return false;
	return CSS.supports("transform-style", "preserve-3d") && CSS.supports("perspective", "1000px");
}
function DepthScene({ children }) {
	const { reducedMotion, osReducedMotion, depth3d } = useAppearance();
	const hostRef = (0, import_react.useRef)(null);
	const frameRef = (0, import_react.useRef)(null);
	const pendingRef = (0, import_react.useRef)(null);
	const [mode, setMode] = (0, import_react.useState)("flat");
	(0, import_react.useEffect)(() => {
		const nav = navigator;
		setMode(depthMode({
			reducedMotion,
			osReducedMotion,
			tier: chooseRenderTier({
				reducedMotion: reducedMotion || osReducedMotion,
				cores: nav.hardwareConcurrency,
				memoryGb: nav.deviceMemory,
				viewportWidth: window.innerWidth
			}),
			hasDom: true,
			supports3d: supports3d(),
			userDepth3d: depth3d
		}));
	}, [
		reducedMotion,
		osReducedMotion,
		depth3d
	]);
	const interactive = mode === "full";
	(0, import_react.useEffect)(() => {
		const root = document.documentElement;
		root.setAttribute("data-depth-scene", mode);
		return () => root.removeAttribute("data-depth-scene");
	}, [mode]);
	const publish = (0, import_react.useCallback)(() => {
		frameRef.current = null;
		const next = pendingRef.current;
		if (!next) return;
		const root = document.documentElement;
		root.style.setProperty("--pointer-x", next.x.toFixed(3));
		root.style.setProperty("--pointer-y", next.y.toFixed(3));
	}, []);
	(0, import_react.useEffect)(() => {
		if (!interactive) return;
		const onMove = (event) => {
			if (event.pointerType === "touch") return;
			pendingRef.current = normalisePointer(event.clientX, event.clientY, {
				left: 0,
				top: 0,
				width: window.innerWidth,
				height: window.innerHeight
			});
			if (frameRef.current === null) frameRef.current = requestAnimationFrame(publish);
		};
		const onLeave = () => {
			pendingRef.current = {
				x: 0,
				y: 0
			};
			if (frameRef.current === null) frameRef.current = requestAnimationFrame(publish);
		};
		window.addEventListener("pointermove", onMove, { passive: true });
		window.addEventListener("pointerleave", onLeave);
		window.addEventListener("blur", onLeave);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerleave", onLeave);
			window.removeEventListener("blur", onLeave);
			if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
			frameRef.current = null;
		};
	}, [interactive, publish]);
	(0, import_react.useEffect)(() => {
		if (interactive) return;
		const root = document.documentElement;
		root.style.setProperty("--pointer-x", "0");
		root.style.setProperty("--pointer-y", "0");
	}, [interactive]);
	const value = (0, import_react.useMemo)(() => ({
		mode,
		enabled: mode !== "flat",
		interactive
	}), [mode, interactive]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DepthContext.Provider, {
		value,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: hostRef,
			style: { display: "contents" },
			children
		})
	});
}
var SERVICE_WORKER_PATH = "/sw.js";
/**
* Install the offline shell, or say precisely why not.
*
* Never throws. A browser that refuses a service worker is an ordinary state —
* private browsing, an insecure origin, a locked-down enterprise profile — and
* the correct response is an application that still works online and a status
* line that is true, not an unhandled rejection in the console.
*/
async function registerOfflineShell(deps) {
	if (!deps.supported) return {
		ok: false,
		reason: "This browser does not support offline mode.",
		retryable: false
	};
	if (!deps.secureContext) return {
		ok: false,
		reason: "Offline mode needs a secure (https) connection.",
		retryable: true
	};
	if (!deps.register) return {
		ok: false,
		reason: "No service worker registrar was provided.",
		retryable: false
	};
	try {
		return {
			ok: true,
			scope: (await deps.register(SERVICE_WORKER_PATH)).scope
		};
	} catch (error) {
		return {
			ok: false,
			reason: error instanceof Error ? error.message : "Offline mode could not be enabled.",
			retryable: true
		};
	}
}
/**
* Read the ambient browser and register, for the one real call site.
*
* Kept separate from `registerOfflineShell` so that function stays pure of
* globals and fully testable; this wrapper is the only part that cannot be
* exercised outside a browser.
*/
async function registerOfflineShellFromBrowser() {
	const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
	return registerOfflineShell({
		supported,
		secureContext: typeof window !== "undefined" && window.isSecureContext,
		register: supported ? (path) => navigator.serviceWorker.register(path).then((r) => ({ scope: r.scope })) : void 0
	});
}
/** Pure, injected orchestration so every failure mode can be verified in tests. */
async function primeOfflineRuntime(deps) {
	if (!deps.online) return {
		ok: false,
		reason: "offline"
	};
	if (!deps.serviceWorkerSupported) return {
		ok: false,
		reason: "unsupported"
	};
	try {
		if (!await deps.waitForController()) return {
			ok: false,
			reason: "not_controlled"
		};
		const { wasmUrl } = await deps.loadRuntime();
		if (!(await deps.fetchAsset(wasmUrl)).ok) return {
			ok: false,
			reason: "load_failed"
		};
		return {
			ok: true,
			wasmUrl
		};
	} catch {
		return {
			ok: false,
			reason: "load_failed"
		};
	}
}
async function waitForController(serviceWorker, timeoutMs = 8e3) {
	await serviceWorker.ready;
	if (serviceWorker.controller) return true;
	return new Promise((resolve) => {
		let settled = false;
		const finish = (controlled) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			serviceWorker.removeEventListener("controllerchange", onControllerChange);
			resolve(controlled);
		};
		const onControllerChange = () => finish(Boolean(serviceWorker.controller));
		const timer = setTimeout(() => finish(Boolean(serviceWorker.controller)), timeoutMs);
		serviceWorker.addEventListener("controllerchange", onControllerChange);
	});
}
/** Browser wrapper used by the application root. Never throws. */
async function primeOfflineRuntimeFromBrowser() {
	const serviceWorkerSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
	return primeOfflineRuntime({
		online: typeof navigator !== "undefined" && navigator.onLine,
		serviceWorkerSupported,
		waitForController: () => serviceWorkerSupported ? waitForController(navigator.serviceWorker) : Promise.resolve(false),
		loadRuntime: async () => {
			await import("./wllama-0Jo7yQto.mjs");
			return { wasmUrl: (await import("./wllama-BGXHWGTU.mjs")).default };
		},
		fetchAsset: (url) => fetch(url, { credentials: "same-origin" })
	});
}
/**
* WHICH DOCUMENTS AN ACCOUNT ACCEPTED, AND WHEN — KEPT WHERE IT CAN BE PROVEN.
*
* Acceptance was recorded only in `localStorage`, which is the right place for
* it before there is an account and the wrong place afterwards, in both
* directions at once:
*
*   The PERSON is asked again on every device, and again after clearing site
*   data, having already agreed. A gate that reappears is a gate people learn
*   to click through, which is the opposite of informed consent.
*
*   And OCADE cannot answer "which version did this account accept, and when?"
*   The evidence sits on the person's own machine, where they can erase it and
*   where nobody else can read it.
*
* So the local receipt stays — it is what a demo visitor and a pre-auth
* session have — and once an account exists the acceptance is also written to
* the server, under RLS, append-only.
*
* NOTHING HERE BLOCKS. Every function degrades to the local receipt on
* failure: a database that is unreachable must not stop somebody agreeing to
* the terms and getting on with their work, and a re-ask on the next device is
* a far smaller harm than a gate that cannot be passed.
*/
/**
* The versions currently in force.
*
* SEPARATE, because the documents change separately. One combined string
* cannot answer "did they accept THIS privacy notice?" after a terms-only
* revision, and answering that question is the whole reason to keep a receipt.
*/
var TERMS_VERSION = "ocade-prelaunch-2026-08-16";
var PRIVACY_VERSION = "ocade-prelaunch-2026-08-16";
/**
* The single string the LOCAL receipt is keyed on.
*
* Derived from the two document versions rather than typed a second time, so
* a revision to either one invalidates the local receipt and the server
* receipt together. Two hand-maintained version strings would eventually
* disagree, and the disagreement would show up as a person being re-asked on
* one device and not another.
*/
var LEGAL_CONSENT_VERSION$1 = `${TERMS_VERSION}|${PRIVACY_VERSION}`;
/**
* Whether a stored acceptance still covers the documents in force.
*
* Pure, so the re-ask rule can be tested without a database. A version bump on
* EITHER document means the acceptance no longer covers what is currently
* published — and re-asking once for a legally meaningful change is the
* behaviour; re-asking on every load is not.
*/
function coversCurrentDocuments(receipt, current = {
	terms: TERMS_VERSION,
	privacy: PRIVACY_VERSION
}) {
	if (!receipt) return false;
	return receipt.termsVersion === current.terms && receipt.privacyVersion === current.privacy;
}
/**
* The most recent acceptance recorded for this account, or null.
*
* "Most recent" rather than "any": the table is append-only, so an account
* that has accepted three versions has three rows, and only the newest says
* whether they are current.
*/
async function latestServerReceipt(userId) {
	if (!userId) return null;
	try {
		const { data, error } = await supabase.from("legal_consent_receipts").select("terms_version, privacy_version, accepted_at").eq("user_id", userId).order("accepted_at", { ascending: false }).limit(1).maybeSingle();
		if (error || !data) return null;
		return {
			termsVersion: data.terms_version,
			privacyVersion: data.privacy_version,
			acceptedAt: data.accepted_at
		};
	} catch {
		return null;
	}
}
/**
* Record an acceptance for this account.
*
* An INSERT, never an upsert. What somebody agreed to in March is not amended
* by what they agree to in June, and there is no UPDATE policy on the table to
* allow it even if this file asked.
*/
async function recordServerConsent(userId, source = "gate") {
	if (!userId) return {
		ok: false,
		reason: "No account is signed in."
	};
	try {
		const { error } = await supabase.from("legal_consent_receipts").insert({
			user_id: userId,
			terms_version: TERMS_VERSION,
			privacy_version: PRIVACY_VERSION,
			source
		});
		return error ? {
			ok: false,
			reason: error.message
		} : { ok: true };
	} catch (e) {
		return {
			ok: false,
			reason: e instanceof Error ? e.message : String(e)
		};
	}
}
/**
* Re-exported rather than declared, so the local receipt and the server
* receipt cannot disagree about which documents are in force. Two
* hand-maintained version strings eventually diverge, and the divergence shows
* up as somebody being re-asked on one device and not another.
*/
var LEGAL_CONSENT_VERSION = LEGAL_CONSENT_VERSION$1;
var LEGAL_CONSENT_STORAGE_KEY = "caera:legal-consent:v1";
function needsLegalConsent(pathname) {
	return [
		"/auth",
		"/demo",
		"/home",
		"/ocade",
		"/settings",
		"/ficia",
		"/madee",
		"/cania"
	].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
function usesAccountConsentReceipt(pathname) {
	return needsLegalConsent(pathname) && !pathname.startsWith("/demo") && !pathname.startsWith("/auth");
}
function readLegalConsent(storage) {
	if (typeof window === "undefined" && !storage) return null;
	try {
		const raw = (storage ?? window.localStorage).getItem(LEGAL_CONSENT_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed.version !== LEGAL_CONSENT_VERSION || parsed.terms !== true || parsed.privacy !== true || typeof parsed.acceptedAt !== "string") return null;
		return parsed;
	} catch {
		return null;
	}
}
function LegalConsentGate({ pathname, children }) {
	const required = needsLegalConsent(pathname);
	const [accepted, setAccepted] = (0, import_react.useState)(false);
	const [legalOpen, setLegalOpen] = (0, import_react.useState)(null);
	const [terms, setTerms] = (0, import_react.useState)(false);
	const [privacy, setPrivacy] = (0, import_react.useState)(false);
	const [storageWarning, setStorageWarning] = (0, import_react.useState)(false);
	const [userId, setUserId] = (0, import_react.useState)("");
	const usesAccountReceipt = usesAccountConsentReceipt(pathname);
	(0, import_react.useEffect)(() => {
		if (readLegalConsent()) {
			setAccepted(true);
			return;
		}
		if (!userId) {
			setAccepted(false);
			return;
		}
		let live = true;
		latestServerReceipt(userId).then((receipt) => {
			if (!live) return;
			setAccepted(coversCurrentDocuments(receipt));
		});
		return () => {
			live = false;
		};
	}, [pathname, userId]);
	const open = required && !accepted;
	const canContinue = terms && privacy;
	const explanation = (0, import_react.useMemo)(() => pathname.startsWith("/demo") ? "The demo can use local storage, an on-device model, microphone or device-control permissions only when you choose those features." : "OCADE stores essential account, security and preference data needed to provide the workspace.", [pathname]);
	function accept() {
		if (!canContinue) return;
		const receipt = {
			version: LEGAL_CONSENT_VERSION,
			acceptedAt: (/* @__PURE__ */ new Date()).toISOString(),
			terms: true,
			privacy: true
		};
		try {
			window.localStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, JSON.stringify(receipt));
		} catch {
			setStorageWarning(true);
		}
		if (userId) recordServerConsent(userId, "gate");
		setAccepted(true);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		usesAccountReceipt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConsentAccountBridge, { onUserId: setUserId }) : null,
		children,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open,
			onOpenChange: () => void 0,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogContent, {
				showClose: false,
				onEscapeKeyDown: (event) => event.preventDefault(),
				onPointerDownOutside: (event) => event.preventDefault(),
				className: "max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto border-white/15 bg-[oklch(0.09_0.012_255/0.97)] p-0 shadow-[0_28px_100px_rgba(0,0,0,0.72)]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative p-6 sm:p-7",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							"aria-hidden": true,
							className: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,oklch(0.65_0.18_255/0.16),transparent_34%),radial-gradient(circle_at_95%_100%,oklch(0.58_0.2_28/0.11),transparent_30%)]"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, {
							className: "relative text-left",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
										className: "h-5 w-5",
										"aria-hidden": true
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Before you use OCADE" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, {
									className: "leading-relaxed",
									children: ["Please read and accept the prelaunch Terms and acknowledge the Privacy Notice.", ` ${explanation}`]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative mt-5 grid gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ConsentCheck, {
									checked: terms,
									onChange: setTerms,
									children: [
										"I have read and accept the",
										` `,
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setLegalOpen("terms"),
											className: "text-primary underline",
											children: "Terms of Service"
										}),
										"."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ConsentCheck, {
									checked: privacy,
									onChange: setPrivacy,
									children: [
										"I have read and acknowledge the",
										` `,
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setLegalOpen("privacy"),
											className: "text-primary underline",
											children: "Privacy Notice"
										}),
										", including device permissions and local storage."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] leading-relaxed text-muted-foreground",
									children: "Camera, microphone, browser control and computer-control permissions are requested separately only when you activate them. Purchases and payment collection are disabled during FREE LAUNCH."
								}),
								storageWarning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									role: "status",
									className: "text-[11px] text-[color:var(--state-warning)]",
									children: "This browser could not save the receipt. You may be asked again after reloading."
								}) : null
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, {
							className: "relative mt-6 sm:justify-between sm:space-x-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: "/",
								className: "inline-flex h-10 items-center justify-center rounded-full px-4 text-xs text-muted-foreground hover:text-foreground",
								children: "Leave OCADE"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								disabled: !canContinue,
								onClick: accept,
								className: "h-10 rounded-full px-6",
								children: "Accept and continue"
							})]
						})
					]
				})
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegalDialog, {
			open: legalOpen !== null,
			document: legalOpen ?? "terms",
			onOpenChange: (next) => {
				if (!next) setLegalOpen(null);
			}
		})
	] });
}
/**
* Keep account lookup out of anonymous routes. `useSession` intentionally
* fails closed when Supabase is not configured, but the no-account demo must
* remain usable with only local consent storage.
*/
function ConsentAccountBridge({ onUserId }) {
	const { user } = useSession();
	const userId = user?.id ?? "";
	(0, import_react.useEffect)(() => onUserId(userId), [onUserId, userId]);
	return null;
}
function ConsentCheck({ checked, onChange, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-black/20 p-3 text-[12.5px] leading-relaxed text-foreground/90",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "checkbox",
			checked,
			onChange: (event) => onChange(event.target.checked),
			className: "mt-0.5 h-4 w-4 accent-[color:var(--primary)]"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children })]
	});
}
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-16",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			"aria-hidden": true,
			className: "pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative w-full max-w-lg rounded-xl border border-border/70 bg-background/70 p-8 text-center shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-primary",
					children: "CARCC CADANE"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-4 text-6xl font-semibold tracking-tight text-foreground",
					children: "404"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-3 text-lg font-semibold text-foreground",
					children: "This page isn't part of the workspace"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm leading-6 text-muted-foreground",
					children: "The link may be out of date, or the page may have moved. Nothing has been lost — your account and work are exactly where you left them."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-7 flex flex-wrap items-center justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90",
						children: "Go back home"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/ocade",
						className: "inline-flex items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
						children: "Open OCADE"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooterLinks, { className: "mt-6 justify-center text-xs text-muted-foreground" })
			]
		})]
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportRuntimeError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			role: "alert",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold tracking-tight text-foreground",
					children: "This page didn't load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Something went wrong on our end. You can try refreshing or head back home."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
						children: "Go home"
					})]
				})
			]
		})
	});
}
var Route$79 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "CARCC CADANE — Private AI workspace" },
			{
				name: "description",
				content: "CARCC CADANE is a privacy-first cross-platform AI work platform. OCADE is a local-first AI assistant that reads your documents on your own device."
			},
			{
				name: "author",
				content: "Haans Antoni"
			},
			{
				name: "theme-color",
				content: "#0a0a09"
			},
			{
				property: "og:title",
				content: "CARCC CADANE — Private AI workspace"
			},
			{
				property: "og:description",
				content: "Private AI assistant, commerce and studio for solo builders, small businesses and enterprise."
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				property: "og:site_name",
				content: "CARCC CADANE"
			},
			{
				property: "og:image",
				content: "/brand/ocade-carcc-wordmark.png"
			},
			{
				name: "robots",
				content: "index,follow,max-image-preview:large"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			}
		],
		links: [
			...[{
				rel: "stylesheet",
				href: styles_default
			}],
			{
				rel: "icon",
				href: "/favicon.ico",
				sizes: "any"
			},
			{
				rel: "apple-touch-icon",
				href: "/apple-touch-icon.png",
				sizes: "180x180"
			},
			{
				rel: "manifest",
				href: "/manifest.webmanifest"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
var THEME_BOOT = `(function(){try{
var d=document.documentElement;var t="dark";
try{var r=localStorage.getItem("caera:appearance:v1");
if(r){var p=JSON.parse(r);if(p&&(p.theme==="light"||p.theme==="real"))t=p.theme;}}catch(e){}
d.classList.add("theme-"+t);if(t!=="dark")d.classList.add(t);
var bg=t==="light"?"#f2f1ee":"#0a0a09";
d.style.background=bg;d.style.colorScheme=t==="light"?"light":"dark";
}catch(e){}})();`;
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		style: { background: "#0a0a09" },
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("head", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", { dangerouslySetInnerHTML: { __html: THEME_BOOT } }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$79.useRouteContext();
	const router = useRouter();
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	(0, import_react.useEffect)(() => {
		if (!getSupabaseBrowserConfiguration().configured) return;
		const { data: sub } = supabase.auth.onAuthStateChange((event) => {
			if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
			if (event === "SIGNED_OUT") {
				invalidateModeCache();
				clearDevices();
				clearApprovals();
				closeActiveCompanionSession().catch(() => {});
			}
			router.invalidate();
			if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
		});
		return () => sub.subscription.unsubscribe();
	}, [router, queryClient]);
	/**
	* Install the offline shell (HWE-35).
	*
	* Fire-and-forget on purpose: a browser that refuses a service worker —
	* private browsing, an insecure origin, a locked-down enterprise profile — is
	* an ordinary state, not an error, and `registerOfflineShell` never throws.
	* The outcome is not surfaced here because nothing about THIS render changes;
	* `supervisionCapability` is what screens read when they need to say what
	* works offline.
	*/
	(0, import_react.useEffect)(() => {
		registerOfflineShellFromBrowser().then((registration) => {
			if (registration.ok) primeOfflineRuntimeFromBrowser();
		});
	}, []);
	useInstallationBootstrap();
	(0, import_react.useEffect)(() => hardenDesktopShell(), []);
	/**
	* Async failures never reach a React boundary — an unhandled rejection in a
	* fetch or an event handler would otherwise vanish with no diagnostic at all.
	* These capture them without changing what the user sees.
	*/
	(0, import_react.useEffect)(() => {
		const onRejection = (e) => {
			const reason = e.reason;
			reportRuntimeError(reason instanceof Error ? reason : new Error(String(reason)), { boundary: "unhandled_rejection" });
		};
		const onError = (e) => {
			reportRuntimeError(e.error instanceof Error ? e.error : new Error(e.message), { boundary: "window_error" });
		};
		window.addEventListener("unhandledrejection", onRejection);
		window.addEventListener("error", onError);
		return () => {
			window.removeEventListener("unhandledrejection", onRejection);
			window.removeEventListener("error", onError);
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ThemeProvider, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
			position: "bottom-right",
			closeButton: true,
			toastOptions: { classNames: {
				toast: "bg-background text-foreground border border-border/70 shadow-lg",
				description: "text-muted-foreground",
				actionButton: "bg-primary text-primary-foreground"
			} }
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DepthScene, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorBoundary, {
			label: "CARCC CADANE",
			fallback: (retry, message) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "flex min-h-screen items-center justify-center bg-background px-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-md text-center",
					role: "alert",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-xl font-semibold tracking-tight text-foreground",
							children: "Something stopped working"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-muted-foreground",
							children: message
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 flex flex-wrap justify-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: retry,
								className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
								children: "Try again"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: "/",
								className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
								children: "Go home"
							})]
						})
					]
				})
			}),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegalConsentGate, {
				pathname,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
			})
		}) })] })
	});
}
var $$splitComponentImporter$70 = () => import("./routes-BHEzc8fS.mjs");
var Route$78 = createFileRoute("/")({
	head: () => ({ meta: [
		{ title: "OCADE by CARCC CADANE — Local-first AI workspace" },
		{
			name: "description",
			content: "OCADE is a local-first AI workspace by CARCC CADANE for private chat, research, work and permissioned computer control. Formal founding and public launch: 28 August 2026."
		},
		{
			property: "og:title",
			content: "OCADE by CARCC CADANE — Command the Next Era."
		},
		{
			property: "og:description",
			content: "Private intelligence on your own hardware where supported, with optional authentication, Private Sync and permissioned network services."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			property: "og:image",
			content: "https://ocade.in/brand/ocade-carcc-wordmark.png"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$70, "component")
});
/**
* The public landing experience deliberately stays outside the marketing shell.
* The Three.js universe is already the highest-value visual element on this
* route, so legal/about/support pages use a lighter CSS depth system instead of
* pulling the full 3D engine into every public document.
*/
var $$splitComponentImporter$69 = () => import("./about-Df1j2GWc.mjs");
var Route$77 = createFileRoute("/about")({
	head: () => ({ meta: [
		{ title: "About CARCC CADANE and OCADE" },
		{
			name: "description",
			content: "Official information about CARCC CADANE, OCADE, leadership, the 28 August 2026 founding and launch, and investor or strategic-partnership enquiries."
		},
		{
			property: "og:title",
			content: "About CARCC CADANE and OCADE"
		},
		{
			property: "og:description",
			content: "CARCC CADANE is the technology enterprise and venture behind OCADE — Command the Next Era."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$69, "component")
});
var $$splitComponentImporter$68 = () => import("./blog-CNlwvZmz.mjs");
var Route$76 = createFileRoute("/blog")({
	head: () => ({ meta: [{ title: "OCADE journal — CARCC CADANE" }, {
		name: "description",
		content: "Official OCADE product and engineering notes from CARCC CADANE."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$68, "component")
});
var $$splitComponentImporter$67 = () => import("./careers-BML73X2Z.mjs");
var Route$75 = createFileRoute("/careers")({
	head: () => ({ meta: [{ title: "Careers — CARCC CADANE" }, {
		name: "description",
		content: "Truthful pre-launch careers information for CARCC CADANE."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$67, "component")
});
var $$splitComponentImporter$66 = () => import("./company-DqZwkhjn.mjs");
var Route$74 = createFileRoute("/company")({
	head: () => ({ meta: [{ title: "CARCC CADANE — Company and brand information" }, {
		name: "description",
		content: "Official information about CARCC CADANE, the technology enterprise and brand behind OCADE, including leadership, launch and investor-enquiry information."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$66, "component")
});
function OcadeBreadcrumbs({ items }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		"aria-label": "Breadcrumb",
		className: "overflow-hidden text-xs text-muted-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
			className: "flex min-w-0 items-center gap-2",
			children: items.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex min-w-0 items-center gap-2",
				children: [index ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					children: "/"
				}) : null, item.to ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: item.to,
					className: "inline-flex min-h-6 max-w-40 items-center truncate py-1 underline-offset-4 hover:underline",
					children: item.label
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					"aria-current": "page",
					className: "max-w-48 truncate text-foreground",
					children: item.label
				})]
			}, `${item.label}-${index}`))
		})
	});
}
var Route$73 = createFileRoute("/compare")({
	head: () => ({ meta: [{ title: "Compare OCADE — local-first AI workspace" }, {
		name: "description",
		content: "A factual comparison of OCADE's local-first product boundaries with common AI workspace categories."
	}] }),
	component: ComparePage
});
var ROWS = [
	[
		"Default inference route",
		"On-device desktop or browser engine",
		"Remote provider",
		"On-device model"
	],
	[
		"Current information",
		"Permissioned retrieval with source labels",
		"Usually built in",
		"Usually manual"
	],
	[
		"Computer work",
		"Permissioned, supervised, with STOP and receipts",
		"Varies by service",
		"Not normally included"
	],
	[
		"Private synchronization",
		"Optional; Device Only remains available",
		"Account cloud by default",
		"Usually manual"
	],
	[
		"Offline behavior",
		"Available where the selected local engine is ready",
		"Generally unavailable",
		"Core capability"
	],
	[
		"Pre-launch price",
		"$4.28 / $28 / $128 planned; checkout locked",
		"Provider-specific",
		"Software and hardware vary"
	]
];
function ComparePage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Product comparison",
		title: "Local intelligence, supervised work",
		summary: "OCADE combines a local-first inference route with projects, files, current-information retrieval and permissioned computer work. This table compares product categories, not unverifiable competitor claims.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OcadeBreadcrumbs, { items: [{
				label: "OCADE",
				to: "/products/ocade"
			}, { label: "Comparison: local and cloud workspace categories" }] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Positioning",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Choose OCADE when you want one workspace that can answer locally and prepare or execute supervised work. Choose a cloud AI workspace when remote hosted models are acceptable. Choose a standalone local runner when model execution matters more than an integrated workspace." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-labelledby": "comparison-title",
				className: "overflow-hidden rounded-2xl border border-white/7",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					id: "comparison-title",
					className: "sr-only",
					children: "Feature comparison table"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "min-w-[720px] w-full border-collapse text-left text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "bg-white/[0.04]",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "p-3",
									children: "Capability"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "p-3",
									children: "OCADE"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "p-3",
									children: "Typical cloud AI workspace"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "p-3",
									children: "Standalone local runner"
								})
							] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: ROWS.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
							className: "border-t border-white/7",
							children: row.map((cell, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: `p-3 align-top ${index === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`,
								children: cell
							}, cell))
						}, row[0])) })]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Key differentiators",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "list-disc space-y-2 pl-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Local execution is the default route, not a privacy-mode add-on." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Computer actions require explicit scope and keep STOP, PAUSE and TAKE OVER visible." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Failure states name the unavailable engine or provider instead of silently switching to public-cloud inference." })
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Next step",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/pricing",
						className: "inline-flex min-h-10 items-center rounded-lg border border-border/70 px-4 text-foreground",
						children: "Compare planned pricing"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/demo/ocade",
						className: "inline-flex min-h-10 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground",
						children: "Try the local demo"
					})]
				})
			})
		]
	});
}
var $$splitComponentImporter$65 = () => import("./data-rights-7RdCHCnz.mjs");
var Route$72 = createFileRoute("/data-rights")({
	head: () => ({ meta: [
		{ title: "Data-rights request builder — OCADE" },
		{
			name: "description",
			content: "Prepare a privacy or data-rights request for OCADE."
		},
		{
			name: "robots",
			content: "noindex"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$65, "component")
});
var $$splitComponentImporter$64 = () => import("./demo-C7oVFnsK.mjs");
var Route$71 = createFileRoute("/demo")({
	ssr: false,
	head: () => ({ meta: [
		{ title: "Demo — CARCC CADANE" },
		{
			name: "description",
			content: "Try OCADE for 28 minutes without an account. Demo conversations stay temporary and the on-device engine can be prepared for later offline use."
		},
		{
			name: "robots",
			content: "noindex"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$64, "component")
});
var $$splitComponentImporter$63 = () => import("./download-DCa5FpeG.mjs");
var Route$70 = createFileRoute("/download")({
	head: () => ({ meta: [{ title: "Download OCADE — desktop and mobile availability" }, {
		name: "description",
		content: "Official OCADE desktop and mobile availability. Installers are never started automatically and public packages must pass signing and device tests."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$63, "component")
});
var $$splitComponentImporter$62 = () => import("./faq-BMsX90KO.mjs");
/**
* Public FAQ.
*
* Answers only describe behaviour that exists today. Where a capability is
* still provider- or platform-dependent, the answer says so rather than
* implying it already works.
*/
var Route$69 = createFileRoute("/faq")({
	head: () => ({ meta: [
		{ title: "FAQ — CARCC CADANE" },
		{
			name: "description",
			content: "Answers about accounts, cross-device sync, billing, privacy modes and account deletion in CARCC CADANE."
		},
		{
			property: "og:title",
			content: "FAQ — CARCC CADANE"
		},
		{
			property: "og:description",
			content: "Common questions about accounts, sync, billing and privacy in CARCC CADANE."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary_large_image"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$62, "component")
});
var $$splitComponentImporter$61 = () => import("./press-BXRBAOHG.mjs");
var Route$68 = createFileRoute("/press")({
	head: () => ({ meta: [{ title: "CARCC CADANE press kit" }, {
		name: "description",
		content: "Official pre-launch OCADE facts and downloadable CARCC CADANE brand assets."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$61, "component")
});
var $$splitComponentImporter$60 = () => import("./privacy-BMFqLVu7.mjs");
var Route$67 = createFileRoute("/privacy")({
	head: () => ({ meta: [{ title: "Privacy notice — OCADE" }, {
		name: "description",
		content: "Current Privacy notice for OCADE by CARCC CADANE, effective 25 August 2026."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$60, "component")
});
var $$splitComponentImporter$59 = () => import("./reset-password-DinaaKmt.mjs");
var Route$66 = createFileRoute("/reset-password")({
	ssr: false,
	head: () => ({ meta: [
		{ title: "Choose a new password — CARCC CADANE" },
		{
			name: "description",
			content: "Set a new password for your CARCC CADANE account from your reset link."
		},
		{
			name: "robots",
			content: "noindex"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$59, "component")
});
var Route$65 = createFileRoute("/robots.txt")({ server: { handlers: { GET: ({ request }) => {
	const body = [
		"User-agent: *",
		"Allow: /",
		"Disallow: /api/",
		"Disallow: /auth",
		"Disallow: /home",
		"Disallow: /settings",
		`Sitemap: ${new URL(request.url).origin}/sitemap.xml`,
		""
	].join("\n");
	return new Response(body, { headers: {
		"content-type": "text/plain; charset=utf-8",
		"cache-control": "public, max-age=3600"
	} });
} } } });
var $$splitComponentImporter$58 = () => import("./search-Bu76N_lu.mjs");
var Route$64 = createFileRoute("/search")({
	head: () => ({ meta: [{ title: "Search — CARCC CADANE" }, {
		name: "description",
		content: "Search official CARCC CADANE and OCADE product, help and legal information."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$58, "component")
});
var PUBLIC_PATHS = [
	"/",
	"/company",
	"/founder/haans-antoni",
	"/products/ocade",
	"/pricing",
	"/compare",
	"/blog",
	"/careers",
	"/team",
	"/press",
	"/status",
	"/faq",
	"/search",
	"/privacy",
	"/terms"
];
function escapeXml(value) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&apos;");
}
var Route$63 = createFileRoute("/sitemap.xml")({ server: { handlers: { GET: ({ request }) => {
	const origin = new URL(request.url).origin;
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PUBLIC_PATHS.map((path) => `  <url><loc>${escapeXml(new URL(path, origin).href)}</loc></url>`).join("\n")}\n</urlset>\n`;
	return new Response(body, { headers: {
		"content-type": "application/xml; charset=utf-8",
		"cache-control": "public, max-age=3600"
	} });
} } } });
var $$splitComponentImporter$57 = () => import("./status-BfDcX8eu.mjs");
var Route$62 = createFileRoute("/status")({
	head: () => ({ meta: [{ title: "OCADE status — pre-launch checks" }, {
		name: "description",
		content: "Honest current-browser and pre-launch service checks for OCADE."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$57, "component")
});
var $$splitComponentImporter$56 = () => import("./support-B-b8zcPc.mjs");
var Route$61 = createFileRoute("/support")({
	head: () => ({ meta: [
		{ title: "Support and contact — OCADE by CARCC CADANE" },
		{
			name: "description",
			content: "Current support, legal, privacy, security, investor and partnership contact options for OCADE by CARCC CADANE."
		},
		{
			property: "og:title",
			content: "Support and contact — OCADE"
		},
		{
			property: "og:description",
			content: "Use OCADE's ticket-based support and administrative review channels."
		},
		{
			property: "og:type",
			content: "website"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$56, "component")
});
var $$splitComponentImporter$55 = () => import("./team-By8Ty1CC.mjs");
var Route$60 = createFileRoute("/team")({
	head: () => ({ meta: [{ title: "CARCC CADANE team" }, {
		name: "description",
		content: "The current, factual CARCC CADANE team record behind OCADE."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$55, "component")
});
var $$splitComponentImporter$54 = () => import("./terms-DiwbSW2Z.mjs");
var Route$59 = createFileRoute("/terms")({
	head: () => ({ meta: [{ title: "Terms of service — OCADE" }, {
		name: "description",
		content: "Current Terms of service for OCADE by CARCC CADANE, effective 25 August 2026."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$54, "component")
});
var $$splitComponentImporter$53 = () => import("./cania-CTjxh_-e.mjs");
var Route$58 = createFileRoute("/_authenticated/cania")({
	head: () => ({ meta: [{ title: "CANIA — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$53, "component")
});
var $$splitComponentImporter$52 = () => import("./ficia-Xly4rSF8.mjs");
var Route$57 = createFileRoute("/_authenticated/ficia")({
	head: () => ({ meta: [{ title: "FICIA — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$52, "component")
});
/**
* `/home` is OCADE.
*
* This was a tile grid introducing four workspaces. Three of them are now
* reserved names behind one-sentence placeholders, so the page had become a
* chooser between the product and three ways of not using it — a step between
* the user and the thing they came for.
*
* Kept as a redirect rather than deleted: `/home` is where onboarding finishes,
* where the shell's fallback used to land, and wherever existing links point.
*/
var Route$56 = createFileRoute("/_authenticated/home")({ beforeLoad: () => {
	throw redirect({
		to: "/ocade",
		replace: true
	});
} });
var $$splitComponentImporter$51 = () => import("./madee-CefJL-wX.mjs");
var Route$55 = createFileRoute("/_authenticated/madee")({
	head: () => ({ meta: [{ title: "MADEE — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$51, "component")
});
var $$splitComponentImporter$50 = () => import("./ocade-CZU3A_Ib.mjs");
/**
* One shell for every OCADE screen.
*
* Pages used to wrap themselves in `AppShell` individually, so any page that
* forgot lost the sidebar, top bar and module rail entirely. The layout owns
* the chrome now; children render page content only.
*/
var Route$54 = createFileRoute("/_authenticated/ocade")({ component: lazyRouteComponent($$splitComponentImporter$50, "component") });
var $$splitComponentImporter$49 = () => import("./onboarding-CGozjUNy.mjs");
var Route$53 = createFileRoute("/_authenticated/onboarding")({
	head: () => ({ meta: [{ title: "Onboarding — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$49, "component")
});
var $$splitComponentImporter$48 = () => import("./settings-CkUgnyDs.mjs");
var Route$52 = createFileRoute("/_authenticated/settings")({ component: lazyRouteComponent($$splitComponentImporter$48, "component") });
var $$splitComponentImporter$47 = () => import("./blog.index-DJtqCbKj.mjs");
var Route$51 = createFileRoute("/blog/")({ component: lazyRouteComponent($$splitComponentImporter$47, "component") });
var $$splitComponentImporter$46 = () => import("./checkout.success-DzG4Qcj0.mjs");
var Route$50 = createFileRoute("/checkout/success")({
	beforeLoad: () => {
		throw redirect({ to: "/home" });
	},
	head: () => ({ meta: [
		{ title: "Purchase confirmed — CARCC CADANE" },
		{
			name: "robots",
			content: "noindex"
		},
		{
			name: "description",
			content: "Confirmation of your CARCC CADANE plan purchase."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$46, "component")
});
/**
* Confirms a purchase from the SERVER's record, not from the fact that the
* browser arrived here.
*
* Anyone can open this URL. The only trustworthy signal that money moved is a
* subscription row written by the signature-verified webhook, so this page
* polls for that row and says plainly when it has not appeared yet rather than
* congratulating someone who has not paid.
*/
/**
* `/demo` is the OCADE demo, so it goes straight there.
*
* This used to be a tile grid: OCADE, Files and Tasks. Files and Tasks were
* separate top-level products in the demo, which is not what OCADE is — files
* are a tool inside a conversation, not a place you visit — and with those two
* gone the page was a single card asking the visitor to click once more before
* anything happened.
*
* A redirect rather than a deleted route: `/demo` is the URL on the landing
* page, in the marketing copy and in whatever links already exist. Removing it
* would break all of them to save one file.
*/
var Route$49 = createFileRoute("/demo/")({ beforeLoad: () => {
	throw redirect({
		to: "/demo/ocade",
		replace: true
	});
} });
var $$splitComponentImporter$45 = () => import("./demo.control-DIujeCjr.mjs");
var Route$48 = createFileRoute("/demo/control")({
	head: () => ({ meta: [{ title: "OCADE Control + Work — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$45, "component")
});
/**
* PC control, in the demo, with no account.
*
* WHY THIS EXISTS AND WHY IT IS NOT RECKLESS
* -------------------------------------------
* The whole claim of this product is that OCADE can work your computer. A demo
* that shows a chat window and asks you to sign up to find out whether the
* claim is true is a demo of a text box. So this is the real thing: the same
* agent loop, the same tools, the same verification.
*
* It is safe for exactly one reason, and it is not a UI reason. The server only
* grants unauthenticated control when the browser and the server are the same
* machine — see `control-access.node.ts`. On a hosted deployment this screen
* loads and then says it cannot reach a computer, which is the truth. Nothing
* here can talk it into anything else, because the decision is not made here.
*
* WHEN THE CLOCK RUNS OUT, THE COMPUTER IS HANDED BACK FIRST.
* The demo ending while OCADE is mid-task is the case that matters most: the
* expiry path stops the mission, releases any held key or mouse button, and
* only then clears the session and leaves. An expiry that navigated away first
* would leave a Python host and possibly a browser running on somebody's
* machine, with Shift held down, and no interface left to fix it from.
*/
var $$splitComponentImporter$44 = () => import("./demo.ocade-Bs95TITn.mjs");
var Route$47 = createFileRoute("/demo/ocade")({
	head: () => ({ meta: [{ title: "OCADE demo — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$44, "component")
});
var $$splitComponentImporter$43 = () => import("./demo.settings-Bngye39Q.mjs");
var Route$46 = createFileRoute("/demo/settings")({ component: lazyRouteComponent($$splitComponentImporter$43, "component") });
var $$splitComponentImporter$42 = () => import("./founder.haans-antoni-CXPPj3BB.mjs");
var Route$45 = createFileRoute("/founder/haans-antoni")({
	head: () => ({ meta: [{ title: "HAANS ANTONI — Founder, CEO and Chairman of CARCC CADANE" }, {
		name: "description",
		content: "Official profile of HAANS ANTONI, Founder, CEO and Chairman of CARCC CADANE and creator of OCADE."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$42, "component")
});
var $$splitComponentImporter$41 = () => import("./products.ocade-DKwTpkRF.mjs");
var Route$44 = createFileRoute("/products/ocade")({
	head: () => ({ meta: [
		{ title: "OCADE — Local-first AI workspace by CARCC CADANE" },
		{
			name: "description",
			content: "Official product information for OCADE, a local-first AI workspace by CARCC CADANE. Formal public launch date: 28 August 2026."
		},
		{
			property: "og:title",
			content: "OCADE by CARCC CADANE — Command the Next Era."
		},
		{
			property: "og:description",
			content: "Local-first AI for chat, research, work and permissioned computer control, with optional Private Sync and current-information services."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$41, "component")
});
var $$splitComponentImporter$40 = () => import("./admin.launch-gate-D9s_WeTh.mjs");
var Route$43 = createFileRoute("/_authenticated/admin/launch-gate")({
	ssr: false,
	head: () => ({ meta: [{ title: "Launch Gate — CARCC CADANE Admin" }, {
		name: "robots",
		content: "noindex"
	}] }),
	beforeLoad: async () => {
		const { data: userData } = await supabase.auth.getUser();
		const uid = userData.user?.id;
		if (!uid) throw redirect({ to: "/auth" });
		const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
		if (!data) throw redirect({
			to: "/access-denied",
			search: {
				area: "the Launch Gate administration console",
				reason: "This area requires the admin role on your CARCC CADANE account."
			}
		});
	},
	component: lazyRouteComponent($$splitComponentImporter$40, "component")
});
/**
* Internal end-to-end payments verification, in the test environment.
*
* Admin only. The steps are run against the real provider and this app's real
* records — no step reports success because the code path exists. The one step
* a machine cannot prove (UPI actually being offered in the checkout) is shown
* as a manual action with a button that opens the real test checkout.
*/
var $$splitComponentImporter$39 = () => import("./admin.payments-checklist-CgZN9i5V.mjs");
var Route$42 = createFileRoute("/_authenticated/admin/payments-checklist")({
	ssr: false,
	head: () => ({ meta: [{ title: "Payments test checklist — CARCC CADANE Admin" }, {
		name: "robots",
		content: "noindex"
	}] }),
	beforeLoad: async () => {
		const { data: userData } = await supabase.auth.getUser();
		const uid = userData.user?.id;
		if (!uid) throw redirect({ to: "/auth" });
		const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
		if (!data) throw redirect({
			to: "/access-denied",
			search: {
				area: "the payments test checklist",
				reason: "This area requires the admin role on your CARCC CADANE account."
			}
		});
	},
	component: lazyRouteComponent($$splitComponentImporter$39, "component")
});
var $$splitComponentImporter$38 = () => import("./admin.support-G8WapE6o.mjs");
var Route$41 = createFileRoute("/_authenticated/admin/support")({
	ssr: false,
	head: () => ({ meta: [{ title: "Support Queue — CARCC CADANE Admin" }, {
		name: "robots",
		content: "noindex"
	}] }),
	beforeLoad: async () => {
		const { data } = await supabase.auth.getUser();
		if (!data.user) throw redirect({ to: "/auth" });
		const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
		if (!role) throw redirect({
			to: "/access-denied",
			search: {
				area: "the customer support queue",
				reason: "This area requires the admin role on your CARCC CADANE account."
			}
		});
	},
	component: lazyRouteComponent($$splitComponentImporter$38, "component")
});
var $$splitComponentImporter$37 = () => import("./admin.users-DLFPCy14.mjs");
var Route$40 = createFileRoute("/_authenticated/admin/users")({
	ssr: false,
	head: () => ({ meta: [{ title: "Accounts — CARCC CADANE Admin" }, {
		name: "robots",
		content: "noindex"
	}] }),
	beforeLoad: async () => {
		const { data } = await supabase.auth.getUser();
		if (!data.user) throw redirect({ to: "/auth" });
		const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
		if (!role) throw redirect({
			to: "/access-denied",
			search: {
				area: "the account overview",
				reason: "This area requires the admin role on your CARCC CADANE account."
			}
		});
	},
	component: lazyRouteComponent($$splitComponentImporter$37, "component")
});
var $$splitComponentImporter$36 = () => import("./ocade.activity-D_DSkOAk.mjs");
var Route$39 = createFileRoute("/_authenticated/ocade/activity")({
	head: () => ({ meta: [{ title: "Activity — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$36, "component")
});
var $$splitComponentImporter$35 = () => import("./ocade.artifacts-auz_YVEW.mjs");
var Route$38 = createFileRoute("/_authenticated/ocade/artifacts")({
	head: () => ({ meta: [{ title: "Artifacts — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$35, "component")
});
/**
* A dedicated Artifacts surface — deliberately NOT a renamed link to Projects.
*
* The two things this page shows that a file list does not: whether the result
* was verified when it was produced (carried permanently on the record), and
* whether the bytes are still what were written (checked live, by re-hashing).
*
* Everything runs on-device against `artifacts/store.ts`. Nothing here uploads.
*/
/**
* Find an artifact's position in its version history.
*
* Returns null when the record has no history entry (e.g. it was collapsed as
* an identical re-save) — the badge simply doesn't show, rather than inventing
* a version number.
*/
var $$splitComponentImporter$34 = () => import("./ocade.automations-BnEbYXbQ.mjs");
var Route$37 = createFileRoute("/_authenticated/ocade/automations")({
	head: () => ({ meta: [{ title: "OCADE Automations — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$34, "component")
});
var $$splitComponentImporter$33 = () => import("./ocade.code-DmRT2N7E.mjs");
var Route$36 = createFileRoute("/_authenticated/ocade/code")({
	head: () => ({ meta: [{ title: "OCADE Code — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$33, "component")
});
var $$splitComponentImporter$32 = () => import("./ocade.connectors-QfMIGnIL.mjs");
var Route$35 = createFileRoute("/_authenticated/ocade/connectors")({
	head: () => ({ meta: [{ title: "Connectors — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$32, "component")
});
var $$splitComponentImporter$31 = () => import("./ocade.devices-BqzPY1ut.mjs");
var Route$34 = createFileRoute("/_authenticated/ocade/devices")({
	head: () => ({ meta: [{ title: "Devices — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$31, "component")
});
var $$splitComponentImporter$30 = () => import("./ocade.health-DHsIZ9MP.mjs");
/**
* OCADE Health: one page that answers "what can this actually do right now?".
*
* Every row is generated by the shared capability registry from observed
* signals, so this page cannot disagree with the badge shown on the feature
* itself. Nothing here is a mock: a capability with no probe result says it has
* none, and each row carries the evidence its status was decided from.
*/
var Route$33 = createFileRoute("/_authenticated/ocade/health")({
	head: () => ({ meta: [
		{ title: "Health — OCADE" },
		{
			name: "description",
			content: "What OCADE can and cannot do on this device right now, with the evidence behind each status."
		},
		{
			property: "og:title",
			content: "Health — OCADE"
		},
		{
			property: "og:description",
			content: "Live capability status for OCADE on this device."
		},
		{
			name: "robots",
			content: "noindex"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$30, "component")
});
var $$splitComponentImporter$29 = () => import("./ocade.inbox-DBnHO04t.mjs");
var Route$32 = createFileRoute("/_authenticated/ocade/inbox")({
	head: () => ({ meta: [{ title: "Inbox — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$29, "component")
});
var $$splitComponentImporter$28 = () => import("./ocade.knowledge-BghROPNK.mjs");
var Route$31 = createFileRoute("/_authenticated/ocade/knowledge")({
	head: () => ({ meta: [{ title: "Knowledge — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$28, "component")
});
var $$splitComponentImporter$27 = () => import("./ocade.lab-Dmdip4j0.mjs");
var Route$30 = createFileRoute("/_authenticated/ocade/lab")({
	head: () => ({ meta: [{ title: "Lab — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$27, "component")
});
/**
* Local Intelligence — what is running on this device, and how healthy it is.
*
* WHAT THIS PAGE USED TO BE. 874 lines of cloud-provider configuration:
* routing modes across four providers, privacy/cost/speed preference matrices,
* "Test connection" buttons for the Lovable AI Gateway and OpenAI, a model
* fabric listing hosted models, and usage diagnostics for a cloud allowance.
* Roughly forty lines of it concerned the engine that actually answers.
*
* Every one of those controls saved a value that no longer changes anything,
* because OCADE does not use a hosted provider. A settings screen whose
* switches persist and do nothing is worse than no settings screen: it tells
* the user they are in control of something they are not.
*
* So the page is now about the only engine there is. The local lifecycle
* panel and the engine control were already here and already good; they are
* what is left, plus an honest statement of where generation happens.
*/
var $$splitComponentImporter$26 = () => import("./ocade.models-C4mmculm.mjs");
var Route$29 = createFileRoute("/_authenticated/ocade/models")({ component: lazyRouteComponent($$splitComponentImporter$26, "component") });
var $$splitComponentImporter$25 = () => import("./ocade.monitors-CUN3V6Ge.mjs");
var Route$28 = createFileRoute("/_authenticated/ocade/monitors")({
	head: () => ({ meta: [{ title: "Monitors — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$25, "component")
});
var $$splitComponentImporter$24 = () => import("./ocade.notifications-iI9yFDn4.mjs");
var Route$27 = createFileRoute("/_authenticated/ocade/notifications")({
	head: () => ({ meta: [{ title: "Notifications — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$24, "component")
});
var $$splitComponentImporter$23 = () => import("./ocade.permissions-BizWNhuJ.mjs");
var Route$26 = createFileRoute("/_authenticated/ocade/permissions")({
	head: () => ({ meta: [{ title: "Permissions — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$23, "component")
});
var $$splitComponentImporter$22 = () => import("./ocade.projects-DFRGDUpg.mjs");
var Route$25 = createFileRoute("/_authenticated/ocade/projects")({
	head: () => ({ meta: [{ title: "OCADE Projects — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$22, "component")
});
var $$splitComponentImporter$21 = () => import("./ocade.search-DFhXEc2m.mjs");
var Route$24 = createFileRoute("/_authenticated/ocade/search")({
	head: () => ({ meta: [{ title: "Search — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$21, "component")
});
/** Escape LIKE wildcards while keeping the value inside typed filter calls. */
/**
* Search only through Supabase's parameterized filter methods.
*
* `.or()` accepts raw PostgREST filter grammar. Interpolating search text into
* that string lets punctuation such as commas or parentheses alter the filter
* expression even when LIKE wildcards are escaped. Separate typed queries keep
* the user's text as data, then de-duplicate matching records by id.
*/
/**
* The REMOTE half only. Runs when Private Sync is on and the network answers.
*
* Kept as separate typed queries rather than one `.or()` because `.or()` takes
* raw PostgREST grammar, and interpolating a person's search text into that
* lets punctuation alter the filter expression even with LIKE wildcards
* escaped. The user's text stays data.
*/
var $$splitComponentImporter$20 = () => import("./ocade.shared-BrkNN45c.mjs");
var Route$23 = createFileRoute("/_authenticated/ocade/shared")({
	head: () => ({ meta: [{ title: "Shared — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$20, "component")
});
var $$splitComponentImporter$19 = () => import("./ocade.studio-BxQXHt4i.mjs");
var Route$22 = createFileRoute("/_authenticated/ocade/studio")({
	head: () => ({ meta: [{ title: "Studio — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$19, "component")
});
var $$splitComponentImporter$18 = () => import("./ocade.system-Dp8u5LdS.mjs");
var Route$21 = createFileRoute("/_authenticated/ocade/system")({
	head: () => ({ meta: [{ title: "System — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$18, "component")
});
var $$splitComponentImporter$17 = () => import("./ocade.tasks-C9oug2t4.mjs");
/**
* Tasks, inside OCADE where the work is.
*
* The same screen as `/settings/tasks` — shared component, one source of data
* (`ocade_automations` and `ocade_automation_runs`) — because two task lists
* that could disagree about whether a run is live would make every Stop button
* on both of them a guess.
*/
var Route$20 = createFileRoute("/_authenticated/ocade/tasks")({
	head: () => ({ meta: [
		{ title: "Tasks — OCADE" },
		{
			name: "description",
			content: "Scheduled automations and their runs, with pause, resume and stop controls."
		},
		{
			property: "og:title",
			content: "Tasks — OCADE"
		},
		{
			property: "og:description",
			content: "Scheduled automations and their runs on this OCADE account."
		},
		{
			name: "robots",
			content: "noindex"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$17, "component")
});
var $$splitComponentImporter$16 = () => import("./ocade.templates-CG6-vKkG.mjs");
var Route$19 = createFileRoute("/_authenticated/ocade/templates")({
	head: () => ({ meta: [{ title: "Templates — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$16, "component")
});
var $$splitComponentImporter$15 = () => import("./ocade.work-Bnx7obhv.mjs");
/**
* OCADE Control + Work.
*
* WHAT THIS ROUTE USED TO BE. A redirect to `/ocade`. Selecting "Control + Work"
* put the user in Chat, which is the one thing this section must not do: the
* whole point of a separate room is that an instruction typed in it has a real
* computer on the other end, and an instruction typed in Chat does not. A
* redirect made those the same place while the navigation claimed they were
* not — the worst of both, because the user believed they had chosen.
*
* SEPARATE RUNTIME, SHARED EVERYTHING ELSE. Authentication, the local engine
* and the history layer are common. The runtime path is not: Chat streams from
* the engine and stops there, while this runs the agent loop and reaches the
* native sidecars one approved action at a time.
*/
var Route$18 = createFileRoute("/_authenticated/ocade/work")({
	head: () => ({ meta: [{ title: "Control + Work — OCADE" }] }),
	component: lazyRouteComponent($$splitComponentImporter$15, "component")
});
var $$splitComponentImporter$14 = () => import("./settings.index-CdfNbPED.mjs");
var Route$17 = createFileRoute("/_authenticated/settings/")({
	head: () => ({ meta: [{ title: "General — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$14, "component")
});
var $$splitComponentImporter$13 = () => import("./settings.activity-jXOGGYno.mjs");
var Route$16 = createFileRoute("/_authenticated/settings/activity")({
	head: () => ({ meta: [{ title: "Activity — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$13, "component")
});
var $$splitComponentImporter$12 = () => import("./settings.appearance-lMXXdx4R.mjs");
var Route$15 = createFileRoute("/_authenticated/settings/appearance")({
	head: () => ({ meta: [{ title: "Appearance — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$12, "component")
});
/**
* Pointer choices, named for what the person sees rather than for the asset.
*
* "OCADE light" and "OCADE dark" describe the pointer's own colour, which is
* the thing being chosen. `auto_contrast` is offered as "Match the theme"
* because that is what it does, and it is the default worth reaching for.
*/
var $$splitComponentImporter$11 = () => import("./settings.billing-CJ6w2W3S.mjs");
var Route$14 = createFileRoute("/_authenticated/settings/billing")({
	beforeLoad: () => {
		throw redirect({ to: "/settings/usage" });
	},
	head: () => ({ meta: [{ title: "Billing and subscription — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$11, "component")
});
/** Statuses that still grant access, in the words a customer would use. */
var $$splitComponentImporter$10 = () => import("./settings.browser-BtV1_CCo.mjs");
var Route$13 = createFileRoute("/_authenticated/settings/browser")({
	head: () => ({ meta: [{ title: "Browser control — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
var $$splitComponentImporter$9 = () => import("./settings.devices-DsBZtzgU.mjs");
var Route$12 = createFileRoute("/_authenticated/settings/devices")({
	head: () => ({ meta: [{ title: "Devices — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("./settings.mobile-DON-jxIh.mjs");
var Route$11 = createFileRoute("/_authenticated/settings/mobile")({
	head: () => ({ meta: [{ title: "Mobile companion — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
/** Plain-language summary of a queued intent. Never echoes file contents. */
var $$splitComponentImporter$7 = () => import("./settings.privacy-BSY6wOGu.mjs");
var Route$10 = createFileRoute("/_authenticated/settings/privacy")({
	head: () => ({ meta: [{ title: "Privacy — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import("./settings.security-DeahnEdK.mjs");
var Route$9 = createFileRoute("/_authenticated/settings/security")({
	head: () => ({ meta: [{ title: "Security — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./settings.skills-ChnaDmCn.mjs");
var Route$8 = createFileRoute("/_authenticated/settings/skills")({
	head: () => ({ meta: [{ title: "Software skills — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./settings.support-IyP-wvRU.mjs");
var Route$7 = createFileRoute("/_authenticated/settings/support")({
	head: () => ({ meta: [{ title: "Support — OCADE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./settings.tasks-GmKsMazY.mjs");
/**
* Kept as a route so existing links and bookmarks still resolve. The screen
* itself lives in `TasksWorkspace` and is shared with `/ocade/tasks`.
*/
var Route$6 = createFileRoute("/_authenticated/settings/tasks")({
	head: () => ({ meta: [{ title: "Tasks — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./settings.usage-CPq7n1cb.mjs");
var Route$5 = createFileRoute("/_authenticated/settings/usage")({
	head: () => ({ meta: [{ title: "Usage and plan — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./settings.vault-7oFw3BcO.mjs");
var Route$4 = createFileRoute("/_authenticated/settings/vault")({
	head: () => ({ meta: [{ title: "Browser Vault — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./settings.voice-CDHHIKYq.mjs");
var Route$3 = createFileRoute("/_authenticated/settings/voice")({
	head: () => ({ meta: [{ title: "OCADE Voice — CARCC CADANE" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
/**
* The paired-computer bridge, as an HTTP endpoint.
*
* This is the transport `bridge-server.ts` deliberately does not contain: it
* turns a `Request` into the shape the policy expects, hands it over, and turns
* the decision back into a `Response`. Every rule about who may ask — signature,
* origin, expiry, replay, rate limit — lives in the policy, not here, so this
* file cannot accidentally become a second, weaker gate.
*
* IT DOES NOT EXIST UNLESS THE MACHINE SAYS SO. `serveBridgeRequest` returns
* null when `OCADE_BRIDGE_ENABLED` is unset, and that becomes a 404. On OCADE's
* hosted deployment the flag is never set, so the cloud can never answer as
* though it were somebody's own computer — which is the entire point of a
* paired device.
*
* THE ENGINE PORT IS STILL NOT REACHABLE. This endpoint speaks to the loopback
* runtime on the user's behalf after authorising them; it never forwards a raw
* request, never accepts an engine URL from the caller, and never returns one.
*/
var SIGNED_HEADERS = [
	"content-type",
	"x-ocade-device",
	"x-ocade-issued-at",
	"x-ocade-nonce",
	"x-ocade-signature"
].join(", ");
/**
* CORS for approved origins only.
*
* A paired browser is by definition on another origin, so some allowance is
* required — but `*` here would let any page on the internet read this
* machine's answers. The echo is only ever of an origin a human already
* approved at this computer.
*/
async function corsHeaders(origin) {
	if (!origin) return {};
	const { approvedOrigins } = await import("./bridge-host.server-C838YxDF.mjs");
	if (!(await approvedOrigins()).has(origin)) return {};
	return {
		"access-control-allow-origin": origin,
		"access-control-allow-headers": SIGNED_HEADERS,
		"access-control-allow-methods": "GET, POST, OPTIONS",
		"access-control-max-age": "600",
		vary: "origin"
	};
}
function headerRecord(request) {
	const headers = {};
	request.headers.forEach((value, key) => {
		headers[key.toLowerCase()] = value;
	});
	return headers;
}
async function serve(request, splat) {
	const cors = await corsHeaders(request.headers.get("origin"));
	const { serveBridgeRequest } = await import("./bridge-host.server-C838YxDF.mjs");
	let body;
	if (request.method === "POST") try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({
			error: "bad_json",
			message: "Unreadable request."
		}), {
			status: 400,
			headers: {
				"content-type": "application/json",
				...cors
			}
		});
	}
	const outcome = await serveBridgeRequest({
		path: `/${splat ?? ""}`,
		method: request.method,
		headers: headerRecord(request),
		body
	});
	if (outcome === null) return new Response("Not found", { status: 404 });
	if ("stream" in outcome && outcome.stream) {
		const write = outcome.stream;
		const encoder = new TextEncoder();
		const controllerRef = new AbortController();
		const stream = new ReadableStream({
			async start(controller) {
				try {
					await write((line) => controller.enqueue(encoder.encode(line)), controllerRef.signal);
				} catch (error) {
					const reason = error instanceof Error ? error.message : "The engine stopped.";
					controller.enqueue(encoder.encode(`${JSON.stringify({ error: reason })}\n`));
				} finally {
					controller.close();
				}
			},
			cancel() {
				controllerRef.abort();
			}
		});
		return new Response(stream, {
			status: outcome.status,
			headers: {
				"content-type": "application/x-ndjson",
				"cache-control": "no-store",
				...cors
			}
		});
	}
	return new Response(JSON.stringify(outcome.body ?? null), {
		status: outcome.status,
		headers: {
			"content-type": "application/json",
			...cors
		}
	});
}
var Route$2 = createFileRoute("/api/ocade/bridge/$")({ server: { handlers: {
	GET: ({ request, params }) => serve(request, params._splat),
	POST: ({ request, params }) => serve(request, params._splat),
	OPTIONS: async ({ request }) => {
		const cors = await corsHeaders(request.headers.get("origin"));
		if (Object.keys(cors).length === 0) return new Response(null, { status: 404 });
		return new Response(null, {
			status: 204,
			headers: cors
		});
	}
} } });
/**
* WHAT A VERIFIED PROVIDER EVENT IS ALLOWED TO DO TO OCADE'S RECORDS.
*
* THE DEFECT THIS EXISTS TO CLOSE, stated plainly: OCADE sold a product it
* could not deliver.
*
* `std_8d` — "8 days", "charged once" — is in `SELLABLE_PLANS` and on the
* pricing page. A one-time purchase in Paddle does not emit
* `subscription.created`; it emits `transaction.completed`. The webhook
* handled three subscription events and logged everything else as
* "Unhandled payment event". So the 8-day pass produced no row anywhere, and
* `/checkout/success` — which correctly refuses to believe the browser and
* polls for a row written by the signature-verified webhook — would have
* polled for thirty seconds and then told a paying customer their purchase was
* "pending", forever. Money in, nothing out, and no record that it happened.
*
* THREE MORE THINGS WERE MISSING, and each is a real incident waiting:
*
*   NO IDEMPOTENCY. `verifyWebhook` discarded `event_id` entirely. Providers
*   retry — that is the contract — so the same event arrives more than once as
*   a matter of course, and a retried `transaction.completed` would have
*   written a second entitlement for one payment.
*
*   NO ORDERING. `occurred_at` was discarded too. Delivery order is not
*   guaranteed, so a `subscription.updated` held up in a retry queue could
*   arrive after the `subscription.canceled` that superseded it and quietly
*   restore access somebody had already cancelled — or that had been refunded.
*
*   NO AUDIT. Nothing recorded that an event had been seen, so a duplicate
*   could not be recognised and a dispute could not be reconstructed.
*
* This module is the decision, and it is PURE: an event and the row OCADE
* currently holds go in, and an instruction goes out. No Supabase client, no
* clock, no network. That is what makes "a duplicate does nothing" and "a
* stale event does nothing" testable exhaustively instead of hopefully.
*
* It deliberately does not verify signatures — `verifyWebhook` owns that, and
* nothing reaches here unverified.
*/
/** The entitlement row an event is allowed to affect. */
function targetEntityIdOf(eventType, data) {
	if (eventType === "adjustment.created" || eventType === "adjustment.updated") {
		const subscriptionId = pick(data, "subscriptionId", "subscription_id");
		if (typeof subscriptionId === "string" && subscriptionId.length > 0) return subscriptionId;
		const transactionId = pick(data, "transactionId", "transaction_id");
		return typeof transactionId === "string" && transactionId.length > 0 ? transactionId : null;
	}
	const id = pick(data, "id");
	return typeof id === "string" && id.length > 0 ? id : null;
}
/** How long a one-time pass lasts, by plan. Days. */
var ONE_TIME_DAYS = { std_8d: 8 };
function pick(data, ...keys) {
	for (const key of keys) {
		const value = data[key];
		if (value !== void 0 && value !== null) return value;
	}
}
function asRecord(value) {
	return value && typeof value === "object" ? value : void 0;
}
/**
* The user this event is for.
*
* Read from `custom_data`, which OCADE sets at checkout. An event without one
* cannot be attributed to anybody, and guessing from an email address would
* attach a stranger's payment to whichever account happened to match.
*/
function userIdOf(data) {
	const custom = asRecord(pick(data, "customData", "custom_data"));
	const value = custom ? pick(custom, "userId", "user_id") : void 0;
	return typeof value === "string" && value.length > 0 ? value : null;
}
/**
* The catalogue ids OCADE is allowed to record.
*
* `importMeta.externalId` is the human-readable id from `paddle-plans.ts`, and
* it is deliberately the only one stored: the provider's own ids differ between
* sandbox and live, so recording those would silently break plan attribution
* the day the product went live.
*/
function catalogueIds(item) {
	const price = asRecord(item?.["price"]);
	const product = asRecord(item?.["product"]) ?? asRecord(price?.["product"]);
	const readExternal = (node) => {
		const meta = node ? asRecord(pick(node, "importMeta", "import_meta")) : void 0;
		const value = meta ? pick(meta, "externalId", "external_id") : void 0;
		return typeof value === "string" && value.length > 0 ? value : null;
	};
	return {
		priceId: readExternal(price),
		productId: readExternal(product)
	};
}
function firstItem(data) {
	const items = data["items"];
	return Array.isArray(items) ? asRecord(items[0]) : void 0;
}
function addDays(iso, days) {
	return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1e3).toISOString();
}
/**
* A stale event changes nothing.
*
* Strictly older, not older-or-equal: two events can legitimately share a
* timestamp, and refusing the second would drop real state. Equal timestamps
* are handled by the event-id de-duplication instead, which is exact.
*/
function isStale(envelope, existing) {
	if (!existing?.providerEventAt) return false;
	return new Date(envelope.occurredAt).getTime() < new Date(existing.providerEventAt).getTime();
}
/**
* A terminal state is not reopened by a late event.
*
* A refund or a lost dispute means the money went back. A `subscription.updated`
* still sitting in the provider's retry queue must not hand the product back to
* somebody who has already been repaid — that is the concrete shape of "a
* delayed webhook resurrecting cancelled access".
*/
var TERMINAL = /* @__PURE__ */ new Set([
	"canceled",
	"cancelled",
	"refunded",
	"charged_back",
	"disputed"
]);
function decide(envelope, existing) {
	if (existing && existing.environment !== envelope.environment) return {
		action: "ignore",
		reason: "environment_mismatch"
	};
	if (isStale(envelope, existing)) return {
		action: "ignore",
		reason: "stale_event"
	};
	const data = envelope.data;
	switch (envelope.eventType) {
		case "subscription.created": {
			const userId = userIdOf(data);
			if (!userId) return {
				action: "ignore",
				reason: "no_user_id"
			};
			const { priceId, productId } = catalogueIds(firstItem(data));
			if (!priceId || !productId) return {
				action: "ignore",
				reason: "no_catalogue_ids"
			};
			const id = pick(data, "id");
			const customerId = pick(data, "customerId", "customer_id");
			if (typeof id !== "string" || typeof customerId !== "string") return {
				action: "ignore",
				reason: "no_entity_id"
			};
			const period = asRecord(pick(data, "currentBillingPeriod", "current_billing_period"));
			return {
				action: "upsert",
				row: {
					user_id: userId,
					paddle_subscription_id: id,
					paddle_customer_id: customerId,
					product_id: productId,
					price_id: priceId,
					status: typeof data["status"] === "string" ? data["status"] : "active",
					current_period_start: pick(period ?? {}, "startsAt", "starts_at") ?? null,
					current_period_end: pick(period ?? {}, "endsAt", "ends_at") ?? null,
					cancel_at_period_end: false,
					environment: envelope.environment,
					provider_event_at: envelope.occurredAt,
					kind: "subscription"
				}
			};
		}
		case "subscription.updated": {
			const id = pick(data, "id");
			if (typeof id !== "string") return {
				action: "ignore",
				reason: "no_entity_id"
			};
			if (existing && TERMINAL.has(existing.status)) return {
				action: "ignore",
				reason: "terminal_state"
			};
			const period = asRecord(pick(data, "currentBillingPeriod", "current_billing_period"));
			const change = asRecord(pick(data, "scheduledChange", "scheduled_change"));
			return {
				action: "update",
				paddleSubscriptionId: id,
				patch: {
					...typeof data["status"] === "string" ? { status: data["status"] } : {},
					current_period_start: pick(period ?? {}, "startsAt", "starts_at") ?? null,
					current_period_end: pick(period ?? {}, "endsAt", "ends_at") ?? null,
					cancel_at_period_end: change?.["action"] === "cancel",
					provider_event_at: envelope.occurredAt
				}
			};
		}
		case "subscription.canceled": {
			const id = pick(data, "id");
			if (typeof id !== "string") return {
				action: "ignore",
				reason: "no_entity_id"
			};
			return {
				action: "update",
				paddleSubscriptionId: id,
				patch: {
					status: "canceled",
					provider_event_at: envelope.occurredAt
				}
			};
		}
		case "transaction.completed": {
			const userId = userIdOf(data);
			if (!userId) return {
				action: "ignore",
				reason: "no_user_id"
			};
			const subscriptionId = pick(data, "subscriptionId", "subscription_id");
			if (typeof subscriptionId === "string" && subscriptionId.length > 0) return {
				action: "ignore",
				reason: "subscription_transaction"
			};
			const { priceId, productId } = catalogueIds(firstItem(data));
			if (!priceId || !productId) return {
				action: "ignore",
				reason: "no_catalogue_ids"
			};
			const plan = sellablePlanByPriceId(priceId) ?? sellablePlanByProductId(productId);
			if (!plan || plan.cadence !== "one-time") return {
				action: "ignore",
				reason: "not_a_one_time_plan"
			};
			const days = ONE_TIME_DAYS[plan.planId];
			if (!days) return {
				action: "ignore",
				reason: "no_configured_duration"
			};
			const id = pick(data, "id");
			const customerId = pick(data, "customerId", "customer_id");
			if (typeof id !== "string" || typeof customerId !== "string") return {
				action: "ignore",
				reason: "no_entity_id"
			};
			const billedAt = pick(data, "billedAt", "billed_at") ?? envelope.occurredAt;
			return {
				action: "upsert",
				row: {
					user_id: userId,
					paddle_subscription_id: id,
					paddle_customer_id: customerId,
					product_id: productId,
					price_id: priceId,
					status: "active",
					current_period_start: billedAt,
					current_period_end: addDays(billedAt, days),
					cancel_at_period_end: false,
					environment: envelope.environment,
					provider_event_at: envelope.occurredAt,
					kind: "one_time"
				}
			};
		}
		case "subscription.activated":
		case "subscription.resumed":
		case "subscription.past_due":
		case "subscription.paused":
		case "subscription.trialing": {
			const id = pick(data, "id");
			if (typeof id !== "string") return {
				action: "ignore",
				reason: "no_entity_id"
			};
			if (existing && TERMINAL.has(existing.status)) return {
				action: "ignore",
				reason: "terminal_state"
			};
			return {
				action: "update",
				paddleSubscriptionId: id,
				patch: {
					status: {
						"subscription.activated": "active",
						"subscription.resumed": "active",
						"subscription.past_due": "past_due",
						"subscription.paused": "paused",
						"subscription.trialing": "trialing"
					}[envelope.eventType],
					provider_event_at: envelope.occurredAt
				}
			};
		}
		case "adjustment.created":
		case "adjustment.updated": {
			const target = targetEntityIdOf(envelope.eventType, data);
			if (!target) return {
				action: "ignore",
				reason: "no_adjustment_target"
			};
			if (!existing) return {
				action: "ignore",
				reason: "entitlement_not_found"
			};
			const action = pick(data, "action");
			const status = pick(data, "status");
			const adjustmentType = pick(data, "type");
			if (typeof action !== "string" || typeof status !== "string") return {
				action: "ignore",
				reason: "invalid_adjustment"
			};
			if (action === "refund") {
				if (status === "pending_approval") return {
					action: "ignore",
					reason: "refund_pending_approval"
				};
				if (status === "rejected") return {
					action: "ignore",
					reason: "refund_rejected"
				};
				if (status !== "approved") return {
					action: "ignore",
					reason: `refund_${status}`
				};
				if (adjustmentType !== "full") return {
					action: "ignore",
					reason: "partial_refund"
				};
				return {
					action: "update",
					paddleSubscriptionId: target,
					patch: {
						status: "refunded",
						provider_event_at: envelope.occurredAt
					}
				};
			}
			if (action === "chargeback" || action === "chargeback_warning") return {
				action: "update",
				paddleSubscriptionId: target,
				patch: {
					status: action === "chargeback" ? "charged_back" : "disputed",
					provider_event_at: envelope.occurredAt
				}
			};
			if (action === "chargeback_reverse" || action === "chargeback_warning_reverse") {
				if (!(existing.status === "charged_back" || existing.status === "disputed")) return {
					action: "ignore",
					reason: "unexpected_chargeback_reversal"
				};
				return {
					action: "update",
					paddleSubscriptionId: target,
					patch: {
						status: "active",
						provider_event_at: envelope.occurredAt
					}
				};
			}
			return {
				action: "ignore",
				reason: `adjustment_action:${action}`
			};
		}
		default: return {
			action: "ignore",
			reason: `unhandled:${envelope.eventType}`
		};
	}
}
/**
* The only writer of subscription state.
*
* This endpoint is deliberately unauthenticated — the payment provider has no
* OCADE session — so the signature check in `verifyWebhook` is the whole
* security boundary. Nothing in the body is trusted before it passes.
*
* It always answers 200 once a verified event has been handled, because a
* provider that receives an error retries for days and eventually drops the
* event, and a dropped event is a customer whose historical provider state
* diverges from OCADE's audit record.
*
* WHAT THIS FILE NO LONGER DECIDES. It used to hold the mapping from event to
* database row inline, three times, with no idempotency, no ordering and no
* record that anything had happened — and with no handler at all for the event
* a one-time purchase actually arrives on, so the 8-day pass in the sellable
* catalogue could take money and create nothing. All of that judgement now
* lives in `payments/webhook-apply.ts`, which is pure and therefore testable
* against duplicates, stale deliveries and refunds without a database. This
* file does three things: verify, record, apply.
*/
var cached = null;
function getSupabase() {
	if (!cached) cached = createClient(process.env["SUPABASE_URL"], process.env["SUPABASE_SERVICE_ROLE_KEY"]);
	return cached;
}
async function handleWebhook(req, env) {
	const event = await verifyWebhook(req, env);
	const supabase = getSupabase();
	const data = event.data ?? {};
	const entityId = targetEntityIdOf(event.eventType, data);
	let existing = null;
	if (entityId) {
		const { data: row } = await supabase.from("subscriptions").select("paddle_subscription_id, status, provider_event_at, environment").eq("paddle_subscription_id", entityId).maybeSingle();
		if (row) existing = {
			paddleSubscriptionId: row.paddle_subscription_id,
			status: row.status,
			providerEventAt: row.provider_event_at,
			environment: row.environment
		};
	}
	const instruction = decide({
		eventId: event.eventId,
		eventType: event.eventType,
		occurredAt: event.occurredAt,
		environment: env,
		data
	}, existing);
	const row = instruction.action === "upsert" ? instruction.row : null;
	const patch = instruction.action === "update" ? instruction.patch : null;
	const adjustmentAction = typeof data["action"] === "string" ? data["action"] : "";
	const { error } = await supabase.rpc("apply_payment_webhook_event", {
		p_event_id: event.eventId,
		p_event_type: event.eventType,
		p_occurred_at: event.occurredAt,
		p_environment: env,
		p_entity_id: entityId,
		p_action: instruction.action,
		p_reason: instruction.action === "ignore" ? instruction.reason : null,
		p_user_id: row?.user_id ?? null,
		p_paddle_subscription_id: row?.paddle_subscription_id ?? (instruction.action === "update" ? instruction.paddleSubscriptionId : null),
		p_paddle_customer_id: row?.paddle_customer_id ?? null,
		p_product_id: row?.product_id ?? null,
		p_price_id: row?.price_id ?? null,
		p_status: row?.status ?? patch?.status ?? null,
		p_current_period_start: row?.current_period_start ?? patch?.current_period_start ?? null,
		p_current_period_end: row?.current_period_end ?? patch?.current_period_end ?? null,
		p_cancel_at_period_end: row?.cancel_at_period_end ?? patch?.cancel_at_period_end ?? null,
		p_kind: row?.kind ?? null,
		p_allow_terminal_reversal: adjustmentAction === "chargeback_reverse" || adjustmentAction === "chargeback_warning_reverse"
	});
	if (error) throw error;
}
var Route$1 = createFileRoute("/api/public/payments/webhook")({ server: { handlers: { POST: async ({ request }) => {
	const requestedEnv = new URL(request.url).searchParams.get("env") ?? "sandbox";
	if (!isPaddleEnv(requestedEnv)) return new Response("Invalid payment environment", { status: 400 });
	const allowance = checkServerLimit("billing_write", `webhook:${request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`);
	if (!allowance.allowed) return new Response("Too many requests", {
		status: 429,
		headers: allowance.headers
	});
	try {
		await handleWebhook(request, requestedEnv);
		return Response.json({ received: true });
	} catch (e) {
		console.error("Payment webhook error:", e);
		return new Response("Webhook error", { status: 400 });
	}
} } } });
var IndexRoute = Route$78.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$79
});
var AuthenticatedRouteRoute = Route$84.update({
	id: "/_authenticated",
	getParentRoute: () => Route$79
});
var AboutRoute = Route$77.update({
	id: "/about",
	path: "/about",
	getParentRoute: () => Route$79
});
var AuthRoute = Route$80.update({
	id: "/auth",
	path: "/auth",
	getParentRoute: () => Route$79
});
var BlogRoute = Route$76.update({
	id: "/blog",
	path: "/blog",
	getParentRoute: () => Route$79
});
var CareersRoute = Route$75.update({
	id: "/careers",
	path: "/careers",
	getParentRoute: () => Route$79
});
var CompanyRoute = Route$74.update({
	id: "/company",
	path: "/company",
	getParentRoute: () => Route$79
});
var CompareRoute = Route$73.update({
	id: "/compare",
	path: "/compare",
	getParentRoute: () => Route$79
});
var DataRightsRoute = Route$72.update({
	id: "/data-rights",
	path: "/data-rights",
	getParentRoute: () => Route$79
});
var DemoRoute = Route$71.update({
	id: "/demo",
	path: "/demo",
	getParentRoute: () => Route$79
});
var DownloadRoute = Route$70.update({
	id: "/download",
	path: "/download",
	getParentRoute: () => Route$79
});
var FaqRoute = Route$69.update({
	id: "/faq",
	path: "/faq",
	getParentRoute: () => Route$79
});
var PressRoute = Route$68.update({
	id: "/press",
	path: "/press",
	getParentRoute: () => Route$79
});
var PricingRoute = Route$85.update({
	id: "/pricing",
	path: "/pricing",
	getParentRoute: () => Route$79
});
var PrivacyRoute = Route$67.update({
	id: "/privacy",
	path: "/privacy",
	getParentRoute: () => Route$79
});
var ResetPasswordRoute = Route$66.update({
	id: "/reset-password",
	path: "/reset-password",
	getParentRoute: () => Route$79
});
var RobotsDottxtRoute = Route$65.update({
	id: "/robots.txt",
	path: "/robots.txt",
	getParentRoute: () => Route$79
});
var SearchRoute = Route$64.update({
	id: "/search",
	path: "/search",
	getParentRoute: () => Route$79
});
var SitemapDotxmlRoute = Route$63.update({
	id: "/sitemap.xml",
	path: "/sitemap.xml",
	getParentRoute: () => Route$79
});
var StatusRoute = Route$62.update({
	id: "/status",
	path: "/status",
	getParentRoute: () => Route$79
});
var SupportRoute = Route$61.update({
	id: "/support",
	path: "/support",
	getParentRoute: () => Route$79
});
var TeamRoute = Route$60.update({
	id: "/team",
	path: "/team",
	getParentRoute: () => Route$79
});
var TermsRoute = Route$59.update({
	id: "/terms",
	path: "/terms",
	getParentRoute: () => Route$79
});
var AuthenticatedAccessDeniedRoute = Route.update({
	id: "/access-denied",
	path: "/access-denied",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedCaniaRoute = Route$58.update({
	id: "/cania",
	path: "/cania",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedFiciaRoute = Route$57.update({
	id: "/ficia",
	path: "/ficia",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedHomeRoute = Route$56.update({
	id: "/home",
	path: "/home",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedMadeeRoute = Route$55.update({
	id: "/madee",
	path: "/madee",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedOcadeRoute = Route$54.update({
	id: "/ocade",
	path: "/ocade",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedOnboardingRoute = Route$53.update({
	id: "/onboarding",
	path: "/onboarding",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedSettingsRoute = Route$52.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthCallbackRoute = Route$81.update({
	id: "/callback",
	path: "/callback",
	getParentRoute: () => AuthRoute
});
var AuthVerifyRoute = Route$82.update({
	id: "/verify",
	path: "/verify",
	getParentRoute: () => AuthRoute
});
var BlogIndexRoute = Route$51.update({
	id: "/",
	path: "/",
	getParentRoute: () => BlogRoute
});
var BlogSlugRoute = Route$83.update({
	id: "/$slug",
	path: "/$slug",
	getParentRoute: () => BlogRoute
});
var CheckoutSuccessRoute = Route$50.update({
	id: "/checkout/success",
	path: "/checkout/success",
	getParentRoute: () => Route$79
});
var DemoIndexRoute = Route$49.update({
	id: "/",
	path: "/",
	getParentRoute: () => DemoRoute
});
var DemoControlRoute = Route$48.update({
	id: "/control",
	path: "/control",
	getParentRoute: () => DemoRoute
});
var DemoOcadeRoute = Route$47.update({
	id: "/ocade",
	path: "/ocade",
	getParentRoute: () => DemoRoute
});
var DemoSettingsRoute = Route$46.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => DemoRoute
});
var FounderHaansAntoniRoute = Route$45.update({
	id: "/founder/haans-antoni",
	path: "/founder/haans-antoni",
	getParentRoute: () => Route$79
});
var ProductsOcadeRoute = Route$44.update({
	id: "/products/ocade",
	path: "/products/ocade",
	getParentRoute: () => Route$79
});
var DotlovableOauthConsentRoute = Route$1$1.update({
	id: "/.lovable/oauth/consent",
	path: "/.lovable/oauth/consent",
	getParentRoute: () => Route$79
});
var AuthenticatedAdminLaunchGateRoute = Route$43.update({
	id: "/admin/launch-gate",
	path: "/admin/launch-gate",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedAdminPaymentsChecklistRoute = Route$42.update({
	id: "/admin/payments-checklist",
	path: "/admin/payments-checklist",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedAdminSupportRoute = Route$41.update({
	id: "/admin/support",
	path: "/admin/support",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedAdminUsersRoute = Route$40.update({
	id: "/admin/users",
	path: "/admin/users",
	getParentRoute: () => AuthenticatedRouteRoute
});
var AuthenticatedOcadeIndexRoute = Route$1$84.update({
	id: "/",
	path: "/",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeActivityRoute = Route$39.update({
	id: "/activity",
	path: "/activity",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeArtifactsRoute = Route$38.update({
	id: "/artifacts",
	path: "/artifacts",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeAutomationsRoute = Route$37.update({
	id: "/automations",
	path: "/automations",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeCodeRoute = Route$36.update({
	id: "/code",
	path: "/code",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeConnectorsRoute = Route$35.update({
	id: "/connectors",
	path: "/connectors",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeDevicesRoute = Route$34.update({
	id: "/devices",
	path: "/devices",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeHealthRoute = Route$33.update({
	id: "/health",
	path: "/health",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeInboxRoute = Route$32.update({
	id: "/inbox",
	path: "/inbox",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeKnowledgeRoute = Route$31.update({
	id: "/knowledge",
	path: "/knowledge",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeLabRoute = Route$30.update({
	id: "/lab",
	path: "/lab",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeModelsRoute = Route$29.update({
	id: "/models",
	path: "/models",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeMonitorsRoute = Route$28.update({
	id: "/monitors",
	path: "/monitors",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeNotificationsRoute = Route$27.update({
	id: "/notifications",
	path: "/notifications",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadePermissionsRoute = Route$26.update({
	id: "/permissions",
	path: "/permissions",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeProjectsRoute = Route$25.update({
	id: "/projects",
	path: "/projects",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeSearchRoute = Route$24.update({
	id: "/search",
	path: "/search",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeSharedRoute = Route$23.update({
	id: "/shared",
	path: "/shared",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeStudioRoute = Route$22.update({
	id: "/studio",
	path: "/studio",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeSystemRoute = Route$21.update({
	id: "/system",
	path: "/system",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeTasksRoute = Route$20.update({
	id: "/tasks",
	path: "/tasks",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeTemplatesRoute = Route$19.update({
	id: "/templates",
	path: "/templates",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedOcadeWorkRoute = Route$18.update({
	id: "/work",
	path: "/work",
	getParentRoute: () => AuthenticatedOcadeRoute
});
var AuthenticatedSettingsIndexRoute = Route$17.update({
	id: "/",
	path: "/",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsSectionRoute = Route$86.update({
	id: "/$section",
	path: "/$section",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsActivityRoute = Route$16.update({
	id: "/activity",
	path: "/activity",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsAppearanceRoute = Route$15.update({
	id: "/appearance",
	path: "/appearance",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsBillingRoute = Route$14.update({
	id: "/billing",
	path: "/billing",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsBrowserRoute = Route$13.update({
	id: "/browser",
	path: "/browser",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsDevicesRoute = Route$12.update({
	id: "/devices",
	path: "/devices",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsMobileRoute = Route$11.update({
	id: "/mobile",
	path: "/mobile",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsPrivacyRoute = Route$10.update({
	id: "/privacy",
	path: "/privacy",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsSecurityRoute = Route$9.update({
	id: "/security",
	path: "/security",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsSkillsRoute = Route$8.update({
	id: "/skills",
	path: "/skills",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsSupportRoute = Route$7.update({
	id: "/support",
	path: "/support",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsTasksRoute = Route$6.update({
	id: "/tasks",
	path: "/tasks",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsUsageRoute = Route$5.update({
	id: "/usage",
	path: "/usage",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsVaultRoute = Route$4.update({
	id: "/vault",
	path: "/vault",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var AuthenticatedSettingsVoiceRoute = Route$3.update({
	id: "/voice",
	path: "/voice",
	getParentRoute: () => AuthenticatedSettingsRoute
});
var ApiOcadeBridgeSplatRoute = Route$2.update({
	id: "/api/ocade/bridge/$",
	path: "/api/ocade/bridge/$",
	getParentRoute: () => Route$79
});
var ApiPublicPaymentsWebhookRoute = Route$1.update({
	id: "/api/public/payments/webhook",
	path: "/api/public/payments/webhook",
	getParentRoute: () => Route$79
});
var AuthenticatedOcadeRouteChildren = {
	AuthenticatedOcadeActivityRoute,
	AuthenticatedOcadeArtifactsRoute,
	AuthenticatedOcadeAutomationsRoute,
	AuthenticatedOcadeCodeRoute,
	AuthenticatedOcadeConnectorsRoute,
	AuthenticatedOcadeDevicesRoute,
	AuthenticatedOcadeHealthRoute,
	AuthenticatedOcadeInboxRoute,
	AuthenticatedOcadeKnowledgeRoute,
	AuthenticatedOcadeLabRoute,
	AuthenticatedOcadeModelsRoute,
	AuthenticatedOcadeMonitorsRoute,
	AuthenticatedOcadeNotificationsRoute,
	AuthenticatedOcadePermissionsRoute,
	AuthenticatedOcadeProjectsRoute,
	AuthenticatedOcadeSearchRoute,
	AuthenticatedOcadeSharedRoute,
	AuthenticatedOcadeStudioRoute,
	AuthenticatedOcadeSystemRoute,
	AuthenticatedOcadeTasksRoute,
	AuthenticatedOcadeTemplatesRoute,
	AuthenticatedOcadeWorkRoute,
	AuthenticatedOcadeIndexRoute
};
var AuthenticatedOcadeRouteWithChildren = AuthenticatedOcadeRoute._addFileChildren(AuthenticatedOcadeRouteChildren);
var AuthenticatedSettingsRouteChildren = {
	AuthenticatedSettingsSectionRoute,
	AuthenticatedSettingsActivityRoute,
	AuthenticatedSettingsAppearanceRoute,
	AuthenticatedSettingsBillingRoute,
	AuthenticatedSettingsBrowserRoute,
	AuthenticatedSettingsDevicesRoute,
	AuthenticatedSettingsMobileRoute,
	AuthenticatedSettingsPrivacyRoute,
	AuthenticatedSettingsSecurityRoute,
	AuthenticatedSettingsSkillsRoute,
	AuthenticatedSettingsSupportRoute,
	AuthenticatedSettingsTasksRoute,
	AuthenticatedSettingsUsageRoute,
	AuthenticatedSettingsVaultRoute,
	AuthenticatedSettingsVoiceRoute,
	AuthenticatedSettingsIndexRoute
};
var AuthenticatedRouteRouteChildren = {
	AuthenticatedAccessDeniedRoute,
	AuthenticatedCaniaRoute,
	AuthenticatedFiciaRoute,
	AuthenticatedHomeRoute,
	AuthenticatedMadeeRoute,
	AuthenticatedOcadeRoute: AuthenticatedOcadeRouteWithChildren,
	AuthenticatedOnboardingRoute,
	AuthenticatedSettingsRoute: AuthenticatedSettingsRoute._addFileChildren(AuthenticatedSettingsRouteChildren),
	AuthenticatedAdminLaunchGateRoute,
	AuthenticatedAdminPaymentsChecklistRoute,
	AuthenticatedAdminSupportRoute,
	AuthenticatedAdminUsersRoute
};
var AuthenticatedRouteRouteWithChildren = AuthenticatedRouteRoute._addFileChildren(AuthenticatedRouteRouteChildren);
var AuthRouteChildren = {
	AuthCallbackRoute,
	AuthVerifyRoute
};
var AuthRouteWithChildren = AuthRoute._addFileChildren(AuthRouteChildren);
var BlogRouteChildren = {
	BlogSlugRoute,
	BlogIndexRoute
};
var BlogRouteWithChildren = BlogRoute._addFileChildren(BlogRouteChildren);
var DemoRouteChildren = {
	DemoControlRoute,
	DemoOcadeRoute,
	DemoSettingsRoute,
	DemoIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	AuthenticatedRouteRoute: AuthenticatedRouteRouteWithChildren,
	AboutRoute,
	AuthRoute: AuthRouteWithChildren,
	BlogRoute: BlogRouteWithChildren,
	CareersRoute,
	CompanyRoute,
	CompareRoute,
	DataRightsRoute,
	DemoRoute: DemoRoute._addFileChildren(DemoRouteChildren),
	DownloadRoute,
	FaqRoute,
	PressRoute,
	PricingRoute,
	PrivacyRoute,
	ResetPasswordRoute,
	RobotsDottxtRoute,
	SearchRoute,
	SitemapDotxmlRoute,
	StatusRoute,
	SupportRoute,
	TeamRoute,
	TermsRoute,
	CheckoutSuccessRoute,
	FounderHaansAntoniRoute,
	ProductsOcadeRoute,
	DotlovableOauthConsentRoute,
	ApiOcadeBridgeSplatRoute,
	ApiPublicPaymentsWebhookRoute
};
var routeTree = Route$79._addFileChildren(rootRouteChildren)._addFileTypes();
var getRouter = () => {
	return createRouter({
		routeTree,
		context: { queryClient: new QueryClient() },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { getRouter };
