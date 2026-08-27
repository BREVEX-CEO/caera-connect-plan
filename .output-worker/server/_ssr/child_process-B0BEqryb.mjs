import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/child_process-B0BEqryb.js
/* @__NO_SIDE_EFFECTS__ */
function createNotImplementedError(name) {
	return /* @__PURE__ */ new Error(`[unenv] ${name} is not implemented yet!`);
}
/* @__NO_SIDE_EFFECTS__ */
function notImplemented(name) {
	const fn = () => {
		throw /* @__PURE__ */ createNotImplementedError(name);
	};
	return Object.assign(fn, { __unenv__: true });
}
/* @__NO_SIDE_EFFECTS__ */
function notImplementedClass(name) {
	return class {
		__unenv__ = true;
		constructor() {
			throw new Error(`[unenv] ${name} is not implemented yet!`);
		}
	};
}
var child_process_exports = /* @__PURE__ */ __exportAll({
	ChildProcess: () => ChildProcess,
	_forkChild: () => _forkChild,
	default: () => child_process_default,
	exec: () => exec,
	execFile: () => execFile,
	execFileSync: () => execFileSync,
	execSync: () => execSync,
	fork: () => fork,
	spawn: () => spawn,
	spawnSync: () => spawnSync
});
var ChildProcess = /* @__PURE__ */ notImplementedClass("child_process.ChildProcess");
var _forkChild = /* @__PURE__ */ notImplemented("child_process.ChildProcess");
var exec = /* @__PURE__ */ notImplemented("child_process.exec");
var execFile = /* @__PURE__ */ notImplemented("child_process.execFile");
var execFileSync = /* @__PURE__ */ notImplemented("child_process.execFileSync");
var execSync = /* @__PURE__ */ notImplemented("child_process.execSyn");
var fork = /* @__PURE__ */ notImplemented("child_process.fork");
var spawn = /* @__PURE__ */ notImplemented("child_process.spawn");
var spawnSync = /* @__PURE__ */ notImplemented("child_process.spawnSync");
var child_process_default = {
	ChildProcess,
	_forkChild,
	exec,
	execFile,
	execFileSync,
	execSync,
	fork,
	spawn,
	spawnSync
};
//#endregion
export { execFile as n, spawn as r, child_process_exports as t };
