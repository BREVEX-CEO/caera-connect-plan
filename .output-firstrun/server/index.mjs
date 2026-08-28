globalThis.__nitro_main__ = import.meta.url;
import { a as toEventHandler, c as serve, i as defineLazyEventHandler, n as HTTPError, r as defineHandler, s as NodeResponse, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { i as withoutTrailingSlash, n as joinURL, r as withLeadingSlash, t as decodePath } from "./_libs/ufo.mjs";
import { promises } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
//#region #nitro-vite-setup
function lazyService(loader) {
	let promise, mod;
	return { fetch(req) {
		if (mod) return mod.fetch(req);
		if (!promise) promise = loader().then((_mod) => mod = _mod.default || _mod);
		return promise.then((mod) => mod.fetch(req));
	} };
}
var services = { ["ssr"]: lazyService(() => import("./_ssr/ssr.mjs")) };
globalThis.__nitro_vite_envs__ = services;
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/apple-touch-icon.png": {
		"type": "image/png",
		"etag": "\"482e-AHyOEKNRVkt/DeKr9FzKKjHuYgE\"",
		"mtime": "2026-08-28T01:53:58.466Z",
		"size": 18478,
		"path": "../public/apple-touch-icon.png"
	},
	"/favicon.ico": {
		"type": "image/vnd.microsoft.icon",
		"etag": "\"fb4-0SojhBjTCdtondWh2OQc0bbHnA8\"",
		"mtime": "2026-08-28T01:53:58.466Z",
		"size": 4020,
		"path": "../public/favicon.ico"
	},
	"/manifest.webmanifest": {
		"type": "application/manifest+json",
		"etag": "\"2b9-7HLG94qjlshQnx59E+/ByIlfznI\"",
		"mtime": "2026-08-28T01:53:58.466Z",
		"size": 697,
		"path": "../public/manifest.webmanifest"
	},
	"/sw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"463c-yzwjMtAFXnY1o6e219yDWz35vxI\"",
		"mtime": "2026-08-28T01:53:58.466Z",
		"size": 17980,
		"path": "../public/sw.js"
	},
	"/offline.html": {
		"type": "text/html; charset=utf-8",
		"etag": "\"a05-pzaEkxiSga8R/E5QnxVTL9w7Wcc\"",
		"mtime": "2026-08-28T01:53:58.466Z",
		"size": 2565,
		"path": "../public/offline.html"
	},
	"/cursors/caera-black.svg": {
		"type": "image/svg+xml",
		"etag": "\"e3-cOVBa1MjhDbN4IhGTA4fG6luTC0\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 227,
		"path": "../public/cursors/caera-black.svg"
	},
	"/cursors/caera-white.svg": {
		"type": "image/svg+xml",
		"etag": "\"e3-K8Ph3SHLSn3xKyibe7XMGertmUU\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 227,
		"path": "../public/cursors/caera-white.svg"
	},
	"/fonts/OFL-InstrumentSerif.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"1135-gDiCV59Tkow3oVdZoNLGxJNQ2gw\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 4405,
		"path": "../public/fonts/OFL-InstrumentSerif.txt"
	},
	"/fonts/OFL-Inter.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"1119-zdAbfmjbgdZj8cOCC298QAKJAN0\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 4377,
		"path": "../public/fonts/OFL-Inter.txt"
	},
	"/fonts/OFL-JetBrainsMono.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"112f-L7YAWH1CBVh/6187FKNT6l1P76A\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 4399,
		"path": "../public/fonts/OFL-JetBrainsMono.txt"
	},
	"/fonts/README.md": {
		"type": "text/markdown; charset=utf-8",
		"etag": "\"721-454yencTVI81kp700tfqHRuG7dE\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 1825,
		"path": "../public/fonts/README.md"
	},
	"/fonts/instrument-serif-italic-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"5670-JObJnKCLHlrMks8QbFhvSR7RUVE\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 22128,
		"path": "../public/fonts/instrument-serif-italic-latin.woff2"
	},
	"/fonts/instrument-serif-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"5228-N930ZbvMJSd2o33PKBeaPKWQNjs\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 21032,
		"path": "../public/fonts/instrument-serif-latin.woff2"
	},
	"/fonts/inter-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"bc80-8R1ym7Ck2DUNLqPQ/AYs9u8tUpg\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 48256,
		"path": "../public/fonts/inter-latin.woff2"
	},
	"/icons/ocade-128.png": {
		"type": "image/png",
		"etag": "\"2871-IZB027IPQeXA1Uie+syfBzKl93I\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 10353,
		"path": "../public/icons/ocade-128.png"
	},
	"/icons/ocade-192.png": {
		"type": "image/png",
		"etag": "\"5149-wzeR766lYdZEadVNBUoDzG48A0c\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 20809,
		"path": "../public/icons/ocade-192.png"
	},
	"/icons/ocade-256.png": {
		"type": "image/png",
		"etag": "\"930e-FmD72307V20/TJsN9OqHrh9zjgs\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 37646,
		"path": "../public/icons/ocade-256.png"
	},
	"/icons/ocade-32.png": {
		"type": "image/png",
		"etag": "\"4dc-hbUtpn6WGgeGc4D7uURQF0k5ABw\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 1244,
		"path": "../public/icons/ocade-32.png"
	},
	"/fonts/jetbrains-mono-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"9dd4-5yd+cUUhzrXxdMyYebUeD0qml1M\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 40404,
		"path": "../public/fonts/jetbrains-mono-latin.woff2"
	},
	"/icons/ocade-48.png": {
		"type": "image/png",
		"etag": "\"8cf-lg1ou1TM9yhpZPYq24/jNN0WGH0\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 2255,
		"path": "../public/icons/ocade-48.png"
	},
	"/brand/ocade-carcc-wordmark.png": {
		"type": "image/png",
		"etag": "\"7c79a-hDONFyhF6C6vVUP8oUwl+uIk1Hs\"",
		"mtime": "2026-08-28T01:53:58.466Z",
		"size": 509850,
		"path": "../public/brand/ocade-carcc-wordmark.png"
	},
	"/icons/ocade-512.png": {
		"type": "image/png",
		"etag": "\"282f1-veO7ECjckHeDITMr9SUQUZwBKSE\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 164593,
		"path": "../public/icons/ocade-512.png"
	},
	"/assets/AppShell-Dqk-NfCp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb-ltRoF0OQMr4+K4UA3sOrOufCXJE\"",
		"mtime": "2026-08-28T01:53:53.696Z",
		"size": 187,
		"path": "../public/assets/AppShell-Dqk-NfCp.js"
	},
	"/assets/AuthShell-BmXPz5-I.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"886-pVKvw5DhHVW+j29GmmS+Zngm11E\"",
		"mtime": "2026-08-28T01:53:53.696Z",
		"size": 2182,
		"path": "../public/assets/AuthShell-BmXPz5-I.js"
	},
	"/brand/ocade-carcc-mark.png": {
		"type": "image/png",
		"etag": "\"a4249-vxI0sbhEiBkI+cWc8Av0Y58BB3A\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 672329,
		"path": "../public/brand/ocade-carcc-mark.png"
	},
	"/assets/BrandMark-Dwstrjb9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"38a-5TFG1vzlCKPhIHZlTOEVb8yUUFU\"",
		"mtime": "2026-08-28T01:53:53.696Z",
		"size": 906,
		"path": "../public/assets/BrandMark-Dwstrjb9.js"
	},
	"/assets/CapabilityBadge-CD_kJknf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9bd-F2aR23vCp0FHztj7OtP18CUkOrM\"",
		"mtime": "2026-08-28T01:53:53.696Z",
		"size": 2493,
		"path": "../public/assets/CapabilityBadge-CD_kJknf.js"
	},
	"/assets/ChatSidebar-CgU8JdTy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"100f-J/4HXu+8z/E9ziA7MJJWXYaf4Hc\"",
		"mtime": "2026-08-28T01:53:53.696Z",
		"size": 4111,
		"path": "../public/assets/ChatSidebar-CgU8JdTy.js"
	},
	"/assets/ComingLater-dxtI_IXS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4dc-Hi/GqZc5DC7bGto/nJP/k99fWxk\"",
		"mtime": "2026-08-28T01:53:53.696Z",
		"size": 1244,
		"path": "../public/assets/ComingLater-dxtI_IXS.js"
	},
	"/assets/DiagnosticsPanel-zDDb_8PD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3313-crUoD/jZc64oq9geo/9NhVLJmcg\"",
		"mtime": "2026-08-28T01:53:53.696Z",
		"size": 13075,
		"path": "../public/assets/DiagnosticsPanel-zDDb_8PD.js"
	},
	"/assets/EmptyState-ZdWRv2VB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"202-dVhIREjLdGd90DdEZEIctjpo6Yw\"",
		"mtime": "2026-08-28T01:53:53.696Z",
		"size": 514,
		"path": "../public/assets/EmptyState-ZdWRv2VB.js"
	},
	"/assets/GestureControlPanel-BB0tN6xJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16ab-kPsyo8PxkRaIjDQ3vekUamWUAT8\"",
		"mtime": "2026-08-28T01:53:53.696Z",
		"size": 5803,
		"path": "../public/assets/GestureControlPanel-BB0tN6xJ.js"
	},
	"/assets/GlassPanel-Cc_YtlGg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"225-tcV2oRemBNZG6e/ko0Vy3gn9aik\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 549,
		"path": "../public/assets/GlassPanel-Cc_YtlGg.js"
	},
	"/assets/LivingIntelligenceBackdrop-CoLVkKHJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19c3-pnNA/l/3mPI4/P6oM55IBmtcjow\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 6595,
		"path": "../public/assets/LivingIntelligenceBackdrop-CoLVkKHJ.js"
	},
	"/assets/LocalEngineControl-PWYaVwgo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e4d-Tv3CLlnhskI4aFmD1RPet/KHshM\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 7757,
		"path": "../public/assets/LocalEngineControl-PWYaVwgo.js"
	},
	"/assets/LocalIntelligenceControl-DC_5YbSx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1435-/h1OgwVdQhyDpdQuoZZL2wd9ExQ\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 5173,
		"path": "../public/assets/LocalIntelligenceControl-DC_5YbSx.js"
	},
	"/assets/OcadeCompanion-mFG4cZ4q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5e5-XxQH673rIee4HFGEglaZzudHAHo\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 1509,
		"path": "../public/assets/OcadeCompanion-mFG4cZ4q.js"
	},
	"/assets/OcadeOrb-STdn-E0d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a4-1/eNm4fEsNO9rfTz2OKnllhraf4\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 1444,
		"path": "../public/assets/OcadeOrb-STdn-E0d.js"
	},
	"/assets/OcadeOrbCanvas-DrGjFtBm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b0a-TlAHGtGanxjX6m/LoncdKo2P8k0\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 6922,
		"path": "../public/assets/OcadeOrbCanvas-DrGjFtBm.js"
	},
	"/assets/PageHeader-C0zSkLIw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ce-iho/5zo8cTFQLp9/yUhwECi4cW0\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 718,
		"path": "../public/assets/PageHeader-C0zSkLIw.js"
	},
	"/assets/PerformanceFallbackNotice-gsA7kTD0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"81f-FISA6rFy6t9tJXO2s7hdhbs0lrQ\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 2079,
		"path": "../public/assets/PerformanceFallbackNotice-gsA7kTD0.js"
	},
	"/assets/PlanComparison-Q3yIfMsg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"111e-QKmS4AuRAQrryURijJQFDiDlG7c\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 4382,
		"path": "../public/assets/PlanComparison-Q3yIfMsg.js"
	},
	"/assets/SettingsGate-WkB6LaYK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"727-cU1bAyjaBAx2bsLKYI96EzQfjcs\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 1831,
		"path": "../public/assets/SettingsGate-WkB6LaYK.js"
	},
	"/assets/SetupRequiredState-CW3XrW8-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3d8-1DzIoH5MsicONSOGHYh5lUuwK7E\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 984,
		"path": "../public/assets/SetupRequiredState-CW3XrW8-.js"
	},
	"/assets/StatusBadge-wb6-VUHC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"658-ah76o4voK+lf7Pf8Nx8s84ghtO8\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 1624,
		"path": "../public/assets/StatusBadge-wb6-VUHC.js"
	},
	"/assets/TasksWorkspace-vK05zuaJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"908c-vkzudrzE7Vf04Qt3mUFJpr63vww\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 37004,
		"path": "../public/assets/TasksWorkspace-vK05zuaJ.js"
	},
	"/assets/TruthfulFailurePanel-B7_uajV6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"784-WdC/cC8NJtkUzhvLzz+ClRgldIM\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 1924,
		"path": "../public/assets/TruthfulFailurePanel-B7_uajV6.js"
	},
	"/assets/VaultUnlockCard-DjaE2SyS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ff6-X/gELyCa7YX+cY3RbkwWznz/jw4\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 4086,
		"path": "../public/assets/VaultUnlockCard-DjaE2SyS.js"
	},
	"/assets/WorkspaceShell-CB5jC4O8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6cbb-ZsZF5Z896blSdzYGlcZ+1lGoDIk\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 27835,
		"path": "../public/assets/WorkspaceShell-CB5jC4O8.js"
	},
	"/assets/SolarSystem-BnE-x23n.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86b9f-zE+HXO5mcrYYuFw/pPta8GhKeps\"",
		"mtime": "2026-08-28T01:53:53.697Z",
		"size": 551839,
		"path": "../public/assets/SolarSystem-BnE-x23n.js"
	},
	"/assets/_._lovable.oauth.consent-Bra60dod.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"18e-3QjMyqJG0iGPGJYi0kiTCCUDlkM\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 398,
		"path": "../public/assets/_._lovable.oauth.consent-Bra60dod.js"
	},
	"/assets/_._lovable.oauth.consent-Dh_I-Ybh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66d-WsoE/KNh3VtlTy2rmNMjvGLZ+T0\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 1645,
		"path": "../public/assets/_._lovable.oauth.consent-Dh_I-Ybh.js"
	},
	"/assets/about-BXu8b34z.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"188c-YZQ8qEX8aTq1Sgk1Hpim4vraUO0\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 6284,
		"path": "../public/assets/about-BXu8b34z.js"
	},
	"/assets/access-denied-BMRDRQVL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"624-N4Yj72TUdT2DnvJ/M+23cmm49jI\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 1572,
		"path": "../public/assets/access-denied-BMRDRQVL.js"
	},
	"/assets/actions-ti96j-02.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"275c-PdHpE6v+7YGOEfPqBltfXqzQpRA\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 10076,
		"path": "../public/assets/actions-ti96j-02.js"
	},
	"/assets/adapter-Bmw1IsNe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"12a-5/RewF0d9UP0xXkUa9BN4530hpI\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 298,
		"path": "../public/assets/adapter-Bmw1IsNe.js"
	},
	"/assets/admin.launch-gate-BTKEi3lx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a97-Y1fZabq1Z4hNqgFo3e1nQXT6xOY\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 23191,
		"path": "../public/assets/admin.launch-gate-BTKEi3lx.js"
	},
	"/assets/admin.payments-checklist-D0ltujw4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26c8-xQOYYVqv5QIuv07QWlkkP6r3qkc\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 9928,
		"path": "../public/assets/admin.payments-checklist-D0ltujw4.js"
	},
	"/assets/admin.support-BK9b95i1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"170f-gisHxWfj00OxhAMQO4UynjLpolU\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 5903,
		"path": "../public/assets/admin.support-BK9b95i1.js"
	},
	"/assets/admin.users-C0nfZi_c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16a8-DSRjKneawiN2ugRhQ/yII9LtVk8\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 5800,
		"path": "../public/assets/admin.users-C0nfZi_c.js"
	},
	"/assets/agent.functions-DGYRRZc0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c1-1P18yMTFdOpE5AtVJYlM9paCCDs\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 705,
		"path": "../public/assets/agent.functions-DGYRRZc0.js"
	},
	"/assets/auth-h4JhUpZG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5738-yPWEDbGUNxYvneZdsXvg46REQUk\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 22328,
		"path": "../public/assets/auth-h4JhUpZG.js"
	},
	"/assets/auth-middleware-BnmDYyyp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4e-6j+M6URyAXeTUnmb9wiPrUI4xng\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 78,
		"path": "../public/assets/auth-middleware-BnmDYyyp.js"
	},
	"/assets/auth.callback-BSgRSEWG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"abc-LD0apxWfZpUA2bA/tmaoECigsC0\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 2748,
		"path": "../public/assets/auth.callback-BSgRSEWG.js"
	},
	"/assets/auth.verify-DA-Xm1oL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1040-TJiMmg7eKCSI1TOYJSjl9+foUSI\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 4160,
		"path": "../public/assets/auth.verify-DA-Xm1oL.js"
	},
	"/assets/blog-CqB4JcFJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9c-qxTxkiF2+iUGbBMhtcT3GQc9L20\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 156,
		"path": "../public/assets/blog-CqB4JcFJ.js"
	},
	"/assets/blog._slug-4Q_2lTX8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eea-MAMhjClGBAWci0mNSWqnqvwFhEI\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 3818,
		"path": "../public/assets/blog._slug-4Q_2lTX8.js"
	},
	"/assets/blog.index-D3P3qOVy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d2c-Q2vBr6KbTSi+6tskM6Y7Z3SH60g\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 3372,
		"path": "../public/assets/blog.index-D3P3qOVy.js"
	},
	"/assets/browser-catalogue-DLxJMBU5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eb7-X0o+iONa9b18HaYpBz7geFkysy0\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 3767,
		"path": "../public/assets/browser-catalogue-DLxJMBU5.js"
	},
	"/assets/browser-wasm-DWKOEebJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1432-AxRA7i6s++aZN5aQTGqtbNpd6bo\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 5170,
		"path": "../public/assets/browser-wasm-DWKOEebJ.js"
	},
	"/assets/browser-webgpu-D2qus02e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1197-cn6Y8qa0TNTq3fu3q8Prqq/4qF0\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 4503,
		"path": "../public/assets/browser-webgpu-D2qus02e.js"
	},
	"/assets/cania-B-sTJ7GD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10b-ZTf2Vh07vs8HqlWMICvnzCEBwXE\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 267,
		"path": "../public/assets/cania-B-sTJ7GD.js"
	},
	"/assets/careers-DjMx95Py.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7bc-n2Fd51Jcp3I0HO2FYcO5zuI5sTg\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 1980,
		"path": "../public/assets/careers-DjMx95Py.js"
	},
	"/assets/chat-citation-store-M_3d5V2j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c39-b7Li7a473VJcdIXAd3OsyvbO0qQ\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 7225,
		"path": "../public/assets/chat-citation-store-M_3d5V2j.js"
	},
	"/assets/chat-output-flow-DIpihmu3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c47-1jA1WJBS5V5qyHujBFPhXZxp81s\"",
		"mtime": "2026-08-28T01:53:53.698Z",
		"size": 3143,
		"path": "../public/assets/chat-output-flow-DIpihmu3.js"
	},
	"/assets/checkout.success-Bt2RijeA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b7c-YarEbH5DUveZ+f8KzcoYDho20F4\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 2940,
		"path": "../public/assets/checkout.success-Bt2RijeA.js"
	},
	"/assets/company-AAefP4h-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"de2-/gCdzFVXD0ZXvW9LQboriMqHkRE\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 3554,
		"path": "../public/assets/company-AAefP4h-.js"
	},
	"/assets/compliance-log.functions-avGPEaVV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-z+sbQCa33be27n+Up4SaA5fuBwk\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 251,
		"path": "../public/assets/compliance-log.functions-avGPEaVV.js"
	},
	"/assets/computer-use-settings-EGzAqqOS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a0f-2d9maaE65OOhpMLiPiR46hqqTb4\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 2575,
		"path": "../public/assets/computer-use-settings-EGzAqqOS.js"
	},
	"/assets/data-rights-CYWO1t-P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e06-2tvbNhg8bKO5uQjZuS6ahQPO9MI\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 3590,
		"path": "../public/assets/data-rights-CYWO1t-P.js"
	},
	"/assets/demo-8maDpkLz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3c1-NL3S/UBsdzsNB5WdoIDDU6qU82E\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 961,
		"path": "../public/assets/demo-8maDpkLz.js"
	},
	"/assets/demo.control-DesYgEY7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"991-MF1jId5/9Lv4NkeZ9M7qEbxmbJ8\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 2449,
		"path": "../public/assets/demo.control-DesYgEY7.js"
	},
	"/assets/demo.ocade-I8h1_7Lw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7ee8-cnMPyeB73DNhKTyi8S21gOj79V8\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 32488,
		"path": "../public/assets/demo.ocade-I8h1_7Lw.js"
	},
	"/assets/demo.settings-DjZHEH54.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"edb-Vt4Ad/xpJa61FK2Amf/n2NEy8JM\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 3803,
		"path": "../public/assets/demo.settings-DjZHEH54.js"
	},
	"/assets/desktop-bridge-tO-QQqy8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eaa-Q4DpW6eraI1WfH5I18f6/If9c70\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 3754,
		"path": "../public/assets/desktop-bridge-tO-QQqy8.js"
	},
	"/assets/devices--Rbv_2bR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e0f-19FVrKVCRMHqX07VJ9c8C1WOm8w\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 3599,
		"path": "../public/assets/devices--Rbv_2bR.js"
	},
	"/assets/download-CjOXDGnM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1027-37+I4GihBGze73Zzi+A1D1WOsUA\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 4135,
		"path": "../public/assets/download-CjOXDGnM.js"
	},
	"/assets/execute-Z451lsms.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1213a-R2ns7aLp9OkcgbzztJMyYD7BqjY\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 74042,
		"path": "../public/assets/execute-Z451lsms.js"
	},
	"/assets/faq-DQEHuC4N.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1420-d0Hvr7U0iEfwdt/4tJ7Xjnz1lX4\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 5152,
		"path": "../public/assets/faq-DQEHuC4N.js"
	},
	"/assets/ficia-BdZ5BDGi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"105-CnEDa9m2bhlGLb8LmjByLZrCCE4\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 261,
		"path": "../public/assets/ficia-BdZ5BDGi.js"
	},
	"/assets/fixed-model-Ckyk5kJ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"895-SahTIID3v5hvHEb68F/9chPipFk\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 2197,
		"path": "../public/assets/fixed-model-Ckyk5kJ8.js"
	},
	"/assets/founder.haans-antoni-mi0tY6Qr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c45-oxtf9oX1XpCtmFOCgcds79l9sQE\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 3141,
		"path": "../public/assets/founder.haans-antoni-mi0tY6Qr.js"
	},
	"/assets/index-D8m23cn6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7e916-ZcYFZygPTNIifd0k4i4npZ1Huuo\"",
		"mtime": "2026-08-28T01:53:53.692Z",
		"size": 518422,
		"path": "../public/assets/index-D8m23cn6.js"
	},
	"/assets/input-BBCfdt_A.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"29a-B4NEC0Qr/ZtNwFtRfdBxozndAmw\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 666,
		"path": "../public/assets/input-BBCfdt_A.js"
	},
	"/assets/installation-browser-BtxAp5hr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6eeb-xUPLat5CKEWaoQfK5O8LqGbySL4\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 28395,
		"path": "../public/assets/installation-browser-BtxAp5hr.js"
	},
	"/assets/local-projects-CHg3osmp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1948-KL67iTAo4uXa1HV/ATBNp2mpVOc\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 6472,
		"path": "../public/assets/local-projects-CHg3osmp.js"
	},
	"/assets/local-runtime.functions-Cli5Gu1q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1080-iUAI7Ey+xInGEMZQ1P0WsMVei2s\"",
		"mtime": "2026-08-28T01:53:53.699Z",
		"size": 4224,
		"path": "../public/assets/local-runtime.functions-Cli5Gu1q.js"
	},
	"/assets/madee-DXc6_Ll0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"100-zeQKnHvjJQ4PcCEsFwL0bBIUcJs\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 256,
		"path": "../public/assets/madee-DXc6_Ll0.js"
	},
	"/assets/methods-Bmi_DJG2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2f0-5wV1FEI7fp4qwbFT2LJxidvgKAY\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 752,
		"path": "../public/assets/methods-Bmi_DJG2.js"
	},
	"/assets/model-download-WPtDDhP_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"129a-0NYA5ZOkysFUID3TPL95/RYlAhI\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 4762,
		"path": "../public/assets/model-download-WPtDDhP_.js"
	},
	"/assets/model-store--TDaCIKO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11f0-/yWxzn0iTXzT8t6LmvAx+tFz+Mg\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 4592,
		"path": "../public/assets/model-store--TDaCIKO.js"
	},
	"/assets/model-vault-DbVu5A8u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e9e-Xiz8k0lOcgQqCNoSaKGZ00BfSMw\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 3742,
		"path": "../public/assets/model-vault-DbVu5A8u.js"
	},
	"/assets/oauth-errors-D0R59ozT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8bf-aaAHKGe4/rm947FH7hWLOpTnBqQ\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 2239,
		"path": "../public/assets/oauth-errors-D0R59ozT.js"
	},
	"/assets/ocade-CvE98Xo2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"df-5LZIeVKkPe1qDzS+OmxH7UaTaB8\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 223,
		"path": "../public/assets/ocade-CvE98Xo2.js"
	},
	"/assets/ocade-allowance-BFQspkmM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52d-tfyMxsfopdsf6cD91j7mgDR2ZCk\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 1325,
		"path": "../public/assets/ocade-allowance-BFQspkmM.js"
	},
	"/assets/ocade-automations.functions-CC2GzEAh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"630-jKa9QM1sMEEsw5L3MEeyWmVM6IY\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 1584,
		"path": "../public/assets/ocade-automations.functions-CC2GzEAh.js"
	},
	"/assets/ocade-identity-BdM79R6-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"175-m+CJ2IY7faIQPIyy+1b+gB+G7Q8\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 373,
		"path": "../public/assets/ocade-identity-BdM79R6-.js"
	},
	"/assets/ocade-local-DMcdYpaT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15e7-44KXXrBxu4yEIXXATmyAb51HtNY\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 5607,
		"path": "../public/assets/ocade-local-DMcdYpaT.js"
	},
	"/assets/ocade-projects.functions-nTZdrukc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25b4-fgXc2Ekd2XQReOt3pYV4Y0thIBQ\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 9652,
		"path": "../public/assets/ocade-projects.functions-nTZdrukc.js"
	},
	"/assets/ocade-usage.functions-BRNNWifn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e9-2lvAURIGnIZQBpYAVxFIEnkQUjY\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 233,
		"path": "../public/assets/ocade-usage.functions-BRNNWifn.js"
	},
	"/assets/ocade.activity-G4rBxvim.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad4-J/e0VAjIJdlimsKNIfnO3I1uayQ\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 2772,
		"path": "../public/assets/ocade.activity-G4rBxvim.js"
	},
	"/assets/ocade.artifacts-BmoYl5X7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"211e-r1dmK6dUHBSwkuuP+sQbW8v7I20\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 8478,
		"path": "../public/assets/ocade.artifacts-BmoYl5X7.js"
	},
	"/assets/ocade.automations-D8P5xKLm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ea97-q7dRvTcMM8vE/6w0aNm+k031XzI\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 60055,
		"path": "../public/assets/ocade.automations-D8P5xKLm.js"
	},
	"/assets/ocade.code-D4mduvJ5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"af01-gCyt5aDUcgeW5XkA84g1hzESqVg\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 44801,
		"path": "../public/assets/ocade.code-D4mduvJ5.js"
	},
	"/assets/ocade.connectors-HCIUmhkY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"949-XszSVPytZbiU22mFuCot6KTx7lA\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 2377,
		"path": "../public/assets/ocade.connectors-HCIUmhkY.js"
	},
	"/assets/ocade.devices-CsbqQ2_b.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eb3-W96jZhMkD5MnWVnVNIfP9DeOYtw\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 3763,
		"path": "../public/assets/ocade.devices-CsbqQ2_b.js"
	},
	"/assets/ocade.health-fvbRPrcd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4d2-xQPRw2fbOJAOuc7Wcgv0VDaZ8Zk\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 1234,
		"path": "../public/assets/ocade.health-fvbRPrcd.js"
	},
	"/assets/ocade.inbox-CNdUTT7n.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fed-qjmWLqGcPOkl0qbvOy1t2FD7ClE\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 4077,
		"path": "../public/assets/ocade.inbox-CNdUTT7n.js"
	},
	"/assets/ocade.index-DWN1HUSK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"46100-HggEULRZ7hm4wqO4UOvesm5qAuA\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 286976,
		"path": "../public/assets/ocade.index-DWN1HUSK.js"
	},
	"/assets/ocade.knowledge-CAvTtbTA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a04-t29CXyPJgAOKvObk/VW8M1pkqEk\"",
		"mtime": "2026-08-28T01:53:53.700Z",
		"size": 2564,
		"path": "../public/assets/ocade.knowledge-CAvTtbTA.js"
	},
	"/assets/ocade.lab-D1ifUDbt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1bc6b-xGTAV16LwTLmzpW22zImt1j4GNU\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 113771,
		"path": "../public/assets/ocade.lab-D1ifUDbt.js"
	},
	"/assets/ocade.models-B9dja9s8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a31-pE84UNyunpS6GJ24kj4Gts7vKVs\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 2609,
		"path": "../public/assets/ocade.models-B9dja9s8.js"
	},
	"/assets/ocade.monitors-DanOQuDS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2313-7ixq/KYb0iGJTg8cpR/Yj/SvzZI\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 8979,
		"path": "../public/assets/ocade.monitors-DanOQuDS.js"
	},
	"/assets/ocade.notifications-DPHZM8ai.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"876-OE5K2dLvmQsCDWyuQfU/AUaTd8U\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 2166,
		"path": "../public/assets/ocade.notifications-DPHZM8ai.js"
	},
	"/assets/ocade.permissions-BYtwHOZ3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b18-3QOYcFVMuUdAOlR69uvQrBYae40\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 2840,
		"path": "../public/assets/ocade.permissions-BYtwHOZ3.js"
	},
	"/assets/ocade.projects-DretSJ93.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"69b9-L80hYMQJH5adENl+fxQE5jhxwmg\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 27065,
		"path": "../public/assets/ocade.projects-DretSJ93.js"
	},
	"/assets/ocade.search-BrfN0zMZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d4f-PzOKRHYgyXLhGm+4h71u3pcNtu0\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 7503,
		"path": "../public/assets/ocade.search-BrfN0zMZ.js"
	},
	"/assets/ocade.shared-DKB7JCHZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"85e-yB86AY1Sea0oWscCA4j85I1MaCA\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 2142,
		"path": "../public/assets/ocade.shared-DKB7JCHZ.js"
	},
	"/assets/ocade.studio-DH1tHYwP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1787-MA5CWYLFyTCvfX6TZILDtmJyRhE\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 6023,
		"path": "../public/assets/ocade.studio-DH1tHYwP.js"
	},
	"/assets/ocade.system-Blap_WDG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b6e-kj1iJKaiwSiuR7Xfrrl/ay8FOQ8\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 2926,
		"path": "../public/assets/ocade.system-Blap_WDG.js"
	},
	"/assets/ocade.tasks-DQG_vGtI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb-TeGz9N30Xhg5bUCXGxvj1jZ2oHY\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 187,
		"path": "../public/assets/ocade.tasks-DQG_vGtI.js"
	},
	"/assets/ocade.templates-CJnKR_XI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86e-IhuY2Hq7amgGa9juGnohzKQj7SI\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 2158,
		"path": "../public/assets/ocade.templates-CJnKR_XI.js"
	},
	"/assets/ocade.work-BX3ooay2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1212-jTQHPBhYg5MNeu/TQpAhorFTcF8\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 4626,
		"path": "../public/assets/ocade.work-BX3ooay2.js"
	},
	"/assets/offline-queue-DCgT3E8_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1022-+HPUrO/Ax7RUoDjtibyncAztEl8\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 4130,
		"path": "../public/assets/offline-queue-DCgT3E8_.js"
	},
	"/assets/onboarding-CmYiKAZE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2455-NkIJ+HkcoqOf5KLrQXyyU+9cJL4\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 9301,
		"path": "../public/assets/onboarding-CmYiKAZE.js"
	},
	"/assets/otp-DjLZa1Bh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf-a6ETjDOg4CEzdZQGVnx9xjn5ni4\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 975,
		"path": "../public/assets/otp-DjLZa1Bh.js"
	},
	"/assets/pack-registry-fS77fCZk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f715-Mh3LAkRXXtL36AJrgj7PXloQZh8\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 63253,
		"path": "../public/assets/pack-registry-fS77fCZk.js"
	},
	"/assets/paddle-CCxlHN2Q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"761-DQIYnyHBKcW1dMDGMbERwOuWkP0\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 1889,
		"path": "../public/assets/paddle-CCxlHN2Q.js"
	},
	"/assets/paired-credentials-BdTt8GO6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3a5-qzcTcelsb5m8nTY7thSSv7fJ9Gc\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 933,
		"path": "../public/assets/paired-credentials-BdTt8GO6.js"
	},
	"/assets/paired-desktop-CRlgl01N.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c19-v4ah0daiI0KvIzpnvg6G+PbgrJo\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 3097,
		"path": "../public/assets/paired-desktop-CRlgl01N.js"
	},
	"/assets/patch-EXKdKZzr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1211-HXETKTXza6inPnwdJDPOFn0Qzy0\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 4625,
		"path": "../public/assets/patch-EXKdKZzr.js"
	},
	"/assets/payments-readiness.functions-CGxMuNjA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"916-q4U0rrfLWiQFkGWuOnQeu0Zndnk\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 2326,
		"path": "../public/assets/payments-readiness.functions-CGxMuNjA.js"
	},
	"/assets/pdf-cdvfLdxt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"686a1-iBQrg6JO/2sxrao8tDZ4r4FMHT8\"",
		"mtime": "2026-08-28T01:53:53.701Z",
		"size": 427681,
		"path": "../public/assets/pdf-cdvfLdxt.js"
	},
	"/assets/permission-settings-Op_IKKjI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f962-+BvuV+CJBu+Na5Mj/NIZEWeLl9Q\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 63842,
		"path": "../public/assets/permission-settings-Op_IKKjI.js"
	},
	"/assets/preflight-BQ6wmuYC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bab-iPqmWZgwh3c3p4xM7AK8CAaLZxY\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 2987,
		"path": "../public/assets/preflight-BQ6wmuYC.js"
	},
	"/assets/press-B5ZuhHcn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c9e-oapHXRKLRpxcvmCForJN5xyfO6s\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 3230,
		"path": "../public/assets/press-B5ZuhHcn.js"
	},
	"/assets/pricing-CrntJgfr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e4e-qTofqxAu/ulJDRyzd7c3y5y5qgg\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 3662,
		"path": "../public/assets/pricing-CrntJgfr.js"
	},
	"/assets/pricing-DRQvgvwI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ac6-QaaWr2pkqOfNHV8VwCIOqgPu4u8\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 2758,
		"path": "../public/assets/pricing-DRQvgvwI.js"
	},
	"/assets/privacy-CcK_N32f.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f3-cdP56qXbdMgM3OvQSfz26rBr5VM\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 243,
		"path": "../public/assets/privacy-CcK_N32f.js"
	},
	"/assets/products.ocade-Co9QZM0Z.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a5e-Nnm79zqv2LPbOT3duYuvtyEYNls\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 6750,
		"path": "../public/assets/products.ocade-Co9QZM0Z.js"
	},
	"/assets/public-content-BHiEcfah.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dfd-n1E3dTQXkgClEA6Pyiwp19soZ/k\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 3581,
		"path": "../public/assets/public-content-BHiEcfah.js"
	},
	"/assets/public-identity-Bw1Z-EQ7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb8-Un27wWzmQzT61u5ivEC9J4ZUN8w\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 3e3,
		"path": "../public/assets/public-identity-Bw1Z-EQ7.js"
	},
	"/assets/research.functions-Dk3XuGeP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"165-uIeRCPT3R5Y5H2QNKFpNhfC1UmQ\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 357,
		"path": "../public/assets/research.functions-Dk3XuGeP.js"
	},
	"/assets/reset-password-CrXFWamh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"14ec-euLGxzNNi44klBL0mpbGaWVguEI\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 5356,
		"path": "../public/assets/reset-password-CrXFWamh.js"
	},
	"/assets/rolldown-runtime-DAXXjFlN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5-2encFCuTik/YJedDUFEd4geNCVs\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 1269,
		"path": "../public/assets/rolldown-runtime-DAXXjFlN.js"
	},
	"/assets/route-C9rir2zf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1495-sjtGdXweWTLkFFcjzixjkwg50UM\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 5269,
		"path": "../public/assets/route-C9rir2zf.js"
	},
	"/assets/route-Czk7uZCI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"497-KatP4WidpDJVpS5zWVtEue3FYwk\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 1175,
		"path": "../public/assets/route-Czk7uZCI.js"
	},
	"/assets/router-policy-CxUOW51h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5ed-xg0EophnrkdSnKmJEBbIn+4yJkU\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 1517,
		"path": "../public/assets/router-policy-CxUOW51h.js"
	},
	"/assets/routes-BxJAsQT5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"343c-pzg8UFmFjfTp+Svme/vbuHtDESY\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 13372,
		"path": "../public/assets/routes-BxJAsQT5.js"
	},
	"/assets/runs-zcbIVbtd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"120c-gAKEm0tvGJfTWHhm1aP6xHnDjSg\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 4620,
		"path": "../public/assets/runs-zcbIVbtd.js"
	},
	"/assets/runtime-activation-cP5-KXHY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"13c5-uwd71B1XS7KhTM3qw5WEs9zs31U\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 5061,
		"path": "../public/assets/runtime-activation-cP5-KXHY.js"
	},
	"/assets/search-BYz9HM2R.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2489-FVGvFpIVg2zQeeIC4pfatlInmNg\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 9353,
		"path": "../public/assets/search-BYz9HM2R.js"
	},
	"/assets/session-BTnEDRCv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"732-fpOcDUUeDtG5yE5t/SspZ9q+83k\"",
		"mtime": "2026-08-28T01:53:53.702Z",
		"size": 1842,
		"path": "../public/assets/session-BTnEDRCv.js"
	},
	"/assets/session-Bzv7Y6Qv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7fcf-eX/7muJRrV8+EIucZx5dm03+OQE\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 32719,
		"path": "../public/assets/session-Bzv7Y6Qv.js"
	},
	"/assets/settings-BOVdnjRw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"153a-yOtgP+HZf+qkkHc8gFOqTJf8MS0\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 5434,
		"path": "../public/assets/settings-BOVdnjRw.js"
	},
	"/assets/settings._section-BO6_rZHi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c636-f6trh7F30vnqz0u3P8u84XCeNVw\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 116278,
		"path": "../public/assets/settings._section-BO6_rZHi.js"
	},
	"/assets/settings.activity-tlm9BG9g.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b4e-WhP2fCtvIukFGqY/XVJP2TpkhaU\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 11086,
		"path": "../public/assets/settings.activity-tlm9BG9g.js"
	},
	"/assets/settings.appearance-DHUhbOYr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1bf2-+0fqEhrYLetFvQgQIul57sWOlUQ\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 7154,
		"path": "../public/assets/settings.appearance-DHUhbOYr.js"
	},
	"/assets/settings.billing-BbCpAmuC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"330c-zxU4gJevQb3rCx7dtGgMszKyYZQ\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 13068,
		"path": "../public/assets/settings.billing-BbCpAmuC.js"
	},
	"/assets/settings.browser-DYm4zCc5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c2c-UTRyr3/31jkn+C2D0OaYJQxyAZs\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 7212,
		"path": "../public/assets/settings.browser-DYm4zCc5.js"
	},
	"/assets/settings.devices-BH9sB-Rb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"22cb-1LVWb5lp+RxV4ybPPLG+f7tEphA\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 8907,
		"path": "../public/assets/settings.devices-BH9sB-Rb.js"
	},
	"/assets/settings.index-CUitERHh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"297a-2GhNlWkjUMhKUH/NJiMQXnh9sjY\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 10618,
		"path": "../public/assets/settings.index-CUitERHh.js"
	},
	"/assets/settings.mobile-C8akCOrK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7582-WDAuzmYHMeLzW4doNJ0v/s+wKoE\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 30082,
		"path": "../public/assets/settings.mobile-C8akCOrK.js"
	},
	"/assets/settings.privacy-mK-pMFW8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"284e-KxpFYJbZO63aQJHSITo71Pq2m4g\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 10318,
		"path": "../public/assets/settings.privacy-mK-pMFW8.js"
	},
	"/assets/settings.security-DOf_uXg8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dc6-/fdYejAnYZgaxaZhxYjsF10697U\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 11718,
		"path": "../public/assets/settings.security-DOf_uXg8.js"
	},
	"/assets/settings.skills-U_sKkg-j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b388-dkVqYa/sXEex6L/zreVVxNlThRk\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 45960,
		"path": "../public/assets/settings.skills-U_sKkg-j.js"
	},
	"/assets/settings.support-B1jlULCb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ec6-zvzMCU1Ms/sZObzqpysQxlzxVY8\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 7878,
		"path": "../public/assets/settings.support-B1jlULCb.js"
	},
	"/assets/settings.tasks-DDn_JoMv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c1-rX6KrKqD5GLZTOBHAB2RoLeqN1w\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 193,
		"path": "../public/assets/settings.tasks-DDn_JoMv.js"
	},
	"/assets/settings.usage-BjlAM5p_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23b8-3he6YpChIjPZ3Ge+R5I+dcAyrCk\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 9144,
		"path": "../public/assets/settings.usage-BjlAM5p_.js"
	},
	"/assets/settings.vault-oUMyfbvP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47d3-UDGIVhSv4AfSX650gU0SMA1TB8w\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 18387,
		"path": "../public/assets/settings.vault-oUMyfbvP.js"
	},
	"/assets/settings.voice-DQr-xhuP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"334d-y95CDuaxjlFWKFsWH4sn3/TO41M\"",
		"mtime": "2026-08-28T01:53:53.703Z",
		"size": 13133,
		"path": "../public/assets/settings.voice-DQr-xhuP.js"
	},
	"/assets/shared-browser-engine-UuUjWn18.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e7f-AtpPFRkx63nAcHUnvEirQrQR4NQ\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 3711,
		"path": "../public/assets/shared-browser-engine-UuUjWn18.js"
	},
	"/assets/skill-pack-DwMLcwaQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2753-XHCUWKZ88e+hhNVwEZPYasY6J3Y\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 10067,
		"path": "../public/assets/skill-pack-DwMLcwaQ.js"
	},
	"/assets/solar-data-Cr1sACCj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d14-o0ZWBWvM/3TWTeCGSydO65G0noI\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 3348,
		"path": "../public/assets/solar-data-Cr1sACCj.js"
	},
	"/assets/state-DxxN8SRV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7ee-m7T9F0E58f7Eq0OuZi5SIxxbCR8\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 2030,
		"path": "../public/assets/state-DxxN8SRV.js"
	},
	"/assets/status-BRGer3u0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c86-tRDHsQR1iNRR5mOCJs0AmoAPiYk\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 7302,
		"path": "../public/assets/status-BRGer3u0.js"
	},
	"/assets/store-BogwCS0B.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15b7-JI9e1D05yXA6IjpOYgjKQ+OjeBI\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 5559,
		"path": "../public/assets/store-BogwCS0B.js"
	},
	"/assets/styles-B3JMwU_4.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"2592f-uFZuuSFsgWKF+z8pUrwrfWZ/W6s\"",
		"mtime": "2026-08-28T01:53:53.706Z",
		"size": 153903,
		"path": "../public/assets/styles-B3JMwU_4.css"
	},
	"/assets/support-Ct8IrjRD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ce7-CkDHPqFRdS+xVfAsNcmxhWC2Gmw\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 3303,
		"path": "../public/assets/support-Ct8IrjRD.js"
	},
	"/assets/team-ByPgeHDz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"85f-TVW7lVk0ggFvBlLIxsI7yqA1MrI\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 2143,
		"path": "../public/assets/team-ByPgeHDz.js"
	},
	"/assets/terms-BVQFO7F5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f3-pDlK/GPQTgpr+h6neZtePt1fm2E\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 243,
		"path": "../public/assets/terms-BVQFO7F5.js"
	},
	"/assets/textarea-Br6iK_H9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"234-uW9t62aeo7FpFMUQxiJVsxrP0XE\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 564,
		"path": "../public/assets/textarea-Br6iK_H9.js"
	},
	"/assets/throttle-u3W15Ydi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52e-OKczYenMlzATtKhxZH8ZOOjjqt0\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 1326,
		"path": "../public/assets/throttle-u3W15Ydi.js"
	},
	"/assets/tier-benchmark-store-8QK9SMla.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"44c-xpEzkjz5potrc7uBtjtiAC+jtiU\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 1100,
		"path": "../public/assets/tier-benchmark-store-8QK9SMla.js"
	},
	"/assets/transcript-redaction-D5c695T6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2171-HFwB+uZW8B5DruIZUg6h1nqjzTQ\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 8561,
		"path": "../public/assets/transcript-redaction-D5c695T6.js"
	},
	"/assets/unavailable-reason-CxXmcH-x.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"33c-zMREJLSX5NtsDmAgMidxWmCLzIk\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 828,
		"path": "../public/assets/unavailable-reason-CxXmcH-x.js"
	},
	"/assets/unified-task-Ct-wJCIq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ebc-MwXHAywKZKs1267pQhiSHWE+Y0w\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 3772,
		"path": "../public/assets/unified-task-Ct-wJCIq.js"
	},
	"/assets/update-signature-Bgi-Ozhm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4df-dzu3Uyqwlyj1Zwx6HLm3HPkDwmU\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 1247,
		"path": "../public/assets/update-signature-Bgi-Ozhm.js"
	},
	"/assets/use-capabilities-D89nQ4Ke.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c02-+ouV/APTdUYsLUNReVbO3y+c2n0\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 11266,
		"path": "../public/assets/use-capabilities-D89nQ4Ke.js"
	},
	"/assets/use-chat-prefs-CZlk0HKL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"64c-sSembQAMF1+QX+mb0OPOs6Xl3Ec\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 1612,
		"path": "../public/assets/use-chat-prefs-CZlk0HKL.js"
	},
	"/assets/use-demo-CDigG9AR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"128-eDRXCL/+dYtxz19YGPyDkLTa5h4\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 296,
		"path": "../public/assets/use-demo-CDigG9AR.js"
	},
	"/assets/use-demo-session-B0JqcJGx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a4a-AGbb30PqS2IgwBXAnwEWLOSze4Q\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 6730,
		"path": "../public/assets/use-demo-session-B0JqcJGx.js"
	},
	"/assets/use-device-policy-wlBfrSBZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1405-AuvYxJnChUu860s4jSP0O+3/eMc\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 5125,
		"path": "../public/assets/use-device-policy-wlBfrSBZ.js"
	},
	"/assets/use-dictation-QWZfC7OM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"595d-BfEWYNFpeMSHr8Oyvk7zlAu9csA\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 22877,
		"path": "../public/assets/use-dictation-QWZfC7OM.js"
	},
	"/assets/use-limits-B2vt3-ru.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c08-8QxxYB3Lc6Ag2XZ6BKDqL9bIN1g\"",
		"mtime": "2026-08-28T01:53:53.704Z",
		"size": 3080,
		"path": "../public/assets/use-limits-B2vt3-ru.js"
	},
	"/assets/use-local-engine-DC6_rYk3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d1a-Vuhxo11qf9fD1S5gFGUuf6rDIus\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 3354,
		"path": "../public/assets/use-local-engine-DC6_rYk3.js"
	},
	"/assets/use-mission-brain-BFY30G-W.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1579d-wB4rFL8KQQNQujhPuRFFDHxrTT8\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 87965,
		"path": "../public/assets/use-mission-brain-BFY30G-W.js"
	},
	"/assets/use-online-CXunBi7G.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c8-sxxRaI3YIhYUU8NqANt44VxjCSU\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 456,
		"path": "../public/assets/use-online-CXunBi7G.js"
	},
	"/assets/use-settings-access-BtFlRhWI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-UiD9a75ZbMEZeqVYT1xGruqI6UY\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 251,
		"path": "../public/assets/use-settings-access-BtFlRhWI.js"
	},
	"/assets/use-shell-DD7w3eib.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ca-k7zrXWFg3T5sFkvJyHMWORwFAgg\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 202,
		"path": "../public/assets/use-shell-DD7w3eib.js"
	},
	"/assets/use-voice-prefs-C3YcXQQR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b08-7CHYJ1t7TSPh8Da8FEntqRz6CaA\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 2824,
		"path": "../public/assets/use-voice-prefs-C3YcXQQR.js"
	},
	"/assets/vault-BPpCjfwb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1469-0KaYvAbsLrSSPGNYW9bchoMKFDI\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 5225,
		"path": "../public/assets/vault-BPpCjfwb.js"
	},
	"/assets/vendor-mammoth-Dpq0khGw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"79667-yat456Rdzc89mGmuoEmeYx6S17E\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 497255,
		"path": "../public/assets/vendor-mammoth-Dpq0khGw.js"
	},
	"/assets/vendor-markdown-CJdAOkbM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c329-jkqcjH7TYhNPRSsO0D4q0vleV/s\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 115497,
		"path": "../public/assets/vendor-markdown-CJdAOkbM.js"
	},
	"/assets/vendor-react-CX2mWblQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2e56d-qrX6GvMoYNkdEag7AoGUlpZrTKw\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 189805,
		"path": "../public/assets/vendor-react-CX2mWblQ.js"
	},
	"/assets/vendor-runtime-Czpn1I53.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4ac-sE+5KsaRXTMfwOfrOATQajMSGV4\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 1196,
		"path": "../public/assets/vendor-runtime-Czpn1I53.js"
	},
	"/assets/vendor-supabase-DSyywpEH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31ffe-LFSgZ+b88LeCDCMCAFoHHin+614\"",
		"mtime": "2026-08-28T01:53:53.705Z",
		"size": 204798,
		"path": "../public/assets/vendor-supabase-DSyywpEH.js"
	},
	"/assets/vendor-ui-BU9GUeSC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16455-ycOJOLQ8Ke+zXS/xw5KNPS2+GEs\"",
		"mtime": "2026-08-28T01:53:53.706Z",
		"size": 91221,
		"path": "../public/assets/vendor-ui-BU9GUeSC.js"
	},
	"/assets/webllm.server-DNYK_aeU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e1-Us1T5KPTXPRBgWxerF+xOrVbVS4\"",
		"mtime": "2026-08-28T01:53:53.706Z",
		"size": 225,
		"path": "../public/assets/webllm.server-DNYK_aeU.js"
	},
	"/assets/webllm.worker-BYUasHjv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6-gzTuXHvqWN3WhQkR86gwLh/4ICk\"",
		"mtime": "2026-08-28T01:53:53.724Z",
		"size": 166,
		"path": "../public/assets/webllm.worker-BYUasHjv.js"
	},
	"/assets/wllama-CfujTeeK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3a-XHS6PgwOix/pzsr2L7s2oAAni5k\"",
		"mtime": "2026-08-28T01:53:53.706Z",
		"size": 58,
		"path": "../public/assets/wllama-CfujTeeK.js"
	},
	"/assets/wllama-Dk3sV4-d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"48b4e-XVvVylqXX1LnpZS7y5u/rSV5znE\"",
		"mtime": "2026-08-28T01:53:53.706Z",
		"size": 297806,
		"path": "../public/assets/wllama-Dk3sV4-d.js"
	},
	"/models/README.md": {
		"type": "text/markdown; charset=utf-8",
		"etag": "\"639-kNCQYFm5MybzQOVkkzMUoMWvI3c\"",
		"mtime": "2026-08-28T01:53:58.465Z",
		"size": 1593,
		"path": "../public/models/README.md"
	},
	"/assets/wllama-m-NqGU8W.wasm": {
		"type": "application/wasm",
		"etag": "\"74d449-/5qFKdxtVjp8khmNdIXiGMaJl+Y\"",
		"mtime": "2026-08-28T01:53:53.706Z",
		"size": 7656521,
		"path": "../public/assets/wllama-m-NqGU8W.wasm"
	}
};
//#endregion
//#region #nitro/virtual/public-assets-node
function readAsset(id) {
	const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
	return promises.readFile(resolve(serverDir, public_assets_data_default[id].path));
}
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
function getAsset(id) {
	return public_assets_data_default[id];
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/static.mjs
var METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
var EncodingMap = {
	gzip: ".gz",
	br: ".br",
	zstd: ".zst"
};
var static_default = defineHandler((event) => {
	if (event.req.method && !METHODS.has(event.req.method)) return;
	let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
	let asset;
	const encodings = [...(event.req.headers.get("accept-encoding") || "").split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(), ""];
	for (const encoding of encodings) for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
		const _asset = getAsset(_id);
		if (_asset) {
			asset = _asset;
			id = _id;
			break;
		}
	}
	if (!asset) {
		if (isPublicAssetURL(id)) {
			event.res.headers.delete("Cache-Control");
			throw new HTTPError({ status: 404 });
		}
		return;
	}
	if (encodings.length > 1) event.res.headers.append("Vary", "Accept-Encoding");
	if (event.req.headers.get("if-none-match") === asset.etag) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	const ifModifiedSinceH = event.req.headers.get("if-modified-since");
	const mtimeDate = new Date(asset.mtime);
	if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	if (asset.type) event.res.headers.set("Content-Type", asset.type);
	if (asset.etag && !event.res.headers.has("ETag")) event.res.headers.set("ETag", asset.etag);
	if (asset.mtime && !event.res.headers.has("Last-Modified")) event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
	if (asset.encoding && !event.res.headers.has("Content-Encoding")) event.res.headers.set("Content-Encoding", asset.encoding);
	if (asset.size > 0 && !event.res.headers.has("Content-Length")) event.res.headers.set("Content-Length", asset.size.toString());
	return readAsset(id);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_uoO2oV = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_uoO2oV
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
var globalMiddleware = [toEventHandler(static_default)].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~middleware"].push(...globalMiddleware);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		middleware.push(...h3App["~middleware"]);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/hooks.mjs
function _captureError(error, type) {
	console.error(`[${type}]`, error);
	useNitroApp().captureError?.(error, { tags: [type] });
}
function trapUnhandledErrors() {
	process.on("unhandledRejection", (error) => _captureError(error, "unhandledRejection"));
	process.on("uncaughtException", (error) => _captureError(error, "uncaughtException"));
}
//#endregion
//#region #nitro/virtual/tracing
var tracingSrvxPlugins = [];
//#endregion
//#region node_modules/nitro/dist/presets/node/runtime/node-server.mjs
var _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
var port = Number.isNaN(_parsedPort) ? 3e3 : _parsedPort;
var host = process.env.NITRO_HOST || process.env.HOST;
var cert = process.env.NITRO_SSL_CERT;
var key = process.env.NITRO_SSL_KEY;
var nitroApp = useNitroApp();
serve({
	port,
	hostname: host,
	tls: cert && key ? {
		cert,
		key
	} : void 0,
	fetch: nitroApp.fetch,
	plugins: [...tracingSrvxPlugins]
});
trapUnhandledErrors();
var node_server_default = {};
//#endregion
export { node_server_default as default };
