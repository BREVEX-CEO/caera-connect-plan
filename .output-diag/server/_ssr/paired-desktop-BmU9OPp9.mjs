import { n as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as unavailable } from "./adapter-BHZ2v_VZ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/paired-desktop-BmU9OPp9.js
var paired_desktop_BmU9OPp9_exports = /* @__PURE__ */ __exportAll({
	n: () => paired_desktop_exports,
	t: () => PairedDesktopAdapter
});
var paired_desktop_exports = /* @__PURE__ */ __exportAll$1({ PairedDesktopAdapter: () => PairedDesktopAdapter });
async function hmacSha256(secret, message) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign"]);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
	return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
var PairedDesktopAdapter = class {
	id = "paired_desktop";
	displayName = "Paired computer";
	credentials;
	fetchImpl;
	constructor(options) {
		this.credentials = options.credentials;
		this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
	}
	/** Build the headers that prove who this is, fresh for every request. */
	async authHeaders(creds) {
		const issuedAt = Date.now();
		const nonce = crypto.randomUUID();
		const origin = typeof window === "undefined" ? "" : window.location.origin;
		const signature = await hmacSha256(creds.secret, `${creds.deviceId}|${origin}|${issuedAt}|${nonce}`);
		return {
			"content-type": "application/json",
			"x-ocade-device": creds.deviceId,
			"x-ocade-issued-at": String(issuedAt),
			"x-ocade-nonce": nonce,
			"x-ocade-signature": signature
		};
	}
	async probe() {
		const creds = this.credentials.current();
		if (!creds) return unavailable("not_paired", "No computer is paired with this device yet.", ["pair_a_computer"]);
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 4e3);
			const response = await this.fetchImpl(`${creds.bridgeUrl.replace(/\/+$/, "")}/status`, {
				headers: await this.authHeaders(creds),
				signal: controller.signal
			});
			clearTimeout(timer);
			if (response.status === 401 || response.status === 403) return unavailable("not_paired", "That computer no longer accepts this device. Pair it again.", ["pair_a_computer"]);
			if (!response.ok) return unavailable("not_running", `The paired computer answered ${response.status}.`);
			const body = await response.json();
			return {
				available: true,
				label: body.label ?? "Paired computer",
				locality: "paired_device",
				modelId: body.modelId ?? null,
				capabilities: {
					text: true,
					vision: body.vision === true,
					imageGeneration: false,
					tools: body.tools === true
				}
			};
		} catch {
			return unavailable("not_running", "The paired computer is not reachable right now.", ["pair_a_computer"]);
		}
	}
	async stream(messages, handlers) {
		const creds = this.credentials.current();
		if (!creds) return {
			ok: false,
			failure: "unavailable",
			reason: "No computer is paired with this device."
		};
		const startedAt = Date.now();
		let firstTokenMs = null;
		try {
			const response = await this.fetchImpl(`${creds.bridgeUrl.replace(/\/+$/, "")}/chat`, {
				method: "POST",
				headers: await this.authHeaders(creds),
				body: JSON.stringify({
					messages,
					think: handlers.think === true
				}),
				signal: handlers.signal
			});
			if (response.status === 401 || response.status === 403) return {
				ok: false,
				failure: "unavailable",
				reason: "That computer refused this device. Pair it again."
			};
			if (response.status === 429) return {
				ok: false,
				failure: "error",
				reason: "The paired computer is busy. Try again in a moment."
			};
			if (!response.ok || !response.body) return {
				ok: false,
				failure: "error",
				reason: `The paired computer answered ${response.status}.`
			};
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let modelId = null;
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				if (handlers.signal?.aborted) break;
				buffer += decoder.decode(value, { stream: true });
				let newline;
				while ((newline = buffer.indexOf("\n")) >= 0) {
					const line = buffer.slice(0, newline).trim();
					buffer = buffer.slice(newline + 1);
					if (!line) continue;
					try {
						const event = JSON.parse(line);
						if (event.modelId) modelId = event.modelId;
						if (event.token) {
							if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
							handlers.onToken(event.token);
						}
					} catch {}
				}
			}
			if (handlers.signal?.aborted) return {
				ok: false,
				failure: "cancelled",
				reason: "Stopped."
			};
			return {
				ok: true,
				modelId,
				firstTokenMs
			};
		} catch (error) {
			if (handlers.signal?.aborted) return {
				ok: false,
				failure: "cancelled",
				reason: "Stopped."
			};
			return {
				ok: false,
				failure: "error",
				reason: `The paired computer stopped responding: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}
};
//#endregion
export { paired_desktop_BmU9OPp9_exports as n, PairedDesktopAdapter as t };
