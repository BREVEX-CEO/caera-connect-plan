import { t as getRequest } from "./request-response-BEPp1C2k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/control-access.node-Db1Sn6Lc.js
/**
* Who may drive this computer, and the one case where an account is not needed.
*
* THE PROBLEM
* -----------
* OCADE's demo exists so somebody can find out whether PC control actually
* works before handing over an email address. A demo of PC control that cannot
* control the PC is a demo of a text box. But "unauthenticated callers may
* operate this machine" is, stated plainly, the worst sentence that could
* appear in this codebase.
*
* WHAT MAKES IT SAFE, AND IT IS ONE FACT
* ---------------------------------------
* The demo may control the computer only when the browser and the server are
* THE SAME MACHINE. Then "an unauthenticated caller" is the person sitting at
* the keyboard, who could open Notepad themselves, and OCADE is a local
* application rather than a service. The moment the server is reachable from
* anywhere else, that reasoning collapses completely — so this refuses.
*
* THREE CONDITIONS, ALL REQUIRED:
*
*   1. The request's Host is a loopback address. Not merely "starts with
*      localhost": parsed, and checked against 127.0.0.0/8, ::1 and the literal
*      name. A `Host: localhost.evil.example` header must not read as local.
*   2. `OCADE_HOSTED` is not set. A deployment sets it and closes this door
*      regardless of what any header claims, because a reverse proxy in front
*      of a hosted instance can present `Host: localhost` all day.
*   3. The Origin, when present, is loopback too. A page on another origin
*      reaching a loopback server is exactly the attack this would otherwise
*      open: any website, silently driving the visitor's computer.
*
* AUTHENTICATED CALLERS DO NOT COME THROUGH HERE. The signed-in path keeps
* `requireSupabaseAuth` unchanged; nothing in this file loosens it. This is a
* second, narrower door, and it is barred by default.
*/
/** Hostnames that mean "this machine". */
function isLoopbackHost(hostname) {
	const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
	if (host === "localhost" || host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
	const parts = host.split(".");
	if (parts.length !== 4) return false;
	const octets = parts.map((part) => Number(part));
	if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
	return octets[0] === 127;
}
function hostnameOf(value) {
	if (!value) return null;
	try {
		return new URL(value.includes("://") ? value : `http://${value}`).hostname;
	} catch {
		return null;
	}
}
/** Whether this installation is a hosted deployment rather than someone's PC. */
function isHostedDeployment(env = process.env) {
	return Boolean(env.OCADE_HOSTED || env.VERCEL || env.CF_PAGES || env.NETLIFY);
}
/**
* Decide whether an unauthenticated caller may drive this computer.
*
* Pure apart from reading the request, and the request is a parameter so every
* branch — hosted, remote host, cross-origin, genuinely local — is reachable
* from a test without a server.
*/
function judgeLocalDemoAccess(request, env = process.env) {
	if (isHostedDeployment(env)) return {
		ok: false,
		reason: "This is OCADE's hosted demo, so it cannot reach a computer. Install OCADE on your own machine to try PC control."
	};
	if (!request?.headers) return {
		ok: false,
		reason: "OCADE could not establish where this request came from."
	};
	const host = hostnameOf(request.headers.get("host"));
	if (!host || !isLoopbackHost(host)) return {
		ok: false,
		reason: "PC control without an account is only available when OCADE is running on the computer you are sitting at."
	};
	const origin = request.headers.get("origin");
	if (origin) {
		const originHost = hostnameOf(origin);
		if (!originHost || !isLoopbackHost(originHost)) return {
			ok: false,
			reason: "That request came from another website, so OCADE refused it."
		};
	}
	return {
		ok: true,
		via: "local-demo",
		detail: "OCADE is running on this computer, so the demo can control it without an account."
	};
}
/**
* The gate the Control + Work server functions call.
*
* Tries the account first and falls back to the local-demo rule. Written this
* way round deliberately: a signed-in user on a hosted instance keeps working,
* and the local rule is only ever reached by someone with no account at all.
*/
async function authoriseControl() {
	const request = getRequest();
	const header = request?.headers?.get("authorization");
	if (header?.toLowerCase().startsWith("bearer ")) {
		const { verifyBearerToken } = await import("./control-identity.node-CM_l3MKM.mjs");
		const verdict = await verifyBearerToken(header.slice(7).trim());
		if (verdict.ok) return {
			ok: true,
			via: "account",
			detail: "Signed in."
		};
		return {
			ok: false,
			reason: verdict.reason
		};
	}
	return judgeLocalDemoAccess(request);
}
//#endregion
export { authoriseControl, isHostedDeployment, judgeLocalDemoAccess };
