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
		"mtime": "2026-08-28T01:33:32.670Z",
		"size": 18478,
		"path": "../public/apple-touch-icon.png"
	},
	"/favicon.ico": {
		"type": "image/vnd.microsoft.icon",
		"etag": "\"fb4-0SojhBjTCdtondWh2OQc0bbHnA8\"",
		"mtime": "2026-08-28T01:33:32.670Z",
		"size": 4020,
		"path": "../public/favicon.ico"
	},
	"/manifest.webmanifest": {
		"type": "application/manifest+json",
		"etag": "\"2b9-7HLG94qjlshQnx59E+/ByIlfznI\"",
		"mtime": "2026-08-28T01:33:32.670Z",
		"size": 697,
		"path": "../public/manifest.webmanifest"
	},
	"/offline.html": {
		"type": "text/html; charset=utf-8",
		"etag": "\"a05-pzaEkxiSga8R/E5QnxVTL9w7Wcc\"",
		"mtime": "2026-08-28T01:33:32.670Z",
		"size": 2565,
		"path": "../public/offline.html"
	},
	"/sw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"463c-yzwjMtAFXnY1o6e219yDWz35vxI\"",
		"mtime": "2026-08-28T01:33:32.670Z",
		"size": 17980,
		"path": "../public/sw.js"
	},
	"/assets/AppShell-DnVG9SXB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb-KTAETHZsizDs6ZSbyrwZDTlz0Vs\"",
		"mtime": "2026-08-28T01:33:28.066Z",
		"size": 187,
		"path": "../public/assets/AppShell-DnVG9SXB.js"
	},
	"/assets/AuthShell-B78MUew_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"886-0yedOZdXrYVXE20QUcw36mtsDfc\"",
		"mtime": "2026-08-28T01:33:28.066Z",
		"size": 2182,
		"path": "../public/assets/AuthShell-B78MUew_.js"
	},
	"/assets/BrandMark-Bf-qlZXW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"38a-E4vfWYfz2IZlUktqsfaKc3D4ohE\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 906,
		"path": "../public/assets/BrandMark-Bf-qlZXW.js"
	},
	"/assets/CapabilityBadge-Rhmesq2l.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9bd-TfgzufgO5btUFKr/6n3cih15CCA\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 2493,
		"path": "../public/assets/CapabilityBadge-Rhmesq2l.js"
	},
	"/assets/ChatSidebar-BTxvypjW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"100f-ucrStFL2FfMt6HzeCNe9E43fjjo\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 4111,
		"path": "../public/assets/ChatSidebar-BTxvypjW.js"
	},
	"/assets/ComingLater-CkrYLQGp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4dc-jgQ0BHKjj29sLkMxqkL5xDejjNI\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 1244,
		"path": "../public/assets/ComingLater-CkrYLQGp.js"
	},
	"/assets/DiagnosticsPanel-D-7vm6Xt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3313-bMKqBn9HO90w54jmQDtGd8X94o4\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 13075,
		"path": "../public/assets/DiagnosticsPanel-D-7vm6Xt.js"
	},
	"/assets/EmptyState-CN3ncrY7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"202-06B0XXfbsNmp8sMeGxzktlZI7/A\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 514,
		"path": "../public/assets/EmptyState-CN3ncrY7.js"
	},
	"/assets/GestureControlPanel-DuFMg6mr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16ab-2ZAHfnDeAdbW7bifgeeKp/VuSmQ\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 5803,
		"path": "../public/assets/GestureControlPanel-DuFMg6mr.js"
	},
	"/assets/LivingIntelligenceBackdrop-DgjdVHej.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19c3-/YRSmyM2dmAHoBRSgVdGvtirdpI\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 6595,
		"path": "../public/assets/LivingIntelligenceBackdrop-DgjdVHej.js"
	},
	"/assets/GlassPanel-BGgzUEaq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"225-RGnPwcv8XrpquESw1S6EWrAozU4\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 549,
		"path": "../public/assets/GlassPanel-BGgzUEaq.js"
	},
	"/assets/LocalEngineControl-B1N0Oy-d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e4d-UTK44DmX03+EdsW811DwB9OnLvM\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 7757,
		"path": "../public/assets/LocalEngineControl-B1N0Oy-d.js"
	},
	"/assets/LocalIntelligenceControl-D0kw8QvQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1484-rw8zpRPc6TeBBTgGONqcMpnJm3w\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 5252,
		"path": "../public/assets/LocalIntelligenceControl-D0kw8QvQ.js"
	},
	"/assets/OcadeCompanion-D3591eba.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5e5-6ebP46223NvmMKtASWjTMTgotxc\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 1509,
		"path": "../public/assets/OcadeCompanion-D3591eba.js"
	},
	"/assets/OcadeOrb-B9fVTR6T.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a4-qxdUymV/QhBJvAk+LqJBWNwEerY\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 1444,
		"path": "../public/assets/OcadeOrb-B9fVTR6T.js"
	},
	"/assets/OcadeOrbCanvas-TNKxH4Ko.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b0a-Vur8uZp5SiTMozGYi/H9RM8i3+o\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 6922,
		"path": "../public/assets/OcadeOrbCanvas-TNKxH4Ko.js"
	},
	"/assets/PageHeader-C0zSkLIw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ce-iho/5zo8cTFQLp9/yUhwECi4cW0\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 718,
		"path": "../public/assets/PageHeader-C0zSkLIw.js"
	},
	"/assets/PerformanceFallbackNotice-HXmrgXvG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"81f-qfPBuvhOAu2cnfMZoJEKrCAX2TA\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 2079,
		"path": "../public/assets/PerformanceFallbackNotice-HXmrgXvG.js"
	},
	"/assets/PlanComparison-BDLkGop2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"111e-UNeIv5kMFfHZjvqhmU8QIIo8XWs\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 4382,
		"path": "../public/assets/PlanComparison-BDLkGop2.js"
	},
	"/assets/SettingsGate-BU-LY_ru.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"727-Q1ksjhsBRGZe5g1PeqOXVbMiBXc\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 1831,
		"path": "../public/assets/SettingsGate-BU-LY_ru.js"
	},
	"/assets/SetupRequiredState-CTucQp9l.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3d8-v6I24uloLogBAseFiafWEE+OutI\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 984,
		"path": "../public/assets/SetupRequiredState-CTucQp9l.js"
	},
	"/assets/StatusBadge-3JatU_GO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"658-NEGhaxbosQryYPfq3TWRypmY66A\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 1624,
		"path": "../public/assets/StatusBadge-3JatU_GO.js"
	},
	"/assets/TasksWorkspace-D0Y3ud5W.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"908c-osztgdIKbi2PoybxEUrtILguS0c\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 37004,
		"path": "../public/assets/TasksWorkspace-D0Y3ud5W.js"
	},
	"/assets/TruthfulFailurePanel-CfsJ6YA0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"784-HiUQC494zIY5XWDUHOVyzsRsjvg\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 1924,
		"path": "../public/assets/TruthfulFailurePanel-CfsJ6YA0.js"
	},
	"/assets/VaultUnlockCard-DnXJ9XdR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ff6-mK/vej6F2RuLDDofbMFcfveBwBI\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 4086,
		"path": "../public/assets/VaultUnlockCard-DnXJ9XdR.js"
	},
	"/assets/WorkspaceShell-YNv1YbnY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6cbb-uM4AMU/lH96+U+nGaUVMywmXQow\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 27835,
		"path": "../public/assets/WorkspaceShell-YNv1YbnY.js"
	},
	"/assets/_._lovable.oauth.consent-Bra60dod.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"18e-3QjMyqJG0iGPGJYi0kiTCCUDlkM\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 398,
		"path": "../public/assets/_._lovable.oauth.consent-Bra60dod.js"
	},
	"/assets/_._lovable.oauth.consent-BwW7fndQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"66d-jwsFS3SN2W6uVQV5diNIhNQZsCg\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 1645,
		"path": "../public/assets/_._lovable.oauth.consent-BwW7fndQ.js"
	},
	"/assets/about-DrdFvBGC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"188c-wdtS2YC2IOdzQNX+2lqEFNwvhlU\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 6284,
		"path": "../public/assets/about-DrdFvBGC.js"
	},
	"/assets/access-denied-CBdmMF11.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"624-JNI4Y8pTlm351q2nSnSdKumhSrs\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 1572,
		"path": "../public/assets/access-denied-CBdmMF11.js"
	},
	"/assets/actions-QPvY23-F.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"275c-dS3WhCUjqBWd/ApMxL//srN35P4\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 10076,
		"path": "../public/assets/actions-QPvY23-F.js"
	},
	"/assets/adapter-Bmw1IsNe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"12a-5/RewF0d9UP0xXkUa9BN4530hpI\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 298,
		"path": "../public/assets/adapter-Bmw1IsNe.js"
	},
	"/assets/admin.launch-gate-7qrrLKZx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a97-bltNgCMIEf+Wrk+PM8MAIuY6HZA\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 23191,
		"path": "../public/assets/admin.launch-gate-7qrrLKZx.js"
	},
	"/assets/admin.payments-checklist-BRooGmuK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26c8-2oVcPy4hk+yIkqK+cHXuukREq3Q\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 9928,
		"path": "../public/assets/admin.payments-checklist-BRooGmuK.js"
	},
	"/assets/admin.support-CQuXKskK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"170f-ja1ai9lD/CCeLwu/4GYdll6jxkg\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 5903,
		"path": "../public/assets/admin.support-CQuXKskK.js"
	},
	"/assets/admin.users-M750Nuvw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16a8-rdyEvT/L7TCRZxnXWx6o2JWSmvg\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 5800,
		"path": "../public/assets/admin.users-M750Nuvw.js"
	},
	"/assets/agent.functions-DLhuT02g.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c1-laZpotosvzSBwqd9rW1JdPUPoHM\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 705,
		"path": "../public/assets/agent.functions-DLhuT02g.js"
	},
	"/assets/auth-HcVytEo6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5738-h+L+BMol1A6Q+K2xAyXNf9zqB+8\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 22328,
		"path": "../public/assets/auth-HcVytEo6.js"
	},
	"/assets/auth-middleware-dKno57Y3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4e-ElmnfjBH/kgnbGVii8NPjip/ggQ\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 78,
		"path": "../public/assets/auth-middleware-dKno57Y3.js"
	},
	"/assets/auth.callback-UBTTEVAK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"abc-jEW7lnp73GkzSvyrh/x0kiaxOOs\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 2748,
		"path": "../public/assets/auth.callback-UBTTEVAK.js"
	},
	"/assets/auth.verify-CsRzOXFO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1040-g15+Q7cPoYCeG0noxDExPEh9b+E\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 4160,
		"path": "../public/assets/auth.verify-CsRzOXFO.js"
	},
	"/assets/blog-BOnWjn5v.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9c-3RDeJO0BTpDeKOjMdNgg5bgKDx8\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 156,
		"path": "../public/assets/blog-BOnWjn5v.js"
	},
	"/assets/blog._slug-BjwfqEK1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eea-0tzgfmL/0pc+TP6WgEZzoRYrQjE\"",
		"mtime": "2026-08-28T01:33:28.068Z",
		"size": 3818,
		"path": "../public/assets/blog._slug-BjwfqEK1.js"
	},
	"/assets/blog.index-uxMrqBdJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d2c-9Fzc7j7xEqMYPvBXjCby20kdwc4\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 3372,
		"path": "../public/assets/blog.index-uxMrqBdJ.js"
	},
	"/assets/SolarSystem-CNXZAaqI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86b9f-lBMTBgjjKhpuDTtQC8GGaYmlqzI\"",
		"mtime": "2026-08-28T01:33:28.067Z",
		"size": 551839,
		"path": "../public/assets/SolarSystem-CNXZAaqI.js"
	},
	"/assets/browser-catalogue-DLxJMBU5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eb7-X0o+iONa9b18HaYpBz7geFkysy0\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 3767,
		"path": "../public/assets/browser-catalogue-DLxJMBU5.js"
	},
	"/assets/browser-wasm-DWKOEebJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1432-AxRA7i6s++aZN5aQTGqtbNpd6bo\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 5170,
		"path": "../public/assets/browser-wasm-DWKOEebJ.js"
	},
	"/assets/browser-webgpu-D2qus02e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1197-cn6Y8qa0TNTq3fu3q8Prqq/4qF0\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 4503,
		"path": "../public/assets/browser-webgpu-D2qus02e.js"
	},
	"/assets/cania-qlJ4OTZM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10b-aEPeoN/9uz3jwGAK10kCOjJ41jg\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 267,
		"path": "../public/assets/cania-qlJ4OTZM.js"
	},
	"/assets/careers-Cp1BbsSF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7bc-YAj0jxENTLMy95uC8/HlZxl9lbE\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 1980,
		"path": "../public/assets/careers-Cp1BbsSF.js"
	},
	"/assets/chat-citation-store-M_3d5V2j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c39-b7Li7a473VJcdIXAd3OsyvbO0qQ\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 7225,
		"path": "../public/assets/chat-citation-store-M_3d5V2j.js"
	},
	"/assets/chat-output-flow-DIpihmu3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c47-1jA1WJBS5V5qyHujBFPhXZxp81s\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 3143,
		"path": "../public/assets/chat-output-flow-DIpihmu3.js"
	},
	"/assets/checkout.success-BFMk1uJS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b7c-0BBNZd78VrBFPJW72lDB1c6NeQk\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 2940,
		"path": "../public/assets/checkout.success-BFMk1uJS.js"
	},
	"/assets/company-0kRZoqV1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"de2-6fMq6VlPEubIFJ0BTo4hZd3xg1U\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 3554,
		"path": "../public/assets/company-0kRZoqV1.js"
	},
	"/assets/compliance-log.functions-CPZ6fKsW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-Xlx36fHMbotiy6DpNIgVyQYQ6p8\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 251,
		"path": "../public/assets/compliance-log.functions-CPZ6fKsW.js"
	},
	"/assets/computer-use-settings-EGzAqqOS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a0f-2d9maaE65OOhpMLiPiR46hqqTb4\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 2575,
		"path": "../public/assets/computer-use-settings-EGzAqqOS.js"
	},
	"/assets/data-rights-B6yBaP7T.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e06-suQ5bLlTryvBu/GP8JByWjaCNOo\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 3590,
		"path": "../public/assets/data-rights-B6yBaP7T.js"
	},
	"/assets/demo-pnKvudIK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3c1-eV2Nv+G8EwLEH5cqqlgj8VwAiac\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 961,
		"path": "../public/assets/demo-pnKvudIK.js"
	},
	"/assets/demo.control-B0mCPiK4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"991-Zm7qC7wYaBPZKfQoGAnFQ6q6u18\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 2449,
		"path": "../public/assets/demo.control-B0mCPiK4.js"
	},
	"/assets/demo.ocade-CSBkAwYZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7e1a-+46Zx/LbjRm90S68lwzxugMVKP4\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 32282,
		"path": "../public/assets/demo.ocade-CSBkAwYZ.js"
	},
	"/assets/demo.settings-F97ZQ3_y.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"edb-fUvVuNZpU74D6e0AZ1wZ7EObBFA\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 3803,
		"path": "../public/assets/demo.settings-F97ZQ3_y.js"
	},
	"/assets/desktop-bridge-tO-QQqy8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eaa-Q4DpW6eraI1WfH5I18f6/If9c70\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 3754,
		"path": "../public/assets/desktop-bridge-tO-QQqy8.js"
	},
	"/assets/devices-CgftGPgK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e0f-RgxFHBuklSfbGmf9IysFW+KnzkM\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 3599,
		"path": "../public/assets/devices-CgftGPgK.js"
	},
	"/assets/download-CqxEsftT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1027-9I8B26wtZRcQOXIGgcTO2yss/64\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 4135,
		"path": "../public/assets/download-CqxEsftT.js"
	},
	"/assets/execute-u2p2__3_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1213a-LogEVEk4vLJGkNAuLJiulikymbw\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 74042,
		"path": "../public/assets/execute-u2p2__3_.js"
	},
	"/assets/faq-BceHwAXc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1420-B6+uagMjZ6eKq8HrM/PA9Av1iNg\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 5152,
		"path": "../public/assets/faq-BceHwAXc.js"
	},
	"/assets/ficia-1QJINZP7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"105-PyOT3NFrC8nFRyMbW6XSoT7wSqY\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 261,
		"path": "../public/assets/ficia-1QJINZP7.js"
	},
	"/assets/fixed-model-Ckyk5kJ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"895-SahTIID3v5hvHEb68F/9chPipFk\"",
		"mtime": "2026-08-28T01:33:28.069Z",
		"size": 2197,
		"path": "../public/assets/fixed-model-Ckyk5kJ8.js"
	},
	"/assets/founder.haans-antoni-DCNHan0c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c45-CHl6aV0Ya7txvVmRB4lkrzZfQnE\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 3141,
		"path": "../public/assets/founder.haans-antoni-DCNHan0c.js"
	},
	"/assets/index-CCNlAlZM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7e916-n29j/cgHB9XQV3NAYoD97qzWdgg\"",
		"mtime": "2026-08-28T01:33:28.060Z",
		"size": 518422,
		"path": "../public/assets/index-CCNlAlZM.js"
	},
	"/assets/input-B48vNe_8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"29a-WHYbojIN8rZtWNLGQ/olVJ/A7+Y\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 666,
		"path": "../public/assets/input-B48vNe_8.js"
	},
	"/assets/installation-browser-B3EoC5CT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6eeb-1RGm9BUqo4P7VIbjsRynQl91Wj8\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 28395,
		"path": "../public/assets/installation-browser-B3EoC5CT.js"
	},
	"/assets/local-projects-jXmNE3UC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1948-BV8Hhxd6QcY0TrlvBbp6x+osF8E\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 6472,
		"path": "../public/assets/local-projects-jXmNE3UC.js"
	},
	"/assets/local-runtime.functions-xsyYTDoD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1080-7E3v6TXJFlREJhHnX3KKqcXFtSs\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 4224,
		"path": "../public/assets/local-runtime.functions-xsyYTDoD.js"
	},
	"/assets/madee-Cwt1JUWD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"100-QzDewnyezW95idAwuOgYNZOkOwo\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 256,
		"path": "../public/assets/madee-Cwt1JUWD.js"
	},
	"/assets/model-download-WPtDDhP_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"129a-0NYA5ZOkysFUID3TPL95/RYlAhI\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 4762,
		"path": "../public/assets/model-download-WPtDDhP_.js"
	},
	"/assets/methods-Bmi_DJG2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2f0-5wV1FEI7fp4qwbFT2LJxidvgKAY\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 752,
		"path": "../public/assets/methods-Bmi_DJG2.js"
	},
	"/assets/model-store--TDaCIKO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11f0-/yWxzn0iTXzT8t6LmvAx+tFz+Mg\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 4592,
		"path": "../public/assets/model-store--TDaCIKO.js"
	},
	"/assets/model-vault-DbVu5A8u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e9e-Xiz8k0lOcgQqCNoSaKGZ00BfSMw\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 3742,
		"path": "../public/assets/model-vault-DbVu5A8u.js"
	},
	"/assets/oauth-errors-D0R59ozT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8bf-aaAHKGe4/rm947FH7hWLOpTnBqQ\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 2239,
		"path": "../public/assets/oauth-errors-D0R59ozT.js"
	},
	"/assets/ocade-CWZXV45Y.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"df-ajmRTzWBcuZcbx0fUrL1ar7kcSE\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 223,
		"path": "../public/assets/ocade-CWZXV45Y.js"
	},
	"/assets/ocade-allowance-BFQspkmM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52d-tfyMxsfopdsf6cD91j7mgDR2ZCk\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 1325,
		"path": "../public/assets/ocade-allowance-BFQspkmM.js"
	},
	"/assets/ocade-automations.functions-BdddXoj1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"630-k2qCt1EyURAkIRNnPSNehKeg3tA\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 1584,
		"path": "../public/assets/ocade-automations.functions-BdddXoj1.js"
	},
	"/assets/ocade-local-DMcdYpaT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15e7-44KXXrBxu4yEIXXATmyAb51HtNY\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 5607,
		"path": "../public/assets/ocade-local-DMcdYpaT.js"
	},
	"/assets/ocade-usage.functions-BkXtxrWR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e9-e2Y64e7+S9wC9MOGNWuSMcn0NCU\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 233,
		"path": "../public/assets/ocade-usage.functions-BkXtxrWR.js"
	},
	"/assets/ocade-projects.functions-ghEtIyqw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25b4-6NhXNOiXOU6Y77xNLCWWEPKbzz4\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 9652,
		"path": "../public/assets/ocade-projects.functions-ghEtIyqw.js"
	},
	"/assets/ocade-identity-BdM79R6-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"175-m+CJ2IY7faIQPIyy+1b+gB+G7Q8\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 373,
		"path": "../public/assets/ocade-identity-BdM79R6-.js"
	},
	"/assets/ocade.activity-DSJP-dmV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ad4-ZegPqYAKH60jYuRqUkwbVB7XzSM\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 2772,
		"path": "../public/assets/ocade.activity-DSJP-dmV.js"
	},
	"/assets/ocade.artifacts-XGghCmr9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"211e-TAw++lzigMQBlIM/aXhVS7m/70A\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 8478,
		"path": "../public/assets/ocade.artifacts-XGghCmr9.js"
	},
	"/assets/ocade.code-BIZubebV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"af01-zYpkSnMmymPb+Q1RQEahwj/o7a8\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 44801,
		"path": "../public/assets/ocade.code-BIZubebV.js"
	},
	"/assets/ocade.connectors-DJenodpS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"949-46+YaI58KIXxRs/F2ZTXrRKk8Rc\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 2377,
		"path": "../public/assets/ocade.connectors-DJenodpS.js"
	},
	"/assets/ocade.devices-BOL5Cbxn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eb3-AWJsg2jUHWHxFFta5qHHZd4jjaI\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 3763,
		"path": "../public/assets/ocade.devices-BOL5Cbxn.js"
	},
	"/assets/ocade.health-dCjl6abJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4d2-nxxHWikexwc00ZNqcyY1lKgGjGk\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 1234,
		"path": "../public/assets/ocade.health-dCjl6abJ.js"
	},
	"/assets/ocade.automations-DlhYqnAQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ea97-B7RioPufoiWlOQ88r21fYUiZLgQ\"",
		"mtime": "2026-08-28T01:33:28.070Z",
		"size": 60055,
		"path": "../public/assets/ocade.automations-DlhYqnAQ.js"
	},
	"/assets/ocade.inbox-B6eoynwd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fed-vpKceJugY0scCtqKLwVYefFKz1I\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 4077,
		"path": "../public/assets/ocade.inbox-B6eoynwd.js"
	},
	"/assets/ocade.index-eeEvkY7b.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"46100-6VAP8Up1dL4zZWtEsBurZ0KjQIc\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 286976,
		"path": "../public/assets/ocade.index-eeEvkY7b.js"
	},
	"/assets/ocade.knowledge-BvO3j2bB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a04-+VlHNtlVCo09X/jlFx9FCblZsb8\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 2564,
		"path": "../public/assets/ocade.knowledge-BvO3j2bB.js"
	},
	"/assets/ocade.models-u4CNU2NW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a31-09/mLQcOnW33Aj9tMNGVbYGfA2E\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 2609,
		"path": "../public/assets/ocade.models-u4CNU2NW.js"
	},
	"/assets/ocade.notifications-B7dkpnZR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"876-OF5CiJDY4iWMf9JulUjULHOjOq0\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 2166,
		"path": "../public/assets/ocade.notifications-B7dkpnZR.js"
	},
	"/assets/ocade.monitors-Cxa8qOoI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2313-9fGm3J/OIaN3i3bCl/wUDZYGew8\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 8979,
		"path": "../public/assets/ocade.monitors-Cxa8qOoI.js"
	},
	"/assets/ocade.permissions-zvUaJQcA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b18-7s3T5zA8eFOPVQ9nwYBhNQYjgSI\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 2840,
		"path": "../public/assets/ocade.permissions-zvUaJQcA.js"
	},
	"/assets/ocade.lab-BObg5TYx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1bc6b-l714jJbUF4lQZFGvtHp+Vgp4gXs\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 113771,
		"path": "../public/assets/ocade.lab-BObg5TYx.js"
	},
	"/assets/ocade.projects-D1wVDxf4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"69b9-CGsXzpZogcAXqoIu+CY8EXCs7fM\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 27065,
		"path": "../public/assets/ocade.projects-D1wVDxf4.js"
	},
	"/assets/ocade.search-Bf_6Rfm8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d4f-t9Xdrr3LRWNIBLxG96lnRJ8FBUQ\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 7503,
		"path": "../public/assets/ocade.search-Bf_6Rfm8.js"
	},
	"/assets/ocade.shared-DMoAjU6w.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"85e-YYZgKzrivGgiMD651lNQ71n3rlo\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 2142,
		"path": "../public/assets/ocade.shared-DMoAjU6w.js"
	},
	"/assets/ocade.studio-CPaRUfeL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1787-8H65t/vnYBxyr01tvO2Z6M+3GYE\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 6023,
		"path": "../public/assets/ocade.studio-CPaRUfeL.js"
	},
	"/assets/ocade.system-cv_D31Vc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b6e-DJ+RIO8aTPCCoKzGShil+ubjfQg\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 2926,
		"path": "../public/assets/ocade.system-cv_D31Vc.js"
	},
	"/assets/ocade.tasks-B_C39go9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb-NLHrGTSxwCQYgnb7lKgFbhNGvxQ\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 187,
		"path": "../public/assets/ocade.tasks-B_C39go9.js"
	},
	"/assets/ocade.work-BEcLsFB8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1212-NXTgJRS1ZOiRwxI5loUxSC54XKM\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 4626,
		"path": "../public/assets/ocade.work-BEcLsFB8.js"
	},
	"/assets/offline-queue-DCgT3E8_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1022-+HPUrO/Ax7RUoDjtibyncAztEl8\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 4130,
		"path": "../public/assets/offline-queue-DCgT3E8_.js"
	},
	"/assets/onboarding-q_vvxG-H.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2455-WUl5yWS5CGNLVpGoHmEIW+KFv44\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 9301,
		"path": "../public/assets/onboarding-q_vvxG-H.js"
	},
	"/assets/otp-DjLZa1Bh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3cf-a6ETjDOg4CEzdZQGVnx9xjn5ni4\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 975,
		"path": "../public/assets/otp-DjLZa1Bh.js"
	},
	"/assets/paddle-TGfUUaDx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"761-RTH1zDZHnyY2os5pk8uCMOhirWU\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 1889,
		"path": "../public/assets/paddle-TGfUUaDx.js"
	},
	"/assets/ocade.templates-BrSb-97b.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86e-eNUu7GBhjRTG5wrQaRMMIguHi64\"",
		"mtime": "2026-08-28T01:33:28.071Z",
		"size": 2158,
		"path": "../public/assets/ocade.templates-BrSb-97b.js"
	},
	"/assets/paired-desktop-CRlgl01N.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c19-v4ah0daiI0KvIzpnvg6G+PbgrJo\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 3097,
		"path": "../public/assets/paired-desktop-CRlgl01N.js"
	},
	"/assets/patch-EXKdKZzr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1211-HXETKTXza6inPnwdJDPOFn0Qzy0\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 4625,
		"path": "../public/assets/patch-EXKdKZzr.js"
	},
	"/assets/payments-readiness.functions-BExAw8ge.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"916-7t/7zTIGN1gFLvMaV4dTsa8DCYg\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 2326,
		"path": "../public/assets/payments-readiness.functions-BExAw8ge.js"
	},
	"/assets/paired-credentials-BdTt8GO6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3a5-qzcTcelsb5m8nTY7thSSv7fJ9Gc\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 933,
		"path": "../public/assets/paired-credentials-BdTt8GO6.js"
	},
	"/assets/pack-registry-BchceG_a.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f715-xLwDbGjiFzKAzHksisaMGGuF5Uk\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 63253,
		"path": "../public/assets/pack-registry-BchceG_a.js"
	},
	"/assets/pdf-cdvfLdxt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"686a1-iBQrg6JO/2sxrao8tDZ4r4FMHT8\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 427681,
		"path": "../public/assets/pdf-cdvfLdxt.js"
	},
	"/assets/permission-settings-Op_IKKjI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f962-+BvuV+CJBu+Na5Mj/NIZEWeLl9Q\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 63842,
		"path": "../public/assets/permission-settings-Op_IKKjI.js"
	},
	"/assets/preflight-BQ6wmuYC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bab-iPqmWZgwh3c3p4xM7AK8CAaLZxY\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 2987,
		"path": "../public/assets/preflight-BQ6wmuYC.js"
	},
	"/assets/press-CEPGfHFZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c9e-M68/g8WCeZiP2SBAfa2KswRJ9Rw\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 3230,
		"path": "../public/assets/press-CEPGfHFZ.js"
	},
	"/assets/pricing-D-Q2Zkls.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ac6-IgeaxZRHBZzSoi9jXSyTQsH3bZI\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 2758,
		"path": "../public/assets/pricing-D-Q2Zkls.js"
	},
	"/assets/privacy-CU6t6fAm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f3-zrWx2o1F6PAQyWz/cFNHsJK+aJ4\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 243,
		"path": "../public/assets/privacy-CU6t6fAm.js"
	},
	"/assets/pricing-CrntJgfr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e4e-qTofqxAu/ulJDRyzd7c3y5y5qgg\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 3662,
		"path": "../public/assets/pricing-CrntJgfr.js"
	},
	"/assets/products.ocade-9extRU3e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a5e-qn3sGl+qhGNISJ0nOMbMvZLFAxQ\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 6750,
		"path": "../public/assets/products.ocade-9extRU3e.js"
	},
	"/assets/public-content-BHiEcfah.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dfd-n1E3dTQXkgClEA6Pyiwp19soZ/k\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 3581,
		"path": "../public/assets/public-content-BHiEcfah.js"
	},
	"/assets/public-identity-Bw1Z-EQ7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb8-Un27wWzmQzT61u5ivEC9J4ZUN8w\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 3e3,
		"path": "../public/assets/public-identity-Bw1Z-EQ7.js"
	},
	"/assets/reset-password-BPMiyYQy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"14ec-pA1X+Swr036GZSkK+zzJM/wLyMY\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 5356,
		"path": "../public/assets/reset-password-BPMiyYQy.js"
	},
	"/assets/rolldown-runtime-DAXXjFlN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f5-2encFCuTik/YJedDUFEd4geNCVs\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 1269,
		"path": "../public/assets/rolldown-runtime-DAXXjFlN.js"
	},
	"/assets/research.functions-D7deXOHX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"165-AT5XlNiQztaVtd4XhMVwSaemyzk\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 357,
		"path": "../public/assets/research.functions-D7deXOHX.js"
	},
	"/assets/route-BpphswaM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"497-T/Nh+DnEJXGp1Ro88bz9ycbd1Ec\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 1175,
		"path": "../public/assets/route-BpphswaM.js"
	},
	"/assets/router-policy-CxUOW51h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5ed-xg0EophnrkdSnKmJEBbIn+4yJkU\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 1517,
		"path": "../public/assets/router-policy-CxUOW51h.js"
	},
	"/assets/route-DDOCcPzi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1495-8EprsYBAp4YoY0mheRJTCE+NGQs\"",
		"mtime": "2026-08-28T01:33:28.072Z",
		"size": 5269,
		"path": "../public/assets/route-DDOCcPzi.js"
	},
	"/assets/runs-zcbIVbtd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"120c-gAKEm0tvGJfTWHhm1aP6xHnDjSg\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 4620,
		"path": "../public/assets/runs-zcbIVbtd.js"
	},
	"/assets/routes-Ch25BPE9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"343c-vrVo+rmgSucQOl+zkDyO4pVbdS0\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 13372,
		"path": "../public/assets/routes-Ch25BPE9.js"
	},
	"/assets/runtime-activation-DTIOK1Wg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"13c5-GCx4DOOdC2iyKvqRZ6LquU3TsC8\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 5061,
		"path": "../public/assets/runtime-activation-DTIOK1Wg.js"
	},
	"/assets/search-D8ofxqJt.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2489-D6Ik+G0P4k0rd/XbgqbRy2gjH1g\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 9353,
		"path": "../public/assets/search-D8ofxqJt.js"
	},
	"/assets/session-BTnEDRCv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"732-fpOcDUUeDtG5yE5t/SspZ9q+83k\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 1842,
		"path": "../public/assets/session-BTnEDRCv.js"
	},
	"/assets/settings-BnrAteXC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"153a-LO2kk6iwxqKNqlR6ua0yMbxUL38\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 5434,
		"path": "../public/assets/settings-BnrAteXC.js"
	},
	"/assets/session-DR4CA_Q0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7fcf-wCjHEfGyJcF7tJ9eKSW90RdppNc\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 32719,
		"path": "../public/assets/session-DR4CA_Q0.js"
	},
	"/assets/settings.activity-COQ5VV2P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b4e-ri7e2BUH7yhr0JN4JSeskAHXDVQ\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 11086,
		"path": "../public/assets/settings.activity-COQ5VV2P.js"
	},
	"/assets/settings.appearance-D_jjU8DN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1bf2-loQ3C4Uc/nM0eAOos/n7eigdNlc\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 7154,
		"path": "../public/assets/settings.appearance-D_jjU8DN.js"
	},
	"/assets/settings._section-i0ZlGJAT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c636-r5t2ZZGThhHX8ZoYTrCq6kOkxps\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 116278,
		"path": "../public/assets/settings._section-i0ZlGJAT.js"
	},
	"/assets/settings.billing-D1h6x9Su.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"330c-XBok7J6DfP8AtSQk1ffPDnJSXxY\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 13068,
		"path": "../public/assets/settings.billing-D1h6x9Su.js"
	},
	"/assets/settings.browser-DcnM3e2T.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c2c-+M+yR7oC9xgcuz7HxzPhOitLH6E\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 7212,
		"path": "../public/assets/settings.browser-DcnM3e2T.js"
	},
	"/assets/settings.devices-Brd3ffe0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"22cb-G+TeiTfBCdl05d0V0Zbn98xOCxE\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 8907,
		"path": "../public/assets/settings.devices-Brd3ffe0.js"
	},
	"/assets/settings.index-DqSRWjg-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"297a-bTlmtmvAIZq9Ff9UgdnZHW7kvvw\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 10618,
		"path": "../public/assets/settings.index-DqSRWjg-.js"
	},
	"/assets/settings.mobile-BTWJuU_h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7582-4aE7jLVRrxmiiYrYn3mJrv5GVi0\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 30082,
		"path": "../public/assets/settings.mobile-BTWJuU_h.js"
	},
	"/assets/settings.privacy-pDdw38fZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"284e-3z6aqPsR2DVX6TvU/FdULtqvdls\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 10318,
		"path": "../public/assets/settings.privacy-pDdw38fZ.js"
	},
	"/assets/settings.security-DeM171D_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2dc6-GVAvM+b3ROyXsFqLLynqTXUMteg\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 11718,
		"path": "../public/assets/settings.security-DeM171D_.js"
	},
	"/assets/settings.skills-Bo1GRbXf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b388-V9gtwL/vbXMo0/WtEJdqJEPVRHs\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 45960,
		"path": "../public/assets/settings.skills-Bo1GRbXf.js"
	},
	"/assets/settings.support-CRfOEh4Q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ec6-FI7Z1LC0OIu0it51ReAuecu77vM\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 7878,
		"path": "../public/assets/settings.support-CRfOEh4Q.js"
	},
	"/assets/settings.usage-QJDMPHrT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23b8-Zg8hr8Z+TfGwDGxPUoYXMb2CA3I\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 9144,
		"path": "../public/assets/settings.usage-QJDMPHrT.js"
	},
	"/assets/settings.vault-xzleLCvT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47d3-Q0wbGRPKRO6uJwGnf9KS2iEP16E\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 18387,
		"path": "../public/assets/settings.vault-xzleLCvT.js"
	},
	"/assets/settings.tasks-DAYmtnlB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c1-xD6eTdLWCuTHBKauYG3RWJ37nqU\"",
		"mtime": "2026-08-28T01:33:28.073Z",
		"size": 193,
		"path": "../public/assets/settings.tasks-DAYmtnlB.js"
	},
	"/assets/settings.voice-CEewOdS6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"334d-89OT7uTnzh0PQT4I3ecIYktf9Z0\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 13133,
		"path": "../public/assets/settings.voice-CEewOdS6.js"
	},
	"/assets/shared-browser-engine-UuUjWn18.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e7f-AtpPFRkx63nAcHUnvEirQrQR4NQ\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 3711,
		"path": "../public/assets/shared-browser-engine-UuUjWn18.js"
	},
	"/assets/skill-pack-DSNZEyTS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2753-rxQ41TzHIQihHpjWhuTKHzMf0K4\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 10067,
		"path": "../public/assets/skill-pack-DSNZEyTS.js"
	},
	"/assets/solar-data-Cr1sACCj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d14-o0ZWBWvM/3TWTeCGSydO65G0noI\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 3348,
		"path": "../public/assets/solar-data-Cr1sACCj.js"
	},
	"/assets/state-DxxN8SRV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7ee-m7T9F0E58f7Eq0OuZi5SIxxbCR8\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 2030,
		"path": "../public/assets/state-DxxN8SRV.js"
	},
	"/assets/status-zz10kBMm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c86-E2tqfweJsfhk7XHtnDbypyWE188\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 7302,
		"path": "../public/assets/status-zz10kBMm.js"
	},
	"/assets/store-BogwCS0B.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"15b7-JI9e1D05yXA6IjpOYgjKQ+OjeBI\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 5559,
		"path": "../public/assets/store-BogwCS0B.js"
	},
	"/assets/styles-C-fHYRT0.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"25901-5q51vGJYuekPQwoKRehiEXt1BaU\"",
		"mtime": "2026-08-28T01:33:28.076Z",
		"size": 153857,
		"path": "../public/assets/styles-C-fHYRT0.css"
	},
	"/assets/support-ClIJc0Dr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ce7-ZGg7/R10z9DyCi8PIRrKmbzAx3s\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 3303,
		"path": "../public/assets/support-ClIJc0Dr.js"
	},
	"/assets/team-DZKoRPiO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"85f-reY6+Y5Xx+lHYEjh3zSO2SpYsV4\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 2143,
		"path": "../public/assets/team-DZKoRPiO.js"
	},
	"/assets/terms-CB5GD9N8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f3-Wu017YAjTzhfEURrAxdQshb031o\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 243,
		"path": "../public/assets/terms-CB5GD9N8.js"
	},
	"/assets/textarea-CT81ZSvd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"234-TQoWRfdHBkf9zm5uHkEXTSPd1r8\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 564,
		"path": "../public/assets/textarea-CT81ZSvd.js"
	},
	"/assets/throttle-u3W15Ydi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52e-OKczYenMlzATtKhxZH8ZOOjjqt0\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 1326,
		"path": "../public/assets/throttle-u3W15Ydi.js"
	},
	"/assets/tier-benchmark-store-8QK9SMla.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"44c-xpEzkjz5potrc7uBtjtiAC+jtiU\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 1100,
		"path": "../public/assets/tier-benchmark-store-8QK9SMla.js"
	},
	"/assets/transcript-redaction-D5c695T6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2171-HFwB+uZW8B5DruIZUg6h1nqjzTQ\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 8561,
		"path": "../public/assets/transcript-redaction-D5c695T6.js"
	},
	"/assets/unavailable-reason-CxXmcH-x.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"33c-zMREJLSX5NtsDmAgMidxWmCLzIk\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 828,
		"path": "../public/assets/unavailable-reason-CxXmcH-x.js"
	},
	"/assets/unified-task-Ct-wJCIq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ebc-MwXHAywKZKs1267pQhiSHWE+Y0w\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 3772,
		"path": "../public/assets/unified-task-Ct-wJCIq.js"
	},
	"/assets/update-signature-Bgi-Ozhm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4df-dzu3Uyqwlyj1Zwx6HLm3HPkDwmU\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 1247,
		"path": "../public/assets/update-signature-Bgi-Ozhm.js"
	},
	"/assets/use-capabilities-DOviDPoh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c02-xYEwzNHxeYBF3D6fx2IqD7WlC7c\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 11266,
		"path": "../public/assets/use-capabilities-DOviDPoh.js"
	},
	"/assets/use-chat-prefs-CZlk0HKL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"64c-sSembQAMF1+QX+mb0OPOs6Xl3Ec\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 1612,
		"path": "../public/assets/use-chat-prefs-CZlk0HKL.js"
	},
	"/assets/use-demo-CDigG9AR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"128-eDRXCL/+dYtxz19YGPyDkLTa5h4\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 296,
		"path": "../public/assets/use-demo-CDigG9AR.js"
	},
	"/assets/use-demo-session-DYaV0WjV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a4a-dSqcHtH5/Muq3iW7hHn74bxz/aw\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 6730,
		"path": "../public/assets/use-demo-session-DYaV0WjV.js"
	},
	"/assets/use-device-policy-L6Ki8FCd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1405-mKtvA+4mrcd+M7YptjChh1xg0P8\"",
		"mtime": "2026-08-28T01:33:28.074Z",
		"size": 5125,
		"path": "../public/assets/use-device-policy-L6Ki8FCd.js"
	},
	"/assets/use-dictation-oL6d0rAf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"595d-ckLfWLlrnu+u8v1+aSael7q782w\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 22877,
		"path": "../public/assets/use-dictation-oL6d0rAf.js"
	},
	"/assets/use-limits-B2vt3-ru.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c08-8QxxYB3Lc6Ag2XZ6BKDqL9bIN1g\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 3080,
		"path": "../public/assets/use-limits-B2vt3-ru.js"
	},
	"/assets/use-local-engine-DC6_rYk3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d1a-Vuhxo11qf9fD1S5gFGUuf6rDIus\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 3354,
		"path": "../public/assets/use-local-engine-DC6_rYk3.js"
	},
	"/assets/use-mission-brain-YPG1n53p.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1579d-rdZ7af0A9uD6STR1TMeUp0pefFw\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 87965,
		"path": "../public/assets/use-mission-brain-YPG1n53p.js"
	},
	"/assets/use-online-CXunBi7G.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c8-sxxRaI3YIhYUU8NqANt44VxjCSU\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 456,
		"path": "../public/assets/use-online-CXunBi7G.js"
	},
	"/assets/use-settings-access-BtFlRhWI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fb-UiD9a75ZbMEZeqVYT1xGruqI6UY\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 251,
		"path": "../public/assets/use-settings-access-BtFlRhWI.js"
	},
	"/assets/use-shell-DD7w3eib.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ca-k7zrXWFg3T5sFkvJyHMWORwFAgg\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 202,
		"path": "../public/assets/use-shell-DD7w3eib.js"
	},
	"/assets/use-voice-prefs-C3YcXQQR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b08-7CHYJ1t7TSPh8Da8FEntqRz6CaA\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 2824,
		"path": "../public/assets/use-voice-prefs-C3YcXQQR.js"
	},
	"/assets/vault-DxsTugCH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1469-a7qzVXXIvgYH6pBsTDeu4trhjeI\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 5225,
		"path": "../public/assets/vault-DxsTugCH.js"
	},
	"/assets/vendor-mammoth-Dpq0khGw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"79667-yat456Rdzc89mGmuoEmeYx6S17E\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 497255,
		"path": "../public/assets/vendor-mammoth-Dpq0khGw.js"
	},
	"/assets/vendor-markdown-CJdAOkbM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c329-jkqcjH7TYhNPRSsO0D4q0vleV/s\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 115497,
		"path": "../public/assets/vendor-markdown-CJdAOkbM.js"
	},
	"/assets/vendor-react-CX2mWblQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2e56d-qrX6GvMoYNkdEag7AoGUlpZrTKw\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 189805,
		"path": "../public/assets/vendor-react-CX2mWblQ.js"
	},
	"/assets/vendor-runtime-Czpn1I53.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4ac-sE+5KsaRXTMfwOfrOATQajMSGV4\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 1196,
		"path": "../public/assets/vendor-runtime-Czpn1I53.js"
	},
	"/assets/vendor-supabase-DSyywpEH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"31ffe-LFSgZ+b88LeCDCMCAFoHHin+614\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 204798,
		"path": "../public/assets/vendor-supabase-DSyywpEH.js"
	},
	"/assets/vendor-ui-Biwsbn7o.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16455-sMwXdTzIB9KcJUicTtM9EQI09eo\"",
		"mtime": "2026-08-28T01:33:28.075Z",
		"size": 91221,
		"path": "../public/assets/vendor-ui-Biwsbn7o.js"
	},
	"/assets/webllm.server-DNYK_aeU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e1-Us1T5KPTXPRBgWxerF+xOrVbVS4\"",
		"mtime": "2026-08-28T01:33:28.076Z",
		"size": 225,
		"path": "../public/assets/webllm.server-DNYK_aeU.js"
	},
	"/assets/webllm.worker-BYUasHjv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6-gzTuXHvqWN3WhQkR86gwLh/4ICk\"",
		"mtime": "2026-08-28T01:33:28.092Z",
		"size": 166,
		"path": "../public/assets/webllm.worker-BYUasHjv.js"
	},
	"/assets/wllama-CfujTeeK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3a-XHS6PgwOix/pzsr2L7s2oAAni5k\"",
		"mtime": "2026-08-28T01:33:28.076Z",
		"size": 58,
		"path": "../public/assets/wllama-CfujTeeK.js"
	},
	"/assets/wllama-Dk3sV4-d.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"48b4e-XVvVylqXX1LnpZS7y5u/rSV5znE\"",
		"mtime": "2026-08-28T01:33:28.076Z",
		"size": 297806,
		"path": "../public/assets/wllama-Dk3sV4-d.js"
	},
	"/brand/ocade-carcc-wordmark.png": {
		"type": "image/png",
		"etag": "\"7c79a-hDONFyhF6C6vVUP8oUwl+uIk1Hs\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 509850,
		"path": "../public/brand/ocade-carcc-wordmark.png"
	},
	"/cursors/caera-black.svg": {
		"type": "image/svg+xml",
		"etag": "\"e3-cOVBa1MjhDbN4IhGTA4fG6luTC0\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 227,
		"path": "../public/cursors/caera-black.svg"
	},
	"/cursors/caera-white.svg": {
		"type": "image/svg+xml",
		"etag": "\"e3-K8Ph3SHLSn3xKyibe7XMGertmUU\"",
		"mtime": "2026-08-28T01:33:32.669Z",
		"size": 227,
		"path": "../public/cursors/caera-white.svg"
	},
	"/fonts/OFL-InstrumentSerif.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"1135-gDiCV59Tkow3oVdZoNLGxJNQ2gw\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 4405,
		"path": "../public/fonts/OFL-InstrumentSerif.txt"
	},
	"/fonts/OFL-Inter.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"1119-zdAbfmjbgdZj8cOCC298QAKJAN0\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 4377,
		"path": "../public/fonts/OFL-Inter.txt"
	},
	"/fonts/OFL-JetBrainsMono.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"112f-L7YAWH1CBVh/6187FKNT6l1P76A\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 4399,
		"path": "../public/fonts/OFL-JetBrainsMono.txt"
	},
	"/fonts/README.md": {
		"type": "text/markdown; charset=utf-8",
		"etag": "\"721-454yencTVI81kp700tfqHRuG7dE\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 1825,
		"path": "../public/fonts/README.md"
	},
	"/fonts/instrument-serif-italic-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"5670-JObJnKCLHlrMks8QbFhvSR7RUVE\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 22128,
		"path": "../public/fonts/instrument-serif-italic-latin.woff2"
	},
	"/fonts/instrument-serif-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"5228-N930ZbvMJSd2o33PKBeaPKWQNjs\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 21032,
		"path": "../public/fonts/instrument-serif-latin.woff2"
	},
	"/fonts/inter-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"bc80-8R1ym7Ck2DUNLqPQ/AYs9u8tUpg\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 48256,
		"path": "../public/fonts/inter-latin.woff2"
	},
	"/fonts/jetbrains-mono-latin.woff2": {
		"type": "font/woff2",
		"etag": "\"9dd4-5yd+cUUhzrXxdMyYebUeD0qml1M\"",
		"mtime": "2026-08-28T01:33:32.669Z",
		"size": 40404,
		"path": "../public/fonts/jetbrains-mono-latin.woff2"
	},
	"/icons/ocade-128.png": {
		"type": "image/png",
		"etag": "\"2871-IZB027IPQeXA1Uie+syfBzKl93I\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 10353,
		"path": "../public/icons/ocade-128.png"
	},
	"/icons/ocade-192.png": {
		"type": "image/png",
		"etag": "\"5149-wzeR766lYdZEadVNBUoDzG48A0c\"",
		"mtime": "2026-08-28T01:33:32.669Z",
		"size": 20809,
		"path": "../public/icons/ocade-192.png"
	},
	"/icons/ocade-256.png": {
		"type": "image/png",
		"etag": "\"930e-FmD72307V20/TJsN9OqHrh9zjgs\"",
		"mtime": "2026-08-28T01:33:32.669Z",
		"size": 37646,
		"path": "../public/icons/ocade-256.png"
	},
	"/icons/ocade-32.png": {
		"type": "image/png",
		"etag": "\"4dc-hbUtpn6WGgeGc4D7uURQF0k5ABw\"",
		"mtime": "2026-08-28T01:33:32.669Z",
		"size": 1244,
		"path": "../public/icons/ocade-32.png"
	},
	"/icons/ocade-48.png": {
		"type": "image/png",
		"etag": "\"8cf-lg1ou1TM9yhpZPYq24/jNN0WGH0\"",
		"mtime": "2026-08-28T01:33:32.669Z",
		"size": 2255,
		"path": "../public/icons/ocade-48.png"
	},
	"/icons/ocade-512.png": {
		"type": "image/png",
		"etag": "\"282f1-veO7ECjckHeDITMr9SUQUZwBKSE\"",
		"mtime": "2026-08-28T01:33:32.669Z",
		"size": 164593,
		"path": "../public/icons/ocade-512.png"
	},
	"/models/README.md": {
		"type": "text/markdown; charset=utf-8",
		"etag": "\"639-kNCQYFm5MybzQOVkkzMUoMWvI3c\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 1593,
		"path": "../public/models/README.md"
	},
	"/brand/ocade-carcc-mark.png": {
		"type": "image/png",
		"etag": "\"a4249-vxI0sbhEiBkI+cWc8Av0Y58BB3A\"",
		"mtime": "2026-08-28T01:33:32.668Z",
		"size": 672329,
		"path": "../public/brand/ocade-carcc-mark.png"
	},
	"/assets/wllama-m-NqGU8W.wasm": {
		"type": "application/wasm",
		"etag": "\"74d449-/5qFKdxtVjp8khmNdIXiGMaJl+Y\"",
		"mtime": "2026-08-28T01:33:28.076Z",
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
