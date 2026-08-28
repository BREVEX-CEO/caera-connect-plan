//#region node_modules/.nitro/vite/services/ssr/assets/mission-host.node-ChhwuCxr.js
/** How long a mission may go untouched before it is cleaned up. */
var IDLE_MS = 300 * 1e3;
var MAX_MISSIONS = 4;
var missions = /* @__PURE__ */ new Map();
var sweeper = null;
function sweep() {
	const now = Date.now();
	for (const mission of [...missions.values()]) if (now - mission.touchedAt > IDLE_MS) stopMission(mission.id, "It was left idle.");
	if (missions.size === 0 && sweeper) {
		clearInterval(sweeper);
		sweeper = null;
	}
}
function ensureSweeper() {
	if (sweeper) return;
	sweeper = setInterval(sweep, 3e4);
	sweeper.unref?.();
}
function newMissionId() {
	return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
async function openMission(id, adapters, via) {
	if (missions.size >= MAX_MISSIONS) {
		const oldest = [...missions.values()].sort((a, b) => a.touchedAt - b.touchedAt)[0];
		if (oldest) await stopMission(oldest.id, "Another mission needed the computer.");
	}
	const mission = {
		id,
		adapters,
		startedAt: Date.now(),
		touchedAt: Date.now(),
		stopping: false,
		via,
		actions: 0
	};
	missions.set(id, mission);
	ensureSweeper();
	return mission;
}
function findMission(id) {
	const mission = missions.get(id);
	if (!mission) return null;
	mission.touchedAt = Date.now();
	return mission;
}
/**
* End a mission: let go of the input, then drop the sidecars.
*
* Safe to call twice, and safe to call on an id that never existed — a stop
* arriving after a crash, or twice from an impatient user, must not itself be
* an error.
*/
async function stopMission(id, reason = "The user stopped it.") {
	const mission = missions.get(id);
	if (!mission) return {
		stopped: false,
		released: false,
		reason: "That mission is not running."
	};
	mission.stopping = true;
	missions.delete(id);
	let released = false;
	try {
		released = await mission.adapters.releaseHeldInput();
	} catch {
		released = false;
	}
	try {
		mission.adapters.dispose();
	} catch {}
	return {
		stopped: true,
		released,
		reason
	};
}
/** Every running mission, for a shutdown path or a status screen. */
async function stopAllMissions(reason) {
	const ids = [...missions.keys()];
	for (const id of ids) await stopMission(id, reason);
	return ids.length;
}
function missionCount() {
	return missions.size;
}
//#endregion
export { findMission, missionCount, newMissionId, openMission, stopAllMissions, stopMission };
