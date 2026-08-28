import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { a as isPreparing, n as describeInstall, r as installState, s as subscribeToInstallState, t as IDLE_INSTALL_STATE } from "./installation-state-Wrzsjypr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-installation-CjTc3LjR.js
var import_react = /* @__PURE__ */ __toESM(require_react());
/**
* Reading — and starting — the one installation, from React.
*
* TWO HOOKS, AND THE SPLIT IS DELIBERATE.
*
* `useInstallationState` only WATCHES. Any number of components may use it, on
* any route, and none of them causes anything to happen. That is what makes it
* safe to put a progress line beside a composer, a badge in a header and a
* full-screen setup experience on a route all at once.
*
* `useInstallationBootstrap` STARTS the install, and is mounted in exactly one
* place — the application root. Preparation is a property of the visit, not of
* whichever screen happens to be open, so it begins as soon as trusted client
* code runs and keeps running across every navigation after that.
*
* WHY STARTING IS NOT IN THE WATCHING HOOK. It used to be, in effect: the
* composer's first keystroke called `warm()`. That made the moment a person
* started typing the moment a gigabyte started moving — the worst possible
* time, because they are now waiting mid-sentence for something that could have
* begun while they read the landing page.
*
* NOTHING HERE IMPORTS THE INSTALLER STATICALLY. Watching reads
* `installation-state.ts`, which has no dependencies; the machinery — transfer
* engine, streaming digest, vault, capability probes, catalogue — is loaded on
* an idle callback. Statically importing it put 50 KiB of installer into the
* entry bundle and the production budget gate refused the build, which was the
* right answer: first paint is a landing page and none of that is needed to
* draw one.
*/
/** The authority, loaded on demand. Resolved once and shared thereafter. */
function authority() {
	return import("./installation-browser-uqj4-qxw.mjs").then((n) => n.n).then((n) => n.n).then((module) => module.installationAuthority());
}
/** Watch the installation. Causes nothing to happen, and loads nothing. */
function useInstallationState() {
	return (0, import_react.useSyncExternalStore)(subscribeToInstallState, installState, () => IDLE_INSTALL_STATE);
}
/** Watch, plus the controls a setup or settings screen needs. */
function useInstallation() {
	const state = useInstallationState();
	return {
		state,
		line: describeInstall(state),
		preparing: isPreparing(state.stage),
		ready: state.stage === "ready",
		retry: (0, import_react.useCallback)(() => void authority().then((a) => a.retry()), []),
		pause: (0, import_react.useCallback)(() => void authority().then((a) => a.pause()), []),
		uninstall: (0, import_react.useCallback)(async () => {
			await (await authority()).uninstall();
		}, []),
		reinstall: (0, import_react.useCallback)(() => void authority().then((a) => a.reinstall()), []),
		repair: (0, import_react.useCallback)(() => void authority().then((a) => a.repair()), []),
		remedies: state.remedies
	};
}
/**
* Start preparing as early as it is technically safe to.
*
* MOUNTED ONCE, IN THE ROOT. Not in the demo, not in Chat, not behind a
* keystroke — a visitor who lands on the marketing page and signs in four
* minutes later should find the engine already there.
*
* DEFERRED BY ONE IDLE CALLBACK, and only one. First paint must not compete
* with loading an installer and probing WebGPU and storage; after that, the
* transfer is network and disk work that has no business waiting for anything.
* The deferral is milliseconds, not a policy — and the timeout matters, because
* on a busy page idle may never arrive and "as early as technically possible"
* cannot mean "eventually, maybe".
*
* IT DOES NOT WAIT FOR WI-FI. Cellular is allowed, deliberately: the local
* engine is what makes OCADE work offline later, so postponing it on a mobile
* connection would trade the feature the user came for against a preference
* nobody expressed. The transfer plan uses fewer connections on a phone, and
* `saveData` narrows it further — restraint rather than refusal.
*/
function useInstallationBootstrap(options) {
	const enabled = options?.enabled ?? true;
	(0, import_react.useEffect)(() => {
		if (!enabled) return;
		if (typeof window === "undefined") return;
		let cancelled = false;
		const start = () => {
			if (cancelled) return;
			authority().then((a) => {
				if (!cancelled) a.install({ reason: "app_bootstrap" });
			});
		};
		const idle = window.requestIdleCallback;
		if (typeof idle === "function") {
			const handle = idle(start, { timeout: 1500 });
			return () => {
				cancelled = true;
				window.cancelIdleCallback?.(handle);
			};
		}
		const handle = window.setTimeout(start, 200);
		return () => {
			cancelled = true;
			window.clearTimeout(handle);
		};
	}, [enabled]);
	/**
	* Resume when the device comes back.
	*
	* A phone that walked out of signal, a laptop that slept, a tab that was
	* discarded and restored, a return from the OAuth redirect. In every one of
	* those the transfer stopped and the checkpoint survived, so the right
	* response to "we are online and visible again" is to carry on from it.
	*/
	(0, import_react.useEffect)(() => {
		if (!enabled) return;
		if (typeof window === "undefined") return;
		const resume = () => {
			if (installState().stage === "ready") return;
			if (typeof navigator !== "undefined" && navigator.onLine === false) return;
			authority().then((a) => {
				if (!a.isReady()) a.install({ reason: "resumed" });
			});
		};
		const onVisibility = () => {
			if (document.visibilityState === "visible") resume();
		};
		window.addEventListener("online", resume);
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("pageshow", resume);
		return () => {
			window.removeEventListener("online", resume);
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("pageshow", resume);
		};
	}, [enabled]);
}
//#endregion
export { useInstallationBootstrap as n, useInstallation as t };
