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
	"/favicon.ico": {
		"type": "image/vnd.microsoft.icon",
		"etag": "\"fb4-0SojhBjTCdtondWh2OQc0bbHnA8\"",
		"mtime": "2026-08-28T01:19:29.078Z",
		"size": 4020,
		"path": "../public/favicon.ico"
	},
	"/manifest.webmanifest": {
		"type": "application/manifest+json",
		"etag": "\"2b9-7HLG94qjlshQnx59E+/ByIlfznI\"",
		"mtime": "2026-08-28T01:19:29.078Z",
		"size": 697,
		"path": "../public/manifest.webmanifest"
	},
	"/offline.html": {
		"type": "text/html; charset=utf-8",
		"etag": "\"a05-pzaEkxiSga8R/E5QnxVTL9w7Wcc\"",
		"mtime": "2026-08-28T01:19:29.078Z",
		"size": 2565,
		"path": "../public/offline.html"
	},
	"/sw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"463c-yzwjMtAFXnY1o6e219yDWz35vxI\"",
		"mtime": "2026-08-28T01:19:29.078Z",
		"size": 17980,
		"path": "../public/sw.js"
	},
	"/apple-touch-icon.png": {
		"type": "image/png",
		"etag": "\"482e-AHyOEKNRVkt/DeKr9FzKKjHuYgE\"",
		"mtime": "2026-08-28T01:19:29.078Z",
		"size": 18478,
		"path": "../public/apple-touch-icon.png"
	},
	"/brand/ocade-carcc-wordmark.png": {
		"type": "image/png",
		"etag": "\"7c79a-hDONFyhF6C6vVUP8oUwl+uIk1Hs\"",
		"mtime": "2026-08-28T01:19:29.076Z",
		"size": 509850,
		"path": "../public/brand/ocade-carcc-wordmark.png"
	},
	"/cursors/caera-black.svg": {
		"type": "image/svg+xml",
		"etag": "\"e3-cOVBa1MjhDbN4IhGTA4fG6luTC0\"",
		"mtime": "2026-08-28T01:19:29.076Z",
		"size": 227,
		"path": "../public/cursors/caera-black.svg"
	},
	"/cursors/caera-white.svg": {
		"type": "image/svg+xml",
		"etag": "\"e3-K8Ph3SHLSn3xKyibe7XMGertmUU\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 227,
		"path": "../public/cursors/caera-white.svg"
	},
	"/fonts/OFL-InstrumentSerif.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"1135-gDiCV59Tkow3oVdZoNLGxJNQ2gw\"",
		"mtime": "2026-08-28T01:19:29.076Z",
		"size": 4405,
		"path": "../public/fonts/OFL-InstrumentSerif.txt"
	},
	"/fonts/OFL-Inter.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"1119-zdAbfmjbgdZj8cOCC298QAKJAN0\"",
		"mtime": "2026-08-28T01:19:29.078Z",
		"size": 4377,
		"path": "../public/fonts/OFL-Inter.txt"
	},
	"/fonts/OFL-JetBrainsMono.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"112f-L7YAWH1CBVh/6187FKNT6l1P76A\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 4399,
		"path": "../public/fonts/OFL-JetBrainsMono.txt"
	},
	"/fonts/README.md": {
		"type": "text/markdown; charset=utf-8",
		"etag": "\"721-454yencTVI81kp700tfqHRuG7dE\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 1825,
		"path": "../public/fonts/README.md"
	},
	"/fonts/instrument-serif-italic-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"5670-JObJnKCLHlrMks8QbFhvSR7RUVE\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 22128,
		"path": "../public/fonts/instrument-serif-italic-latin.woff2"
	},
	"/fonts/instrument-serif-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"5228-N930ZbvMJSd2o33PKBeaPKWQNjs\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 21032,
		"path": "../public/fonts/instrument-serif-latin.woff2"
	},
	"/fonts/inter-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"bc80-8R1ym7Ck2DUNLqPQ/AYs9u8tUpg\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 48256,
		"path": "../public/fonts/inter-latin.woff2"
	},
	"/fonts/jetbrains-mono-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"9dd4-5yd+cUUhzrXxdMyYebUeD0qml1M\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 40404,
		"path": "../public/fonts/jetbrains-mono-latin.woff2"
	},
	"/assets/AppShell-D5c5570v.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb-wwDGSHiTF4z2AClGg03N7gzE1rM\"",
		"mtime": "2026-08-28T01:19:24.554Z",
		"size": 187,
		"path": "../public/assets/AppShell-D5c5570v.js"
	},
	"/assets/AuthShell-CslsX-06.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"886-OAYX0VgHiywHq/8jykXsa7Et6mw\"",
		"mtime": "2026-08-28T01:19:24.554Z",
		"size": 2182,
		"path": "../public/assets/AuthShell-CslsX-06.js"
	},
	"/assets/BrandMark-CzrSv4bp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"38a-L1YgB/vnJKBYqU/737wPfUhcEko\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 906,
		"path": "../public/assets/BrandMark-CzrSv4bp.js"
	},
	"/assets/CapabilityBadge-w-8whZSG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9bd-o5zw14VpWhC6UpwdGnCwjN/tEqs\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 2493,
		"path": "../public/assets/CapabilityBadge-w-8whZSG.js"
	},
	"/assets/ChatSidebar-6wLtEzA5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"100f-Y5LxYRk2KcpxqrNNciMo+UnIF4o\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 4111,
		"path": "../public/assets/ChatSidebar-6wLtEzA5.js"
	},
	"/assets/ComingLater-DQShoWAz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4dc-3omEOVM0OGl1GDEGbva/xggWJEk\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 1244,
		"path": "../public/assets/ComingLater-DQShoWAz.js"
	},
	"/assets/DiagnosticsPanel-DN4wYOzz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3313-BnB8aMAfE/7l1VgGpNrLVWyQYSY\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 13075,
		"path": "../public/assets/DiagnosticsPanel-DN4wYOzz.js"
	},
	"/assets/EmptyState-CT2XNnAh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"202-t6dghjDQhPTjrPD5kwPKgJm2zPk\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 514,
		"path": "../public/assets/EmptyState-CT2XNnAh.js"
	},
	"/brand/ocade-carcc-mark.png": {
		"type": "image/png",
		"etag": "\"a4249-vxI0sbhEiBkI+cWc8Av0Y58BB3A\"",
		"mtime": "2026-08-28T01:19:29.076Z",
		"size": 672329,
		"path": "../public/brand/ocade-carcc-mark.png"
	},
	"/assets/GestureControlPanel-BoV7bAnU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16ab-zXaFmz8BtMVzaPemNEVlgsQx1WA\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 5803,
		"path": "../public/assets/GestureControlPanel-BoV7bAnU.js"
	},
	"/assets/GlassPanel-BZ4LOupo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"225-0KedtDAPoAyspMwldmR3bXeliGI\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 549,
		"path": "../public/assets/GlassPanel-BZ4LOupo.js"
	},
	"/assets/LivingIntelligenceBackdrop-Bxxx8eAL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19c3-Mk8v5s0iTy76d+CKbLasxf49u04\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 6595,
		"path": "../public/assets/LivingIntelligenceBackdrop-Bxxx8eAL.js"
	},
	"/assets/LocalEngineControl-Bfe_Ttwm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e4d-Fzwpxnrf9vjZz4s16J/jOaC1rb4\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 7757,
		"path": "../public/assets/LocalEngineControl-Bfe_Ttwm.js"
	},
	"/assets/LocalIntelligenceControl-Dai0ERSX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1484-oqJMBNTsPkKUZ9jYqlQIOpND4A0\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 5252,
		"path": "../public/assets/LocalIntelligenceControl-Dai0ERSX.js"
	},
	"/assets/OcadeOrb-CkH-_w22.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a4-jUGfsP/9NoLvspZf1XEc0Ex59fI\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 1444,
		"path": "../public/assets/OcadeOrb-CkH-_w22.js"
	},
	"/assets/OcadeOrbCanvas-CzLdoQZs.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b0a-ZoBOeg+p11p/vrj8eFiUmmhISSk\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 6922,
		"path": "../public/assets/OcadeOrbCanvas-CzLdoQZs.js"
	},
	"/assets/OcadeCompanion-BFNicnD-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5e5-0HAanTMslfPYuUDMRV0Oo5n5Rvw\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 1509,
		"path": "../public/assets/OcadeCompanion-BFNicnD-.js"
	},
	"/assets/PageHeader-C0zSkLIw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ce-iho/5zo8cTFQLp9/yUhwECi4cW0\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 718,
		"path": "../public/assets/PageHeader-C0zSkLIw.js"
	},
	"/assets/PerformanceFallbackNotice-D7ltCwhA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"81f-QRBkXjIXkUlbAXzbcHG9whNFgcw\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 2079,
		"path": "../public/assets/PerformanceFallbackNotice-D7ltCwhA.js"
	},
	"/assets/PlanComparison-R2cM21Uj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"111e-qVLHuj2bhphZk1Owzkn7RqrLlA0\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 4382,
		"path": "../public/assets/PlanComparison-R2cM21Uj.js"
	},
	"/assets/SettingsGate-DG1LDN0i.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"727-LjBTM1mcpexDiK+v70i5MEiLJm4\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 1831,
		"path": "../public/assets/SettingsGate-DG1LDN0i.js"
	},
	"/assets/SetupRequiredState-Do6auW4Z.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3d8-66uWQrDZUDBaKtqZL/7ZB0Zj0jY\"",
		"mtime": "2026-08-28T01:19:24.555Z",
		"size": 984,
		"path": "../public/assets/SetupRequiredState-Do6auW4Z.js"
	},
	"/assets/StatusBadge-C7cV78sg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"658-RhYbqXxfxilvZkhOpoy+C6NKnYA\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 1624,
		"path": "../public/assets/StatusBadge-C7cV78sg.js"
	},
	"/assets/TruthfulFailurePanel-Vl4H8sMA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"784-5jmSFTtKw17WrGDLqohhjdUyp94\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 1924,
		"path": "../public/assets/TruthfulFailurePanel-Vl4H8sMA.js"
	},
	"/assets/TasksWorkspace-CZmO6XAn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"908c-FapHdRlnPU0kRMho1zlsBqc1Pn4\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 37004,
		"path": "../public/assets/TasksWorkspace-CZmO6XAn.js"
	},
	"/assets/VaultUnlockCard-CyE6q-F5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ff6-2esknwtWUPjELjlpPauTQ1CBCvs\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 4086,
		"path": "../public/assets/VaultUnlockCard-CyE6q-F5.js"
	},
	"/assets/WorkspaceShell-Mo8XbRJ9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6cbb-piqaGqKpX0FK14sLZnL+CxrLm5U\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 27835,
		"path": "../public/assets/WorkspaceShell-Mo8XbRJ9.js"
	},
	"/assets/_._lovable.oauth.consent-BJ1_Djfo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66d-Lmz0l4tWAe6BFtfb60EQzEJhbTA\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 1645,
		"path": "../public/assets/_._lovable.oauth.consent-BJ1_Djfo.js"
	},
	"/assets/_._lovable.oauth.consent-Bra60dod.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"18e-3QjMyqJG0iGPGJYi0kiTCCUDlkM\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 398,
		"path": "../public/assets/_._lovable.oauth.consent-Bra60dod.js"
	},
	"/assets/about-wZw21qNB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"188c-CriFtSzXTlJT5F69RbmnPt1hUHQ\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 6284,
		"path": "../public/assets/about-wZw21qNB.js"
	},
	"/assets/access-denied-CVdQNoRr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"624-7d8CU6+9gHMtx0r42RW+rwJWQug\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 1572,
		"path": "../public/assets/access-denied-CVdQNoRr.js"
	},
	"/assets/actions-CdLxPdNd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"275c-tUwxhpWdM0pA0S4p3atsAsL7Sq4\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 10076,
		"path": "../public/assets/actions-CdLxPdNd.js"
	},
	"/assets/adapter-Bmw1IsNe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"12a-5/RewF0d9UP0xXkUa9BN4530hpI\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 298,
		"path": "../public/assets/adapter-Bmw1IsNe.js"
	},
	"/assets/SolarSystem-uoqlUt65.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86b9f-iJITuar8XwkFzfTt3MkRz1Kj5/Y\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 551839,
		"path": "../public/assets/SolarSystem-uoqlUt65.js"
	},
	"/assets/admin.launch-gate-DInB9gVz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a97-LQejBn305QuqeBuli5TatVtPfaM\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 23191,
		"path": "../public/assets/admin.launch-gate-DInB9gVz.js"
	},
	"/assets/admin.payments-checklist-DNLZIkup.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26c8-M6zXoJDBlq+YwkwMmz4Gk9n99Ls\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 9928,
		"path": "../public/assets/admin.payments-checklist-DNLZIkup.js"
	},
	"/assets/admin.support-BQtznuY1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"170f-qE4v7Br0qQFTC39g4i0/tf2pLck\"",
		"mtime": "2026-08-28T01:19:24.556Z",
		"size": 5903,
		"path": "../public/assets/admin.support-BQtznuY1.js"
	},
	"/assets/admin.users-BBFtaG9a.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16a8-NIokkeUkuw34l7GwaIv4ofK7cgY\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 5800,
		"path": "../public/assets/admin.users-BBFtaG9a.js"
	},
	"/assets/agent.functions-un_MtrM2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c1-Q0I+RvPARLuYCPbq3xHZwyYSVno\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 705,
		"path": "../public/assets/agent.functions-un_MtrM2.js"
	},
	"/assets/auth-DQqIbfZN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5738-qjVnXUjlHyKx3epBNKJJ4AtxKWc\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 22328,
		"path": "../public/assets/auth-DQqIbfZN.js"
	},
	"/assets/auth-middleware-BPtORiZx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4e-5mPwXxkN0+ZcZT9n0hnX4ZDpNEs\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 78,
		"path": "../public/assets/auth-middleware-BPtORiZx.js"
	},
	"/assets/auth.callback-pC-4IJf9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"abc-c31m5mUDcwU1Rq2pwh0+Qn2hGW4\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 2748,
		"path": "../public/assets/auth.callback-pC-4IJf9.js"
	},
	"/assets/blog-BGf_5ZiP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9c-vFpRb9yHlns/eK0sHHEqYwBW4Aw\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 156,
		"path": "../public/assets/blog-BGf_5ZiP.js"
	},
	"/assets/blog._slug-DH48dA36.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eea-6eYObDlFbV85kvFmHfg3yezpzbs\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 3818,
		"path": "../public/assets/blog._slug-DH48dA36.js"
	},
	"/assets/auth.verify-Bv-1Qu-Y.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1040-zWFDtWSEiErhoBR1rT53t1UnpA4\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 4160,
		"path": "../public/assets/auth.verify-Bv-1Qu-Y.js"
	},
	"/assets/blog.index-CDJuTW5Q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d2c-YVgIadY5IkGim2Aw28VxdYoxEds\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 3372,
		"path": "../public/assets/blog.index-CDJuTW5Q.js"
	},
	"/assets/browser-catalogue-DLxJMBU5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eb7-X0o+iONa9b18HaYpBz7geFkysy0\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 3767,
		"path": "../public/assets/browser-catalogue-DLxJMBU5.js"
	},
	"/assets/browser-wasm-DWKOEebJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1432-AxRA7i6s++aZN5aQTGqtbNpd6bo\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 5170,
		"path": "../public/assets/browser-wasm-DWKOEebJ.js"
	},
	"/assets/browser-webgpu-D2qus02e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1197-cn6Y8qa0TNTq3fu3q8Prqq/4qF0\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 4503,
		"path": "../public/assets/browser-webgpu-D2qus02e.js"
	},
	"/assets/cania-vrQbrntH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10b-DjvkiyRLI8+3jliupUtYHNIfob4\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 267,
		"path": "../public/assets/cania-vrQbrntH.js"
	},
	"/assets/careers-PjKbE-jh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7bc-XYT8MZ64xUuqOWxK2LjfW+NfpNY\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 1980,
		"path": "../public/assets/careers-PjKbE-jh.js"
	},
	"/assets/chat-citation-store-M_3d5V2j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c39-b7Li7a473VJcdIXAd3OsyvbO0qQ\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 7225,
		"path": "../public/assets/chat-citation-store-M_3d5V2j.js"
	},
	"/assets/chat-output-flow-DIpihmu3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c47-1jA1WJBS5V5qyHujBFPhXZxp81s\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 3143,
		"path": "../public/assets/chat-output-flow-DIpihmu3.js"
	},
	"/assets/checkout.success-D4kbQjcP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b7c-c79I8sdmgfh5zm2d3f9jIR5Z8Rw\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 2940,
		"path": "../public/assets/checkout.success-D4kbQjcP.js"
	},
	"/assets/company-Dy76U6rT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"de2-e2s8Joqk42tyL+IwXT32EmMRcLI\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 3554,
		"path": "../public/assets/company-Dy76U6rT.js"
	},
	"/assets/compliance-log.functions-ChWV8NyI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-xv5nfswOPg4Kp7KPMU+PbqSeXsY\"",
		"mtime": "2026-08-28T01:19:24.557Z",
		"size": 251,
		"path": "../public/assets/compliance-log.functions-ChWV8NyI.js"
	},
	"/assets/computer-use-settings-EGzAqqOS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a0f-2d9maaE65OOhpMLiPiR46hqqTb4\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 2575,
		"path": "../public/assets/computer-use-settings-EGzAqqOS.js"
	},
	"/assets/data-rights-Zadell_7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e06-NTRG9jIahd1SQBYAPuSsIdWmizg\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 3590,
		"path": "../public/assets/data-rights-Zadell_7.js"
	},
	"/assets/demo-BuifD78k.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3c1-OJ3SU1poCAthmUPYh0K4xl7ltwE\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 961,
		"path": "../public/assets/demo-BuifD78k.js"
	},
	"/assets/demo.control-BYA99YUy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"991-R6GCGQ7yKZIAJa00kBm8nt/dj9c\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 2449,
		"path": "../public/assets/demo.control-BYA99YUy.js"
	},
	"/assets/demo.settings-B_2VIGlF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"edb-cUQ5BMuttaebWl97OYc27E7+1bg\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 3803,
		"path": "../public/assets/demo.settings-B_2VIGlF.js"
	},
	"/assets/desktop-bridge-tO-QQqy8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eaa-Q4DpW6eraI1WfH5I18f6/If9c70\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 3754,
		"path": "../public/assets/desktop-bridge-tO-QQqy8.js"
	},
	"/assets/demo.ocade-whS_AP9X.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7e1a-3Gj0SS3c7k5TxDgEo/rLXJa3vRo\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 32282,
		"path": "../public/assets/demo.ocade-whS_AP9X.js"
	},
	"/assets/devices-F8brq2Wj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e0f-nL0FtZMRckaOGZyBf4DZba2usnE\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 3599,
		"path": "../public/assets/devices-F8brq2Wj.js"
	},
	"/assets/download-B-CebTIk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1027-EYevQuykpiJUZiZJfRGBvteEQWU\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 4135,
		"path": "../public/assets/download-B-CebTIk.js"
	},
	"/assets/execute-BaUQDABw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1213a-qlCo+SGzDXFEKzVkcgmO4n6wmcw\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 74042,
		"path": "../public/assets/execute-BaUQDABw.js"
	},
	"/assets/faq-wkwcHezk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1420-Ad9XYucUz3Mud8JryNkcAc/SGg8\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 5152,
		"path": "../public/assets/faq-wkwcHezk.js"
	},
	"/assets/ficia-Dz0ZndT7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"105-/oNL1oc5PE5M64efxCxJUOmFMg8\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 261,
		"path": "../public/assets/ficia-Dz0ZndT7.js"
	},
	"/assets/fixed-model-Ckyk5kJ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"895-SahTIID3v5hvHEb68F/9chPipFk\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 2197,
		"path": "../public/assets/fixed-model-Ckyk5kJ8.js"
	},
	"/assets/founder.haans-antoni-TzOcvFg1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c45-hKubCY+4eK91dRcfeFWdYbnDN7w\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 3141,
		"path": "../public/assets/founder.haans-antoni-TzOcvFg1.js"
	},
	"/assets/index-CC4mhrgd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7e98a-+ipBc8WXFTgwXKEEZCUUnMcAtHs\"",
		"mtime": "2026-08-28T01:19:24.548Z",
		"size": 518538,
		"path": "../public/assets/index-CC4mhrgd.js"
	},
	"/assets/input-Cr41BVUT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"29a-8ItCPk32TzOPq6umG4d7VOdseHc\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 666,
		"path": "../public/assets/input-Cr41BVUT.js"
	},
	"/assets/installation-browser-DZvEX4FM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6e8c-IwduQNBw0xyizIV+IlRIg6H800Q\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 28300,
		"path": "../public/assets/installation-browser-DZvEX4FM.js"
	},
	"/assets/local-projects-j1YH7OSg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1948-5f8a4xRB6DmrYhsTxs6RTemSPDY\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 6472,
		"path": "../public/assets/local-projects-j1YH7OSg.js"
	},
	"/assets/local-runtime.functions-WI1do0fQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1080-8XCDkRdyNxqUDvucMwJIHznbA3M\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 4224,
		"path": "../public/assets/local-runtime.functions-WI1do0fQ.js"
	},
	"/assets/madee-D5c-QMNK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"100-YckD0oU5ZKX/MjbpS84hNoagr4M\"",
		"mtime": "2026-08-28T01:19:24.558Z",
		"size": 256,
		"path": "../public/assets/madee-D5c-QMNK.js"
	},
	"/assets/methods-Bmi_DJG2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2f0-5wV1FEI7fp4qwbFT2LJxidvgKAY\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 752,
		"path": "../public/assets/methods-Bmi_DJG2.js"
	},
	"/assets/model-download-WPtDDhP_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"129a-0NYA5ZOkysFUID3TPL95/RYlAhI\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 4762,
		"path": "../public/assets/model-download-WPtDDhP_.js"
	},
	"/assets/model-store--TDaCIKO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11f0-/yWxzn0iTXzT8t6LmvAx+tFz+Mg\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 4592,
		"path": "../public/assets/model-store--TDaCIKO.js"
	},
	"/assets/model-vault-DbVu5A8u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e9e-Xiz8k0lOcgQqCNoSaKGZ00BfSMw\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 3742,
		"path": "../public/assets/model-vault-DbVu5A8u.js"
	},
	"/assets/oauth-errors-D0R59ozT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8bf-aaAHKGe4/rm947FH7hWLOpTnBqQ\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 2239,
		"path": "../public/assets/oauth-errors-D0R59ozT.js"
	},
	"/assets/ocade-CxFxUn2d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"df-YgEEFhfE3CZxeoraT2wwOngYVzU\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 223,
		"path": "../public/assets/ocade-CxFxUn2d.js"
	},
	"/assets/ocade-allowance-BFQspkmM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52d-tfyMxsfopdsf6cD91j7mgDR2ZCk\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 1325,
		"path": "../public/assets/ocade-allowance-BFQspkmM.js"
	},
	"/assets/ocade-automations.functions-CR9jzRGT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"630-5tcYk5yiHPtD7Sdx7HtmKAN933A\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 1584,
		"path": "../public/assets/ocade-automations.functions-CR9jzRGT.js"
	},
	"/assets/ocade-identity-BdM79R6-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"175-m+CJ2IY7faIQPIyy+1b+gB+G7Q8\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 373,
		"path": "../public/assets/ocade-identity-BdM79R6-.js"
	},
	"/assets/ocade-local-DMcdYpaT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15e7-44KXXrBxu4yEIXXATmyAb51HtNY\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 5607,
		"path": "../public/assets/ocade-local-DMcdYpaT.js"
	},
	"/assets/ocade-projects.functions-BrPAhhiF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25b4-x7mrn+27iuVMYPpch7sCQMvbwCM\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 9652,
		"path": "../public/assets/ocade-projects.functions-BrPAhhiF.js"
	},
	"/assets/ocade-usage.functions-Cf2WZcK_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e9-Br7Z54Wb5E55qT5FdTBxZwdsIcY\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 233,
		"path": "../public/assets/ocade-usage.functions-Cf2WZcK_.js"
	},
	"/assets/ocade.activity-Cd8RPIB5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad4-A/erfU3iwx6ho8V2KKeDkXpOV1g\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 2772,
		"path": "../public/assets/ocade.activity-Cd8RPIB5.js"
	},
	"/assets/ocade.artifacts-C6cByFHa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"211e-Cb+3wMb8Pj476wkNL7VlBodm8m4\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 8478,
		"path": "../public/assets/ocade.artifacts-C6cByFHa.js"
	},
	"/assets/ocade.code-BVsAwYlo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"af01-LWFkx/Fk5bwZJdE1qL0mlTuiU/A\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 44801,
		"path": "../public/assets/ocade.code-BVsAwYlo.js"
	},
	"/assets/ocade.connectors-DHsZdq_h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"949-5vqQ+KD07OYbptlelGFIg9xEfLw\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 2377,
		"path": "../public/assets/ocade.connectors-DHsZdq_h.js"
	},
	"/assets/ocade.devices-eSWeii_g.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eb3-nkOJDyleRLfKuSjbiARYSDse1Ss\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 3763,
		"path": "../public/assets/ocade.devices-eSWeii_g.js"
	},
	"/assets/ocade.health-CYk8WAje.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4d2-Fd/YNJ3MAarR0aGmkpYDwUY23yU\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 1234,
		"path": "../public/assets/ocade.health-CYk8WAje.js"
	},
	"/assets/ocade.inbox-D2TjMhUb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fed-Sum8hqV1wc3TnRvm84dBiZBEqhQ\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 4077,
		"path": "../public/assets/ocade.inbox-D2TjMhUb.js"
	},
	"/assets/ocade.automations-CJJp6Y5b.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ea97-KGgc7wDOumQ4KPtaMjkYeVN2fYE\"",
		"mtime": "2026-08-28T01:19:24.559Z",
		"size": 60055,
		"path": "../public/assets/ocade.automations-CJJp6Y5b.js"
	},
	"/assets/ocade.index-CEsJ74EA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"46125-i/lcmlTZ9yYjVRISbw4pAoR83ks\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 287013,
		"path": "../public/assets/ocade.index-CEsJ74EA.js"
	},
	"/assets/ocade.knowledge-BvztFkWx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a04-i0yl6s6xOc/5gysThTaq0MncZtM\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 2564,
		"path": "../public/assets/ocade.knowledge-BvztFkWx.js"
	},
	"/assets/ocade.lab-DCTIjbE5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1bc6b-UYhzsKwuk+2Nb4Vr/fPecFVKdrQ\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 113771,
		"path": "../public/assets/ocade.lab-DCTIjbE5.js"
	},
	"/assets/ocade.models-BM1XNQTD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a31-JDHHGQAs2HpJCboxe1HvO8D2FX0\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 2609,
		"path": "../public/assets/ocade.models-BM1XNQTD.js"
	},
	"/assets/ocade.monitors-DYWZrvRq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2313-m755ston7jXOyaaC4DZz5HShUTk\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 8979,
		"path": "../public/assets/ocade.monitors-DYWZrvRq.js"
	},
	"/assets/ocade.notifications-BJaElS6l.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"876-P3ojaIkhykkya3etsoE2C1ZkJKM\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 2166,
		"path": "../public/assets/ocade.notifications-BJaElS6l.js"
	},
	"/assets/ocade.permissions-D5sjk9d4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b18-yr27CH/e/fF12jNcln1ysPZvUMg\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 2840,
		"path": "../public/assets/ocade.permissions-D5sjk9d4.js"
	},
	"/assets/ocade.projects-CS3DWnvD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"69b9-S3KI/RIZ93Vs/41CXxcZopEcutA\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 27065,
		"path": "../public/assets/ocade.projects-CS3DWnvD.js"
	},
	"/assets/ocade.search-DHktEQGX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d4f-k/CIGM6T9Qk1G2tggPTtkTjbV/c\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 7503,
		"path": "../public/assets/ocade.search-DHktEQGX.js"
	},
	"/assets/ocade.shared-BxJ8e5TF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"85e-oKyKtKm1U+htQGg9KI9TchoP86E\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 2142,
		"path": "../public/assets/ocade.shared-BxJ8e5TF.js"
	},
	"/assets/ocade.studio-B_4NFOU6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1787-B4j9e/YO3/8OD77SPasrAZbhZcU\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 6023,
		"path": "../public/assets/ocade.studio-B_4NFOU6.js"
	},
	"/assets/ocade.system-GykTdehO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b6e-NcLgBrPtt9tF8ngYf2u1KeXbD+Q\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 2926,
		"path": "../public/assets/ocade.system-GykTdehO.js"
	},
	"/assets/ocade.tasks-ms3lIMWU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb-cY3nAae2lzBQ/H1e3Co1hCXtb+c\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 187,
		"path": "../public/assets/ocade.tasks-ms3lIMWU.js"
	},
	"/assets/ocade.templates-DFFQUpmo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86e-iDD2bI4dlQNE1Y6zlqyvZ1ROkyY\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 2158,
		"path": "../public/assets/ocade.templates-DFFQUpmo.js"
	},
	"/assets/ocade.work-cq6sac92.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1212-kGARtxCsGQ8vcE+a9Z/L8dffcME\"",
		"mtime": "2026-08-28T01:19:24.560Z",
		"size": 4626,
		"path": "../public/assets/ocade.work-cq6sac92.js"
	},
	"/assets/offline-queue-DCgT3E8_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1022-+HPUrO/Ax7RUoDjtibyncAztEl8\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 4130,
		"path": "../public/assets/offline-queue-DCgT3E8_.js"
	},
	"/assets/onboarding-B3sRxw-d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2455-Z53t1m+Wf4JLuLOPaWCQdOWOxkU\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 9301,
		"path": "../public/assets/onboarding-B3sRxw-d.js"
	},
	"/assets/otp-DjLZa1Bh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf-a6ETjDOg4CEzdZQGVnx9xjn5ni4\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 975,
		"path": "../public/assets/otp-DjLZa1Bh.js"
	},
	"/assets/pack-registry-CFjso4JY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f715-HhPkfeDCVwrXCadf+lDVo1OQLMY\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 63253,
		"path": "../public/assets/pack-registry-CFjso4JY.js"
	},
	"/assets/paddle-P_ovnqxC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"761-Y66J2uF7iBHyRm2y+DEklR6ajBI\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 1889,
		"path": "../public/assets/paddle-P_ovnqxC.js"
	},
	"/assets/paired-credentials-BdTt8GO6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3a5-qzcTcelsb5m8nTY7thSSv7fJ9Gc\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 933,
		"path": "../public/assets/paired-credentials-BdTt8GO6.js"
	},
	"/assets/paired-desktop-CRlgl01N.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c19-v4ah0daiI0KvIzpnvg6G+PbgrJo\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 3097,
		"path": "../public/assets/paired-desktop-CRlgl01N.js"
	},
	"/assets/patch-EXKdKZzr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1211-HXETKTXza6inPnwdJDPOFn0Qzy0\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 4625,
		"path": "../public/assets/patch-EXKdKZzr.js"
	},
	"/assets/payments-readiness.functions-CLKjIU-m.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"916-s1atOqNvhtzhNfZCEprP8aaLM9s\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 2326,
		"path": "../public/assets/payments-readiness.functions-CLKjIU-m.js"
	},
	"/assets/pdf-cdvfLdxt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"686a1-iBQrg6JO/2sxrao8tDZ4r4FMHT8\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 427681,
		"path": "../public/assets/pdf-cdvfLdxt.js"
	},
	"/assets/permission-settings-Op_IKKjI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f962-+BvuV+CJBu+Na5Mj/NIZEWeLl9Q\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 63842,
		"path": "../public/assets/permission-settings-Op_IKKjI.js"
	},
	"/assets/preflight-BQ6wmuYC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bab-iPqmWZgwh3c3p4xM7AK8CAaLZxY\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 2987,
		"path": "../public/assets/preflight-BQ6wmuYC.js"
	},
	"/assets/press-Kr9GVhk9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c9e-JfIp16ojtVnoX18f57LA5bf3rO4\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 3230,
		"path": "../public/assets/press-Kr9GVhk9.js"
	},
	"/assets/pricing-CrntJgfr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e4e-qTofqxAu/ulJDRyzd7c3y5y5qgg\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 3662,
		"path": "../public/assets/pricing-CrntJgfr.js"
	},
	"/assets/pricing-DWsHUKSf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ac6-3laBV79B7vfepTvgBoRvKKumpn8\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 2758,
		"path": "../public/assets/pricing-DWsHUKSf.js"
	},
	"/assets/privacy-BEUPrWv3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f3-VT1NnE7ElcAx2x3FHzvab5Y76dE\"",
		"mtime": "2026-08-28T01:19:24.561Z",
		"size": 243,
		"path": "../public/assets/privacy-BEUPrWv3.js"
	},
	"/assets/products.ocade-So8hSP05.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a5e-m28+y997gujQKMT2k30idfxO6JU\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 6750,
		"path": "../public/assets/products.ocade-So8hSP05.js"
	},
	"/assets/public-content-BHiEcfah.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dfd-n1E3dTQXkgClEA6Pyiwp19soZ/k\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 3581,
		"path": "../public/assets/public-content-BHiEcfah.js"
	},
	"/assets/public-identity-Bw1Z-EQ7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb8-Un27wWzmQzT61u5ivEC9J4ZUN8w\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 3e3,
		"path": "../public/assets/public-identity-Bw1Z-EQ7.js"
	},
	"/assets/research.functions-B6yhG92u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"165-jMy7GoNKrGx7xFYvXDGIxBRRgCo\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 357,
		"path": "../public/assets/research.functions-B6yhG92u.js"
	},
	"/assets/reset-password-BI-e2sI1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"14ec-smvH4WZBFGOhsAfPPHNySVHgcaE\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 5356,
		"path": "../public/assets/reset-password-BI-e2sI1.js"
	},
	"/assets/route-9q1OrE4K.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"497-AGWuZuOsm3AWmyPQY2gCRvVTIKI\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 1175,
		"path": "../public/assets/route-9q1OrE4K.js"
	},
	"/assets/route-CYKXT5zz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1974-N71mtU/maYbeYbAqKRWcKfFPgxI\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 6516,
		"path": "../public/assets/route-CYKXT5zz.js"
	},
	"/assets/router-policy-CxUOW51h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5ed-xg0EophnrkdSnKmJEBbIn+4yJkU\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 1517,
		"path": "../public/assets/router-policy-CxUOW51h.js"
	},
	"/assets/routes-C2KEDORk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"343c-4TAAsyqFykKgLfNQ+F8E/44z6J0\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 13372,
		"path": "../public/assets/routes-C2KEDORk.js"
	},
	"/assets/runs-zcbIVbtd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"120c-gAKEm0tvGJfTWHhm1aP6xHnDjSg\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 4620,
		"path": "../public/assets/runs-zcbIVbtd.js"
	},
	"/assets/runtime-activation-DZkE6okr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"13c5-nbKD9YWA6+6DMlpxrrFZ6CD5FRQ\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 5061,
		"path": "../public/assets/runtime-activation-DZkE6okr.js"
	},
	"/assets/session-BTnEDRCv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"732-fpOcDUUeDtG5yE5t/SspZ9q+83k\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 1842,
		"path": "../public/assets/session-BTnEDRCv.js"
	},
	"/assets/search-B7SSt1Wf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2489-hC1NZ+ON36kPQ7dUh9QnpOqLWLk\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 9353,
		"path": "../public/assets/search-B7SSt1Wf.js"
	},
	"/assets/session-F0aHiXU4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7fcf-mzFWyz824YxE2hiuNKc01N93mwQ\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 32719,
		"path": "../public/assets/session-F0aHiXU4.js"
	},
	"/assets/settings-CwR7yfkc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"153a-l+mr+4uCEi60j/Ha7Q/aGjJ3+Bo\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 5434,
		"path": "../public/assets/settings-CwR7yfkc.js"
	},
	"/assets/rolldown-runtime-DAXXjFlN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5-2encFCuTik/YJedDUFEd4geNCVs\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 1269,
		"path": "../public/assets/rolldown-runtime-DAXXjFlN.js"
	},
	"/assets/settings._section-CrtrzosY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c636-zSPgt0vpZv596xDUG1f5RzceilQ\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 116278,
		"path": "../public/assets/settings._section-CrtrzosY.js"
	},
	"/assets/settings.appearance-BtAGfav4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1bf2-qCNwKwFbEJagr/ZNR8pIw7YLXnU\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 7154,
		"path": "../public/assets/settings.appearance-BtAGfav4.js"
	},
	"/assets/settings.activity-BBL36Eii.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b4e-qBilxo9Uwj8PvEEsBw0d9ETAISI\"",
		"mtime": "2026-08-28T01:19:24.562Z",
		"size": 11086,
		"path": "../public/assets/settings.activity-BBL36Eii.js"
	},
	"/assets/settings.billing-qPLV6NFL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"330c-Tb+pQjMO45neZkIXTcngV9OYxYk\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 13068,
		"path": "../public/assets/settings.billing-qPLV6NFL.js"
	},
	"/assets/settings.browser-CRR0QPfz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c2c-cXXsnL5m4mHP22hE61/oXbXJeN8\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 7212,
		"path": "../public/assets/settings.browser-CRR0QPfz.js"
	},
	"/assets/settings.devices-CSwAm0fK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"22cb-pfLNbMg+WqqntdHyI0EWJZuEorY\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 8907,
		"path": "../public/assets/settings.devices-CSwAm0fK.js"
	},
	"/assets/settings.index-CKL3r7M2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"297a-3hKr15OS6sU7XlU9TqBOXP2gmTE\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 10618,
		"path": "../public/assets/settings.index-CKL3r7M2.js"
	},
	"/assets/settings.mobile-sSAadjGr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7582-mTlP9YgGxk8+KUtYBOUILWG8pmI\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 30082,
		"path": "../public/assets/settings.mobile-sSAadjGr.js"
	},
	"/assets/settings.privacy-vpY641-P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"284e-rpmp1K1mVNnV9w//GNP33dMFe3I\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 10318,
		"path": "../public/assets/settings.privacy-vpY641-P.js"
	},
	"/assets/settings.security-CNEYKlnX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dc6-Tr+vdXys4ATJZseE9L7uGmr19h0\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 11718,
		"path": "../public/assets/settings.security-CNEYKlnX.js"
	},
	"/assets/settings.skills-D7xarBHe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b388-AjS3ZUHuLcZ/tEq4fpY1yEGOxro\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 45960,
		"path": "../public/assets/settings.skills-D7xarBHe.js"
	},
	"/assets/settings.support-WN_mVZwY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ec6-usrynbFcAWQFWAOsSzkh5GJaN/s\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 7878,
		"path": "../public/assets/settings.support-WN_mVZwY.js"
	},
	"/assets/settings.usage-zHdgZWIX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23b8-uyCsPZ2uB4CZmQqOZLnhgwKsUL0\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 9144,
		"path": "../public/assets/settings.usage-zHdgZWIX.js"
	},
	"/assets/settings.tasks-DgE9z_Y9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c1-8fmyAYqhr3OMLwRtCkJ89PlkVpM\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 193,
		"path": "../public/assets/settings.tasks-DgE9z_Y9.js"
	},
	"/assets/settings.vault-B-vJmeGN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47d3-ZGEQLplLxUysZvXJ3serz3PoEnQ\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 18387,
		"path": "../public/assets/settings.vault-B-vJmeGN.js"
	},
	"/assets/shared-browser-engine-UuUjWn18.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e7f-AtpPFRkx63nAcHUnvEirQrQR4NQ\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 3711,
		"path": "../public/assets/shared-browser-engine-UuUjWn18.js"
	},
	"/assets/skill-pack-BHYdbJ14.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2753-LA42d3zXBqYgEPkeuvrvwQAkBq4\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 10067,
		"path": "../public/assets/skill-pack-BHYdbJ14.js"
	},
	"/assets/settings.voice-CrqHyCHw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"334d-e9pAz9DT+OQcqSxWmnfumeY0b8s\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 13133,
		"path": "../public/assets/settings.voice-CrqHyCHw.js"
	},
	"/assets/state-DxxN8SRV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7ee-m7T9F0E58f7Eq0OuZi5SIxxbCR8\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 2030,
		"path": "../public/assets/state-DxxN8SRV.js"
	},
	"/assets/status-aCKvq6tt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c86-8vrj7fRdp6V/Nwv/nQRpHk39sl0\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 7302,
		"path": "../public/assets/status-aCKvq6tt.js"
	},
	"/assets/styles-C-fHYRT0.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"25901-5q51vGJYuekPQwoKRehiEXt1BaU\"",
		"mtime": "2026-08-28T01:19:24.566Z",
		"size": 153857,
		"path": "../public/assets/styles-C-fHYRT0.css"
	},
	"/assets/team-CbCJnh-r.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"85f-n3OEoyPeqcG6hjR30I50pBYkmuI\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 2143,
		"path": "../public/assets/team-CbCJnh-r.js"
	},
	"/assets/support-D_iWaIh2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ce7-qmNo7PM2SPq3s2I7YpZIHHT5DEI\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 3303,
		"path": "../public/assets/support-D_iWaIh2.js"
	},
	"/assets/store-BogwCS0B.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15b7-JI9e1D05yXA6IjpOYgjKQ+OjeBI\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 5559,
		"path": "../public/assets/store-BogwCS0B.js"
	},
	"/assets/solar-data-Cr1sACCj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d14-o0ZWBWvM/3TWTeCGSydO65G0noI\"",
		"mtime": "2026-08-28T01:19:24.563Z",
		"size": 3348,
		"path": "../public/assets/solar-data-Cr1sACCj.js"
	},
	"/assets/terms-QOdF7S7n.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f3-v7RzrTdb4PqIvlqRqEbZbh7S4K4\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 243,
		"path": "../public/assets/terms-QOdF7S7n.js"
	},
	"/assets/textarea-C5yUH9WW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"234-9EvUfpVTnHwv6tukytAg2I7nEus\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 564,
		"path": "../public/assets/textarea-C5yUH9WW.js"
	},
	"/assets/throttle-u3W15Ydi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52e-OKczYenMlzATtKhxZH8ZOOjjqt0\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 1326,
		"path": "../public/assets/throttle-u3W15Ydi.js"
	},
	"/assets/tier-benchmark-store-8QK9SMla.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"44c-xpEzkjz5potrc7uBtjtiAC+jtiU\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 1100,
		"path": "../public/assets/tier-benchmark-store-8QK9SMla.js"
	},
	"/assets/transcript-redaction-D5c695T6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2171-HFwB+uZW8B5DruIZUg6h1nqjzTQ\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 8561,
		"path": "../public/assets/transcript-redaction-D5c695T6.js"
	},
	"/assets/unavailable-reason-CxXmcH-x.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"33c-zMREJLSX5NtsDmAgMidxWmCLzIk\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 828,
		"path": "../public/assets/unavailable-reason-CxXmcH-x.js"
	},
	"/assets/unified-task-Ct-wJCIq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ebc-MwXHAywKZKs1267pQhiSHWE+Y0w\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 3772,
		"path": "../public/assets/unified-task-Ct-wJCIq.js"
	},
	"/assets/update-signature-Bgi-Ozhm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4df-dzu3Uyqwlyj1Zwx6HLm3HPkDwmU\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 1247,
		"path": "../public/assets/update-signature-Bgi-Ozhm.js"
	},
	"/assets/use-brain-CSQ_wCAx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f03-1axbU9pMTqz4BiSfiGViSeCQ9cA\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 3843,
		"path": "../public/assets/use-brain-CSQ_wCAx.js"
	},
	"/assets/use-capabilities-C7PcSoKQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c02-HXDcxljpe1wLbhbSRPEapq7DCJA\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 11266,
		"path": "../public/assets/use-capabilities-C7PcSoKQ.js"
	},
	"/assets/use-demo-CDigG9AR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"128-eDRXCL/+dYtxz19YGPyDkLTa5h4\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 296,
		"path": "../public/assets/use-demo-CDigG9AR.js"
	},
	"/assets/use-chat-prefs-CZlk0HKL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"64c-sSembQAMF1+QX+mb0OPOs6Xl3Ec\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 1612,
		"path": "../public/assets/use-chat-prefs-CZlk0HKL.js"
	},
	"/assets/use-demo-session-BwqDrfAT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a4a-ygBz6QHvFXX6oaQyK/yhpQlorAA\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 6730,
		"path": "../public/assets/use-demo-session-BwqDrfAT.js"
	},
	"/assets/use-device-policy-Cpi-sHq8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1405-endiu8EvvqC2/QsqYm+fNZxey8c\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 5125,
		"path": "../public/assets/use-device-policy-Cpi-sHq8.js"
	},
	"/assets/use-dictation-BXU97IKZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4b04-csKiXcGA4yUj7o5t1nUIUJP8OBw\"",
		"mtime": "2026-08-28T01:19:24.564Z",
		"size": 19204,
		"path": "../public/assets/use-dictation-BXU97IKZ.js"
	},
	"/assets/use-limits-B2vt3-ru.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c08-8QxxYB3Lc6Ag2XZ6BKDqL9bIN1g\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 3080,
		"path": "../public/assets/use-limits-B2vt3-ru.js"
	},
	"/assets/use-local-engine-DC6_rYk3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d1a-Vuhxo11qf9fD1S5gFGUuf6rDIus\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 3354,
		"path": "../public/assets/use-local-engine-DC6_rYk3.js"
	},
	"/assets/use-online-CXunBi7G.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c8-sxxRaI3YIhYUU8NqANt44VxjCSU\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 456,
		"path": "../public/assets/use-online-CXunBi7G.js"
	},
	"/assets/use-mission-brain-CF_HBwrx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1579d-nyVZ90dOZ2x934a0EGmT/mCgll0\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 87965,
		"path": "../public/assets/use-mission-brain-CF_HBwrx.js"
	},
	"/assets/use-settings-access-BtFlRhWI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-UiD9a75ZbMEZeqVYT1xGruqI6UY\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 251,
		"path": "../public/assets/use-settings-access-BtFlRhWI.js"
	},
	"/assets/use-shell-DD7w3eib.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ca-k7zrXWFg3T5sFkvJyHMWORwFAgg\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 202,
		"path": "../public/assets/use-shell-DD7w3eib.js"
	},
	"/assets/use-voice-prefs-C3YcXQQR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b08-7CHYJ1t7TSPh8Da8FEntqRz6CaA\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 2824,
		"path": "../public/assets/use-voice-prefs-C3YcXQQR.js"
	},
	"/assets/vault-DvLlJ4re.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1469-kpDvX5PnLg+5Y8hAoUn0kxKsdDw\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 5225,
		"path": "../public/assets/vault-DvLlJ4re.js"
	},
	"/assets/vendor-markdown-CJdAOkbM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c329-jkqcjH7TYhNPRSsO0D4q0vleV/s\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 115497,
		"path": "../public/assets/vendor-markdown-CJdAOkbM.js"
	},
	"/assets/vendor-mammoth-Dpq0khGw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"79667-yat456Rdzc89mGmuoEmeYx6S17E\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 497255,
		"path": "../public/assets/vendor-mammoth-Dpq0khGw.js"
	},
	"/assets/vendor-react-CX2mWblQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2e56d-qrX6GvMoYNkdEag7AoGUlpZrTKw\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 189805,
		"path": "../public/assets/vendor-react-CX2mWblQ.js"
	},
	"/assets/vendor-runtime-Czpn1I53.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4ac-sE+5KsaRXTMfwOfrOATQajMSGV4\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 1196,
		"path": "../public/assets/vendor-runtime-Czpn1I53.js"
	},
	"/assets/vendor-supabase-DSyywpEH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31ffe-LFSgZ+b88LeCDCMCAFoHHin+614\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 204798,
		"path": "../public/assets/vendor-supabase-DSyywpEH.js"
	},
	"/assets/vendor-ui-BrfxvsVO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16455-PHKTav0iaIKlOK0Q87zX1/H3fcU\"",
		"mtime": "2026-08-28T01:19:24.565Z",
		"size": 91221,
		"path": "../public/assets/vendor-ui-BrfxvsVO.js"
	},
	"/assets/webllm.server-DNYK_aeU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e1-Us1T5KPTXPRBgWxerF+xOrVbVS4\"",
		"mtime": "2026-08-28T01:19:24.566Z",
		"size": 225,
		"path": "../public/assets/webllm.server-DNYK_aeU.js"
	},
	"/assets/webllm.worker-BYUasHjv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6-gzTuXHvqWN3WhQkR86gwLh/4ICk\"",
		"mtime": "2026-08-28T01:19:24.584Z",
		"size": 166,
		"path": "../public/assets/webllm.worker-BYUasHjv.js"
	},
	"/assets/wllama-CfujTeeK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3a-XHS6PgwOix/pzsr2L7s2oAAni5k\"",
		"mtime": "2026-08-28T01:19:24.566Z",
		"size": 58,
		"path": "../public/assets/wllama-CfujTeeK.js"
	},
	"/assets/wllama-Dk3sV4-d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"48b4e-XVvVylqXX1LnpZS7y5u/rSV5znE\"",
		"mtime": "2026-08-28T01:19:24.566Z",
		"size": 297806,
		"path": "../public/assets/wllama-Dk3sV4-d.js"
	},
	"/icons/ocade-128.png": {
		"type": "image/png",
		"etag": "\"2871-IZB027IPQeXA1Uie+syfBzKl93I\"",
		"mtime": "2026-08-28T01:19:29.076Z",
		"size": 10353,
		"path": "../public/icons/ocade-128.png"
	},
	"/icons/ocade-192.png": {
		"type": "image/png",
		"etag": "\"5149-wzeR766lYdZEadVNBUoDzG48A0c\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 20809,
		"path": "../public/icons/ocade-192.png"
	},
	"/icons/ocade-256.png": {
		"type": "image/png",
		"etag": "\"930e-FmD72307V20/TJsN9OqHrh9zjgs\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 37646,
		"path": "../public/icons/ocade-256.png"
	},
	"/icons/ocade-32.png": {
		"type": "image/png",
		"etag": "\"4dc-hbUtpn6WGgeGc4D7uURQF0k5ABw\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 1244,
		"path": "../public/icons/ocade-32.png"
	},
	"/icons/ocade-48.png": {
		"type": "image/png",
		"etag": "\"8cf-lg1ou1TM9yhpZPYq24/jNN0WGH0\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 2255,
		"path": "../public/icons/ocade-48.png"
	},
	"/icons/ocade-512.png": {
		"type": "image/png",
		"etag": "\"282f1-veO7ECjckHeDITMr9SUQUZwBKSE\"",
		"mtime": "2026-08-28T01:19:29.077Z",
		"size": 164593,
		"path": "../public/icons/ocade-512.png"
	},
	"/models/README.md": {
		"type": "text/markdown; charset=utf-8",
		"etag": "\"639-kNCQYFm5MybzQOVkkzMUoMWvI3c\"",
		"mtime": "2026-08-28T01:19:29.076Z",
		"size": 1593,
		"path": "../public/models/README.md"
	},
	"/assets/wllama-m-NqGU8W.wasm": {
		"type": "application/wasm",
		"etag": "\"74d449-/5qFKdxtVjp8khmNdIXiGMaJl+Y\"",
		"mtime": "2026-08-28T01:19:24.566Z",
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
