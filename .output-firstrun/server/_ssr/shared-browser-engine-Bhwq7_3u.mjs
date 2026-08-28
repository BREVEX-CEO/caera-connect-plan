//#region node_modules/.nitro/vite/services/ssr/assets/shared-browser-engine-Bhwq7_3u.js
var DEFAULTS = {
	lockName: "ocade.model.owner",
	channelName: "ocade.model.bus",
	requestTimeoutMs: 2e4
};
function modelOwnerSupported() {
	return typeof BroadcastChannel === "function" && typeof navigator !== "undefined" && typeof navigator.locks?.request === "function";
}
function createModelOwner(options) {
	const lockName = options.lockName ?? DEFAULTS.lockName;
	const channelName = options.channelName ?? DEFAULTS.channelName;
	const timeoutMs = options.requestTimeoutMs ?? DEFAULTS.requestTimeoutMs;
	const me = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const channel = new BroadcastChannel(channelName);
	let role = "starting";
	let loads = 0;
	let disposed = false;
	let releaseLock = null;
	const roleListeners = /* @__PURE__ */ new Set();
	/** Follower-side: requests this tab is waiting on. */
	const pending = /* @__PURE__ */ new Map();
	function setRole(next) {
		if (role === next) return;
		role = next;
		for (const listener of roleListeners) listener(next);
	}
	function post(message) {
		if (!disposed) channel.postMessage(message);
	}
	async function becomeOwner() {
		setRole("owner");
		post({
			k: "owner",
			who: me
		});
		for (const [id, entry] of [...pending]) {
			clearTimeout(entry.timer);
			pending.delete(id);
			try {
				if (loads === 0) {
					loads += 1;
					await options.load();
				}
				const result = await options.run(entry.payload, entry.onToken);
				entry.settle({
					...result,
					ranOn: "owner"
				});
			} catch (error) {
				entry.settle({
					ok: false,
					reason: error instanceof Error ? error.message : "The model failed.",
					ranOn: "owner"
				});
			}
		}
	}
	async function handleRequest(message) {
		if (role !== "owner") return;
		try {
			if (loads === 0) {
				loads += 1;
				await options.load();
			}
			const result = await options.run(message.payload, (t) => post({
				k: "tok",
				id: message.id,
				t
			}));
			post({
				k: "end",
				id: message.id,
				ok: result.ok,
				reason: result.reason,
				data: result.data
			});
		} catch (error) {
			post({
				k: "end",
				id: message.id,
				ok: false,
				reason: error instanceof Error ? error.message : "The model failed."
			});
		}
	}
	function failPending(reason) {
		for (const [, entry] of pending) {
			clearTimeout(entry.timer);
			entry.settle({
				ok: false,
				reason
			});
		}
		pending.clear();
	}
	channel.onmessage = (event) => {
		const message = event.data;
		if (!message || typeof message !== "object") return;
		switch (message.k) {
			case "req":
				handleRequest(message);
				return;
			case "who":
				if (role === "owner") post({
					k: "owner",
					who: me
				});
				return;
			case "owner":
				if (message.who !== me) retryPending();
				return;
			case "tok":
				pending.get(message.id)?.onToken(message.t);
				return;
			case "end": {
				const entry = pending.get(message.id);
				if (!entry) return;
				clearTimeout(entry.timer);
				pending.delete(message.id);
				entry.settle({
					ok: message.ok,
					reason: message.reason,
					data: message.data,
					ranOn: "follower-forwarded"
				});
				return;
			}
		}
	};
	/** Re-send anything in flight, ONCE, to whoever owns the model now. */
	const retried = /* @__PURE__ */ new Set();
	function retryPending() {
		for (const [id, entry] of pending) {
			if (retried.has(id)) continue;
			retried.add(id);
			clearTimeout(entry.timer);
			entry.timer = setTimeout(() => {
				pending.delete(id);
				entry.settle({
					ok: false,
					reason: "The tab holding the model did not answer."
				});
			}, timeoutMs);
			post({
				k: "req",
				id,
				from: me,
				payload: entry.payload
			});
		}
	}
	async function request(payload, onToken) {
		if (disposed) return {
			ok: false,
			reason: "This tab has stopped using the model."
		};
		if (role === "owner") {
			if (loads === 0) {
				loads += 1;
				await options.load();
			}
			return {
				...await options.run(payload, onToken),
				ranOn: "owner"
			};
		}
		const id = `${me}-${Math.random().toString(36).slice(2, 10)}`;
		return new Promise((resolve) => {
			const entry = {
				onToken,
				settle: resolve,
				payload,
				timer: setTimeout(() => {
					pending.delete(id);
					resolve({
						ok: false,
						reason: "The tab holding the model did not answer."
					});
				}, timeoutMs)
			};
			pending.set(id, entry);
			post({
				k: "req",
				id,
				from: me,
				payload
			});
		});
	}
	if (modelOwnerSupported()) {
		navigator.locks.request(lockName, { mode: "exclusive" }, async () => {
			if (disposed) return;
			await becomeOwner();
			await new Promise((resolve) => {
				releaseLock = resolve;
			});
		}).catch(() => {});
		setRole("follower");
		post({ k: "who" });
	} else becomeOwner();
	return {
		role: () => role,
		request,
		loadCount: () => loads,
		onRoleChange: (listener) => {
			roleListeners.add(listener);
			return () => roleListeners.delete(listener);
		},
		dispose: () => {
			if (disposed) return;
			disposed = true;
			failPending("This tab stopped using the model.");
			releaseLock?.();
			channel.close();
		}
	};
}
function shareAcrossTabs(inner) {
	if (!modelOwnerSupported()) return inner;
	let handle = null;
	function owner() {
		if (handle) return handle;
		handle = createModelOwner({
			load: async () => {},
			run: async (payload, onToken) => {
				const request = payload;
				if (request.kind === "preload") {
					await inner.preload?.();
					return { ok: true };
				}
				const result = await inner.stream(request.messages, {
					onToken,
					think: request.think
				});
				return result.ok ? {
					ok: true,
					data: { modelId: result.modelId }
				} : {
					ok: false,
					reason: result.reason ?? "The browser engine failed."
				};
			}
		});
		return handle;
	}
	return {
		id: inner.id,
		displayName: inner.displayName,
		probe: () => inner.probe(),
		async preload() {
			const result = await owner().request({ kind: "preload" }, () => {});
			if (!result.ok) throw new Error(result.reason ?? "The browser engine could not warm up.");
		},
		async stream(messages, handlers) {
			const coordinator = owner();
			if (handlers.signal !== void 0 || (handlers.tools?.length ?? 0) > 0 || coordinator.role() === "owner") return inner.stream(messages, handlers);
			const startedAt = Date.now();
			let firstTokenMs = null;
			const result = await coordinator.request({
				kind: "stream",
				messages,
				think: handlers.think
			}, (token) => {
				if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
				handlers.onToken(token);
			});
			const modelId = typeof result.data === "object" && result.data !== null ? result.data.modelId ?? null : null;
			return result.ok ? {
				ok: true,
				modelId,
				firstTokenMs
			} : {
				ok: false,
				failure: "error",
				reason: result.reason ?? "The tab holding the on-device model did not answer. Reload this tab to take it over."
			};
		},
		async dispose() {
			handle?.dispose();
			handle = null;
			await inner.dispose?.();
		}
	};
}
//#endregion
export { shareAcrossTabs };
