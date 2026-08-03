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
import { execFile } from "node:child_process";
import { statfs } from "node:fs/promises";
import { totalmem, freemem, cpus, arch, platform } from "node:os";
import { promisify } from "node:util";
import { unknownSnapshot, type GpuPresence, type HardwareSnapshot } from "./detect.ts";

const run = promisify(execFile);

/** Adapter names that indicate real acceleration rather than a display chip. */
const DISCRETE = /nvidia|geforce|rtx|gtx|radeon|\brx\s|\barc\s|quadro|tesla/i;

interface GpuResult {
  present: GpuPresence;
  adapters: string[];
  discrete: string[];
  reason: string;
}

const unknownGpu = (reason: string): GpuResult => ({
  present: "unknown",
  adapters: [],
  discrete: [],
  reason,
});

async function detectGpu(): Promise<GpuResult> {
  const os = platform();
  try {
    if (os === "win32") {
      const { stdout } = await run(
        "powershell",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "(Get-CimInstance Win32_VideoController).Name -join '|'",
        ],
        { timeout: 15_000 },
      );
      const adapters = stdout.trim().split("|").filter(Boolean);
      if (adapters.length === 0) return unknownGpu("no video controller reported");
      const discrete = adapters.filter((n) => DISCRETE.test(n));
      return {
        present: discrete.length > 0,
        adapters,
        discrete,
        reason:
          discrete.length > 0 ? "discrete adapter reported" : "only integrated adapters reported",
      };
    }

    if (os === "darwin") {
      // Added here: the script had no darwin probe, so every Mac reported
      // "unknown" and silently fell back to the conservative branch.
      const { stdout } = await run("system_profiler", ["SPDisplaysDataType", "-json"], {
        timeout: 20_000,
        maxBuffer: 4 * 1024 * 1024,
      });
      const parsed = JSON.parse(stdout) as {
        SPDisplaysDataType?: { sppci_model?: string; spdisplays_vendor?: string }[];
      };
      const adapters = (parsed.SPDisplaysDataType ?? [])
        .map((d) => d.sppci_model ?? d.spdisplays_vendor ?? "")
        .filter(Boolean);
      if (adapters.length === 0) return unknownGpu("system_profiler reported no display hardware");
      // Apple Silicon GPUs are integrated but genuinely accelerate inference,
      // so they count where an Intel Iris does not.
      const discrete = adapters.filter((n) => DISCRETE.test(n) || /apple m\d/i.test(n));
      return {
        present: discrete.length > 0,
        adapters,
        discrete,
        reason: discrete.length > 0 ? "accelerating GPU reported" : "no accelerating GPU reported",
      };
    }

    if (os === "linux") {
      const { stdout } = await run(
        "sh",
        ["-c", "lspci 2>/dev/null | grep -i 'vga\\|3d\\|display' || true"],
        { timeout: 15_000 },
      );
      const adapters = stdout.trim().split("\n").filter(Boolean);
      if (adapters.length === 0) return unknownGpu("lspci unavailable or reported nothing");
      const discrete = adapters.filter((n) => DISCRETE.test(n));
      return {
        present: discrete.length > 0,
        adapters,
        discrete,
        reason: discrete.length > 0 ? "discrete adapter reported by lspci" : "integrated only",
      };
    }

    return unknownGpu(`no probe implemented for ${os}`);
  } catch (error) {
    return unknownGpu(error instanceof Error ? error.message : "probe failed");
  }
}

async function freeStorage(): Promise<number> {
  try {
    const stats = await statfs(process.cwd());
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    // Unknown free space is reported as 0, which makes any disk pre-check
    // refuse rather than proceed blind.
    return 0;
  }
}

export async function measureHardware(): Promise<HardwareSnapshot> {
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
      // A desktop host measured here is never a phone. Mobile is decided by the
      // shell that calls this, not inferred from the server it happens to run on.
      isMobile: false,
      measuredAt: new Date().toISOString(),
    };
  } catch (error) {
    return unknownSnapshot(
      platform(),
      error instanceof Error ? error.message : "measurement failed",
    );
  }
}
