//#region node_modules/unenv/dist/runtime/node/internal/worker_threads/broadcast-channel.mjs
var BroadcastChannel = class {
	name = "";
	onmessage = (message) => {};
	onmessageerror = (message) => {};
	close() {}
	postMessage(message) {}
	ref() {
		return this;
	}
	unref() {
		return this;
	}
};
//#endregion
export { BroadcastChannel as t };
