import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { E as Smartphone, M as ShieldCheck, Xn as CircleCheck, Xt as Laptop } from "../_libs/lucide-react.mjs";
import { n as PublicPage, r as PublicSection, t as Notice } from "./PublicPage-CTc9xZld.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/download-DCa5FpeG.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Prelaunch default. The repository intentionally contains no paid publisher
* certificate and no pretend release URL.
*/
var PUBLIC_WINDOWS_RELEASE = {
	version: null,
	url: null,
	sha256: null,
	authenticodeSigned: false,
	updateSignatureVerified: false,
	cleanDeviceTested: false,
	publisher: null
};
var SHA256 = /^[a-f0-9]{64}$/;
function evaluatePublicWindowsRelease(release) {
	if (!release.authenticodeSigned || !release.publisher) return {
		ready: false,
		reason: "signing_required"
	};
	if (!release.updateSignatureVerified || !release.cleanDeviceTested) return {
		ready: false,
		reason: "verification_required"
	};
	if (!release.version || !release.url || !release.sha256 || !SHA256.test(release.sha256)) return {
		ready: false,
		reason: "invalid_manifest"
	};
	try {
		if (new URL(release.url).protocol !== "https:") return {
			ready: false,
			reason: "invalid_manifest"
		};
	} catch {
		return {
			ready: false,
			reason: "invalid_manifest"
		};
	}
	return {
		ready: true,
		url: release.url,
		label: `Download OCADE ${release.version} for Windows`
	};
}
function detectClientPlatform(userAgent) {
	const ua = userAgent.toLowerCase();
	if (/iphone|ipad|ipod/.test(ua)) return "ios";
	if (/android/.test(ua)) return "android";
	if (/windows/.test(ua)) return "windows";
	if (/macintosh|mac os x/.test(ua)) return "macos";
	return "other";
}
function DownloadPage() {
	const [platform, setPlatform] = (0, import_react.useState)("other");
	(0, import_react.useEffect)(() => setPlatform(detectClientPlatform(navigator.userAgent)), []);
	const release = (0, import_react.useMemo)(() => evaluatePublicWindowsRelease(PUBLIC_WINDOWS_RELEASE), []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Official packages",
		title: "OCADE on your devices",
		summary: "The web app needs no installer. Native packages add the permission-gated local bridge used for computer control, deeper offline storage and operating-system integration. OCADE never installs itself.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, { children: "Downloads are not open yet. OCADE runs in your browser today with no installer, and the native packages arrive once they are signed and verified. Nothing on this page will ask you to install an unsigned build." }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Windows desktop",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PackageRow, {
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Laptop, {
						className: "h-5 w-5",
						"aria-hidden": true
					}),
					title: platform === "windows" ? "Recommended for this device" : "OCADE for Windows",
					description: "Tauri desktop shell, local companion bridge and optional on-device runtime. Public packages remain unavailable until signing and clean-device verification are complete."
				}), (release.ready, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					disabled: true,
					"data-reason": "A public Windows package needs publisher signing and a clean-device installation test.",
					title: "Unavailable until publisher signing and clean-device testing are complete",
					className: "mt-4 rounded-full",
					children: "Signing and clean-device test required"
				}))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "macOS, Android and iOS",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PackageRow, {
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, {
						className: "h-5 w-5",
						"aria-hidden": true
					}),
					title: "Packaging foundations are present",
					description: "macOS and mobile packages are not public downloads yet. They need production signing, device testing and the relevant store accounts before release."
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "What every public package must prove",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "grid gap-2",
					children: [
						"Publisher identity is verified by the operating system.",
						"The downloaded bytes match the published SHA-256 digest and update signature.",
						"Installation, first launch, update and uninstall pass on a clean device.",
						"Computer, camera, microphone and file permissions remain opt-in."
					].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-start gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, {
							className: "mt-1 h-4 w-4 shrink-0 text-primary",
							"aria-hidden": true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item })]
					}, item))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-start gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
						className: "mt-1 h-4 w-4 shrink-0 text-primary",
						"aria-hidden": true
					}), "Browser OCADE cannot silently gain operating-system control. The signed local companion is the security boundary for desktop actions, while mobile control requires a paired and revocable device relationship."]
				})]
			})
		]
	});
}
function PackageRow({ icon, title, description }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mt-0.5 rounded-full border border-primary/30 bg-primary/10 p-2 text-primary",
			children: icon
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "font-semibold text-foreground",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-xs leading-relaxed",
			children: description
		})] })]
	});
}
//#endregion
export { DownloadPage as component };
