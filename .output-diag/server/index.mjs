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
		"mtime": "2026-08-28T01:15:25.673Z",
		"size": 18478,
		"path": "../public/apple-touch-icon.png"
	},
	"/favicon.ico": {
		"type": "image/vnd.microsoft.icon",
		"etag": "\"fb4-0SojhBjTCdtondWh2OQc0bbHnA8\"",
		"mtime": "2026-08-28T01:15:25.673Z",
		"size": 4020,
		"path": "../public/favicon.ico"
	},
	"/manifest.webmanifest": {
		"type": "application/manifest+json",
		"etag": "\"2b9-7HLG94qjlshQnx59E+/ByIlfznI\"",
		"mtime": "2026-08-28T01:15:25.673Z",
		"size": 697,
		"path": "../public/manifest.webmanifest"
	},
	"/offline.html": {
		"type": "text/html; charset=utf-8",
		"etag": "\"a05-pzaEkxiSga8R/E5QnxVTL9w7Wcc\"",
		"mtime": "2026-08-28T01:15:25.673Z",
		"size": 2565,
		"path": "../public/offline.html"
	},
	"/sw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"463c-yzwjMtAFXnY1o6e219yDWz35vxI\"",
		"mtime": "2026-08-28T01:15:25.674Z",
		"size": 17980,
		"path": "../public/sw.js"
	},
	"/assets/AppShell-D3vqPi7L.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb-FEKrLdPSHZHycw5RiEWiHrCriGo\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 187,
		"path": "../public/assets/AppShell-D3vqPi7L.js"
	},
	"/assets/AuthShell-BBC87k70.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"886-5fZRfD9VhtgMBmzsCKgzN/xb3i8\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 2182,
		"path": "../public/assets/AuthShell-BBC87k70.js"
	},
	"/assets/BrandMark-ZeG2i2WV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"38a-Ci2Nwrci2R0VB1zbiUL1j4imUgU\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 906,
		"path": "../public/assets/BrandMark-ZeG2i2WV.js"
	},
	"/assets/CapabilityBadge-BCWtK_Pd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9bd-odh9jaTnzvTCDPxCkaElEBvCGT0\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 2493,
		"path": "../public/assets/CapabilityBadge-BCWtK_Pd.js"
	},
	"/assets/ChatSidebar-BptB05vx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"100f-mbF5UxVp58JOz88vNQtCpD/xFGQ\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 4111,
		"path": "../public/assets/ChatSidebar-BptB05vx.js"
	},
	"/assets/ComingLater-rUZkyuYi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4dc-oiOrLEhCFdk0Qyq0CReVRxbkn3w\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 1244,
		"path": "../public/assets/ComingLater-rUZkyuYi.js"
	},
	"/assets/DiagnosticsPanel-CsqaKlz9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3313-oUmakE/QjSApu8tM/fWhu7STo/8\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 13075,
		"path": "../public/assets/DiagnosticsPanel-CsqaKlz9.js"
	},
	"/assets/EmptyState-CJlHJ6PR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"202-rpt66DchCvKDzSbnoVdnYjzxsrQ\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 514,
		"path": "../public/assets/EmptyState-CJlHJ6PR.js"
	},
	"/assets/GestureControlPanel-CtPE3Vqh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16ab-39Uy8wGPdg8JQ9GY2GOyVzYuvbE\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 5803,
		"path": "../public/assets/GestureControlPanel-CtPE3Vqh.js"
	},
	"/assets/GlassPanel-BkJI87st.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"225-JuxDgzq4WOXiMVdutlUb4+HSwaU\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 549,
		"path": "../public/assets/GlassPanel-BkJI87st.js"
	},
	"/assets/LivingIntelligenceBackdrop-DHyDO0Xx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19c3-zaGguJvD+RSqj9u0Jvb24CiUEXM\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 6595,
		"path": "../public/assets/LivingIntelligenceBackdrop-DHyDO0Xx.js"
	},
	"/assets/LocalEngineControl-CglxQH0I.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e4d-K6NgDReLkXBPnXe/RaxJoL9GNuI\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 7757,
		"path": "../public/assets/LocalEngineControl-CglxQH0I.js"
	},
	"/assets/LocalIntelligenceControl-BoXIJbid.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1317-tODSmiBHJ9JkQzQClsQFYml3E8s\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 4887,
		"path": "../public/assets/LocalIntelligenceControl-BoXIJbid.js"
	},
	"/assets/OcadeCompanion-CLRpUXly.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5e5-lAW3iyUwQBEqtmf/friHFjZY6gE\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 1509,
		"path": "../public/assets/OcadeCompanion-CLRpUXly.js"
	},
	"/assets/OcadeOrb-CnUHXHsy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a4-ba5PwKckKW/ijTfnj+Gg7z+qqJE\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 1444,
		"path": "../public/assets/OcadeOrb-CnUHXHsy.js"
	},
	"/assets/OcadeOrbCanvas-CO0tDYLK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b0a-FFbzjFIEhqHDl6VlfwMyDAOa1As\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 6922,
		"path": "../public/assets/OcadeOrbCanvas-CO0tDYLK.js"
	},
	"/assets/PageHeader-C0zSkLIw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ce-iho/5zo8cTFQLp9/yUhwECi4cW0\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 718,
		"path": "../public/assets/PageHeader-C0zSkLIw.js"
	},
	"/assets/PerformanceFallbackNotice-KeETZNxO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"81f-lbc51EbDGdLPQZg28GtBpJ92HXQ\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 2079,
		"path": "../public/assets/PerformanceFallbackNotice-KeETZNxO.js"
	},
	"/assets/PlanComparison-DIJC8TrA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"111e-/ezq6UPvj6ErQ5DlW31RaYKprsc\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 4382,
		"path": "../public/assets/PlanComparison-DIJC8TrA.js"
	},
	"/assets/SettingsGate-DqTmUkD_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"727-8c/TKH1Ox/b1vWBO33MR0MeXL7w\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 1831,
		"path": "../public/assets/SettingsGate-DqTmUkD_.js"
	},
	"/assets/SetupRequiredState-tOLwEoLd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3d8-YjPUrXZu8DefgvZ/tW9zwgGEh4k\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 984,
		"path": "../public/assets/SetupRequiredState-tOLwEoLd.js"
	},
	"/assets/StatusBadge-Dzoh-gcG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"658-ZZSnazRThWrLUgn6NKaeOTJtU60\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 1624,
		"path": "../public/assets/StatusBadge-Dzoh-gcG.js"
	},
	"/assets/TasksWorkspace-BU1g_RI5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"908c-77jv081+sniT4mzBoCCJSEISG9A\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 37004,
		"path": "../public/assets/TasksWorkspace-BU1g_RI5.js"
	},
	"/assets/TruthfulFailurePanel-DKc9F0Am.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"784-T8Iv0PpWsnEXUbt93engAVBJs30\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 1924,
		"path": "../public/assets/TruthfulFailurePanel-DKc9F0Am.js"
	},
	"/assets/VaultUnlockCard-DPJ2pY5h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ff6-T+OCUMejh8HfspdMls8NXCGZXLk\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 4086,
		"path": "../public/assets/VaultUnlockCard-DPJ2pY5h.js"
	},
	"/assets/WorkspaceShell-CAb8MKHy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6cbb-vopdCdqEcdFEmsNWRns3GdmSsUQ\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 27835,
		"path": "../public/assets/WorkspaceShell-CAb8MKHy.js"
	},
	"/assets/_._lovable.oauth.consent-Bra60dod.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"18e-3QjMyqJG0iGPGJYi0kiTCCUDlkM\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 398,
		"path": "../public/assets/_._lovable.oauth.consent-Bra60dod.js"
	},
	"/assets/about-CAkz_saD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"188c-ywP2yh8ytgHZcL51QTG5A8wal+k\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 6284,
		"path": "../public/assets/about-CAkz_saD.js"
	},
	"/assets/access-denied-D4P3yr3v.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"624-NfYTH+3CNOyXfniZ0Q2PPsslzwk\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 1572,
		"path": "../public/assets/access-denied-D4P3yr3v.js"
	},
	"/assets/actions-CDDb4oyp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"275c-kZNXW9H5SLs8uzgxAz0Gz1BoQzs\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 10076,
		"path": "../public/assets/actions-CDDb4oyp.js"
	},
	"/assets/adapter-Bmw1IsNe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"12a-5/RewF0d9UP0xXkUa9BN4530hpI\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 298,
		"path": "../public/assets/adapter-Bmw1IsNe.js"
	},
	"/assets/admin.launch-gate-CvxHAjEv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a97-gT9Rqcc2PS5dHbnqaNcdPfDD9YE\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 23191,
		"path": "../public/assets/admin.launch-gate-CvxHAjEv.js"
	},
	"/assets/admin.payments-checklist-BhaPPBdy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26c8-yr6nUBz0+WUujYltT/PWFQk8W4w\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 9928,
		"path": "../public/assets/admin.payments-checklist-BhaPPBdy.js"
	},
	"/assets/admin.support-CdZpz2ny.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"170f-dUmA3gHaUvnszl6HvmExn4VhYGY\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 5903,
		"path": "../public/assets/admin.support-CdZpz2ny.js"
	},
	"/assets/admin.users-DAKV_mK0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16a8-qB6Hnaa6iVmaaK2VcCH3qaIj2Ro\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 5800,
		"path": "../public/assets/admin.users-DAKV_mK0.js"
	},
	"/assets/agent.functions-BYdocFWu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c1-PIQeqDoXzmrF9iu8H8yJRAMYv54\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 705,
		"path": "../public/assets/agent.functions-BYdocFWu.js"
	},
	"/assets/auth-CM3_6cto.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5738-PXwR7G6VSnyTTcSqosWEWH2dFaU\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 22328,
		"path": "../public/assets/auth-CM3_6cto.js"
	},
	"/assets/auth-middleware-CSx9bJfn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4e-tVsTm6Q1ilQEyJI0C07BhwsXmb4\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 78,
		"path": "../public/assets/auth-middleware-CSx9bJfn.js"
	},
	"/assets/auth.callback-BeXBjWbJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"abc-zLAMC3k893kX5o1tRBmxZfWSF8w\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 2748,
		"path": "../public/assets/auth.callback-BeXBjWbJ.js"
	},
	"/assets/auth.verify-CvwxTuJg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1040-+T4qS0fz1EdpMYwmGQWzbmx95GI\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 4160,
		"path": "../public/assets/auth.verify-CvwxTuJg.js"
	},
	"/assets/blog-DjhrnhDZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9c-QqOhM0LYihmCwjqqAyBn5GX8Ui8\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 156,
		"path": "../public/assets/blog-DjhrnhDZ.js"
	},
	"/assets/blog._slug-CcTuucYZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eea-DPZTu+Mb8xNZ7IhGudqZoZR59FI\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 3818,
		"path": "../public/assets/blog._slug-CcTuucYZ.js"
	},
	"/assets/blog.index-CJ5IdJ6d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d2c-kDdNlu2kOw3PRXY54GpbJ3lYicQ\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 3372,
		"path": "../public/assets/blog.index-CJ5IdJ6d.js"
	},
	"/assets/_._lovable.oauth.consent-6rKYs4zx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66d-60TaHvV7eK0n1P2JdHNTbxmoM5E\"",
		"mtime": "2026-08-28T01:15:21.112Z",
		"size": 1645,
		"path": "../public/assets/_._lovable.oauth.consent-6rKYs4zx.js"
	},
	"/assets/SolarSystem-CIYQxpH2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86b9f-1CollrtmKlXWWhmChvvPhcDrIZk\"",
		"mtime": "2026-08-28T01:15:21.111Z",
		"size": 551839,
		"path": "../public/assets/SolarSystem-CIYQxpH2.js"
	},
	"/assets/browser-catalogue-DLxJMBU5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eb7-X0o+iONa9b18HaYpBz7geFkysy0\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 3767,
		"path": "../public/assets/browser-catalogue-DLxJMBU5.js"
	},
	"/assets/browser-wasm-DWKOEebJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1432-AxRA7i6s++aZN5aQTGqtbNpd6bo\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 5170,
		"path": "../public/assets/browser-wasm-DWKOEebJ.js"
	},
	"/assets/browser-webgpu-D2qus02e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1197-cn6Y8qa0TNTq3fu3q8Prqq/4qF0\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 4503,
		"path": "../public/assets/browser-webgpu-D2qus02e.js"
	},
	"/assets/cania-D88LgDF6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10b-Su3G1DPuZpTI57zZlk3r8m43NWU\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 267,
		"path": "../public/assets/cania-D88LgDF6.js"
	},
	"/assets/careers-CM4hrZe_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7bc-DOwXvGRuinqV7qeAfL7fxKaoa+Q\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 1980,
		"path": "../public/assets/careers-CM4hrZe_.js"
	},
	"/assets/chat-citation-store-M_3d5V2j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c39-b7Li7a473VJcdIXAd3OsyvbO0qQ\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 7225,
		"path": "../public/assets/chat-citation-store-M_3d5V2j.js"
	},
	"/assets/chat-output-flow-DIpihmu3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c47-1jA1WJBS5V5qyHujBFPhXZxp81s\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 3143,
		"path": "../public/assets/chat-output-flow-DIpihmu3.js"
	},
	"/assets/checkout.success-YQgb6k3c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b7c-HSW7lVkc6PthYqWq3AIbQcsxlXg\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 2940,
		"path": "../public/assets/checkout.success-YQgb6k3c.js"
	},
	"/assets/company-jxhWO0J8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"de2-tnmYcN/kqWiuhJWKbtbjIH52YQQ\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 3554,
		"path": "../public/assets/company-jxhWO0J8.js"
	},
	"/assets/compliance-log.functions-tunDm80S.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-741HQQbfgERrBV6PUldZ7FXilE8\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 251,
		"path": "../public/assets/compliance-log.functions-tunDm80S.js"
	},
	"/assets/computer-use-settings-EGzAqqOS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a0f-2d9maaE65OOhpMLiPiR46hqqTb4\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 2575,
		"path": "../public/assets/computer-use-settings-EGzAqqOS.js"
	},
	"/assets/data-rights-BmALzAo8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e06-SB5A0uTNY6PY9SYtOKPeIoLHa3w\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 3590,
		"path": "../public/assets/data-rights-BmALzAo8.js"
	},
	"/assets/demo-LhcAWJmu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3c1-gu/DTqfRiWszCy89uOPSKcUrfAU\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 961,
		"path": "../public/assets/demo-LhcAWJmu.js"
	},
	"/assets/demo.control-BHQ9VWr7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"991-euWtOJ8CQQTm/Qhmi8K5/T81syc\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 2449,
		"path": "../public/assets/demo.control-BHQ9VWr7.js"
	},
	"/assets/demo.ocade-C-FzK8Bs.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7db0-aYJMieVIqFdrRjPioRMM/gaMsRM\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 32176,
		"path": "../public/assets/demo.ocade-C-FzK8Bs.js"
	},
	"/assets/demo.settings-Dr7XS4tb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"edb-MhQIoiB2WJlPEaEmpsVpJdO1WjQ\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 3803,
		"path": "../public/assets/demo.settings-Dr7XS4tb.js"
	},
	"/assets/desktop-bridge-tO-QQqy8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eaa-Q4DpW6eraI1WfH5I18f6/If9c70\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 3754,
		"path": "../public/assets/desktop-bridge-tO-QQqy8.js"
	},
	"/assets/devices-FsmnU4Ty.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e0f-rUf/Yi670pgAKFIMz+3ZgjOAR9c\"",
		"mtime": "2026-08-28T01:15:21.113Z",
		"size": 3599,
		"path": "../public/assets/devices-FsmnU4Ty.js"
	},
	"/assets/download-BDqEVzsU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1027-Fq8xUKWV8I1MBwM4yRkuY1Qnqak\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 4135,
		"path": "../public/assets/download-BDqEVzsU.js"
	},
	"/assets/execute-DHrUDbAV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1213a-AQiC5DMlUOxDCAqLMPuxTFt0a9k\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 74042,
		"path": "../public/assets/execute-DHrUDbAV.js"
	},
	"/assets/faq-YvKl7FNH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1420-HbVsxIzGOvH5PocjfOAr0fqoug8\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 5152,
		"path": "../public/assets/faq-YvKl7FNH.js"
	},
	"/assets/ficia-Cgc667pd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"105-w1sAyLRZ0X4ACzFaObEXcZm79tk\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 261,
		"path": "../public/assets/ficia-Cgc667pd.js"
	},
	"/assets/fixed-model-Ckyk5kJ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"895-SahTIID3v5hvHEb68F/9chPipFk\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 2197,
		"path": "../public/assets/fixed-model-Ckyk5kJ8.js"
	},
	"/assets/founder.haans-antoni-CY-d4ket.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c45-iI36cbrYzEX7HbgJUwPM9zqSXQA\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 3141,
		"path": "../public/assets/founder.haans-antoni-CY-d4ket.js"
	},
	"/assets/index-D2dPCofE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7e98a-rbojvj3IKhL83n3/hIoTs+AEdYY\"",
		"mtime": "2026-08-28T01:15:21.104Z",
		"size": 518538,
		"path": "../public/assets/index-D2dPCofE.js"
	},
	"/assets/input-B8gjJ3f_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"29a-8HpvhNNzmvGT+Y31JFvCK2hCG98\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 666,
		"path": "../public/assets/input-B8gjJ3f_.js"
	},
	"/assets/installation-browser-nlOXPRlE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6e8c-77edCJ4hHAyNtZBoAzcv2ZxVX7g\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 28300,
		"path": "../public/assets/installation-browser-nlOXPRlE.js"
	},
	"/assets/local-projects-NmeiQB5C.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1948-hunGkSGvAM8HkvJ183oQaTzcYNI\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 6472,
		"path": "../public/assets/local-projects-NmeiQB5C.js"
	},
	"/assets/local-runtime.functions-BcagiN2D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1080-r8QNME57kLN90+DDs5TlMd/1gdY\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 4224,
		"path": "../public/assets/local-runtime.functions-BcagiN2D.js"
	},
	"/assets/madee-Dz0oRjW1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"100-WkJLBp6wRpEw+T5ZCrw8z50JHXY\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 256,
		"path": "../public/assets/madee-Dz0oRjW1.js"
	},
	"/assets/methods-Bmi_DJG2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2f0-5wV1FEI7fp4qwbFT2LJxidvgKAY\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 752,
		"path": "../public/assets/methods-Bmi_DJG2.js"
	},
	"/assets/model-download-WPtDDhP_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"129a-0NYA5ZOkysFUID3TPL95/RYlAhI\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 4762,
		"path": "../public/assets/model-download-WPtDDhP_.js"
	},
	"/assets/oauth-errors-D0R59ozT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8bf-aaAHKGe4/rm947FH7hWLOpTnBqQ\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 2239,
		"path": "../public/assets/oauth-errors-D0R59ozT.js"
	},
	"/assets/ocade-allowance-BFQspkmM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52d-tfyMxsfopdsf6cD91j7mgDR2ZCk\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 1325,
		"path": "../public/assets/ocade-allowance-BFQspkmM.js"
	},
	"/assets/ocade-automations.functions-7ByCpyVf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"630-EJjwUgBT39X5Tv0i3jD7IfA82wU\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 1584,
		"path": "../public/assets/ocade-automations.functions-7ByCpyVf.js"
	},
	"/assets/ocade-identity-BdM79R6-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"175-m+CJ2IY7faIQPIyy+1b+gB+G7Q8\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 373,
		"path": "../public/assets/ocade-identity-BdM79R6-.js"
	},
	"/assets/model-store--TDaCIKO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11f0-/yWxzn0iTXzT8t6LmvAx+tFz+Mg\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 4592,
		"path": "../public/assets/model-store--TDaCIKO.js"
	},
	"/assets/ocade-DajR4D2t.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"df-1auxRhc77wwf9dEREOU+e+yMOR8\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 223,
		"path": "../public/assets/ocade-DajR4D2t.js"
	},
	"/assets/ocade-local-DMcdYpaT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15e7-44KXXrBxu4yEIXXATmyAb51HtNY\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 5607,
		"path": "../public/assets/ocade-local-DMcdYpaT.js"
	},
	"/assets/model-vault-DbVu5A8u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e9e-Xiz8k0lOcgQqCNoSaKGZ00BfSMw\"",
		"mtime": "2026-08-28T01:15:21.114Z",
		"size": 3742,
		"path": "../public/assets/model-vault-DbVu5A8u.js"
	},
	"/assets/ocade-projects.functions-DaKCffqj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25b4-DS4yVfEyKhx/eCSg5Yt9/BktF8U\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 9652,
		"path": "../public/assets/ocade-projects.functions-DaKCffqj.js"
	},
	"/assets/ocade-usage.functions-DFCh5WsL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e9-znicGhzwKkQupkUiOeV1mCURWm0\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 233,
		"path": "../public/assets/ocade-usage.functions-DFCh5WsL.js"
	},
	"/assets/ocade.activity-6_NB5adm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad4-ubF4iNPegdoszj0q3AhNBjKsP2Y\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 2772,
		"path": "../public/assets/ocade.activity-6_NB5adm.js"
	},
	"/assets/ocade.artifacts-JeOwfarD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"211e-1FKhWQcMXX1iEaAwEG/BflH48SA\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 8478,
		"path": "../public/assets/ocade.artifacts-JeOwfarD.js"
	},
	"/assets/ocade.automations-BoNuv0ja.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ea97-hfsdQkcdwf0zinuO0jVfn3o6i5M\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 60055,
		"path": "../public/assets/ocade.automations-BoNuv0ja.js"
	},
	"/assets/ocade.code-CnlPOuP6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"af01-n8tWK8ODYlgqU4jlkj8SKV0crO8\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 44801,
		"path": "../public/assets/ocade.code-CnlPOuP6.js"
	},
	"/assets/ocade.connectors-aERgkUJz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"949-hVUr9h6m0qgoyJLfhhqQadxyJWo\"",
		"mtime": "2026-08-28T01:15:21.115Z",
		"size": 2377,
		"path": "../public/assets/ocade.connectors-aERgkUJz.js"
	},
	"/assets/ocade.devices-BqQ4NuGx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eb3-eW7xhDcDhQybtgyGAg+u5a8a1fQ\"",
		"mtime": "2026-08-28T01:15:21.116Z",
		"size": 3763,
		"path": "../public/assets/ocade.devices-BqQ4NuGx.js"
	},
	"/assets/ocade.health-DQIlYpnQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4d2-Tf0XybI/eTZIfKs0H5zxehInqoc\"",
		"mtime": "2026-08-28T01:15:21.116Z",
		"size": 1234,
		"path": "../public/assets/ocade.health-DQIlYpnQ.js"
	},
	"/assets/ocade.inbox-C0Gpk3vF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fed-2YBVt6pdp8t0snx3vALQ6bNm+wU\"",
		"mtime": "2026-08-28T01:15:21.116Z",
		"size": 4077,
		"path": "../public/assets/ocade.inbox-C0Gpk3vF.js"
	},
	"/assets/ocade.index-BnzcsDS9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"46125-Ui9cynGcAvbkcBjH+G6nICHJ8uE\"",
		"mtime": "2026-08-28T01:15:21.116Z",
		"size": 287013,
		"path": "../public/assets/ocade.index-BnzcsDS9.js"
	},
	"/assets/ocade.knowledge-BccTliKk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a04-o7qPdH7kCoeU3kSXshH9w05STaw\"",
		"mtime": "2026-08-28T01:15:21.116Z",
		"size": 2564,
		"path": "../public/assets/ocade.knowledge-BccTliKk.js"
	},
	"/assets/ocade.lab-CRJmAe1K.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1bc6b-nvWvojK6WAugF3YOGMYSkypU8bo\"",
		"mtime": "2026-08-28T01:15:21.116Z",
		"size": 113771,
		"path": "../public/assets/ocade.lab-CRJmAe1K.js"
	},
	"/assets/ocade.models-D3CRFwPq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a31-KL7iIehpzTs5+GY8iSwmE/nX1tA\"",
		"mtime": "2026-08-28T01:15:21.116Z",
		"size": 2609,
		"path": "../public/assets/ocade.models-D3CRFwPq.js"
	},
	"/assets/ocade.monitors-5jBR5WkC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2313-HpA0VYkxhwJJDPp9a8h98Ireag4\"",
		"mtime": "2026-08-28T01:15:21.116Z",
		"size": 8979,
		"path": "../public/assets/ocade.monitors-5jBR5WkC.js"
	},
	"/assets/ocade.notifications-25TT9eHx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"876-bTZrIiCFIL5igFbZ2iZTBrlWxJQ\"",
		"mtime": "2026-08-28T01:15:21.116Z",
		"size": 2166,
		"path": "../public/assets/ocade.notifications-25TT9eHx.js"
	},
	"/assets/ocade.permissions-C98q25B2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b18-3IyNThO9uihYsI0pSrs2lJCMDMQ\"",
		"mtime": "2026-08-28T01:15:21.116Z",
		"size": 2840,
		"path": "../public/assets/ocade.permissions-C98q25B2.js"
	},
	"/assets/ocade.search-DqZgVvcK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d4f-GAWYXxPl2sjZKzZU3WEKQ9AzeCQ\"",
		"mtime": "2026-08-28T01:15:21.117Z",
		"size": 7503,
		"path": "../public/assets/ocade.search-DqZgVvcK.js"
	},
	"/assets/ocade.projects-iFTgJ_6H.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"69b9-0f2Orv0yAvK+TOB157AN0f/RMq8\"",
		"mtime": "2026-08-28T01:15:21.116Z",
		"size": 27065,
		"path": "../public/assets/ocade.projects-iFTgJ_6H.js"
	},
	"/assets/ocade.studio-Cf4sJMEx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1787-rbaQ3j3UZS/ZHBupYB4JLWNp30E\"",
		"mtime": "2026-08-28T01:15:21.117Z",
		"size": 6023,
		"path": "../public/assets/ocade.studio-Cf4sJMEx.js"
	},
	"/assets/ocade.system-S3yqIdfu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b6e-GlqmUlQ6WXQRwzQOrkn/zXcacq0\"",
		"mtime": "2026-08-28T01:15:21.117Z",
		"size": 2926,
		"path": "../public/assets/ocade.system-S3yqIdfu.js"
	},
	"/assets/ocade.tasks-f_FZOzKQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb-tYGdeMtpBaIkuV946S5apDUbJFw\"",
		"mtime": "2026-08-28T01:15:21.117Z",
		"size": 187,
		"path": "../public/assets/ocade.tasks-f_FZOzKQ.js"
	},
	"/assets/ocade.templates-CjxtZDMT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86e-RY8qdeTKjQzzlymAWd2e+pEZ+Lk\"",
		"mtime": "2026-08-28T01:15:21.117Z",
		"size": 2158,
		"path": "../public/assets/ocade.templates-CjxtZDMT.js"
	},
	"/assets/ocade.shared-DQzmb5Jr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"85e-lB4khzpWuDFabcgteHfxCpmPr60\"",
		"mtime": "2026-08-28T01:15:21.117Z",
		"size": 2142,
		"path": "../public/assets/ocade.shared-DQzmb5Jr.js"
	},
	"/assets/ocade.work-D1ZcXy2N.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1212-AyH6av3/2DdrzxOlDhhJOXfA70c\"",
		"mtime": "2026-08-28T01:15:21.117Z",
		"size": 4626,
		"path": "../public/assets/ocade.work-D1ZcXy2N.js"
	},
	"/assets/offline-queue-DCgT3E8_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1022-+HPUrO/Ax7RUoDjtibyncAztEl8\"",
		"mtime": "2026-08-28T01:15:21.117Z",
		"size": 4130,
		"path": "../public/assets/offline-queue-DCgT3E8_.js"
	},
	"/assets/onboarding-KqpiikcM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2455-OSFRE+PFD5uCthqKObo9WyuTajM\"",
		"mtime": "2026-08-28T01:15:21.117Z",
		"size": 9301,
		"path": "../public/assets/onboarding-KqpiikcM.js"
	},
	"/assets/otp-DjLZa1Bh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf-a6ETjDOg4CEzdZQGVnx9xjn5ni4\"",
		"mtime": "2026-08-28T01:15:21.117Z",
		"size": 975,
		"path": "../public/assets/otp-DjLZa1Bh.js"
	},
	"/assets/pack-registry-weB0IOhS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f715-SX7auuPnaPRXHBXJ45b+bGzztJ8\"",
		"mtime": "2026-08-28T01:15:21.117Z",
		"size": 63253,
		"path": "../public/assets/pack-registry-weB0IOhS.js"
	},
	"/assets/paddle-CD57KC5U.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"761-zrXkiiobTTcjOPR7t1MnGwv4WlM\"",
		"mtime": "2026-08-28T01:15:21.118Z",
		"size": 1889,
		"path": "../public/assets/paddle-CD57KC5U.js"
	},
	"/assets/paired-credentials-BdTt8GO6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3a5-qzcTcelsb5m8nTY7thSSv7fJ9Gc\"",
		"mtime": "2026-08-28T01:15:21.118Z",
		"size": 933,
		"path": "../public/assets/paired-credentials-BdTt8GO6.js"
	},
	"/assets/paired-desktop-CRlgl01N.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c19-v4ah0daiI0KvIzpnvg6G+PbgrJo\"",
		"mtime": "2026-08-28T01:15:21.118Z",
		"size": 3097,
		"path": "../public/assets/paired-desktop-CRlgl01N.js"
	},
	"/assets/patch-EXKdKZzr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1211-HXETKTXza6inPnwdJDPOFn0Qzy0\"",
		"mtime": "2026-08-28T01:15:21.118Z",
		"size": 4625,
		"path": "../public/assets/patch-EXKdKZzr.js"
	},
	"/assets/payments-readiness.functions-Df3BmSW8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"916-p1TuYLOTqsTM4VoIKNBVE/Aj7A4\"",
		"mtime": "2026-08-28T01:15:21.118Z",
		"size": 2326,
		"path": "../public/assets/payments-readiness.functions-Df3BmSW8.js"
	},
	"/assets/pdf-cdvfLdxt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"686a1-iBQrg6JO/2sxrao8tDZ4r4FMHT8\"",
		"mtime": "2026-08-28T01:15:21.118Z",
		"size": 427681,
		"path": "../public/assets/pdf-cdvfLdxt.js"
	},
	"/assets/permission-settings-Op_IKKjI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f962-+BvuV+CJBu+Na5Mj/NIZEWeLl9Q\"",
		"mtime": "2026-08-28T01:15:21.118Z",
		"size": 63842,
		"path": "../public/assets/permission-settings-Op_IKKjI.js"
	},
	"/assets/preflight-BQ6wmuYC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bab-iPqmWZgwh3c3p4xM7AK8CAaLZxY\"",
		"mtime": "2026-08-28T01:15:21.118Z",
		"size": 2987,
		"path": "../public/assets/preflight-BQ6wmuYC.js"
	},
	"/assets/press-D0KTeRMJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c9e-PCeO2ArtbY+rgfRVMmWjXVkYBsM\"",
		"mtime": "2026-08-28T01:15:21.118Z",
		"size": 3230,
		"path": "../public/assets/press-D0KTeRMJ.js"
	},
	"/assets/pricing-CrntJgfr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e4e-qTofqxAu/ulJDRyzd7c3y5y5qgg\"",
		"mtime": "2026-08-28T01:15:21.119Z",
		"size": 3662,
		"path": "../public/assets/pricing-CrntJgfr.js"
	},
	"/assets/pricing-DulKmVkF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ac6-WweZ96QRqdLMmRB0X11tO8Bcfxk\"",
		"mtime": "2026-08-28T01:15:21.119Z",
		"size": 2758,
		"path": "../public/assets/pricing-DulKmVkF.js"
	},
	"/assets/privacy-DFsOd5nt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f3-xSv0qcrQBigdSH1z+ccs0+YQraE\"",
		"mtime": "2026-08-28T01:15:21.119Z",
		"size": 243,
		"path": "../public/assets/privacy-DFsOd5nt.js"
	},
	"/assets/products.ocade-Djy14L4C.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a5e-3jLe0Pr8C/ncoSdL1Z/Wj5cWlQ4\"",
		"mtime": "2026-08-28T01:15:21.119Z",
		"size": 6750,
		"path": "../public/assets/products.ocade-Djy14L4C.js"
	},
	"/assets/public-content-BHiEcfah.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dfd-n1E3dTQXkgClEA6Pyiwp19soZ/k\"",
		"mtime": "2026-08-28T01:15:21.119Z",
		"size": 3581,
		"path": "../public/assets/public-content-BHiEcfah.js"
	},
	"/assets/public-identity-Bw1Z-EQ7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb8-Un27wWzmQzT61u5ivEC9J4ZUN8w\"",
		"mtime": "2026-08-28T01:15:21.119Z",
		"size": 3e3,
		"path": "../public/assets/public-identity-Bw1Z-EQ7.js"
	},
	"/assets/research.functions-WwpwByzW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"165-OY0PE6H8/jw8oCh7JeE2fI+OiZE\"",
		"mtime": "2026-08-28T01:15:21.119Z",
		"size": 357,
		"path": "../public/assets/research.functions-WwpwByzW.js"
	},
	"/assets/reset-password-DgE41Gfe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"14ec-xn6QXGCGHpNQn/7NH8EFCuOQ7zg\"",
		"mtime": "2026-08-28T01:15:21.119Z",
		"size": 5356,
		"path": "../public/assets/reset-password-DgE41Gfe.js"
	},
	"/assets/rolldown-runtime-DAXXjFlN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5-2encFCuTik/YJedDUFEd4geNCVs\"",
		"mtime": "2026-08-28T01:15:21.119Z",
		"size": 1269,
		"path": "../public/assets/rolldown-runtime-DAXXjFlN.js"
	},
	"/assets/route-GkITkgHZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"497-40dCjbC0B3qGweKkL35E1hmKz24\"",
		"mtime": "2026-08-28T01:15:21.120Z",
		"size": 1175,
		"path": "../public/assets/route-GkITkgHZ.js"
	},
	"/assets/route-inOzazdO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1974-6YTj8OSMFVyQ8MkK85XkuKgF/hA\"",
		"mtime": "2026-08-28T01:15:21.120Z",
		"size": 6516,
		"path": "../public/assets/route-inOzazdO.js"
	},
	"/assets/router-policy-CxUOW51h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5ed-xg0EophnrkdSnKmJEBbIn+4yJkU\"",
		"mtime": "2026-08-28T01:15:21.120Z",
		"size": 1517,
		"path": "../public/assets/router-policy-CxUOW51h.js"
	},
	"/assets/routes-BefCWtih.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"343c-m5AS3o9q2PF00yMkVk4yC9tJceE\"",
		"mtime": "2026-08-28T01:15:21.120Z",
		"size": 13372,
		"path": "../public/assets/routes-BefCWtih.js"
	},
	"/assets/runs-zcbIVbtd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"120c-gAKEm0tvGJfTWHhm1aP6xHnDjSg\"",
		"mtime": "2026-08-28T01:15:21.120Z",
		"size": 4620,
		"path": "../public/assets/runs-zcbIVbtd.js"
	},
	"/assets/runtime-activation-BWIGpoP2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"13c5-xZVOboxXErs3BqXQUMIqaNtRLFI\"",
		"mtime": "2026-08-28T01:15:21.120Z",
		"size": 5061,
		"path": "../public/assets/runtime-activation-BWIGpoP2.js"
	},
	"/assets/search-DZ5i_uhX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2489-TXk/Dza0qOmixNkOk6cV5bdW+NA\"",
		"mtime": "2026-08-28T01:15:21.120Z",
		"size": 9353,
		"path": "../public/assets/search-DZ5i_uhX.js"
	},
	"/assets/session-BTnEDRCv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"732-fpOcDUUeDtG5yE5t/SspZ9q+83k\"",
		"mtime": "2026-08-28T01:15:21.120Z",
		"size": 1842,
		"path": "../public/assets/session-BTnEDRCv.js"
	},
	"/assets/session-VmGvlstC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7fcf-TT/N0TzIscLU7pV+jylO+xuLaug\"",
		"mtime": "2026-08-28T01:15:21.120Z",
		"size": 32719,
		"path": "../public/assets/session-VmGvlstC.js"
	},
	"/assets/settings-BW74Jud_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"153a-tdGkTPZrGj3CO4PlBdJCxJrHqhE\"",
		"mtime": "2026-08-28T01:15:21.120Z",
		"size": 5434,
		"path": "../public/assets/settings-BW74Jud_.js"
	},
	"/assets/settings._section-DuCihlX7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c636-sqPW5GgUI/d34cdw0zjktGl8FUI\"",
		"mtime": "2026-08-28T01:15:21.121Z",
		"size": 116278,
		"path": "../public/assets/settings._section-DuCihlX7.js"
	},
	"/assets/settings.activity-DSC9bpYL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b4e-6oUjQ750vuB0aL5bFo8kUGDX26U\"",
		"mtime": "2026-08-28T01:15:21.121Z",
		"size": 11086,
		"path": "../public/assets/settings.activity-DSC9bpYL.js"
	},
	"/assets/settings.appearance-Cw1LTgA2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1bf2-Xqcao5vZcI9djl7/oXJHKoKdLbw\"",
		"mtime": "2026-08-28T01:15:21.121Z",
		"size": 7154,
		"path": "../public/assets/settings.appearance-Cw1LTgA2.js"
	},
	"/assets/settings.billing-Xwe54uR-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"330c-XMjLgL76bp2sfd7/inCD20TShBI\"",
		"mtime": "2026-08-28T01:15:21.121Z",
		"size": 13068,
		"path": "../public/assets/settings.billing-Xwe54uR-.js"
	},
	"/assets/settings.browser-DfLQiZiP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c2c-bO6QzCrP8PCM1YKTXs67e54Q5/0\"",
		"mtime": "2026-08-28T01:15:21.121Z",
		"size": 7212,
		"path": "../public/assets/settings.browser-DfLQiZiP.js"
	},
	"/assets/settings.devices-Dc6iFZso.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"22cb-Pgc8JcgDVBY2U4gXFrtq0dzhzJU\"",
		"mtime": "2026-08-28T01:15:21.121Z",
		"size": 8907,
		"path": "../public/assets/settings.devices-Dc6iFZso.js"
	},
	"/assets/settings.index-DXHPo5oO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"297a-hh22OjdfsBwqNpQ8yeRorkIoQX8\"",
		"mtime": "2026-08-28T01:15:21.121Z",
		"size": 10618,
		"path": "../public/assets/settings.index-DXHPo5oO.js"
	},
	"/assets/settings.mobile-CNq2vJgT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7582-iyz0iwfcpjFGi6anngttk/80M1g\"",
		"mtime": "2026-08-28T01:15:21.121Z",
		"size": 30082,
		"path": "../public/assets/settings.mobile-CNq2vJgT.js"
	},
	"/assets/settings.privacy-nnUeuuaH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"284e-olfKrE0y84gjAbmZ50flYZ/4Rm4\"",
		"mtime": "2026-08-28T01:15:21.121Z",
		"size": 10318,
		"path": "../public/assets/settings.privacy-nnUeuuaH.js"
	},
	"/assets/settings.security-DqAeTeIp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dc6-nT0KM/Q/TGvf6D3/9dQVPiCodlc\"",
		"mtime": "2026-08-28T01:15:21.122Z",
		"size": 11718,
		"path": "../public/assets/settings.security-DqAeTeIp.js"
	},
	"/assets/settings.skills-G6ZBKaCB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b388-kAJOL8r1ynBaVl/7J2NIhiOzgI0\"",
		"mtime": "2026-08-28T01:15:21.122Z",
		"size": 45960,
		"path": "../public/assets/settings.skills-G6ZBKaCB.js"
	},
	"/assets/settings.support-BwBEPBni.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ec6-B5ZWia0BR9pMANASFN1NWgU7FDk\"",
		"mtime": "2026-08-28T01:15:21.122Z",
		"size": 7878,
		"path": "../public/assets/settings.support-BwBEPBni.js"
	},
	"/assets/settings.tasks-BkRHYX2x.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c1-02nzPqj7B6f+/FisDIVGIwyfx3U\"",
		"mtime": "2026-08-28T01:15:21.122Z",
		"size": 193,
		"path": "../public/assets/settings.tasks-BkRHYX2x.js"
	},
	"/assets/settings.usage-C4rxMNsb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23b8-OaBstYJh9+UfSKX1mUq9/0eCX9g\"",
		"mtime": "2026-08-28T01:15:21.122Z",
		"size": 9144,
		"path": "../public/assets/settings.usage-C4rxMNsb.js"
	},
	"/assets/settings.vault-rBpuGmuN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47d3-Nf7fPmfhcevlbhGDHKnNw5ssdms\"",
		"mtime": "2026-08-28T01:15:21.122Z",
		"size": 18387,
		"path": "../public/assets/settings.vault-rBpuGmuN.js"
	},
	"/assets/settings.voice-BSlyvVGM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"334d-kYzYi7+72TRIAg3phk7dkwj5UUA\"",
		"mtime": "2026-08-28T01:15:21.122Z",
		"size": 13133,
		"path": "../public/assets/settings.voice-BSlyvVGM.js"
	},
	"/assets/shared-browser-engine-UuUjWn18.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e7f-AtpPFRkx63nAcHUnvEirQrQR4NQ\"",
		"mtime": "2026-08-28T01:15:21.122Z",
		"size": 3711,
		"path": "../public/assets/shared-browser-engine-UuUjWn18.js"
	},
	"/assets/skill-pack-BuOYZiNR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2753-+83juUeDBcGzI58mJX64ptOC/PQ\"",
		"mtime": "2026-08-28T01:15:21.122Z",
		"size": 10067,
		"path": "../public/assets/skill-pack-BuOYZiNR.js"
	},
	"/assets/solar-data-Cr1sACCj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d14-o0ZWBWvM/3TWTeCGSydO65G0noI\"",
		"mtime": "2026-08-28T01:15:21.123Z",
		"size": 3348,
		"path": "../public/assets/solar-data-Cr1sACCj.js"
	},
	"/assets/state-DxxN8SRV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7ee-m7T9F0E58f7Eq0OuZi5SIxxbCR8\"",
		"mtime": "2026-08-28T01:15:21.123Z",
		"size": 2030,
		"path": "../public/assets/state-DxxN8SRV.js"
	},
	"/assets/status-CMD2nAp0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c86-hL77RV6NNZALx8sNphEN8FXzyxs\"",
		"mtime": "2026-08-28T01:15:21.123Z",
		"size": 7302,
		"path": "../public/assets/status-CMD2nAp0.js"
	},
	"/assets/store-BogwCS0B.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15b7-JI9e1D05yXA6IjpOYgjKQ+OjeBI\"",
		"mtime": "2026-08-28T01:15:21.123Z",
		"size": 5559,
		"path": "../public/assets/store-BogwCS0B.js"
	},
	"/assets/styles-C-fHYRT0.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"25901-5q51vGJYuekPQwoKRehiEXt1BaU\"",
		"mtime": "2026-08-28T01:15:21.128Z",
		"size": 153857,
		"path": "../public/assets/styles-C-fHYRT0.css"
	},
	"/assets/support-MaBRPIIv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ce7-rEpVoOK0l/wSiCm6LEbqc4G6klM\"",
		"mtime": "2026-08-28T01:15:21.123Z",
		"size": 3303,
		"path": "../public/assets/support-MaBRPIIv.js"
	},
	"/assets/team-CXPKscGI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"85f-9y1CzJ0KInUAzLtRwd9lXafpjaw\"",
		"mtime": "2026-08-28T01:15:21.123Z",
		"size": 2143,
		"path": "../public/assets/team-CXPKscGI.js"
	},
	"/assets/terms-Bpps4ksu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f3-cvPuGTX/AZsN7IH5hUqIQ8NZdlY\"",
		"mtime": "2026-08-28T01:15:21.123Z",
		"size": 243,
		"path": "../public/assets/terms-Bpps4ksu.js"
	},
	"/assets/textarea-BjJVWo-f.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"234-WLQUwP2oN+N0pVnnu61nuB30rIU\"",
		"mtime": "2026-08-28T01:15:21.123Z",
		"size": 564,
		"path": "../public/assets/textarea-BjJVWo-f.js"
	},
	"/assets/throttle-u3W15Ydi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52e-OKczYenMlzATtKhxZH8ZOOjjqt0\"",
		"mtime": "2026-08-28T01:15:21.124Z",
		"size": 1326,
		"path": "../public/assets/throttle-u3W15Ydi.js"
	},
	"/assets/tier-benchmark-store-8QK9SMla.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"44c-xpEzkjz5potrc7uBtjtiAC+jtiU\"",
		"mtime": "2026-08-28T01:15:21.124Z",
		"size": 1100,
		"path": "../public/assets/tier-benchmark-store-8QK9SMla.js"
	},
	"/assets/transcript-redaction-D5c695T6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2171-HFwB+uZW8B5DruIZUg6h1nqjzTQ\"",
		"mtime": "2026-08-28T01:15:21.124Z",
		"size": 8561,
		"path": "../public/assets/transcript-redaction-D5c695T6.js"
	},
	"/assets/unavailable-reason-CxXmcH-x.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"33c-zMREJLSX5NtsDmAgMidxWmCLzIk\"",
		"mtime": "2026-08-28T01:15:21.124Z",
		"size": 828,
		"path": "../public/assets/unavailable-reason-CxXmcH-x.js"
	},
	"/assets/unified-task-Ct-wJCIq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ebc-MwXHAywKZKs1267pQhiSHWE+Y0w\"",
		"mtime": "2026-08-28T01:15:21.124Z",
		"size": 3772,
		"path": "../public/assets/unified-task-Ct-wJCIq.js"
	},
	"/assets/update-signature-Bgi-Ozhm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4df-dzu3Uyqwlyj1Zwx6HLm3HPkDwmU\"",
		"mtime": "2026-08-28T01:15:21.124Z",
		"size": 1247,
		"path": "../public/assets/update-signature-Bgi-Ozhm.js"
	},
	"/assets/use-brain-C4gdnbJ4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f03-yOK1bryfw/3oZnj/Us+8i44FBxU\"",
		"mtime": "2026-08-28T01:15:21.124Z",
		"size": 3843,
		"path": "../public/assets/use-brain-C4gdnbJ4.js"
	},
	"/assets/use-capabilities-DbgFml9W.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c02-4j2yJzywzskVpXZFfwyv1k7aIaA\"",
		"mtime": "2026-08-28T01:15:21.124Z",
		"size": 11266,
		"path": "../public/assets/use-capabilities-DbgFml9W.js"
	},
	"/assets/use-chat-prefs-CZlk0HKL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"64c-sSembQAMF1+QX+mb0OPOs6Xl3Ec\"",
		"mtime": "2026-08-28T01:15:21.125Z",
		"size": 1612,
		"path": "../public/assets/use-chat-prefs-CZlk0HKL.js"
	},
	"/assets/use-demo-CDigG9AR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"128-eDRXCL/+dYtxz19YGPyDkLTa5h4\"",
		"mtime": "2026-08-28T01:15:21.125Z",
		"size": 296,
		"path": "../public/assets/use-demo-CDigG9AR.js"
	},
	"/assets/use-demo-session-DvAhS03-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a4a-HthKmyFmv3h9sJx2gnM0j7qIwFw\"",
		"mtime": "2026-08-28T01:15:21.125Z",
		"size": 6730,
		"path": "../public/assets/use-demo-session-DvAhS03-.js"
	},
	"/assets/use-device-policy-Blyzfz6d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1405-BUvsQLnbES6Gg+zlckHrnpo+NhY\"",
		"mtime": "2026-08-28T01:15:21.125Z",
		"size": 5125,
		"path": "../public/assets/use-device-policy-Blyzfz6d.js"
	},
	"/assets/use-dictation-CzyeBbq7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4b04-7lz2qT0G8osiB8QSnDr6FH/P79U\"",
		"mtime": "2026-08-28T01:15:21.125Z",
		"size": 19204,
		"path": "../public/assets/use-dictation-CzyeBbq7.js"
	},
	"/assets/use-limits-B2vt3-ru.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c08-8QxxYB3Lc6Ag2XZ6BKDqL9bIN1g\"",
		"mtime": "2026-08-28T01:15:21.125Z",
		"size": 3080,
		"path": "../public/assets/use-limits-B2vt3-ru.js"
	},
	"/assets/use-local-engine-DC6_rYk3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d1a-Vuhxo11qf9fD1S5gFGUuf6rDIus\"",
		"mtime": "2026-08-28T01:15:21.125Z",
		"size": 3354,
		"path": "../public/assets/use-local-engine-DC6_rYk3.js"
	},
	"/assets/use-mission-brain-CpcbakT9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1579d-IwNMDn49RSRHEyJ5JrGVcx8aoKE\"",
		"mtime": "2026-08-28T01:15:21.126Z",
		"size": 87965,
		"path": "../public/assets/use-mission-brain-CpcbakT9.js"
	},
	"/assets/use-online-CXunBi7G.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c8-sxxRaI3YIhYUU8NqANt44VxjCSU\"",
		"mtime": "2026-08-28T01:15:21.126Z",
		"size": 456,
		"path": "../public/assets/use-online-CXunBi7G.js"
	},
	"/assets/use-settings-access-BtFlRhWI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-UiD9a75ZbMEZeqVYT1xGruqI6UY\"",
		"mtime": "2026-08-28T01:15:21.126Z",
		"size": 251,
		"path": "../public/assets/use-settings-access-BtFlRhWI.js"
	},
	"/assets/use-shell-DD7w3eib.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ca-k7zrXWFg3T5sFkvJyHMWORwFAgg\"",
		"mtime": "2026-08-28T01:15:21.126Z",
		"size": 202,
		"path": "../public/assets/use-shell-DD7w3eib.js"
	},
	"/assets/use-voice-prefs-C3YcXQQR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b08-7CHYJ1t7TSPh8Da8FEntqRz6CaA\"",
		"mtime": "2026-08-28T01:15:21.126Z",
		"size": 2824,
		"path": "../public/assets/use-voice-prefs-C3YcXQQR.js"
	},
	"/assets/vault-BKAAX6Ky.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1469-vMz4TMJLN9zQw6P/SxKrn9mP83o\"",
		"mtime": "2026-08-28T01:15:21.126Z",
		"size": 5225,
		"path": "../public/assets/vault-BKAAX6Ky.js"
	},
	"/assets/vendor-mammoth-Dpq0khGw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"79667-yat456Rdzc89mGmuoEmeYx6S17E\"",
		"mtime": "2026-08-28T01:15:21.126Z",
		"size": 497255,
		"path": "../public/assets/vendor-mammoth-Dpq0khGw.js"
	},
	"/assets/vendor-markdown-CJdAOkbM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c329-jkqcjH7TYhNPRSsO0D4q0vleV/s\"",
		"mtime": "2026-08-28T01:15:21.127Z",
		"size": 115497,
		"path": "../public/assets/vendor-markdown-CJdAOkbM.js"
	},
	"/assets/vendor-react-CX2mWblQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2e56d-qrX6GvMoYNkdEag7AoGUlpZrTKw\"",
		"mtime": "2026-08-28T01:15:21.127Z",
		"size": 189805,
		"path": "../public/assets/vendor-react-CX2mWblQ.js"
	},
	"/assets/vendor-runtime-Czpn1I53.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4ac-sE+5KsaRXTMfwOfrOATQajMSGV4\"",
		"mtime": "2026-08-28T01:15:21.127Z",
		"size": 1196,
		"path": "../public/assets/vendor-runtime-Czpn1I53.js"
	},
	"/assets/vendor-supabase-DSyywpEH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31ffe-LFSgZ+b88LeCDCMCAFoHHin+614\"",
		"mtime": "2026-08-28T01:15:21.127Z",
		"size": 204798,
		"path": "../public/assets/vendor-supabase-DSyywpEH.js"
	},
	"/assets/vendor-ui-Dzo6ZTd8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16455-FRK3JkUCjZnUC43gOSTINh3uk3c\"",
		"mtime": "2026-08-28T01:15:21.128Z",
		"size": 91221,
		"path": "../public/assets/vendor-ui-Dzo6ZTd8.js"
	},
	"/assets/webllm.server-DNYK_aeU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e1-Us1T5KPTXPRBgWxerF+xOrVbVS4\"",
		"mtime": "2026-08-28T01:15:21.128Z",
		"size": 225,
		"path": "../public/assets/webllm.server-DNYK_aeU.js"
	},
	"/assets/webllm.worker-BYUasHjv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6-gzTuXHvqWN3WhQkR86gwLh/4ICk\"",
		"mtime": "2026-08-28T01:15:21.156Z",
		"size": 166,
		"path": "../public/assets/webllm.worker-BYUasHjv.js"
	},
	"/assets/wllama-CfujTeeK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3a-XHS6PgwOix/pzsr2L7s2oAAni5k\"",
		"mtime": "2026-08-28T01:15:21.128Z",
		"size": 58,
		"path": "../public/assets/wllama-CfujTeeK.js"
	},
	"/assets/wllama-Dk3sV4-d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"48b4e-XVvVylqXX1LnpZS7y5u/rSV5znE\"",
		"mtime": "2026-08-28T01:15:21.128Z",
		"size": 297806,
		"path": "../public/assets/wllama-Dk3sV4-d.js"
	},
	"/brand/ocade-carcc-wordmark.png": {
		"type": "image/png",
		"etag": "\"7c79a-hDONFyhF6C6vVUP8oUwl+uIk1Hs\"",
		"mtime": "2026-08-28T01:15:25.672Z",
		"size": 509850,
		"path": "../public/brand/ocade-carcc-wordmark.png"
	},
	"/cursors/caera-black.svg": {
		"type": "image/svg+xml",
		"etag": "\"e3-cOVBa1MjhDbN4IhGTA4fG6luTC0\"",
		"mtime": "2026-08-28T01:15:25.671Z",
		"size": 227,
		"path": "../public/cursors/caera-black.svg"
	},
	"/cursors/caera-white.svg": {
		"type": "image/svg+xml",
		"etag": "\"e3-K8Ph3SHLSn3xKyibe7XMGertmUU\"",
		"mtime": "2026-08-28T01:15:25.672Z",
		"size": 227,
		"path": "../public/cursors/caera-white.svg"
	},
	"/fonts/OFL-InstrumentSerif.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"1135-gDiCV59Tkow3oVdZoNLGxJNQ2gw\"",
		"mtime": "2026-08-28T01:15:25.671Z",
		"size": 4405,
		"path": "../public/fonts/OFL-InstrumentSerif.txt"
	},
	"/fonts/OFL-Inter.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"1119-zdAbfmjbgdZj8cOCC298QAKJAN0\"",
		"mtime": "2026-08-28T01:15:25.672Z",
		"size": 4377,
		"path": "../public/fonts/OFL-Inter.txt"
	},
	"/fonts/OFL-JetBrainsMono.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"112f-L7YAWH1CBVh/6187FKNT6l1P76A\"",
		"mtime": "2026-08-28T01:15:25.672Z",
		"size": 4399,
		"path": "../public/fonts/OFL-JetBrainsMono.txt"
	},
	"/fonts/README.md": {
		"type": "text/markdown; charset=utf-8",
		"etag": "\"721-454yencTVI81kp700tfqHRuG7dE\"",
		"mtime": "2026-08-28T01:15:25.672Z",
		"size": 1825,
		"path": "../public/fonts/README.md"
	},
	"/fonts/instrument-serif-italic-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"5670-JObJnKCLHlrMks8QbFhvSR7RUVE\"",
		"mtime": "2026-08-28T01:15:25.673Z",
		"size": 22128,
		"path": "../public/fonts/instrument-serif-italic-latin.woff2"
	},
	"/fonts/instrument-serif-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"5228-N930ZbvMJSd2o33PKBeaPKWQNjs\"",
		"mtime": "2026-08-28T01:15:25.673Z",
		"size": 21032,
		"path": "../public/fonts/instrument-serif-latin.woff2"
	},
	"/fonts/inter-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"bc80-8R1ym7Ck2DUNLqPQ/AYs9u8tUpg\"",
		"mtime": "2026-08-28T01:15:25.673Z",
		"size": 48256,
		"path": "../public/fonts/inter-latin.woff2"
	},
	"/fonts/jetbrains-mono-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"9dd4-5yd+cUUhzrXxdMyYebUeD0qml1M\"",
		"mtime": "2026-08-28T01:15:25.673Z",
		"size": 40404,
		"path": "../public/fonts/jetbrains-mono-latin.woff2"
	},
	"/icons/ocade-128.png": {
		"type": "image/png",
		"etag": "\"2871-IZB027IPQeXA1Uie+syfBzKl93I\"",
		"mtime": "2026-08-28T01:15:25.673Z",
		"size": 10353,
		"path": "../public/icons/ocade-128.png"
	},
	"/icons/ocade-192.png": {
		"type": "image/png",
		"etag": "\"5149-wzeR766lYdZEadVNBUoDzG48A0c\"",
		"mtime": "2026-08-28T01:15:25.672Z",
		"size": 20809,
		"path": "../public/icons/ocade-192.png"
	},
	"/icons/ocade-256.png": {
		"type": "image/png",
		"etag": "\"930e-FmD72307V20/TJsN9OqHrh9zjgs\"",
		"mtime": "2026-08-28T01:15:25.673Z",
		"size": 37646,
		"path": "../public/icons/ocade-256.png"
	},
	"/icons/ocade-32.png": {
		"type": "image/png",
		"etag": "\"4dc-hbUtpn6WGgeGc4D7uURQF0k5ABw\"",
		"mtime": "2026-08-28T01:15:25.672Z",
		"size": 1244,
		"path": "../public/icons/ocade-32.png"
	},
	"/icons/ocade-48.png": {
		"type": "image/png",
		"etag": "\"8cf-lg1ou1TM9yhpZPYq24/jNN0WGH0\"",
		"mtime": "2026-08-28T01:15:25.672Z",
		"size": 2255,
		"path": "../public/icons/ocade-48.png"
	},
	"/icons/ocade-512.png": {
		"type": "image/png",
		"etag": "\"282f1-veO7ECjckHeDITMr9SUQUZwBKSE\"",
		"mtime": "2026-08-28T01:15:25.672Z",
		"size": 164593,
		"path": "../public/icons/ocade-512.png"
	},
	"/models/README.md": {
		"type": "text/markdown; charset=utf-8",
		"etag": "\"639-kNCQYFm5MybzQOVkkzMUoMWvI3c\"",
		"mtime": "2026-08-28T01:15:25.671Z",
		"size": 1593,
		"path": "../public/models/README.md"
	},
	"/brand/ocade-carcc-mark.png": {
		"type": "image/png",
		"etag": "\"a4249-vxI0sbhEiBkI+cWc8Av0Y58BB3A\"",
		"mtime": "2026-08-28T01:15:25.670Z",
		"size": 672329,
		"path": "../public/brand/ocade-carcc-mark.png"
	},
	"/assets/wllama-m-NqGU8W.wasm": {
		"type": "application/wasm",
		"etag": "\"74d449-/5qFKdxtVjp8khmNdIXiGMaJl+Y\"",
		"mtime": "2026-08-28T01:15:21.128Z",
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
