//#region node_modules/.nitro/vite/services/ssr/assets/detect-LJYWOPdG.js
var GIB = 1024 ** 3;
var round = (bytes) => Math.round(bytes / GIB * 100) / 100;
function profileFrom(snapshot) {
	const hasDiscreteGpu = snapshot.gpuPresent === true;
	const gpuCertain = snapshot.gpuPresent !== "unknown";
	const gpuSummary = !gpuCertain ? `Could not determine whether this machine has a graphics card (${snapshot.gpuReason}). Assuming it does not, which is the safe direction.` : hasDiscreteGpu ? `Discrete graphics detected: ${snapshot.gpuDiscrete.join(", ")}.` : snapshot.gpuAdapters.length > 0 ? `Integrated graphics only (${snapshot.gpuAdapters.join(", ")}), which does not accelerate local models.` : "No graphics adapter reported.";
	return {
		totalRamGib: round(snapshot.totalRamBytes),
		availableRamGib: round(snapshot.availableRamBytes),
		freeStorageGib: round(snapshot.freeStorageBytes),
		cpuCount: snapshot.cpuCount,
		hasDiscreteGpu,
		gpuCertain,
		gpuSummary,
		isMobile: snapshot.isMobile,
		platform: snapshot.platform
	};
}
/**
* A snapshot to fall back on when measurement itself fails.
*
* Not a guess at the real machine — every number is zero and the GPU is
* unknown, so any tier decision made from it lands on the smallest, safest
* option rather than an optimistic one.
*/
function unknownSnapshot(platform = "unknown", reason = "measurement failed") {
	return {
		totalRamBytes: 0,
		availableRamBytes: 0,
		freeStorageBytes: 0,
		cpuCount: 0,
		cpuModel: null,
		arch: "unknown",
		platform,
		gpuPresent: "unknown",
		gpuAdapters: [],
		gpuDiscrete: [],
		gpuReason: reason,
		isMobile: false,
		measuredAt: (/* @__PURE__ */ new Date(0)).toISOString()
	};
}
//#endregion
export { unknownSnapshot as n, profileFrom as t };
