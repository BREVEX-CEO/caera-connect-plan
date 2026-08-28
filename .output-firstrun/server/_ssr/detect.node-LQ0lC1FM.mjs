import { n as unknownSnapshot } from "./detect-LJYWOPdG.mjs";
import { execFile } from "node:child_process";
import { statfs } from "node:fs/promises";
import { arch, cpus, freemem, platform, totalmem } from "node:os";
import { promisify } from "node:util";
//#region node_modules/.nitro/vite/services/ssr/assets/detect.node-LQ0lC1FM.js
/**
* Real hardware measurement (W2). Node-only.
*
* Ported from `scripts/detect-hardware.mjs`, which measured the right things
* but could only be run from a terminal. The behaviour worth preserving is its
* refusal to guess: a GPU probe that cannot answer returns "unknown", never
* `false` dressed up as a measurement and never an optimistic `true`.
*
* One thing is added rather than ported: macOS had no probe at all
* ("no probe implemented for darwin"), which mattered because the plan covers
* macOS. `system_profiler` now answers there.
*/
var run = promisify(execFile);
/** Adapter names that indicate real acceleration rather than a display chip. */
var DISCRETE = /nvidia|geforce|rtx|gtx|radeon|\brx\s|\barc\s|quadro|tesla/i;
var unknownGpu = (reason) => ({
	present: "unknown",
	adapters: [],
	discrete: [],
	reason
});
async function detectGpu() {
	const os = platform();
	try {
		if (os === "win32") {
			const { stdout } = await run("powershell", [
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				"(Get-CimInstance Win32_VideoController).Name -join '|'"
			], { timeout: 15e3 });
			const adapters = stdout.trim().split("|").filter(Boolean);
			if (adapters.length === 0) return unknownGpu("no video controller reported");
			const discrete = adapters.filter((n) => DISCRETE.test(n));
			return {
				present: discrete.length > 0,
				adapters,
				discrete,
				reason: discrete.length > 0 ? "discrete adapter reported" : "only integrated adapters reported"
			};
		}
		if (os === "darwin") {
			const { stdout } = await run("system_profiler", ["SPDisplaysDataType", "-json"], {
				timeout: 2e4,
				maxBuffer: 4 * 1024 * 1024
			});
			const adapters = (JSON.parse(stdout).SPDisplaysDataType ?? []).map((d) => d.sppci_model ?? d.spdisplays_vendor ?? "").filter(Boolean);
			if (adapters.length === 0) return unknownGpu("system_profiler reported no display hardware");
			const discrete = adapters.filter((n) => DISCRETE.test(n) || /apple m\d/i.test(n));
			return {
				present: discrete.length > 0,
				adapters,
				discrete,
				reason: discrete.length > 0 ? "accelerating GPU reported" : "no accelerating GPU reported"
			};
		}
		if (os === "linux") {
			const { stdout } = await run("sh", ["-c", "lspci 2>/dev/null | grep -i 'vga\\|3d\\|display' || true"], { timeout: 15e3 });
			const adapters = stdout.trim().split("\n").filter(Boolean);
			if (adapters.length === 0) return unknownGpu("lspci unavailable or reported nothing");
			const discrete = adapters.filter((n) => DISCRETE.test(n));
			return {
				present: discrete.length > 0,
				adapters,
				discrete,
				reason: discrete.length > 0 ? "discrete adapter reported by lspci" : "integrated only"
			};
		}
		return unknownGpu(`no probe implemented for ${os}`);
	} catch (error) {
		return unknownGpu(error instanceof Error ? error.message : "probe failed");
	}
}
async function freeStorage() {
	try {
		const stats = await statfs(process.cwd());
		return Number(stats.bavail) * Number(stats.bsize);
	} catch {
		return 0;
	}
}
async function measureHardware() {
	try {
		const cpuList = cpus() ?? [];
		const [gpu, freeStorageBytes] = await Promise.all([detectGpu(), freeStorage()]);
		return {
			totalRamBytes: totalmem(),
			availableRamBytes: freemem(),
			freeStorageBytes,
			cpuCount: cpuList.length,
			cpuModel: cpuList[0]?.model?.trim() ?? null,
			arch: arch(),
			platform: platform(),
			gpuPresent: gpu.present,
			gpuAdapters: gpu.adapters,
			gpuDiscrete: gpu.discrete,
			gpuReason: gpu.reason,
			isMobile: false,
			measuredAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	} catch (error) {
		return unknownSnapshot(platform(), error instanceof Error ? error.message : "measurement failed");
	}
}
//#endregion
export { measureHardware };
