/**
 * Hardware detection and local-profile benchmark.
 *
 * Specification §3.5 requires hardware-aware model tiers and §19.2 requires
 * "hardware detection works". `recommendProfile` in
 * src/lib/skills/hardware-profile.ts already chooses a tier — but it takes a
 * HardwareSnapshot as input, so nothing had ever produced one from a real
 * machine. This does, and prints what it found.
 *
 * Detecting hardware needs no model weights, no GPU and no credentials, so this
 * item was never externally blocked. Only the DOWNLOAD and RUN of a model are.
 *
 * HONESTY RULES:
 *  - GPU presence is not reliably detectable from stock Node on every platform.
 *    When it cannot be determined, this reports `unknown` and the profile
 *    recommendation treats it as ABSENT — the conservative direction, since
 *    assuming a GPU that is not there would recommend a tier the machine cannot
 *    run.
 *  - Every number is measured. Nothing is estimated from the platform name.
 *  - A measurement that fails is reported as unavailable, never defaulted to a
 *    plausible-looking value.
 *
 * Usage: node scripts/detect-hardware.mjs [--json]
 */

import { totalmem, freemem, cpus, arch, platform, release } from "node:os";
import { statfs } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const jsonOnly = process.argv.includes("--json");

/** Free bytes on the volume holding the project. */
async function freeDisk() {
  try {
    const stats = await statfs(process.cwd());
    return { ok: true, bytes: stats.bavail * stats.bsize };
  } catch (error) {
    return { ok: false, reason: (error && error.message) || "statfs unavailable" };
  }
}

/**
 * Best-effort GPU probe. Returns `unknown` rather than guessing: a wrong
 * positive would recommend a tier the machine cannot actually run.
 */
function detectGpu() {
  try {
    if (platform() === "win32") {
      const out = execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "(Get-CimInstance Win32_VideoController).Name -join '|'",
        ],
        { encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      if (!out) return { present: "unknown", reason: "no video controller reported" };
      const names = out.split("|").filter(Boolean);
      // A discrete GPU is what matters for local inference; integrated display
      // adapters are reported but not treated as acceleration.
      const discrete = names.filter((n) => /nvidia|geforce|rtx|gtx|radeon|rx |arc /i.test(n));
      return {
        present: discrete.length > 0,
        adapters: names,
        discrete,
        reason:
          discrete.length > 0 ? "discrete adapter reported" : "only integrated adapters reported",
      };
    }
    if (platform() === "linux") {
      const out = execFileSync(
        "sh",
        ["-c", "lspci 2>/dev/null | grep -i 'vga\\|3d\\|display' || true"],
        {
          encoding: "utf8",
          timeout: 15_000,
        },
      ).trim();
      if (!out) return { present: "unknown", reason: "lspci unavailable" };
      const discrete = /nvidia|amd\/ati|radeon/i.test(out);
      return { present: discrete, adapters: out.split("\n"), reason: "lspci" };
    }
    return { present: "unknown", reason: `no probe implemented for ${platform()}` };
  } catch (error) {
    return { present: "unknown", reason: (error && error.message) || "probe failed" };
  }
}

const cpuList = cpus() ?? [];
const disk = await freeDisk();
const gpu = detectGpu();

const snapshot = {
  totalRamBytes: totalmem(),
  availableRamBytes: freemem(),
  freeStorageBytes: disk.ok ? disk.bytes : 0,
  // `unknown` is treated as absent: the conservative direction.
  hasGpu: gpu.present === true,
};

const report = {
  generatedAt: new Date().toISOString(),
  machine: {
    platform: platform(),
    release: release(),
    arch: arch(),
    cpuModel: cpuList[0]?.model?.trim() ?? "unknown",
    cpuCores: cpuList.length,
  },
  memory: {
    totalBytes: snapshot.totalRamBytes,
    availableBytes: snapshot.availableRamBytes,
    totalGiB: +(snapshot.totalRamBytes / 1024 ** 3).toFixed(2),
    availableGiB: +(snapshot.availableRamBytes / 1024 ** 3).toFixed(2),
  },
  storage: disk.ok
    ? { freeBytes: disk.bytes, freeGiB: +(disk.bytes / 1024 ** 3).toFixed(2) }
    : { freeBytes: null, unavailable: disk.reason },
  gpu,
  snapshot,
  note: "hasGpu is false when GPU presence is unknown. Assuming a GPU that is absent would recommend a tier this machine cannot run.",
};

/**
 * Tier table mirroring specification §3.5. These are PLANNING defaults, not
 * benchmarked model choices — the spec says so explicitly, and so does this.
 */
const GiB = 1024 ** 3;
const TIERS = [
  { id: "chat-1b", label: "Lightweight chat (~1B quantised)", minRamGiB: 3, tier: 1 },
  { id: "general-3b", label: "General local chat (~3B quantised)", minRamGiB: 6, tier: 2 },
  { id: "reasoning-7b", label: "Stronger reasoning (~7B quantised)", minRamGiB: 12, tier: 3 },
  { id: "advanced-14b", label: "Advanced planning (~14B quantised)", minRamGiB: 24, tier: 4 },
];

const RAM_HEADROOM = 0.85; // matches hardware-profile.ts
const usable = snapshot.availableRamBytes * RAM_HEADROOM;
const fits = TIERS.filter((t) => t.minRamGiB * GiB <= usable);
const best = fits.at(-1) ?? null;

report.recommendation = {
  usableRamGiB: +(usable / GiB).toFixed(2),
  fits: fits.map((t) => t.id),
  best: best?.id ?? null,
  advice: best
    ? `This machine can run ${best.label} within a safe RAM ceiling.`
    : "No local tier fits the currently available RAM. Cloud is the honest fallback until more RAM is free.",
  caveat:
    "Tiers are planning defaults from specification 3.5, not benchmarked model choices. Real model selection must be validated against measured memory, speed and quality before release.",
};

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const m = report.machine;
  console.log("OCADE hardware detection");
  console.log("");
  console.log(`  platform    ${m.platform} ${m.release} (${m.arch})`);
  console.log(`  cpu         ${m.cpuModel} — ${m.cpuCores} logical cores`);
  console.log(
    `  memory      ${report.memory.availableGiB} GiB free of ${report.memory.totalGiB} GiB`,
  );
  console.log(
    `  storage     ${disk.ok ? `${report.storage.freeGiB} GiB free` : `unavailable (${disk.reason})`}`,
  );
  console.log(
    `  gpu         ${gpu.present === true ? `yes — ${(gpu.discrete ?? []).join(", ")}` : gpu.present === false ? `none detected (${gpu.reason})` : `unknown (${gpu.reason})`}`,
  );
  console.log("");
  console.log(`  usable RAM  ${report.recommendation.usableRamGiB} GiB after 15% headroom`);
  console.log(`  fits tiers  ${fits.length > 0 ? fits.map((t) => t.id).join(", ") : "none"}`);
  console.log(`  recommend   ${report.recommendation.advice}`);
  console.log("");
  console.log(`  ${report.recommendation.caveat}`);
}
