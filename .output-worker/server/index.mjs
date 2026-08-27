globalThis.__nitro_main__ = import.meta.url;
import { a as FastResponse, n as HTTPError, r as defineLazyEventHandler, t as H3Core } from "./_libs/h3+rou3+srvx+unenv.mjs";
import { t as HookableCore } from "./_libs/hookable.mjs";
import processModule from "node:process";
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
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/apple-touch-icon.png": {
		"type": "image/png",
		"etag": "\"482e-AHyOEKNRVkt/DeKr9FzKKjHuYgE\"",
		"mtime": "2026-08-27T00:58:02.933Z",
		"size": 18478,
		"path": "../public/apple-touch-icon.png"
	},
	"/favicon.ico": {
		"type": "image/vnd.microsoft.icon",
		"etag": "\"fb4-0SojhBjTCdtondWh2OQc0bbHnA8\"",
		"mtime": "2026-08-27T00:58:02.933Z",
		"size": 4020,
		"path": "../public/favicon.ico"
	},
	"/manifest.webmanifest": {
		"type": "application/manifest+json",
		"etag": "\"2b9-7HLG94qjlshQnx59E+/ByIlfznI\"",
		"mtime": "2026-08-27T00:58:02.933Z",
		"size": 697,
		"path": "../public/manifest.webmanifest"
	},
	"/offline.html": {
		"type": "text/html; charset=utf-8",
		"etag": "\"a05-pzaEkxiSga8R/E5QnxVTL9w7Wcc\"",
		"mtime": "2026-08-27T00:58:02.933Z",
		"size": 2565,
		"path": "../public/offline.html"
	},
	"/sw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2420-AasKX7vT5uSpXrBz7I2paDU8UmE\"",
		"mtime": "2026-08-27T00:58:02.933Z",
		"size": 9248,
		"path": "../public/sw.js"
	},
	"/brand/ocade-carcc-wordmark.png": {
		"type": "image/png",
		"etag": "\"7c79a-hDONFyhF6C6vVUP8oUwl+uIk1Hs\"",
		"mtime": "2026-08-27T00:58:02.932Z",
		"size": 509850,
		"path": "../public/brand/ocade-carcc-wordmark.png"
	},
	"/cursors/caera-white.svg": {
		"type": "image/svg+xml",
		"etag": "\"e3-K8Ph3SHLSn3xKyibe7XMGertmUU\"",
		"mtime": "2026-08-27T00:58:02.932Z",
		"size": 227,
		"path": "../public/cursors/caera-white.svg"
	},
	"/cursors/caera-black.svg": {
		"type": "image/svg+xml",
		"etag": "\"e3-cOVBa1MjhDbN4IhGTA4fG6luTC0\"",
		"mtime": "2026-08-27T00:58:02.932Z",
		"size": 227,
		"path": "../public/cursors/caera-black.svg"
	},
	"/assets/AppShell-BX-SDvmA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb-zmbQH+KvyVKYuL2gIDK1+bDGLqU\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 187,
		"path": "../public/assets/AppShell-BX-SDvmA.js"
	},
	"/assets/AuthShell-BaO2iQrd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"886-mWQdmL7u9/LtjWqHIQIpoa2DzkA\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 2182,
		"path": "../public/assets/AuthShell-BaO2iQrd.js"
	},
	"/assets/BrandMark-BsUl0NCA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"38a-EAgvUultK2JbTT4aDMw2sXZheDg\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 906,
		"path": "../public/assets/BrandMark-BsUl0NCA.js"
	},
	"/assets/CapabilityBadge-DbFmIxP6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9bd-suDUr1bftFwbGTMTqhrvkMDVTfU\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 2493,
		"path": "../public/assets/CapabilityBadge-DbFmIxP6.js"
	},
	"/assets/ChatSidebar-BgJ-eeSB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"100f-tP1XO0MzuSoMUWTEwNg6J1x0x7A\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 4111,
		"path": "../public/assets/ChatSidebar-BgJ-eeSB.js"
	},
	"/assets/ComingLater-CEyRkEHT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4dc-fHONggIZJJtX7TAE6W+00YJwTAU\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 1244,
		"path": "../public/assets/ComingLater-CEyRkEHT.js"
	},
	"/assets/DiagnosticsPanel-fBY1IPDv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3313-5/e7D/VzOJEHmgRAjzsKu49C/LA\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 13075,
		"path": "../public/assets/DiagnosticsPanel-fBY1IPDv.js"
	},
	"/assets/EmptyState-DzZ8gXzf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"202-xTuWK3m9FDeA5KlJqiZ1u7BzNtM\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 514,
		"path": "../public/assets/EmptyState-DzZ8gXzf.js"
	},
	"/assets/GestureControlPanel-eWH-ED9A.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16ab-jSZ2qQT+gT0xNmHc2Ad587WcBPY\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 5803,
		"path": "../public/assets/GestureControlPanel-eWH-ED9A.js"
	},
	"/assets/GlassPanel-DNw3lQBo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"225-fe991qX4EdriIj25auarbbcNHzA\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 549,
		"path": "../public/assets/GlassPanel-DNw3lQBo.js"
	},
	"/assets/LivingIntelligenceBackdrop-fgAL3kGx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19c3-0xhx/2F+xhZ7hCMkCcVxXroviQY\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 6595,
		"path": "../public/assets/LivingIntelligenceBackdrop-fgAL3kGx.js"
	},
	"/assets/LocalEngineControl-BIsylMMg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e4d-VS0Sik8M8Jont81AKp46c2NMlCQ\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 7757,
		"path": "../public/assets/LocalEngineControl-BIsylMMg.js"
	},
	"/assets/OcadeCompanion-B47CxcYY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5e5-YqsVGRBq/5BoonNM/BNyxCx36FM\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 1509,
		"path": "../public/assets/OcadeCompanion-B47CxcYY.js"
	},
	"/assets/OcadeOrb-DJ1XRgvv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a4-CDmwKiU+ca3IyQ5wx+xE9SGHufM\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 1444,
		"path": "../public/assets/OcadeOrb-DJ1XRgvv.js"
	},
	"/assets/OcadeOrbCanvas-OA5_r3-r.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b0a-WZWoxqaoeuiESWQ3vMcMF4zMfD4\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 6922,
		"path": "../public/assets/OcadeOrbCanvas-OA5_r3-r.js"
	},
	"/assets/PageHeader-C0zSkLIw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ce-iho/5zo8cTFQLp9/yUhwECi4cW0\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 718,
		"path": "../public/assets/PageHeader-C0zSkLIw.js"
	},
	"/brand/ocade-carcc-mark.png": {
		"type": "image/png",
		"etag": "\"a4249-vxI0sbhEiBkI+cWc8Av0Y58BB3A\"",
		"mtime": "2026-08-27T00:58:02.932Z",
		"size": 672329,
		"path": "../public/brand/ocade-carcc-mark.png"
	},
	"/assets/PerformanceFallbackNotice-D-hcFKO6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"81f-oisENjRdbOq6yT7oqCgqSnj50Yo\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 2079,
		"path": "../public/assets/PerformanceFallbackNotice-D-hcFKO6.js"
	},
	"/assets/PlanComparison-BAE8bT7M.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"111e-T4riF8e1QY0q+sYOJqn+YTa1wHM\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 4382,
		"path": "../public/assets/PlanComparison-BAE8bT7M.js"
	},
	"/assets/SettingsGate-BjHe7kPa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"727-XDrFhsjlQwXSNI03yoGQnYswSso\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 1831,
		"path": "../public/assets/SettingsGate-BjHe7kPa.js"
	},
	"/assets/SetupRequiredState-a9x3vJko.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3d8-mra1LB5FJMhOYz8z4Xs5EDwuMpI\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 984,
		"path": "../public/assets/SetupRequiredState-a9x3vJko.js"
	},
	"/assets/StatusBadge-DyhMcbSe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"658-P7tA0KcRCSX5G5fB6E3D8MXwqMI\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 1624,
		"path": "../public/assets/StatusBadge-DyhMcbSe.js"
	},
	"/assets/TasksWorkspace-CJfXJF0W.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"907a-e7Gi4B2EWTlH9auBli/ZMJk5/5g\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 36986,
		"path": "../public/assets/TasksWorkspace-CJfXJF0W.js"
	},
	"/assets/TruthfulFailurePanel-Jr9zZ15q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"784-LKIG9saVpsAlzGMNrd1wVDXndDM\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 1924,
		"path": "../public/assets/TruthfulFailurePanel-Jr9zZ15q.js"
	},
	"/assets/WorkspaceShell-GxL_jNV7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6cbb-VHtWVWyCZbYHmkDif0RaUYx70Dc\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 27835,
		"path": "../public/assets/WorkspaceShell-GxL_jNV7.js"
	},
	"/assets/_._lovable.oauth.consent-Bra60dod.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"18e-3QjMyqJG0iGPGJYi0kiTCCUDlkM\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 398,
		"path": "../public/assets/_._lovable.oauth.consent-Bra60dod.js"
	},
	"/assets/_._lovable.oauth.consent-USTl5bcP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66d-a80gaw4NaL/TaOQlhoNVAKykUxo\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 1645,
		"path": "../public/assets/_._lovable.oauth.consent-USTl5bcP.js"
	},
	"/assets/about-CMm7ln-D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"187a-Ms9pQ/JqZQP4wxE3O3a9bI3/pPs\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 6266,
		"path": "../public/assets/about-CMm7ln-D.js"
	},
	"/assets/access-denied-DXmTtZEJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"624-Nx6pKVC5q+4NeG1AdzrXbH86S20\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 1572,
		"path": "../public/assets/access-denied-DXmTtZEJ.js"
	},
	"/assets/actions-sL9qFG5V.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"275c-0esYknQvjkQRhXoWiw1PvLnIvP8\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 10076,
		"path": "../public/assets/actions-sL9qFG5V.js"
	},
	"/assets/admin.launch-gate-mRd6NMwb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a97-m58y8noIKNlY6Ixpx7jVv1YqA5E\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 23191,
		"path": "../public/assets/admin.launch-gate-mRd6NMwb.js"
	},
	"/assets/admin.payments-checklist-CTJEDSSP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26c8-aixmqiAUi0WqzXIcjvOHJccK/H8\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 9928,
		"path": "../public/assets/admin.payments-checklist-CTJEDSSP.js"
	},
	"/assets/admin.support-Ch2NuFtz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16f9-6BBVEn9mE1a+70X/VFbIohrQ7Ok\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 5881,
		"path": "../public/assets/admin.support-Ch2NuFtz.js"
	},
	"/assets/admin.users-KkYGh7tf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16a8-yrLaYe37D/R7w/K6Ok8l1pPlvZk\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 5800,
		"path": "../public/assets/admin.users-KkYGh7tf.js"
	},
	"/assets/agent.functions-ykjTEarP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c1-QEAHiAf+hCAGJNgI9I4ZiL0guBw\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 705,
		"path": "../public/assets/agent.functions-ykjTEarP.js"
	},
	"/assets/auth-V9VFbbWd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5324-XlGVRzp8LoV6BNRtu7ACZLfhs3w\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 21284,
		"path": "../public/assets/auth-V9VFbbWd.js"
	},
	"/assets/auth-middleware-HKwZBzfs.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4e-Vva1PSQoCE8SnmWCpFkttfASvz8\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 78,
		"path": "../public/assets/auth-middleware-HKwZBzfs.js"
	},
	"/assets/auth.callback-CIPbxcVa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ae1-B+/s/XfhBRJTvQEAIBF1cPEw5FI\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 2785,
		"path": "../public/assets/auth.callback-CIPbxcVa.js"
	},
	"/assets/auth.verify-Bg_RN5Xv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1065-vLzXz99eYyR0Figie7trjRr7u4o\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 4197,
		"path": "../public/assets/auth.verify-Bg_RN5Xv.js"
	},
	"/assets/blog-OJ3lrKb1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9c-47iH8h+DIWJJxWrTXOxQBP/RCpc\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 156,
		"path": "../public/assets/blog-OJ3lrKb1.js"
	},
	"/assets/blog._slug-0TmWmL-p.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eea-vw1S/NuZKK8WUumHSCSuZ2u7vIA\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 3818,
		"path": "../public/assets/blog._slug-0TmWmL-p.js"
	},
	"/assets/SolarSystem-N35KlH9C.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86b9f-SzlaMqSy4jY+Hh9uxpxOSvyJZ8s\"",
		"mtime": "2026-08-27T00:57:57.067Z",
		"size": 551839,
		"path": "../public/assets/SolarSystem-N35KlH9C.js"
	},
	"/assets/cania-DC_gLbx8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10b-I2vNzEVcdxNDe7f/juxbenfN2H8\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 267,
		"path": "../public/assets/cania-DC_gLbx8.js"
	},
	"/assets/careers-B8tV-H5v.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7bc-OFmYjQYw2ZG3k5RW+QokP2ObEIs\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 1980,
		"path": "../public/assets/careers-B8tV-H5v.js"
	},
	"/assets/blog.index-BGPwMjGO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d2c-jfsE4HjoQCyutCaIqrWZ9ao8Hjs\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 3372,
		"path": "../public/assets/blog.index-BGPwMjGO.js"
	},
	"/assets/chat-citation-store-M_3d5V2j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c39-b7Li7a473VJcdIXAd3OsyvbO0qQ\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 7225,
		"path": "../public/assets/chat-citation-store-M_3d5V2j.js"
	},
	"/assets/chat-output-flow-DIpihmu3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c47-1jA1WJBS5V5qyHujBFPhXZxp81s\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 3143,
		"path": "../public/assets/chat-output-flow-DIpihmu3.js"
	},
	"/assets/checkout.success-BfrQpKtO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b7c-IxjwSQMSAVuzLtM/mC615yWcwFg\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 2940,
		"path": "../public/assets/checkout.success-BfrQpKtO.js"
	},
	"/assets/company-Djw51rxg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dd9-i5Hu1v1PdzHcMZUyP/mRG+HF6V4\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 3545,
		"path": "../public/assets/company-Djw51rxg.js"
	},
	"/assets/compliance-log.functions-B79PStmM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-4GWrCPmzz/3JrVxIFYShs78Vkgg\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 251,
		"path": "../public/assets/compliance-log.functions-B79PStmM.js"
	},
	"/assets/computer-use-settings-EGzAqqOS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a0f-2d9maaE65OOhpMLiPiR46hqqTb4\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 2575,
		"path": "../public/assets/computer-use-settings-EGzAqqOS.js"
	},
	"/assets/data-rights-zPtvryxo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ce8-x7jDWCVcS7/ww5dvDOz/+7g9Cf0\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 3304,
		"path": "../public/assets/data-rights-zPtvryxo.js"
	},
	"/assets/demo-iVtVU5LZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3c1-wMeDJHFRiZn0tSZRbNcrdggdusE\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 961,
		"path": "../public/assets/demo-iVtVU5LZ.js"
	},
	"/assets/demo.control-DNSM46WU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99d-CanANut1lPduhAacMobGhGnpNqk\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 2461,
		"path": "../public/assets/demo.control-DNSM46WU.js"
	},
	"/assets/demo.settings-Cz3otJdf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"edb-tj4LVXly5iaA0DQr9fUVYPKyslk\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 3803,
		"path": "../public/assets/demo.settings-Cz3otJdf.js"
	},
	"/assets/demo.ocade-BKXxaVpH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6155-TtcVUWu1SHzHffC0wZomBS57MZw\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 24917,
		"path": "../public/assets/demo.ocade-BKXxaVpH.js"
	},
	"/assets/devices-BPXGa4AD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e0f-v2t1Upttnj5LqNdSnOIUX2cU8DU\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 3599,
		"path": "../public/assets/devices-BPXGa4AD.js"
	},
	"/assets/download-C7D63KtE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1027-IvDjzTYEM5WVCfgei+ahnKdFxVg\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 4135,
		"path": "../public/assets/download-C7D63KtE.js"
	},
	"/assets/faq-D67Px5E-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1420-64GG9V24M+1RxbReR6MYkC2itpE\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 5152,
		"path": "../public/assets/faq-D67Px5E-.js"
	},
	"/assets/ficia-B7op3wP8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"105-oX27CYk0QSDApcdcP5hrvVvr0jY\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 261,
		"path": "../public/assets/ficia-B7op3wP8.js"
	},
	"/assets/founder.haans-antoni-Bl2rkcoN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c3f-JQa/2WUkb6MSNWZGRF08n2WSbjo\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 3135,
		"path": "../public/assets/founder.haans-antoni-Bl2rkcoN.js"
	},
	"/assets/index-CPNFD7rA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7cc29-L/INdCAdP7yAGybwABAqp9/PtO0\"",
		"mtime": "2026-08-27T00:57:57.065Z",
		"size": 511017,
		"path": "../public/assets/index-CPNFD7rA.js"
	},
	"/assets/input-RSb2vsVA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"29a-1P0TGNXUFshruj0IHCdD5lTVMkA\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 666,
		"path": "../public/assets/input-RSb2vsVA.js"
	},
	"/assets/local-projects-C6EMlCvr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1948-PCgBmJSjGwa7HiRLIQau8316qwc\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 6472,
		"path": "../public/assets/local-projects-C6EMlCvr.js"
	},
	"/assets/local-runtime.functions-mZsaNgDO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1080-NgEzOkFaO5qDMi8iMUwNbrHYYK4\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 4224,
		"path": "../public/assets/local-runtime.functions-mZsaNgDO.js"
	},
	"/assets/madee-8RlIQaxO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"100-VrcTQ59v3YhsZTXKS1T/uFQGlGc\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 256,
		"path": "../public/assets/madee-8RlIQaxO.js"
	},
	"/assets/methods-Bmi_DJG2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2f0-5wV1FEI7fp4qwbFT2LJxidvgKAY\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 752,
		"path": "../public/assets/methods-Bmi_DJG2.js"
	},
	"/assets/model-store-ShbWJakW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19b6-C4Z3KARZdCDMKh0tZJRCFmK8AOo\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 6582,
		"path": "../public/assets/model-store-ShbWJakW.js"
	},
	"/assets/oauth-errors-D0R59ozT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8bf-aaAHKGe4/rm947FH7hWLOpTnBqQ\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 2239,
		"path": "../public/assets/oauth-errors-D0R59ozT.js"
	},
	"/assets/ocade-CHO4creD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"df-04bh7AfjC5VVZt7GnvGSzAH+d0Y\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 223,
		"path": "../public/assets/ocade-CHO4creD.js"
	},
	"/assets/ocade-allowance-BFQspkmM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52d-tfyMxsfopdsf6cD91j7mgDR2ZCk\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 1325,
		"path": "../public/assets/ocade-allowance-BFQspkmM.js"
	},
	"/assets/ocade-automations.functions-BOwDmNGc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"630-SxEErq6a708d5XousI2/FiaSiMg\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 1584,
		"path": "../public/assets/ocade-automations.functions-BOwDmNGc.js"
	},
	"/assets/ocade-core-policy-BW45ajmz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"197d-mEcY4ZRgwmsD32EGGwlCzt8gqdc\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 6525,
		"path": "../public/assets/ocade-core-policy-BW45ajmz.js"
	},
	"/assets/ocade-identity-BdM79R6-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"175-m+CJ2IY7faIQPIyy+1b+gB+G7Q8\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 373,
		"path": "../public/assets/ocade-identity-BdM79R6-.js"
	},
	"/assets/ocade-local-5XnX8HGl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e40-yBAeGMzdIIPQd5IeB1eEqF8uFa8\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 7744,
		"path": "../public/assets/ocade-local-5XnX8HGl.js"
	},
	"/assets/ocade-projects.functions-FQzjerZb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a27-6zFtFuOw/QQeU8qe14Qn+j9JC9E\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 10791,
		"path": "../public/assets/ocade-projects.functions-FQzjerZb.js"
	},
	"/assets/ocade-usage.functions-C8zP4ExF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e9-kk10nM2WqOv2DdX7ekuFoIsHKZ8\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 233,
		"path": "../public/assets/ocade-usage.functions-C8zP4ExF.js"
	},
	"/assets/ocade.activity-BNtiarC3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad4-oBPoitDQAhwVXyhhi/YSzelMtSA\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 2772,
		"path": "../public/assets/ocade.activity-BNtiarC3.js"
	},
	"/assets/ocade.connectors-CkWiayB6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"949-6pp7NfyK/i7mueZHsNlyw0QBHHc\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 2377,
		"path": "../public/assets/ocade.connectors-CkWiayB6.js"
	},
	"/assets/ocade.devices-CXCuOIy0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eb3-qxfHyS+Ayk6PUXrW/7I9jQ4KXdQ\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 3763,
		"path": "../public/assets/ocade.devices-CXCuOIy0.js"
	},
	"/assets/ocade.automations-DWnK8CZJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ea94-Jd3ImDWO4fQ9ZsTa0NRt+1Ldc9Q\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 60052,
		"path": "../public/assets/ocade.automations-DWnK8CZJ.js"
	},
	"/assets/ocade.health-B-p7O52D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4d2-SjfLos1RKSTjhsYpyivxY7Oapy4\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 1234,
		"path": "../public/assets/ocade.health-B-p7O52D.js"
	},
	"/assets/ocade.inbox-DHzdZYTL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fed-nu91IvNFfGoCUqpQ2qhl+nCzy08\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 4077,
		"path": "../public/assets/ocade.inbox-DHzdZYTL.js"
	},
	"/assets/ocade.index-D0-aAdme.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"456c9-1hyzoJ+IfG3LxshNXfoiHZ+FlRk\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 284361,
		"path": "../public/assets/ocade.index-D0-aAdme.js"
	},
	"/assets/ocade.code-DU62Qbnl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"af00-YgSALN7/fU9zlfJoYLLgVzmClbo\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 44800,
		"path": "../public/assets/ocade.code-DU62Qbnl.js"
	},
	"/assets/ocade.artifacts-C5QlpaEZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"211e-bGxJhKSDt1b/lowvktKVrmDbEos\"",
		"mtime": "2026-08-27T00:57:57.068Z",
		"size": 8478,
		"path": "../public/assets/ocade.artifacts-C5QlpaEZ.js"
	},
	"/assets/ocade.knowledge-7RsEDQxc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a04-AVFQAqlBfEGlTT0P8xJejjLhnj8\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 2564,
		"path": "../public/assets/ocade.knowledge-7RsEDQxc.js"
	},
	"/assets/ocade.lab-BmsLqI9P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1bc6c-fHZvT0mO4/8Kk/+vEAJu/8K2Vf4\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 113772,
		"path": "../public/assets/ocade.lab-BmsLqI9P.js"
	},
	"/assets/ocade.models-xgfdU2nq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a31-w2bHiVBiLrDbpV4/yEMubHQqFeM\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 2609,
		"path": "../public/assets/ocade.models-xgfdU2nq.js"
	},
	"/assets/ocade.monitors-BBVqE5Y5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2313-K9J4xPJu2lpht0iQpG07Tu9VN3U\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 8979,
		"path": "../public/assets/ocade.monitors-BBVqE5Y5.js"
	},
	"/assets/ocade.notifications-y8kKMFyQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"876-/tN03m96+qwa0DSYHzkJ7LiAu3E\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 2166,
		"path": "../public/assets/ocade.notifications-y8kKMFyQ.js"
	},
	"/assets/ocade.permissions-BYpjZr1D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b18-PPeJ/WLRkPDciMqMlpEXZsLlsdc\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 2840,
		"path": "../public/assets/ocade.permissions-BYpjZr1D.js"
	},
	"/assets/ocade.projects-C402D-lC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"682b-T2q+iHkY1gaK7kVi4MK8msDi4ic\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 26667,
		"path": "../public/assets/ocade.projects-C402D-lC.js"
	},
	"/assets/ocade.search-B_mctX08.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c4a-R3oqTNE8wPVAnQUfeNGNC/SzZWw\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 7242,
		"path": "../public/assets/ocade.search-B_mctX08.js"
	},
	"/assets/ocade.shared-DpU7JpWB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"85e-jLXlQxlXAnkKlX86HD81cRu0sbA\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 2142,
		"path": "../public/assets/ocade.shared-DpU7JpWB.js"
	},
	"/assets/ocade.studio-Qfhv6AeH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1787-U2rjJPKK1KVFMv4zxp/4DSlGxJg\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 6023,
		"path": "../public/assets/ocade.studio-Qfhv6AeH.js"
	},
	"/assets/ocade.system-GAUjf6gv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b6e-Zrqllf2gYEHN6nysfrjYoBzRBFA\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 2926,
		"path": "../public/assets/ocade.system-GAUjf6gv.js"
	},
	"/assets/ocade.tasks-Cj1FAM9D.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb-gqEFO9ZwJo6qYZSZ3j/JRa0OQys\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 187,
		"path": "../public/assets/ocade.tasks-Cj1FAM9D.js"
	},
	"/assets/ocade.templates-CpUZdOQ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86e-66rTQoEIxr2mw2KmEfHh3CTvdHM\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 2158,
		"path": "../public/assets/ocade.templates-CpUZdOQ8.js"
	},
	"/assets/ocade.work-CH2Wgfsv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11fd-6nSuRUUKXASR63EA3+bCcHHhbuc\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 4605,
		"path": "../public/assets/ocade.work-CH2Wgfsv.js"
	},
	"/assets/offline-queue-DCgT3E8_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1022-+HPUrO/Ax7RUoDjtibyncAztEl8\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 4130,
		"path": "../public/assets/offline-queue-DCgT3E8_.js"
	},
	"/assets/onboarding-BbPcTopP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2183-NdwKzuwEo/CdPe13ClwlJ5OlPEE\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 8579,
		"path": "../public/assets/onboarding-BbPcTopP.js"
	},
	"/assets/otp-DjLZa1Bh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf-a6ETjDOg4CEzdZQGVnx9xjn5ni4\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 975,
		"path": "../public/assets/otp-DjLZa1Bh.js"
	},
	"/assets/pack-registry-z9NnEWUu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f715-uNnrMhAjUrtuAV5jsIw9Gs84rGE\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 63253,
		"path": "../public/assets/pack-registry-z9NnEWUu.js"
	},
	"/assets/paddle-CLgSoFKC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"761-RPv3Blx6OfFM49anjuCuhmWXQGw\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 1889,
		"path": "../public/assets/paddle-CLgSoFKC.js"
	},
	"/assets/paired-credentials-frVKUtQB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b77-MEqtdx3XSWaJRFMqZk8l0DpBqEc\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 15223,
		"path": "../public/assets/paired-credentials-frVKUtQB.js"
	},
	"/assets/patch-EXKdKZzr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1211-HXETKTXza6inPnwdJDPOFn0Qzy0\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 4625,
		"path": "../public/assets/patch-EXKdKZzr.js"
	},
	"/assets/payments-readiness.functions-DNRURGLg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"916-vsev+Hcf6fJtqI+qD6WSDxXbd3M\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 2326,
		"path": "../public/assets/payments-readiness.functions-DNRURGLg.js"
	},
	"/assets/pdf-cdvfLdxt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"686a1-iBQrg6JO/2sxrao8tDZ4r4FMHT8\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 427681,
		"path": "../public/assets/pdf-cdvfLdxt.js"
	},
	"/assets/permission-settings-DAipUz4T.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2124d-v1oyVANVgDwKmDREyQZJyBYJP3k\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 135757,
		"path": "../public/assets/permission-settings-DAipUz4T.js"
	},
	"/assets/preflight-BQ6wmuYC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bab-iPqmWZgwh3c3p4xM7AK8CAaLZxY\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 2987,
		"path": "../public/assets/preflight-BQ6wmuYC.js"
	},
	"/assets/press-MoNb9nfe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c9e-7w70AQWDsKXL9ZOUjY6azVnqyPQ\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 3230,
		"path": "../public/assets/press-MoNb9nfe.js"
	},
	"/assets/pricing-BX1xnYtz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ac6-8FBod2oeXh/ssYoMktl6bnWMHwA\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 2758,
		"path": "../public/assets/pricing-BX1xnYtz.js"
	},
	"/assets/pricing-CrntJgfr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e4e-qTofqxAu/ulJDRyzd7c3y5y5qgg\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 3662,
		"path": "../public/assets/pricing-CrntJgfr.js"
	},
	"/assets/privacy-B5nA0bRC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f3-BWBYJcCISS96nleNOzy5mggkjdk\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 243,
		"path": "../public/assets/privacy-B5nA0bRC.js"
	},
	"/assets/products.ocade-BC3wcKH0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a5e-n+BsteeyEXZlWo0bYlrkeQ3W2bc\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 6750,
		"path": "../public/assets/products.ocade-BC3wcKH0.js"
	},
	"/assets/public-content-BHiEcfah.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dfd-n1E3dTQXkgClEA6Pyiwp19soZ/k\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 3581,
		"path": "../public/assets/public-content-BHiEcfah.js"
	},
	"/assets/public-identity-BElgSIV4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bba-06hcYRRg63uf0Ac3QAmc/2xf+lQ\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 3002,
		"path": "../public/assets/public-identity-BElgSIV4.js"
	},
	"/assets/research.functions-QHAOPtso.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"165-fiox+BqRSgEiUmCtkoIcpwCAc6Y\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 357,
		"path": "../public/assets/research.functions-QHAOPtso.js"
	},
	"/assets/reset-password-CGWCQ39R.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"14ec-RshOp91qDiuBppVGPRrErUg0OyI\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 5356,
		"path": "../public/assets/reset-password-CGWCQ39R.js"
	},
	"/assets/rolldown-runtime-DAXXjFlN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5-2encFCuTik/YJedDUFEd4geNCVs\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 1269,
		"path": "../public/assets/rolldown-runtime-DAXXjFlN.js"
	},
	"/assets/route-Bz6nS1TN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1587-oguQTTNwVpvjdktPjZX53f+7NXQ\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 5511,
		"path": "../public/assets/route-Bz6nS1TN.js"
	},
	"/assets/route-DQJs7V2S.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"497-FZ3aO2kCUC5XmRj8qSn0VE7DPMQ\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 1175,
		"path": "../public/assets/route-DQJs7V2S.js"
	},
	"/assets/routes-yEwOKxf3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"330c-WlPjFqln4pqbWROOcTxEjlxkfkg\"",
		"mtime": "2026-08-27T00:57:57.069Z",
		"size": 13068,
		"path": "../public/assets/routes-yEwOKxf3.js"
	},
	"/assets/runs-zcbIVbtd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"120c-gAKEm0tvGJfTWHhm1aP6xHnDjSg\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 4620,
		"path": "../public/assets/runs-zcbIVbtd.js"
	},
	"/assets/search-v4kr_TdN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2489-vgiW+CGKijFk3AI3TmjodnmH9Aw\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 9353,
		"path": "../public/assets/search-v4kr_TdN.js"
	},
	"/assets/session-BuwZrU4K.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"64b-K55xa5nRZh+EkmGqc8r771ARj44\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 1611,
		"path": "../public/assets/session-BuwZrU4K.js"
	},
	"/assets/session-D5dPGmY5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7f6b-TCzT61aAH6uzt5ovWg50AfW0tp8\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 32619,
		"path": "../public/assets/session-D5dPGmY5.js"
	},
	"/assets/settings-BZ_DyzNY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"153a-4uP2kYnmzaIloHW7nUC2JZvsOQg\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 5434,
		"path": "../public/assets/settings-BZ_DyzNY.js"
	},
	"/assets/settings._section-CFWNe3mm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a148-nosQ3u56Qtz4WsluBI5wtl/8KPY\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 106824,
		"path": "../public/assets/settings._section-CFWNe3mm.js"
	},
	"/assets/settings.activity-l7sIyktU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b4e-Xet4bPvQN75aRk45T+tL81jDTlk\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 11086,
		"path": "../public/assets/settings.activity-l7sIyktU.js"
	},
	"/assets/settings.appearance-PErzKapK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b1f-GvtJgM72oudxFd/M+loeXBfpW7I\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 6943,
		"path": "../public/assets/settings.appearance-PErzKapK.js"
	},
	"/assets/settings.billing-BF4RZsSn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"330c-ta0nMd9PvpJR3gs+CYf5nU0srO4\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 13068,
		"path": "../public/assets/settings.billing-BF4RZsSn.js"
	},
	"/assets/settings.browser-D63-9lU9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c2c-fAhi0L3ijGN+5C8E/LVbZ3V8aZ4\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 7212,
		"path": "../public/assets/settings.browser-D63-9lU9.js"
	},
	"/assets/settings.devices-CwbqLDSm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"22cb-SzWuhLSIu/mc30xiegFpbSooGZw\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 8907,
		"path": "../public/assets/settings.devices-CwbqLDSm.js"
	},
	"/assets/settings.index-CsqtTuYf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"297a-OUPznDQ0qRvk0t/mgh2CqU92ayU\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 10618,
		"path": "../public/assets/settings.index-CsqtTuYf.js"
	},
	"/assets/settings.mobile-CSkZO882.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7583-A4XcsGAUZ69lGyFQ14dEGsF883o\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 30083,
		"path": "../public/assets/settings.mobile-CSkZO882.js"
	},
	"/assets/settings.privacy-DmJqRqu-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"284e-LPw3NB+g8Hbwn8HbasyRORA9aA0\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 10318,
		"path": "../public/assets/settings.privacy-DmJqRqu-.js"
	},
	"/assets/settings.security-CZlKRQvv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dc6-laxBy0pxklB1nByhMDsXqDCdQx0\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 11718,
		"path": "../public/assets/settings.security-CZlKRQvv.js"
	},
	"/assets/settings.skills-I-rIvEgq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b388-oR9vgZuOtd+mZk0+9hFoe8ZWS/o\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 45960,
		"path": "../public/assets/settings.skills-I-rIvEgq.js"
	},
	"/assets/settings.support-H0EtN6Eq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1eb0-TX1p9iHXB4DUgs9VRna0WQbLfaA\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 7856,
		"path": "../public/assets/settings.support-H0EtN6Eq.js"
	},
	"/assets/settings.tasks-DkTQGP-v.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c1-EJwMVrKkwGSG3vgu0JycKrNNLFo\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 193,
		"path": "../public/assets/settings.tasks-DkTQGP-v.js"
	},
	"/assets/settings.usage-DpbpPuBd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23b8-JWXfK4ooeUmAvchUB4QFmBJBcMw\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 9144,
		"path": "../public/assets/settings.usage-DpbpPuBd.js"
	},
	"/assets/settings.vault-B-q9aVaw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"44be-2yCqgM5KuNagojaP+foqwlWMmo0\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 17598,
		"path": "../public/assets/settings.vault-B-q9aVaw.js"
	},
	"/assets/settings.voice-DF1rfu9K.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"334d-kdLMv/NTgDHsbhLLmIucFkCbZLg\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 13133,
		"path": "../public/assets/settings.voice-DF1rfu9K.js"
	},
	"/assets/skill-pack-CvBUP5We.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2753-Flob6FtT4e9RujvegZwnnb09+N4\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 10067,
		"path": "../public/assets/skill-pack-CvBUP5We.js"
	},
	"/assets/solar-data-Cr1sACCj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d14-o0ZWBWvM/3TWTeCGSydO65G0noI\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 3348,
		"path": "../public/assets/solar-data-Cr1sACCj.js"
	},
	"/assets/state-DxxN8SRV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7ee-m7T9F0E58f7Eq0OuZi5SIxxbCR8\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 2030,
		"path": "../public/assets/state-DxxN8SRV.js"
	},
	"/assets/status-C0A0ujAJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c83-9S1BIcWDe5EchutM/gbKA7ep4gA\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 7299,
		"path": "../public/assets/status-C0A0ujAJ.js"
	},
	"/assets/store-BogwCS0B.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15b7-JI9e1D05yXA6IjpOYgjKQ+OjeBI\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 5559,
		"path": "../public/assets/store-BogwCS0B.js"
	},
	"/assets/styles-Ddnb7zdm.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"25077-CMZ6Cfxn1j49UZgXTQ4cuQdfLKc\"",
		"mtime": "2026-08-27T00:57:57.071Z",
		"size": 151671,
		"path": "../public/assets/styles-Ddnb7zdm.css"
	},
	"/assets/team-5px4lzV3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"85f-HgOV54//N+IFJ7H/bb7g00TGmZs\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 2143,
		"path": "../public/assets/team-5px4lzV3.js"
	},
	"/assets/support-Bq1fs655.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ce7-+w3ebpx6wW0fxU7+k+DMPddreQw\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 3303,
		"path": "../public/assets/support-Bq1fs655.js"
	},
	"/assets/terms-CCu1NThX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f3-txT2/NlC3aZVxhqHcPhpiYI8Skg\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 243,
		"path": "../public/assets/terms-CCu1NThX.js"
	},
	"/assets/textarea-0V7WIr5O.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"234-k2ny6hTB/JuOmPCAtA70OuFI1J8\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 564,
		"path": "../public/assets/textarea-0V7WIr5O.js"
	},
	"/assets/throttle-u3W15Ydi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52e-OKczYenMlzATtKhxZH8ZOOjjqt0\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 1326,
		"path": "../public/assets/throttle-u3W15Ydi.js"
	},
	"/assets/tier-benchmark-store-Cs-xkIaH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"446-eLXzLmjOIgBUduBs1274C84WhyE\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 1094,
		"path": "../public/assets/tier-benchmark-store-Cs-xkIaH.js"
	},
	"/assets/transcript-redaction-D5c695T6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2171-HFwB+uZW8B5DruIZUg6h1nqjzTQ\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 8561,
		"path": "../public/assets/transcript-redaction-D5c695T6.js"
	},
	"/assets/unavailable-reason-CxXmcH-x.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"33c-zMREJLSX5NtsDmAgMidxWmCLzIk\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 828,
		"path": "../public/assets/unavailable-reason-CxXmcH-x.js"
	},
	"/assets/unified-task-Ct-wJCIq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ebc-MwXHAywKZKs1267pQhiSHWE+Y0w\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 3772,
		"path": "../public/assets/unified-task-Ct-wJCIq.js"
	},
	"/assets/update-signature-Bgi-Ozhm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4df-dzu3Uyqwlyj1Zwx6HLm3HPkDwmU\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 1247,
		"path": "../public/assets/update-signature-Bgi-Ozhm.js"
	},
	"/assets/use-brain-CJXGZuZE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"514e-Y7K+SOIL9I/F5APH5UnnPagal2A\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 20814,
		"path": "../public/assets/use-brain-CJXGZuZE.js"
	},
	"/assets/use-capabilities-DQzuv_kR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c02-0v/1AhprmVzjxotM/+Fxg34wIxA\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 11266,
		"path": "../public/assets/use-capabilities-DQzuv_kR.js"
	},
	"/assets/use-chat-prefs-CZlk0HKL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"64c-sSembQAMF1+QX+mb0OPOs6Xl3Ec\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 1612,
		"path": "../public/assets/use-chat-prefs-CZlk0HKL.js"
	},
	"/assets/use-demo-CDigG9AR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"128-eDRXCL/+dYtxz19YGPyDkLTa5h4\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 296,
		"path": "../public/assets/use-demo-CDigG9AR.js"
	},
	"/assets/use-demo-session-Dm5mN1hS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a34-cyePv0QmD40BrNORVFljoU/E7d4\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 6708,
		"path": "../public/assets/use-demo-session-Dm5mN1hS.js"
	},
	"/assets/use-dictation-CQamQuZu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e1a-herEhxU3AKLG7j4ybjgdCm4RFew\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 3610,
		"path": "../public/assets/use-dictation-CQamQuZu.js"
	},
	"/assets/use-limits-B2vt3-ru.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c08-8QxxYB3Lc6Ag2XZ6BKDqL9bIN1g\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 3080,
		"path": "../public/assets/use-limits-B2vt3-ru.js"
	},
	"/assets/use-local-engine-D4UoJS0p.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d1a-NCfd31qZWn5icGyIl7k3DgV65KU\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 3354,
		"path": "../public/assets/use-local-engine-D4UoJS0p.js"
	},
	"/assets/use-mission-brain-BKhGxJZJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"157a7-i0NV4Kjnn0V++2FXoW6qjqLVuKM\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 87975,
		"path": "../public/assets/use-mission-brain-BKhGxJZJ.js"
	},
	"/assets/use-online-CXunBi7G.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c8-sxxRaI3YIhYUU8NqANt44VxjCSU\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 456,
		"path": "../public/assets/use-online-CXunBi7G.js"
	},
	"/assets/use-settings-access-BtFlRhWI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-UiD9a75ZbMEZeqVYT1xGruqI6UY\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 251,
		"path": "../public/assets/use-settings-access-BtFlRhWI.js"
	},
	"/assets/use-shell-DD7w3eib.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ca-k7zrXWFg3T5sFkvJyHMWORwFAgg\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 202,
		"path": "../public/assets/use-shell-DD7w3eib.js"
	},
	"/assets/use-voice-prefs-C3YcXQQR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b08-7CHYJ1t7TSPh8Da8FEntqRz6CaA\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 2824,
		"path": "../public/assets/use-voice-prefs-C3YcXQQR.js"
	},
	"/assets/vault-BQKvdBQS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"121f-ofPtsxw2NYyvkjakA2lWvgDPP3k\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 4639,
		"path": "../public/assets/vault-BQKvdBQS.js"
	},
	"/assets/vendor-mammoth-Dpq0khGw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"79667-yat456Rdzc89mGmuoEmeYx6S17E\"",
		"mtime": "2026-08-27T00:57:57.070Z",
		"size": 497255,
		"path": "../public/assets/vendor-mammoth-Dpq0khGw.js"
	},
	"/assets/vendor-markdown-CJdAOkbM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c329-jkqcjH7TYhNPRSsO0D4q0vleV/s\"",
		"mtime": "2026-08-27T00:57:57.071Z",
		"size": 115497,
		"path": "../public/assets/vendor-markdown-CJdAOkbM.js"
	},
	"/assets/vendor-react-CX2mWblQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2e56d-qrX6GvMoYNkdEag7AoGUlpZrTKw\"",
		"mtime": "2026-08-27T00:57:57.071Z",
		"size": 189805,
		"path": "../public/assets/vendor-react-CX2mWblQ.js"
	},
	"/assets/vendor-runtime-Czpn1I53.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4ac-sE+5KsaRXTMfwOfrOATQajMSGV4\"",
		"mtime": "2026-08-27T00:57:57.071Z",
		"size": 1196,
		"path": "../public/assets/vendor-runtime-Czpn1I53.js"
	},
	"/assets/vendor-supabase-DSyywpEH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31ffe-LFSgZ+b88LeCDCMCAFoHHin+614\"",
		"mtime": "2026-08-27T00:57:57.071Z",
		"size": 204798,
		"path": "../public/assets/vendor-supabase-DSyywpEH.js"
	},
	"/assets/vendor-ui-BJL8vlL-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"164b4-/2Uo6p8vy0Nv7FEh8OAwmyfcIaM\"",
		"mtime": "2026-08-27T00:57:57.071Z",
		"size": 91316,
		"path": "../public/assets/vendor-ui-BJL8vlL-.js"
	},
	"/assets/webllm.server-DNYK_aeU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e1-Us1T5KPTXPRBgWxerF+xOrVbVS4\"",
		"mtime": "2026-08-27T00:57:57.071Z",
		"size": 225,
		"path": "../public/assets/webllm.server-DNYK_aeU.js"
	},
	"/assets/webllm.worker-BYUasHjv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6-gzTuXHvqWN3WhQkR86gwLh/4ICk\"",
		"mtime": "2026-08-27T00:57:57.125Z",
		"size": 166,
		"path": "../public/assets/webllm.worker-BYUasHjv.js"
	},
	"/assets/wllama-CfujTeeK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3a-XHS6PgwOix/pzsr2L7s2oAAni5k\"",
		"mtime": "2026-08-27T00:57:57.071Z",
		"size": 58,
		"path": "../public/assets/wllama-CfujTeeK.js"
	},
	"/assets/wllama-Dk3sV4-d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"48b4e-XVvVylqXX1LnpZS7y5u/rSV5znE\"",
		"mtime": "2026-08-27T00:57:57.071Z",
		"size": 297806,
		"path": "../public/assets/wllama-Dk3sV4-d.js"
	},
	"/icons/ocade-128.png": {
		"type": "image/png",
		"etag": "\"2871-IZB027IPQeXA1Uie+syfBzKl93I\"",
		"mtime": "2026-08-27T00:58:02.932Z",
		"size": 10353,
		"path": "../public/icons/ocade-128.png"
	},
	"/icons/ocade-192.png": {
		"type": "image/png",
		"etag": "\"5149-wzeR766lYdZEadVNBUoDzG48A0c\"",
		"mtime": "2026-08-27T00:58:02.933Z",
		"size": 20809,
		"path": "../public/icons/ocade-192.png"
	},
	"/icons/ocade-256.png": {
		"type": "image/png",
		"etag": "\"930e-FmD72307V20/TJsN9OqHrh9zjgs\"",
		"mtime": "2026-08-27T00:58:02.932Z",
		"size": 37646,
		"path": "../public/icons/ocade-256.png"
	},
	"/icons/ocade-32.png": {
		"type": "image/png",
		"etag": "\"4dc-hbUtpn6WGgeGc4D7uURQF0k5ABw\"",
		"mtime": "2026-08-27T00:58:02.932Z",
		"size": 1244,
		"path": "../public/icons/ocade-32.png"
	},
	"/icons/ocade-48.png": {
		"type": "image/png",
		"etag": "\"8cf-lg1ou1TM9yhpZPYq24/jNN0WGH0\"",
		"mtime": "2026-08-27T00:58:02.933Z",
		"size": 2255,
		"path": "../public/icons/ocade-48.png"
	},
	"/icons/ocade-512.png": {
		"type": "image/png",
		"etag": "\"282f1-veO7ECjckHeDITMr9SUQUZwBKSE\"",
		"mtime": "2026-08-27T00:58:02.933Z",
		"size": 164593,
		"path": "../public/icons/ocade-512.png"
	},
	"/models/README.md": {
		"type": "text/markdown; charset=utf-8",
		"etag": "\"639-kNCQYFm5MybzQOVkkzMUoMWvI3c\"",
		"mtime": "2026-08-27T00:58:02.932Z",
		"size": 1593,
		"path": "../public/models/README.md"
	},
	"/assets/wllama-m-NqGU8W.wasm": {
		"type": "application/wasm",
		"etag": "\"74d449-/5qFKdxtVjp8khmNdIXiGMaJl+Y\"",
		"mtime": "2026-08-27T00:57:57.071Z",
		"size": 7656521,
		"path": "../public/assets/wllama-m-NqGU8W.wasm"
	}
};
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
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
[].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new FastResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
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
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
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
function useNitroHooks() {
	const nitroApp = useNitroApp();
	const hooks = nitroApp.hooks;
	if (hooks) return hooks;
	return nitroApp.hooks = new HookableCore();
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
//#region src/config/company-facts.ts
/**
* Canonical current company and product facts.
*
* Public UI, SEO, legal copy, and release tests must derive their identity
* claims from this authority. Historical evidence and compatibility
* identifiers are deliberately outside its scope.
*/
var COMPANY_FACTS = {
	companyName: "CARCC CADANE",
	companyAlternateName: "Carcc Cadane",
	productName: "OCADE",
	productFormalName: "OCADE BY CARCC CADANE",
	tagline: "Command the Next Era.",
	founderName: "Haans Antoni",
	founderDisplayName: "HAANS ANTONI",
	founderLeadershipStatement: "HAANS ANTONI — CEO, Chairman and Founder",
	founderRoles: "CEO, Chairman and Founder",
	foundingDateIso: "2026-08-28",
	foundingDateLabel: "28 August 2026",
	launchAtIso: "2026-08-28T02:58:00Z",
	location: "Bengaluru, Karnataka, India",
	status: "pre-launch"
};
//#endregion
//#region src/lib/launch/launch-window.ts
/**
* Canonical OCADE production launch window.
*
* One module owns the launch instant. Everything else — the edge gate, robots,
* sitemap, runbook checks and tests — reads it from here so the date can never
* drift between the worker and the documentation.
*
* Two independent conditions must both hold before the production product is
* reachable:
*
*   1. Server/edge time is at or after `LAUNCH_AT_ISO`.
*   2. An explicit server-side readiness flag (`OCADE_LAUNCH_READY=true`) is set
*      by a human after the real pre-launch checks passed.
*
* The clock alone never launches anything: an unready release stays locked
* rather than opening broken. The browser clock is never consulted.
*/
/** Exact launch instant. 28 August 2026, 08:28:00 IST. */
var LAUNCH_AT_ISO = COMPANY_FACTS.launchAtIso;
/** Milliseconds since epoch for `LAUNCH_AT_ISO`. */
var LAUNCH_AT_MS = Date.parse(LAUNCH_AT_ISO);
/**
* The only launch wording allowed in public copy, metadata or structured data.
* The exact time of day is deliberately absent.
*/
var LAUNCH_PUBLIC_DATE_LABEL = COMPANY_FACTS.foundingDateLabel;
/** Environment variable that carries the human-set production readiness flag. */
var LAUNCH_READY_ENV_KEY = "OCADE_LAUNCH_READY";
function readEnv(env, key) {
	const fromEnv = env && typeof env === "object" ? env[key] : void 0;
	if (typeof fromEnv === "string") return fromEnv;
	const fromProcess = (typeof processModule !== "undefined" ? processModule.env : void 0)?.[key];
	return typeof fromProcess === "string" ? fromProcess : void 0;
}
function isTrue(value) {
	return value === "true";
}
/**
* Hosts that are development or approved internal preview surfaces. These stay
* testable before launch; none of them is the production product.
*/
function isInternalHost(hostname) {
	const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
	if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true;
	if (host.endsWith(".localhost") || host.endsWith(".local")) return true;
	if (host.endsWith(".lovableproject.com")) return true;
	if (host.startsWith("id-preview--") && host.endsWith(".lovable.app")) return true;
	if (host.endsWith("-dev.lovable.app")) return true;
	return false;
}
function isLaunchReady(env) {
	return isTrue(readEnv(env, LAUNCH_READY_ENV_KEY));
}
/**
* Decide whether the shipping application may be served for this request.
*
* `now` must come from the server/edge clock.
*/
function evaluateLaunchGate(options) {
	const { hostname, env } = options;
	const nowMs = typeof options.now === "number" ? options.now : options.now.getTime();
	if (isInternalHost(hostname) || isTrue(readEnv(env, "OCADE_LAUNCH_PREVIEW"))) return {
		open: true,
		reason: "open_internal_preview",
		internal: true,
		retryAfterSeconds: 0
	};
	if (nowMs < LAUNCH_AT_MS) {
		const remaining = Math.ceil((LAUNCH_AT_MS - nowMs) / 1e3);
		return {
			open: false,
			reason: "locked_before_launch",
			internal: false,
			retryAfterSeconds: Math.min(Math.max(remaining, 60), 3600)
		};
	}
	if (!isLaunchReady(env)) return {
		open: false,
		reason: "locked_not_ready",
		internal: false,
		retryAfterSeconds: 300
	};
	return {
		open: true,
		reason: "open_launched",
		internal: false,
		retryAfterSeconds: 0
	};
}
//#endregion
//#region src/lib/public-identity.ts
var PUBLIC_IDENTITY = {
	brand: COMPANY_FACTS.companyName,
	brandAlternateName: COMPANY_FACTS.companyAlternateName,
	tagline: COMPANY_FACTS.tagline,
	product: COMPANY_FACTS.productName,
	productPronunciation: "OH-kayd",
	productMeaning: "Orbital-scale command and autonomous decision engine",
	founder: COMPANY_FACTS.founderName,
	founderAlternateName: COMPANY_FACTS.founderDisplayName,
	founderRoles: COMPANY_FACTS.founderRoles,
	plannedFoundingDate: COMPANY_FACTS.foundingDateIso,
	plannedLaunchDate: COMPANY_FACTS.foundingDateLabel,
	status: COMPANY_FACTS.status
};
function organizationStructuredData(now = Date.now()) {
	const founded = now >= Date.parse(`${PUBLIC_IDENTITY.plannedFoundingDate}T00:00:00+05:30`);
	return {
		"@context": "https://schema.org",
		"@type": "Organization",
		"@id": "https://ocade.in/#organization",
		name: PUBLIC_IDENTITY.brand,
		alternateName: [PUBLIC_IDENTITY.brandAlternateName, PUBLIC_IDENTITY.tagline],
		url: "https://ocade.in/company",
		logo: "https://ocade.in/brand/ocade-carcc-mark.png",
		image: "https://ocade.in/brand/ocade-carcc-wordmark.png",
		slogan: PUBLIC_IDENTITY.tagline,
		...founded ? { foundingDate: PUBLIC_IDENTITY.plannedFoundingDate } : {},
		description: "CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE.",
		founder: {
			"@type": "Person",
			"@id": "https://ocade.in/#haans-antoni",
			name: PUBLIC_IDENTITY.founder,
			alternateName: PUBLIC_IDENTITY.founderAlternateName,
			jobTitle: PUBLIC_IDENTITY.founderRoles,
			url: "https://ocade.in/founder/haans-antoni"
		}
	};
}
var FOUNDER_STRUCTURED_DATA = {
	"@context": "https://schema.org",
	"@type": "ProfilePage",
	mainEntity: {
		"@type": "Person",
		"@id": "https://ocade.in/#haans-antoni",
		name: PUBLIC_IDENTITY.founder,
		alternateName: PUBLIC_IDENTITY.founderAlternateName,
		jobTitle: PUBLIC_IDENTITY.founderRoles,
		url: "https://ocade.in/founder/haans-antoni",
		worksFor: {
			"@type": "Organization",
			"@id": "https://ocade.in/#organization",
			name: PUBLIC_IDENTITY.brand
		}
	}
};
`${PUBLIC_IDENTITY.brand}${PUBLIC_IDENTITY.product}`, `${PUBLIC_IDENTITY.product}${PUBLIC_IDENTITY.brand}`, PUBLIC_IDENTITY.brand;
var OCADE_STRUCTURED_DATA = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	"@id": "https://ocade.in/#ocade",
	name: PUBLIC_IDENTITY.product,
	alternateName: "Ocade",
	url: "https://ocade.in/products/ocade",
	applicationCategory: "ProductivityApplication",
	operatingSystem: "Web, Windows, macOS, Android, iOS",
	author: {
		"@type": "Organization",
		"@id": "https://ocade.in/#organization",
		name: PUBLIC_IDENTITY.brand
	},
	creator: {
		"@type": "Person",
		"@id": "https://ocade.in/#haans-antoni",
		name: PUBLIC_IDENTITY.founder,
		alternateName: PUBLIC_IDENTITY.founderAlternateName
	},
	description: `OCADE, defined by its creator as ${PUBLIC_IDENTITY.productMeaning}, is a local-first AI workspace whose formal public-launch date is ${PUBLIC_IDENTITY.plannedLaunchDate}, with optional private synchronization and permissioned current-information retrieval.`
};
//#endregion
//#region src/lib/launch/prelaunch-response.ts
/**
* Public edge documents served while the authenticated OCADE product is locked.
* These responses contain no application JavaScript and never grant product access.
*/
var PRELAUNCH_PUBLIC_PATHS = /* @__PURE__ */ new Set([
	"/",
	"/about",
	"/privacy",
	"/terms",
	"/support",
	"/company",
	"/founder/haans-antoni",
	"/products/ocade"
]);
var PRELAUNCH_PUBLIC_ASSET_PATHS = /* @__PURE__ */ new Set(["/brand/ocade-carcc-mark.png", "/brand/ocade-carcc-wordmark.png"]);
[...PRELAUNCH_PUBLIC_PATHS];
var NOINDEX = "noindex, nofollow, noarchive";
var CLOUDFLARE_WEB_ANALYTICS = "https://static.cloudflareinsights.com/beacon.min.js https://static.cloudflareinsights.com/beacon.min.js/";
function lockedHeaders(decision, contentType) {
	return {
		"content-type": contentType,
		"cache-control": "no-store",
		"content-security-policy": `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src ${CLOUDFLARE_WEB_ANALYTICS}; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
		"cross-origin-resource-policy": "same-origin",
		"referrer-policy": "no-referrer",
		"x-robots-tag": NOINDEX,
		"retry-after": String(decision.retryAfterSeconds),
		"x-content-type-options": "nosniff",
		"x-ocade-launch-state": "prelaunch"
	};
}
function publicHeaders(contentType) {
	return {
		"content-type": contentType,
		"cache-control": "public, max-age=300",
		"content-security-policy": `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline' ${CLOUDFLARE_WEB_ANALYTICS}; connect-src 'self' https://stream.mux.com; media-src https://stream.mux.com blob:; worker-src blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
		"cross-origin-resource-policy": "same-origin",
		"referrer-policy": "strict-origin-when-cross-origin",
		"x-robots-tag": "index, follow, max-image-preview:large",
		"x-content-type-options": "nosniff",
		"x-ocade-launch-state": "prelaunch-public-information"
	};
}
function escapeHtml(value) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}
function webPageStructuredData(name, description, url) {
	return {
		"@context": "https://schema.org",
		"@type": "WebPage",
		name,
		description,
		url,
		isPartOf: {
			"@type": "WebSite",
			name: "OCADE",
			url: "https://ocade.in/"
		}
	};
}
function publicDocument(pathname) {
	if (pathname === "/") return {
		title: "OCADE by CARCC CADANE — Local-first AI workspace",
		description: "Official OCADE home page by CARCC CADANE with product, privacy, legal, launch and contact information.",
		eyebrow: "Official OCADE home",
		heading: "OCADE",
		lead: `OCADE is a local-first AI workspace by CARCC CADANE for private chat, research, work and permissioned computer-control tasks. Formal founding and public launch are scheduled for ${LAUNCH_PUBLIC_DATE_LABEL}.`,
		sections: [
			{
				heading: "Private intelligence, permissioned action",
				paragraphs: ["Supported AI generation is designed around local inference on the user's device rather than public-cloud AI inference. Optional authentication, Private Sync, current-information retrieval, support, payments and other user-requested online services are separated from normal local generation.", "Feature availability varies by device, hardware, platform and release readiness. These public information pages do not grant access to the authenticated product before the launch gate opens."]
			},
			{
				heading: "CARCC CADANE",
				paragraphs: ["CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE. HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. The official tagline is “Command the Next Era.”"]
			},
			{
				heading: `Formal founding and public launch — ${LAUNCH_PUBLIC_DATE_LABEL}`,
				paragraphs: [`CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and the scheduled public launch of OCADE. Legal, privacy, support, identity and verification pages are available earlier so users and external services can review them before the authenticated product opens.`, "The date alone does not open an unfinished build. Production access also requires the separate launch-readiness approval after final coding and release checks."]
			},
			{
				heading: "Privacy, Terms and contact",
				paragraphs: ["The Privacy notice explains Google Sign-In, local-first processing, optional online services and support data. The Terms explain AI limitations, computer-control risk, payments, refunds, liability, acceptable use, investor enquiries and disputes. The Support page explains the current ticket-based contact system."]
			}
		],
		structuredData: OCADE_STRUCTURED_DATA
	};
	if (pathname === "/about") {
		const description = "Official information about CARCC CADANE, OCADE, leadership, the 28 August 2026 founding and launch, and investor or strategic-partnership enquiries.";
		return {
			title: "About CARCC CADANE and OCADE",
			description,
			eyebrow: "Official CARCC CADANE information",
			heading: "Building the next era of private AI",
			lead: "CARCC CADANE is an independent technology enterprise, business brand and venture building OCADE — a local-first AI workspace designed around private intelligence, user control and permissioned action.",
			sections: [
				{
					heading: "CARCC CADANE",
					paragraphs: ["CARCC CADANE is the technology enterprise, business brand and venture behind OCADE. OCADE is the active AI product within that identity. The official CARCC CADANE tagline is “Command the Next Era.”", "Public materials use the CARCC CADANE brand name consistently and do not publish an unverified corporate form or registration category."]
				},
				{
					heading: "OCADE",
					paragraphs: ["OCADE is a cross-platform AI workspace for chat, research, work, creation and permissioned computer-control tasks. Supported AI generation is designed around local inference on the user's own hardware where supported.", "Optional authentication, Private Sync, current-information retrieval, support, payments and user-requested network services are separated from normal local AI generation."]
				},
				{
					heading: "Leadership",
					paragraphs: ["HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. Product direction, brand strategy and the OCADE technology vision are led under that role."]
				},
				{
					heading: `Formal founding and public launch — ${LAUNCH_PUBLIC_DATE_LABEL}`,
					paragraphs: [`CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and the scheduled public launch date for OCADE. Legal, privacy, identity, support and verification pages can be available earlier while the authenticated product remains protected by the launch gate.`]
				},
				{
					heading: "Investors, strategic partners and future ownership discussions",
					paragraphs: [
						"CARCC CADANE welcomes serious enquiries from prospective investors and strategic partners who want to discuss product strategy, commercial collaboration, future investment or a possible future ownership or equity transaction.",
						"No outside investor or shareholder is publicly announced by this page today. Nothing on this website is an offer to sell securities, an investment prospectus, a solicitation to invest, a promise of allocation, valuation, dividend, return, future listing or a guarantee that equity or shareholding will be offered.",
						"Any future investment, ownership or shareholder arrangement requires a separate private discussion, diligence, valuation, legal documentation, approvals and compliance with the laws that apply to that transaction."
					]
				},
				{
					heading: "Investor and partnership contact",
					paragraphs: ["Until dedicated investor email infrastructure is activated and verified, prospective investors and strategic partners should use the OCADE ticket system when account intake is available and choose the Investor or Partnership category. Dedicated domain email channels will be published only after they are active and verified."]
				}
			],
			structuredData: webPageStructuredData("About CARCC CADANE and OCADE", description, "https://ocade.in/about")
		};
	}
	if (pathname === "/privacy") {
		const description = "Privacy notice for OCADE by CARCC CADANE, effective 25 August 2026.";
		return {
			title: "Privacy notice — OCADE",
			description,
			eyebrow: "Effective and last updated 25 August 2026",
			heading: "Privacy notice",
			lead: "This notice explains how CARCC CADANE handles or intends to handle information for the OCADE website, authentication, local-first AI, Private Sync, support and other user-requested services.",
			sections: [
				{
					heading: "Who is responsible",
					paragraphs: ["CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE and is responsible for the OCADE service operations described in this notice. This notice uses the public CARCC CADANE brand identity and does not publish an unverified legal form, registration category, address or corporate status."]
				},
				{
					heading: "Information OCADE may handle",
					paragraphs: ["OCADE may handle account identifiers and authentication events, basic profile and settings data, device registrations, conversations, messages and files under the storage mode you choose, support tickets and messages, security and abuse-prevention records, payment status or provider references if payments are enabled, and feature-specific information needed for a user-requested connector or action.", "Do not place passwords, one-time codes, PINs, recovery codes, private keys, full card numbers, CVVs or other payment or authentication secrets in support tickets."]
				},
				{
					heading: "Google Sign-In",
					paragraphs: ["If you choose Google Sign-In, Google may provide OCADE with authentication identifiers and basic account information such as your name, email address and profile image according to the permissions shown during sign-in. OCADE uses that information to authenticate the account, maintain the session, protect the service and provide account features.", "Google account information is not sold or used by OCADE for targeted advertising and is not used to train a public AI model."]
				},
				{
					heading: "Local-first does not mean local-only",
					paragraphs: ["Supported AI generation is designed to run locally on your device. Device-only processing keeps supported data under your device controls. Optional Google authentication, Private Sync, Supabase, Cloudflare, current-information retrieval, payments, mobile pairing, support and other user-requested network services may process the minimum information reasonably necessary to provide those features.", "OCADE does not silently send normal chat generation to a public-cloud AI inference provider."]
				},
				{
					heading: "Purposes and service providers",
					paragraphs: ["Information may be used to provide requested features, authenticate and secure accounts, synchronize selected data when you choose Private Sync, maintain reliability, prevent abuse, investigate security events, process support or rights requests, maintain payment records when payments are enabled and comply with applicable law.", "Depending on the feature, recipients may include Supabase, Cloudflare, Google or another authentication provider, cited source websites, app stores, payment providers and other services necessary to deliver the requested feature. OCADE does not sell personal information to advertisers."]
				},
				{
					heading: "Retention, deletion and rights",
					paragraphs: ["Device-only data remains subject to your device controls. Cloud records are intended to be retained only while reasonably necessary for the account, requested service, security, legal obligation, payment record or dispute. Backup deletion may take additional time and some records may need to be retained where law requires.", "Depending on applicable law, you may have rights to access, correct or erase personal information, withdraw consent, object to certain processing or raise a grievance. Use the data-rights route where available or create a Privacy ticket through OCADE Support."]
				},
				{
					heading: "Users aged 16 or 17",
					paragraphs: ["OCADE is intended for users aged 16 or older, but age rules differ by jurisdiction. Where applicable law treats a 16- or 17-year-old as a child for personal-data processing, the required verified parent or lawful-guardian consent must be obtained before the relevant processing unless a lawful exemption applies.", "If OCADE does not yet provide the legally required consent flow, that user must wait until legally eligible to use the affected account or personal-data feature."]
				},
				{
					heading: "Security and contact",
					paragraphs: ["OCADE uses measures including access controls, row-level security, restricted storage patterns and security checks appropriate to the relevant feature, but no device, network or online service can guarantee absolute security.", "Privacy, security and grievance requests use the OCADE ticket system while dedicated domain email channels are being established. Dedicated email addresses will be published only after they are activated and verified."]
				}
			],
			structuredData: webPageStructuredData("OCADE Privacy notice", description, "https://ocade.in/privacy")
		};
	}
	if (pathname === "/terms") {
		const description = "Terms of service for OCADE by CARCC CADANE, effective 25 August 2026.";
		return {
			title: "Terms of service — OCADE",
			description,
			eyebrow: "Effective and last updated 25 August 2026",
			heading: "Terms of service",
			lead: `These Terms apply now to the OCADE public website and to OCADE services as they become available. CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as the formal founding and scheduled public-launch date for OCADE.`,
			sections: [
				{
					heading: "1. Agreement and CARCC CADANE",
					paragraphs: ["These Terms govern the OCADE public website and every OCADE service that becomes available under the CARCC CADANE brand. CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE. HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.", "These Terms use the public CARCC CADANE brand identity and do not describe a Private Limited Company, LLP, listed company or other legal form unless that status is separately established and published."]
				},
				{
					heading: "2. Effective date, eligibility and launch",
					paragraphs: [`These Terms are effective from 25 August 2026. CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and scheduled public launch date for OCADE. Public legal and verification pages can be available earlier without opening the authenticated product.`, "OCADE is intended for users aged 16 or older. A user aged 16 or 17 may use account or personal-data features only where all consent or authorization required by applicable law has been validly obtained and the relevant OCADE flow supports it."]
				},
				{
					heading: "3. Local-first service architecture",
					paragraphs: ["OCADE combines local software with optional online authentication, Private Sync, current-information retrieval, support, payments and permissioned computer or remote-device features. Supported chat generation is designed to run on the user's own device rather than through a public-cloud AI inference provider.", "Feature availability may vary by device, hardware, browser, operating system, region, release stage and plan."]
				},
				{
					heading: "4. Accounts, devices and security",
					paragraphs: ["Users are responsible for safeguarding their devices, accounts, recovery methods and credentials used with third-party services. Never provide OCADE Support with a password, one-time code, PIN, recovery code, private key, CVV or full payment credential."]
				},
				{
					heading: "5. AI output can be wrong",
					paragraphs: ["OCADE may produce inaccurate, incomplete, outdated, misleading, duplicated or otherwise incorrect output. Users must independently verify important output before relying on it.", "OCADE is not a substitute for a qualified lawyer, doctor, accountant, tax professional, investment or financial adviser, cybersecurity professional or emergency service. Users remain responsible for decisions made using OCADE."]
				},
				{
					heading: "6. Computer control and authorized actions",
					paragraphs: ["Permissioned computer-control features may open applications, read visible screens, type, click, create, edit, move or delete files, navigate websites and perform other actions a user authorizes. AI can select the wrong control, open the wrong application, alter or delete the wrong file, submit incorrect information or send content to an unintended destination.", "Users may use computer control only on systems, accounts and content they are authorized to control. Important actions may require confirmation, but users must still supervise the agent, review important work and maintain appropriate backups."]
				},
				{
					heading: "7. User content and AI output",
					paragraphs: ["Users retain the rights they have in prompts, files and other content they provide. Subject to applicable law, third-party rights and separately disclosed licences, users may use OCADE-generated output for personal or commercial purposes, including posts, videos, reels, documents and business work.", "AI output is not guaranteed to be unique and other users may receive similar output."]
				},
				{
					heading: "8. OCADE and CARCC CADANE intellectual property",
					paragraphs: ["CARCC CADANE and its rights holders retain their rights in OCADE software, original code, interfaces, designs, systems, proprietary technology, brand materials, logos and the tagline “Command the Next Era.” Third-party and open-source materials remain governed by their own licences and rights."]
				},
				{
					heading: "9. Acceptable use",
					paragraphs: ["Users may not use OCADE to violate law, infringe rights, access systems or accounts without authorization, distribute malware, commit fraud, evade security or payment controls, attack OCADE or another service, intentionally harm people or repeatedly violate these Terms."]
				},
				{
					heading: "10. Suspension, termination and feature changes",
					paragraphs: ["CARCC CADANE may limit, suspend or terminate online access for illegal activity, hacking, malware, fraud, abuse, security-bypass attempts, attacks, non-payment, material or repeated Terms violations, security emergencies or legal requirements.", "CARCC CADANE may modify, discontinue or replace a feature or service subject to rights that applicable law does not permit these Terms to waive."]
				},
				{
					heading: "11. Free period, future paid plans and checkout",
					paragraphs: ["OCADE may initially be available without charge while coding, release and payment work is completed. Free availability can change. Paid plans, subscriptions or other commercial services may be introduced later.", "Before a paid purchase, the checkout should display the applicable price, taxes where required, duration or renewal rule, cancellation information and purchase-specific conditions."]
				},
				{
					heading: "12. Refunds and payment errors",
					paragraphs: ["Except where applicable law requires otherwise, a paid digital service is not eligible for a voluntary refund after the purchased service has been activated or used.", "A refund, reversal, credit or other remedy may still be required for a duplicate charge, billing or payment-processing error, non-delivery, material service defect, unauthorized transaction where law provides protection or another non-waivable consumer right."]
				},
				{
					heading: "13. Third-party services",
					paragraphs: ["OCADE may depend on Google, Supabase, Cloudflare, app stores, payment providers, cited websites, network operators and other third parties. CARCC CADANE does not control those services and cannot guarantee their availability, accuracy, security, policies or continued operation."]
				},
				{
					heading: "14. Service provided as available",
					paragraphs: ["To the maximum extent permitted by applicable law, OCADE is provided on an “as is” and “as available” basis. CARCC CADANE does not promise uninterrupted, error-free, loss-free or perfectly accurate operation, or that every defect will be corrected.", "Users should maintain independent records and backups for important information."]
				},
				{
					heading: "15. Limitation of liability and assumed risks",
					paragraphs: ["To the maximum extent permitted by applicable law, CARCC CADANE, OCADE and their founder, personnel and service providers are not liable for indirect, incidental, special, exemplary, punitive or consequential loss, or for lost profits, revenue, business, opportunities, investment loss, data loss or corruption, business interruption, reputational harm, device or software problems, or losses caused by reliance on AI output, computer-control actions or third-party services.", "Where liability cannot lawfully be excluded and except for liability that applicable law does not permit to be capped, aggregate liability arising from a paid OCADE service is limited to the amount actually paid by the claimant for the affected OCADE service during the three months immediately before the event giving rise to the claim. Mandatory statutory rights and liabilities remain unaffected."]
				},
				{
					heading: "16. Indemnity for unlawful or unauthorized use",
					paragraphs: ["To the extent permitted by law, a user is responsible for third-party claims and reasonable losses caused by that user's unlawful use of OCADE, intentional infringement of another person's rights, or use of OCADE to access systems, accounts or content without authorization."]
				},
				{
					heading: "17. Governing law and disputes",
					paragraphs: ["These Terms are governed by the laws of India without removing mandatory protections that may apply to a user elsewhere. The parties should first try in good faith to resolve a dispute through the OCADE support process.", "Where legally capable of arbitration and not resolved informally, a dispute may be referred to arbitration under the Arbitration and Conciliation Act, 1996, in English, subject to non-waivable consumer, regulatory, urgent-relief and other statutory rights."]
				},
				{
					heading: "18. Communications and marketing",
					paragraphs: ["OCADE may send essential account, authentication, security, legal and service messages. Marketing communications are sent only where the required permission exists and include the applicable opt-out method."]
				},
				{
					heading: "19. Changes to these Terms",
					paragraphs: ["CARCC CADANE may update these Terms as OCADE changes. Material changes will be identified through an appropriate notice where required. If a change legally requires fresh consent, OCADE will request that consent."]
				},
				{
					heading: "20. Support, legal, privacy and investor enquiries",
					paragraphs: ["OCADE uses a ticket-based support system. Intended categories include Account, Billing, Technical, Privacy, Security, Feedback, Legal, Investor and Partnership.", "Investor and partnership enquiries start a private discussion only. Nothing on this website is an offer to sell securities, a solicitation to invest or a promise that equity or shareholding will be offered."]
				}
			],
			structuredData: webPageStructuredData("OCADE Terms of service", description, "https://ocade.in/terms")
		};
	}
	if (pathname === "/support") {
		const description = "Current support, privacy, legal, security, investor and partnership contact options for OCADE by CARCC CADANE.";
		return {
			title: "Support and contact — OCADE",
			description,
			eyebrow: "Support and contact",
			heading: "OCADE support",
			lead: "OCADE uses a ticket-based support queue and administrative review workspace. Dedicated domain email addresses will be published only after they are activated and verified.",
			sections: [
				{
					heading: "Ticket categories",
					paragraphs: ["Account, Billing, Technical, Privacy, Security, Feedback, Legal, Investor and Partnership are the intended support categories. Signed-in tickets can be attached to the user's account and reviewed in the OCADE administrative support workspace once account intake is open."]
				},
				{
					heading: "Privacy, legal and security requests",
					paragraphs: ["Use the relevant ticket category when intake is available. Do not place passwords, one-time codes, PINs, recovery codes, private keys, full card numbers, CVVs or other authentication or payment secrets in a ticket."]
				},
				{
					heading: "Investor and partnership enquiries",
					paragraphs: ["Prospective investors and strategic partners may use the Investor or Partnership category when account intake is available. An enquiry begins a private discussion only; it is not an offer of securities, solicitation to invest or promise that equity or shareholding will be offered."]
				},
				{
					heading: "Dedicated email channels",
					paragraphs: ["Support, privacy, legal, security and investor domain email addresses may be added later. No address is published as active until the mailbox, delivery, access controls and handling process have been verified."]
				}
			],
			structuredData: webPageStructuredData("OCADE Support and contact", description, "https://ocade.in/support")
		};
	}
	if (pathname === "/company") return {
		title: "CARCC CADANE — Company and founder information",
		description: "Official information about CARCC CADANE, OCADE and founder HAANS ANTONI.",
		eyebrow: "Official company information",
		heading: "CARCC CADANE",
		lead: `CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE. ${LAUNCH_PUBLIC_DATE_LABEL} is recorded as its formal founding date and OCADE's scheduled public launch date.`,
		sections: [
			{
				heading: "Technology enterprise and brand",
				paragraphs: ["CARCC CADANE develops technology products and systems under a single enterprise and brand identity. OCADE is its active AI product. Public pages do not publish an unverified corporate form or registration category."]
			},
			{
				heading: "Leadership and product",
				paragraphs: ["HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. OCADE is the active product in development and is being prepared for its controlled public opening."]
			},
			{
				heading: "Launch status",
				paragraphs: [`CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and OCADE public-launch date. The authenticated product remains protected until both the launch date and production-readiness approval are satisfied.`]
			}
		],
		structuredData: organizationStructuredData()
	};
	if (pathname === "/founder/haans-antoni") return {
		title: "HAANS ANTONI — Founder, CEO and Chairman of CARCC CADANE",
		description: "Official profile connecting HAANS ANTONI with CARCC CADANE and OCADE.",
		eyebrow: "Official founder profile",
		heading: "HAANS ANTONI",
		lead: "HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.",
		sections: [{
			heading: "Role",
			paragraphs: ["Haans Antoni leads product direction, brand strategy and the technology vision for OCADE, a local-first AI workspace being prepared for public launch.", "This page records the founder's public role. It does not imply funding, press coverage, trademark registration, public listing or another status that has not been independently established."]
		}, {
			heading: "Official references",
			paragraphs: ["The CARCC CADANE company page, About page and OCADE product page are the canonical first-party references for this public identity. Search engines decide independently how and when those facts appear."]
		}],
		structuredData: FOUNDER_STRUCTURED_DATA
	};
	if (pathname === "/products/ocade") return {
		title: "OCADE — Local-first AI workspace by CARCC CADANE",
		description: "Official product information for OCADE by CARCC CADANE.",
		eyebrow: "OCADE",
		heading: "Private intelligence. Permissioned action.",
		lead: `OCADE is a local-inference AI workspace created by Haans Antoni under CARCC CADANE. Public launch is scheduled for ${LAUNCH_PUBLIC_DATE_LABEL}.`,
		sections: [
			{
				heading: "Product boundary",
				paragraphs: ["Supported chat generation is designed to run on the user's device. Sign-in, optional Private Sync, support and permissioned current-information retrieval can require network services; those services are not public-cloud AI inference.", "Web launch, Windows, macOS, Android, iOS and browser-extension releases are separate readiness claims and may not become available at exactly the same time."]
			},
			{
				heading: "Launch access",
				paragraphs: ["OCADE may initially be available without charge while final product and payment work is completed. Paid plans may be introduced later only with checkout terms displayed before purchase."]
			},
			{
				heading: "AI and computer control",
				paragraphs: ["AI can be inaccurate. Permissioned computer-control features can also take an unintended action. Important work must be reviewed and high-impact decisions should not rely on OCADE alone."]
			}
		],
		structuredData: OCADE_STRUCTURED_DATA
	};
	return null;
}
function renderPrelaunchPublicPage(pathname) {
	const document = publicDocument(pathname);
	if (!document) return null;
	const canonical = `https://ocade.in${pathname}`;
	const isHome = pathname === "/";
	const sections = document.sections.map((section, index) => `<section class="card ${index === 0 ? "card-wide" : ""}" data-tilt style="--i:${index}"><div class="card-index">${String(index + 1).padStart(2, "0")}</div><h2>${escapeHtml(section.heading)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`).join("");
	const structuredData = JSON.stringify(document.structuredData).replaceAll("<", "\\u003c");
	const launchStats = isHome ? `<section class="stats" aria-label="OCADE facts"><div><strong>LOCAL</strong><span>AI generation first</span></div><div><strong>16+</strong><span>Intended user age</span></div><div><strong>28 AUG</strong><span>Formal launch 2026</span></div></section>` : "";
	const homeCtas = isHome ? `<div class="hero-actions"><a class="btn btn-solid" href="/products/ocade">Explore OCADE <span>↗</span></a><a class="btn btn-ghost" href="/about">About CARCC CADANE</a></div><div class="scroll-cue" aria-hidden="true"><span>SCROLL</span><i></i></div>` : `<div class="hero-actions"><a class="btn btn-ghost" href="/">Back to OCADE</a></div>`;
	const loader = isHome ? `<div id="loader" class="loader" aria-hidden="true"><div class="loader-top">OCADE / CARCC CADANE</div><div class="loader-word" id="loaderWord">PRIVATE</div><div class="loader-count" id="loaderCount">000</div><div class="loader-track"><div id="loaderBar"></div></div></div>` : "";
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(document.title)}</title><meta name="description" content="${escapeHtml(document.description)}" />
<meta name="robots" content="index,follow,max-image-preview:large" /><link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" /><meta property="og:site_name" content="CARCC CADANE" />
<meta property="og:title" content="${escapeHtml(document.title)}" /><meta property="og:description" content="${escapeHtml(document.description)}" />
<meta property="og:image" content="https://ocade.in/brand/ocade-carcc-wordmark.png" /><meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${structuredData}<\/script>
<style>
:root{color-scheme:dark;--bg:#0a0a0b;--surface:#101013;--surface2:#151519;--text:#f5f5f7;--muted:#8d8d98;--stroke:#26262c;--silver:#c9ccd4;--gold:#c89d4c;--aub:#4f2d63;--crimson:#5c1f31;--mx:50vw;--my:20vh}
*{box-sizing:border-box}html{scroll-behavior:smooth;background:var(--bg)}body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font:400 15px/1.65 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;overflow-x:hidden}
body:before{content:"";position:fixed;inset:0;z-index:-3;pointer-events:none;background:radial-gradient(700px circle at var(--mx) var(--my),rgba(105,72,132,.13),transparent 46%),radial-gradient(500px circle at 90% 60%,rgba(178,130,58,.07),transparent 50%),#080809}
body:after{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;opacity:.18;background-image:radial-gradient(circle,rgba(255,255,255,.18) .7px,transparent .8px);background-size:28px 28px;mask-image:linear-gradient(to bottom,#000,transparent 82%)}
a{color:inherit}.loader{position:fixed;inset:0;z-index:9999;background:#080809;transition:opacity .55s ease,visibility .55s ease}.loader.done{opacity:0;visibility:hidden}.loader-top{position:absolute;left:28px;top:25px;color:#777782;font-size:10px;letter-spacing:.28em;text-transform:uppercase}.loader-word{position:absolute;inset:0;display:grid;place-items:center;font:italic clamp(44px,8vw,104px)/1 "Instrument Serif",serif;color:rgba(245,245,247,.86);letter-spacing:-.035em}.loader-count{position:absolute;right:28px;bottom:32px;font:400 clamp(62px,10vw,132px)/.8 "Instrument Serif",serif;color:#ececf0;font-variant-numeric:tabular-nums}.loader-track{position:absolute;left:0;right:0;bottom:0;height:3px;background:#18181c}.loader-track div{height:100%;width:100%;transform:scaleX(0);transform-origin:left;background:linear-gradient(90deg,#bfc5cf 0%,#6f4a86 48%,#c89d4c 100%);box-shadow:0 0 14px rgba(126,89,151,.45)}
.video-stage{position:absolute;inset:0;overflow:hidden;background:radial-gradient(circle at 50% 36%,#17121c 0,#09090b 48%,#070708 100%)}.video-stage video{position:absolute;left:50%;top:50%;width:100%;height:100%;min-width:100%;min-height:100%;object-fit:cover;transform:translate(-50%,-50%) scale(1.025);opacity:.62;filter:saturate(.72) contrast(1.06) brightness(.62)}.video-stage:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,5,7,.24) 0%,rgba(5,5,7,.16) 42%,#080809 100%),radial-gradient(circle at center,transparent 20%,rgba(6,6,8,.68) 100%)}
.nav-wrap{position:fixed;left:0;right:0;top:0;z-index:80;display:flex;justify-content:center;padding:18px 16px;pointer-events:none}.nav{pointer-events:auto;display:inline-flex;align-items:center;gap:5px;max-width:calc(100vw - 28px);padding:7px;border:1px solid rgba(255,255,255,.10);border-radius:999px;background:rgba(12,12,15,.68);backdrop-filter:blur(22px) saturate(1.25);box-shadow:0 14px 44px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.04);transition:background .25s ease,box-shadow .25s ease}.nav.scrolled{background:rgba(10,10,12,.88);box-shadow:0 18px 55px rgba(0,0,0,.34)}.nav-logo{display:grid;place-items:center;width:38px;height:38px;padding:2px;border-radius:50%;background:linear-gradient(135deg,#d8dbe2,#4f2d63 58%,#c89d4c);text-decoration:none}.nav-logo img{display:block;width:34px;height:34px;border-radius:50%;object-fit:cover;background:#080809;transition:transform .3s ease}.nav-logo:hover img{transform:scale(1.08) rotate(-4deg)}.nav-divider{width:1px;height:20px;margin:0 4px;background:#2b2b30}.nav-links{display:flex;align-items:center;gap:2px;overflow:auto;scrollbar-width:none}.nav-links::-webkit-scrollbar{display:none}.nav-links a{white-space:nowrap;text-decoration:none;color:#9c9ca6;font-size:11px;padding:8px 11px;border-radius:999px;transition:.22s ease}.nav-links a:hover,.nav-links a:focus-visible{color:#fff;background:#202024;outline:none}.nav-contact{margin-left:3px;color:#0b0b0c!important;background:#f0f0f2!important;font-weight:600!important}
.hero{position:relative;min-height:${isHome ? "100svh" : "68svh"};display:flex;align-items:center;justify-content:center;overflow:hidden;padding:120px 24px 82px}.hero-inner{position:relative;z-index:4;width:min(1100px,100%);text-align:center}.hero-wordmark{display:block;width:min(560px,78vw);height:auto!important;margin:0 auto 34px;object-fit:contain;filter:drop-shadow(0 28px 70px rgba(0,0,0,.55));animation:heroFloat 7s ease-in-out infinite}.eyebrow{margin:0 0 22px;color:#a6a6b0;font-size:10px;font-weight:600;letter-spacing:.32em;text-transform:uppercase}.hero h1{margin:0 auto;max-width:1000px;font:italic clamp(56px,9vw,112px)/.9 "Instrument Serif",serif;font-weight:400;letter-spacing:-.055em;text-wrap:balance}.inner-page .hero h1{font-size:clamp(48px,7vw,86px)}.lead{max-width:710px;margin:26px auto 0;color:#aaaab4;font-size:clamp(15px,1.8vw,18px);line-height:1.75;text-wrap:balance}.hero-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:34px}.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 23px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:600;transition:transform .22s ease,background .22s ease,border-color .22s ease}.btn:hover{transform:translateY(-2px) scale(1.015)}.btn-solid{background:#f1f1f3;color:#09090a;border:1px solid #f1f1f3}.btn-ghost{background:rgba(9,9,11,.46);color:#efeff2;border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(16px)}.btn-ghost:hover{border-color:rgba(200,157,76,.42);background:rgba(20,18,23,.78)}.scroll-cue{position:absolute;left:50%;bottom:24px;z-index:6;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;color:#73737c;font-size:9px;letter-spacing:.25em}.scroll-cue i{position:relative;width:1px;height:38px;background:#28282d;overflow:hidden}.scroll-cue i:after{content:"";position:absolute;left:0;top:-100%;width:1px;height:44%;background:#c8c8ce;animation:scrollDown 1.5s ease-in-out infinite}
.content{position:relative;z-index:7;width:min(1180px,calc(100% - 34px));margin:-2px auto 0;padding:70px 0 110px}.section-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:28px}.section-kicker{display:flex;align-items:center;gap:10px;color:#777781;font-size:10px;text-transform:uppercase;letter-spacing:.28em}.section-kicker:before{content:"";width:34px;height:1px;background:#343439}.section-head h2{margin:12px 0 0;font:italic clamp(38px,5vw,62px)/1 "Instrument Serif",serif;font-weight:400}.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:18px;perspective:1200px}.card{position:relative;grid-column:span 6;min-height:230px;padding:28px;border:1px solid rgba(255,255,255,.075);border-radius:28px;background:linear-gradient(145deg,rgba(19,19,23,.86),rgba(11,11,13,.76));box-shadow:inset 0 1px rgba(255,255,255,.035),0 24px 80px rgba(0,0,0,.18);overflow:hidden;transform:perspective(1000px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translateY(var(--lift,0));transform-style:preserve-3d;transition:transform .18s ease,border-color .25s ease,background .25s ease}.card-wide{grid-column:span 7}.card:nth-child(2n){grid-column:span 5}.card:nth-child(4n){grid-column:span 7}.card:before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:linear-gradient(135deg,rgba(198,202,212,.18),rgba(79,45,99,.4),rgba(200,157,76,.14));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity .3s}.card:after{content:"";position:absolute;width:220px;height:220px;right:-90px;top:-110px;border-radius:50%;background:radial-gradient(circle,rgba(101,65,125,.17),transparent 68%);pointer-events:none}.card:hover{--lift:-5px;border-color:rgba(255,255,255,.13);background:linear-gradient(145deg,rgba(24,23,29,.94),rgba(12,12,15,.86))}.card:hover:before{opacity:1}.card-index{color:#5f5f69;font-size:10px;letter-spacing:.2em;margin-bottom:42px}.card h2{position:relative;z-index:1;margin:0 0 16px;font:italic 31px/1.05 "Instrument Serif",serif;font-weight:400;letter-spacing:-.02em}.card p{position:relative;z-index:1;margin:10px 0;color:#9898a3;font-size:14px;line-height:1.8}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin:72px 0 0;border:1px solid #222228;border-radius:28px;overflow:hidden;background:#222228}.stats div{display:flex;flex-direction:column;justify-content:center;min-height:170px;padding:28px;background:#0d0d10}.stats strong{font:italic clamp(32px,5vw,58px)/1 "Instrument Serif",serif;font-weight:400;color:#f0f0f2}.stats span{margin-top:10px;color:#777781;font-size:11px;letter-spacing:.13em;text-transform:uppercase}
.marquee{position:relative;z-index:4;overflow:hidden;border-top:1px solid #1f1f23;border-bottom:1px solid #1f1f23;padding:22px 0;background:#09090b}.marquee-track{display:flex;width:max-content;white-space:nowrap;font:italic clamp(38px,6vw,76px)/1 "Instrument Serif",serif;color:#17171b;animation:marquee 32s linear infinite}.marquee-track span{padding-right:32px}.footer{position:relative;z-index:4;padding:70px 24px 38px;background:radial-gradient(circle at 50% 120%,rgba(79,45,99,.18),transparent 38%),#080809;text-align:center}.footer h2{margin:0 auto;max-width:800px;font:italic clamp(48px,7vw,90px)/.95 "Instrument Serif",serif;font-weight:400;letter-spacing:-.04em}.footer p{max-width:560px;margin:20px auto 0;color:#83838d}.footer-actions{margin-top:30px}.footer-bar{width:min(1180px,100%);margin:70px auto 0;padding-top:22px;border-top:1px solid #1f1f24;display:flex;justify-content:space-between;gap:18px;color:#666670;font-size:11px}.footer-links{display:flex;flex-wrap:wrap;gap:16px}.footer-links a{color:#8d8d96;text-decoration:none}.footer-links a:hover{color:#fff}
@keyframes heroFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes scrollDown{0%{transform:translateY(-100%)}100%{transform:translateY(320%)}}@keyframes marquee{to{transform:translateX(-50%)}}@media(max-width:780px){.nav-wrap{padding-top:10px}.nav-divider,.nav-contact{display:none}.nav{max-width:calc(100vw - 18px)}.nav-links a{padding:8px 9px}.hero{padding-left:18px;padding-right:18px}.hero-wordmark{width:min(460px,88vw);margin-bottom:28px}.content{width:min(100% - 24px,1180px);padding-top:50px}.grid{display:block}.card{min-height:0;margin-bottom:14px}.card-index{margin-bottom:28px}.stats{grid-template-columns:1fr}.stats div{min-height:120px}.footer-bar{flex-direction:column;align-items:center}.loader-top{left:18px}.loader-count{right:18px}.section-head{display:block}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.hero-wordmark,.scroll-cue i:after,.marquee-track{animation:none}.card,.btn{transition:none}.loader{display:none}}
</style></head>
<body class="${isHome ? "home-page" : "inner-page"}">${loader}
<div class="nav-wrap"><nav class="nav" id="nav" aria-label="Public information"><a class="nav-logo" href="/" aria-label="OCADE home"><img src="/brand/ocade-carcc-mark.png" alt="" width="96" height="96"></a><span class="nav-divider"></span><div class="nav-links"><a href="/">Home</a><a href="/about">About</a><a href="/products/ocade">OCADE</a><a href="/company">Company</a><a href="/founder/haans-antoni">Founder</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><span class="nav-divider"></span><a class="nav-contact" href="/support">Contact ↗</a></nav></div>
<section class="hero"><div class="video-stage"><video id="heroVideo" muted loop playsinline preload="metadata" aria-hidden="true"></video></div><div class="hero-inner"><img class="hero-wordmark" src="/brand/ocade-carcc-wordmark.png" alt="OCADE by CARCC CADANE — Command the Next Era." width="2172" height="724"><p class="eyebrow">${escapeHtml(document.eyebrow)}</p><h1>${escapeHtml(document.heading)}</h1><p class="lead">${escapeHtml(document.lead)}</p>${homeCtas}</div></section>
<main class="content"><div class="section-head"><div><div class="section-kicker">${isHome ? "Inside OCADE" : "Official information"}</div><h2>${isHome ? "Designed for the next era." : "Clear. Current. Verifiable."}</h2></div></div><div class="grid">${sections}</div>${launchStats}</main>
<div class="marquee" aria-hidden="true"><div class="marquee-track"><span>COMMAND THE NEXT ERA • PRIVATE INTELLIGENCE • PERMISSIONED ACTION • </span><span>COMMAND THE NEXT ERA • PRIVATE INTELLIGENCE • PERMISSIONED ACTION • </span></div></div>
<footer class="footer"><h2>Building the next era.</h2><p>OCADE by CARCC CADANE. Local-first AI, optional connected services, and a controlled public launch.</p><div class="footer-actions"><a class="btn btn-ghost" href="/support">Contact / Support ↗</a></div><div class="footer-bar"><span>© 2026 CARCC CADANE</span><div class="footer-links"><a href="/about">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Contact</a></div><span>Command the Next Era.</span></div></footer>
<script>
(function(){
  // Native adaptive streaming where the browser has it, the progressive file
  // everywhere else. No third-party player script: the application pages
  // dropped theirs when the route sweep proved the CSP had been refusing it on
  // every request, and this page has no reason to keep one either.
  const source="https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8";
  const progressive="https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g/high.mp4";
  const video=document.getElementById("heroVideo");
  if(video){
    try{
      video.src=video.canPlayType("application/vnd.apple.mpegurl")?source:progressive;
      video.play().catch(()=>{});
    }catch(e){}
  }
  const nav=document.getElementById("nav");
  const onScroll=()=>nav&&nav.classList.toggle("scrolled",window.scrollY>80);
  onScroll();window.addEventListener("scroll",onScroll,{passive:true});
  if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    window.addEventListener("pointermove",(e)=>{document.documentElement.style.setProperty("--mx",e.clientX+"px");document.documentElement.style.setProperty("--my",e.clientY+"px");},{passive:true});
    document.querySelectorAll("[data-tilt]").forEach((card)=>{
      card.addEventListener("pointermove",(e)=>{const r=card.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5;const y=(e.clientY-r.top)/r.height-.5;card.style.setProperty("--ry",(x*3.2)+"deg");card.style.setProperty("--rx",(-y*3.2)+"deg");});
      card.addEventListener("pointerleave",()=>{card.style.setProperty("--ry","0deg");card.style.setProperty("--rx","0deg");});
    });
    const loader=document.getElementById("loader"),count=document.getElementById("loaderCount"),bar=document.getElementById("loaderBar"),word=document.getElementById("loaderWord");
    if(loader&&count&&bar&&word){const words=["PRIVATE","LOCAL","OCADE"];const start=performance.now(),duration=1650;const tick=(now)=>{const p=Math.min(1,(now-start)/duration);const n=Math.floor(p*100);count.textContent=String(n).padStart(3,"0");bar.style.transform="scaleX("+p+")";word.textContent=words[Math.min(words.length-1,Math.floor(p*words.length))];if(p<1)requestAnimationFrame(tick);else setTimeout(()=>loader.classList.add("done"),260)};requestAnimationFrame(tick);}
  }
})();
<\/script></body></html>`;
}
function prelaunchPublicResponse(pathname) {
	const html = renderPrelaunchPublicPage(pathname);
	return html ? new Response(html, {
		status: 200,
		headers: publicHeaders("text/html; charset=utf-8")
	}) : null;
}
function prelaunchSitemapResponse() {
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...PRELAUNCH_PUBLIC_PATHS].map((pathname) => `  <url><loc>https://ocade.in${pathname}</loc></url>`).join("\n")}\n</urlset>\n`;
	return new Response(body, {
		status: 200,
		headers: publicHeaders("application/xml; charset=utf-8")
	});
}
/** Minimal dependency-free page for every route that must remain locked. */
function renderPrelaunchPage() {
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="robots" content="${NOINDEX}" /><title>CARCC CADANE — OCADE</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 20%,#1c1023 0,#08090b 42%,#050506 100%);color:#e6e8ec;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:2rem}main{max-width:34rem;text-align:center;border:1px solid rgba(255,255,255,.08);border-radius:24px;background:rgba(255,255,255,.025);box-shadow:0 28px 100px rgba(0,0,0,.48);backdrop-filter:blur(18px);padding:3rem 2rem}img{display:block;width:min(28rem,100%);height:auto;margin:0 auto 2rem}.brand{font-size:.72rem;letter-spacing:.32em;text-transform:uppercase;color:#a9a1ad}h1{margin:1.25rem 0 0;font-size:1.9rem;font-weight:650;letter-spacing:-.02em}p{margin:1rem 0 0;color:#9aa3af;line-height:1.7;font-size:.95rem}</style></head><body><main><img src="/brand/ocade-carcc-wordmark.png" alt="OCADE by CARCC CADANE — Command the Next Era." width="2172" height="724" /><p class="brand">CARCC CADANE</p><h1>OCADE</h1><p>Authenticated product access is not open yet.</p><p>Public information, Privacy, Terms, About and Support remain available through the navigation on the OCADE home page.</p></main></body></html>`;
}
/** Robots remains crawlable while the authenticated product is locked. */
function prelaunchRobotsResponse(decision) {
	const body = [
		"User-agent: *",
		"Disallow: /",
		...[...PRELAUNCH_PUBLIC_PATHS].map((pathname) => `Allow: ${pathname}`),
		"Allow: /brand/ocade-carcc-wordmark.png",
		"Allow: /brand/ocade-carcc-mark.png",
		"Sitemap: https://ocade.in/sitemap.xml",
		""
	].join("\n");
	return new Response(body, {
		status: 200,
		headers: {
			...publicHeaders("text/plain; charset=utf-8"),
			"retry-after": String(decision.retryAfterSeconds)
		}
	});
}
/**
* The response for any locked request. Public factual/legal pages stay 200;
* everything else remains a 503/no-store/noindex response.
*/
function prelaunchResponse(pathname, decision) {
	const canonicalPath = pathname.length > 1 && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;
	if (canonicalPath !== pathname && PRELAUNCH_PUBLIC_PATHS.has(canonicalPath)) return new Response(null, {
		status: 308,
		headers: {
			...publicHeaders("text/html; charset=utf-8"),
			location: canonicalPath
		}
	});
	if (pathname === "/robots.txt") return prelaunchRobotsResponse(decision);
	if (pathname === "/sitemap.xml") return prelaunchSitemapResponse();
	if (PRELAUNCH_PUBLIC_PATHS.has(pathname)) return prelaunchPublicResponse(pathname) ?? new Response(renderPrelaunchPage(), {
		status: 503,
		headers: lockedHeaders(decision, "text/html; charset=utf-8")
	});
	return new Response(renderPrelaunchPage(), {
		status: 503,
		headers: lockedHeaders(decision, "text/html; charset=utf-8")
	});
}
//#endregion
//#region src/lib/security/public-response.ts
var DEFAULT_SECURITY_HEADERS = {
	"content-security-policy": [
		"default-src 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://static.cloudflareinsights.com/beacon.min.js https://static.cloudflareinsights.com/beacon.min.js/",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data:",
		"connect-src 'self' https: wss: blob: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
		"worker-src 'self' blob:",
		"media-src 'self' blob: data:",
		"manifest-src 'self'",
		"upgrade-insecure-requests"
	].join("; "),
	"cross-origin-opener-policy": "same-origin-allow-popups",
	"cross-origin-resource-policy": "same-origin",
	"origin-agent-cluster": "?1",
	"permissions-policy": "camera=(self), microphone=(self), geolocation=(), payment=(self), usb=(), browsing-topics=()",
	"referrer-policy": "strict-origin-when-cross-origin",
	"x-content-type-options": "nosniff",
	"x-frame-options": "DENY"
};
/** Preserve a response's status/body and add only headers it has not set. */
function withPublicSecurityHeaders(response) {
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) if (!headers.has(name)) headers.set(name, value);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
//#endregion
//#region src/cloudflare-entry.ts
var nitroApp = useNitroApp();
var nitroHooks = useNitroHooks();
function setGlobalEnvironment(env) {
	globalThis.__env__ = env;
}
function augmentRequest(request, env, context) {
	const runtimeRequest = request;
	runtimeRequest.ip = request.headers.get("cf-connecting-ip") ?? void 0;
	runtimeRequest.runtime ??= { name: "cloudflare" };
	runtimeRequest.runtime.cloudflare = {
		...runtimeRequest.runtime.cloudflare,
		env,
		context
	};
	runtimeRequest.waitUntil = context.waitUntil.bind(context);
}
function publicAssetResponse(response) {
	const headers = new Headers(response.headers);
	headers.set("x-robots-tag", "index, follow, max-image-preview:large");
	headers.set("x-ocade-launch-state", "prelaunch-public-information");
	return withPublicSecurityHeaders(new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	}));
}
function lockedAssetResponse(pathname, gate) {
	const response = prelaunchResponse(pathname, gate);
	const headers = new Headers(response.headers);
	headers.set("x-ocade-edge-gate", "asset-v1");
	return withPublicSecurityHeaders(new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	}));
}
/**
* Outermost Cloudflare entrypoint.
*
* While the launch gate is locked, this boundary owns every public request.
* Only the explicit public information surface and deployment-health probe may
* escape the lock. No authenticated route, application HTML or hashed bundle
* may fall through to Nitro before launch.
*/
var cloudflare_entry_default = {
	async fetch(request, env, context) {
		setGlobalEnvironment(env);
		augmentRequest(request, env, context);
		const url = new URL(request.url);
		const gate = evaluateLaunchGate({
			now: Date.now(),
			hostname: url.hostname,
			env
		});
		const isGetOrHead = request.method === "GET" || request.method === "HEAD";
		if (env.ASSETS && isPublicAssetURL(url.pathname)) {
			const mayReadPublicAsset = isGetOrHead && PRELAUNCH_PUBLIC_ASSET_PATHS.has(url.pathname);
			if (!gate.open && !mayReadPublicAsset) return lockedAssetResponse(url.pathname, gate);
			const response = await env.ASSETS.fetch(request);
			return gate.open ? withPublicSecurityHeaders(response) : publicAssetResponse(response);
		}
		if (!gate.open) {
			if (isGetOrHead && url.pathname === "/api/health") return nitroApp.fetch(request);
			return withPublicSecurityHeaders(prelaunchResponse(url.pathname, gate));
		}
		return nitroApp.fetch(request);
	},
	scheduled(controller, env, context) {
		setGlobalEnvironment(env);
		context.waitUntil(nitroHooks.callHook("cloudflare:scheduled", {
			controller,
			env,
			context
		}) ?? Promise.resolve());
	},
	email(message, env, context) {
		setGlobalEnvironment(env);
		context.waitUntil(nitroHooks.callHook("cloudflare:email", {
			message,
			event: message,
			env,
			context
		}) ?? Promise.resolve());
	},
	queue(batch, env, context) {
		setGlobalEnvironment(env);
		context.waitUntil(nitroHooks.callHook("cloudflare:queue", {
			batch,
			event: batch,
			env,
			context
		}) ?? Promise.resolve());
	},
	tail(traces, env, context) {
		setGlobalEnvironment(env);
		context.waitUntil(nitroHooks.callHook("cloudflare:tail", {
			traces,
			env,
			context
		}) ?? Promise.resolve());
	},
	trace(traces, env, context) {
		setGlobalEnvironment(env);
		context.waitUntil(nitroHooks.callHook("cloudflare:trace", {
			traces,
			env,
			context
		}) ?? Promise.resolve());
	}
};
//#endregion
export { cloudflare_entry_default as default };
