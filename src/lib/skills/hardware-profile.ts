/**
 * OCADE hardware-profile recommender (master plan §6.3).
 *
 * Detecting the machine's specs needs a runtime (the companion or browser
 * APIs) — that part is environment-gated. This is the pure decision the plan
 * asks for on top of detection: given the specs, recommend a compatible LOCAL
 * profile, and — the rule stated in bold in §6.3 — **never auto-download a
 * large component.** A profile that would fit but isn't installed is offered
 * for the user to approve; it is never silently selected as ready.
 *
 * TWO HONESTY RULES:
 *
 * 1. **Installed ≠ fits, and fits ≠ installed.** These are separate facts and
 *    are reported separately. The recommender picks the most capable profile
 *    that FITS; whether it is READY depends on installation, and a fitting-but-
 *    absent profile is returned as "needs approval to download N", never
 *    started behind the user's back.
 *
 * 2. **When nothing local fits, say so — don't pretend.** If even the smallest
 *    local profile exceeds the machine, the recommendation is to free resources
 *    or move to capable hardware, not to run something that won't load.
 *
 * Reuses `HardwareSnapshot` from the resource governor so there is one shape
 * for "the machine right now".
 */
import type { HardwareSnapshot } from "./resource-governor";

export interface LocalProfile {
  id: string;
  label: string;
  /** RAM the profile needs loaded, in bytes. */
  minRamBytes: number;
  /** Disk the profile's components occupy once installed. */
  installBytes: number;
  /** Bytes still to download if not yet installed. 0 when fully local. */
  downloadBytes: number;
  /** True when the profile can only run with a GPU. */
  requiresGpu: boolean;
  /** True when the components are already on disk. */
  installed: boolean;
  /** Relative capability, higher = more capable. Used to prefer the best fit. */
  tier: number;
}

export type ProfileOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface ProfileRecommendation {
  /** The best profile that FITS and is READY now, if any. */
  ready: LocalProfile | null;
  /**
   * A more capable profile that would fit but must be downloaded first. Offered
   * for approval — never auto-installed.
   */
  installable: LocalProfile | null;
  /** Every profile that could not run, with the reason. */
  excluded: { profile: LocalProfile; reason: string }[];
  /** What OCADE recommends the user do. */
  recommendation: string;
  /** True when nothing local can run on this machine. */
  localUnavailable: boolean;
}

/** Keep this much RAM free for the OS, matching the resource governor. */
const RAM_HEADROOM = 0.85;

/**
 * Recommend a local profile for the current machine.
 *
 * Picks the most capable profile that fits within a safe RAM ceiling, has its
 * storage, and has a GPU if it needs one. Never auto-downloads: a fitting
 * profile that isn't installed is surfaced as `installable`, not `ready`.
 */
export function recommendProfile(
  hw: HardwareSnapshot,
  profiles: LocalProfile[],
): ProfileOutcome<ProfileRecommendation> {
  if (profiles.length === 0)
    return { ok: false, reason: "No local profiles were provided to choose from." };

  const usableRam = hw.availableRamBytes * RAM_HEADROOM;
  const excluded: { profile: LocalProfile; reason: string }[] = [];
  const fitting: LocalProfile[] = [];

  for (const p of profiles) {
    if (p.requiresGpu && !hw.hasGpu) {
      excluded.push({
        profile: p,
        reason: `${p.label} needs a GPU, which this machine doesn't have.`,
      });
      continue;
    }
    if (p.minRamBytes > usableRam) {
      excluded.push({
        profile: p,
        reason: `${p.label} needs ${formatBytes(p.minRamBytes)} of RAM but only ${formatBytes(usableRam)} is safely available.`,
      });
      continue;
    }
    // Installing needs room for the download AND the unpacked components.
    const storageNeeded = p.installed ? 0 : p.installBytes;
    if (storageNeeded > hw.freeStorageBytes) {
      excluded.push({
        profile: p,
        reason: `${p.label} needs ${formatBytes(storageNeeded)} of free disk to install but only ${formatBytes(hw.freeStorageBytes)} is free.`,
      });
      continue;
    }
    fitting.push(p);
  }

  // Most capable first among those that fit.
  fitting.sort((a, b) => b.tier - a.tier);

  const ready = fitting.find((p) => p.installed) ?? null;
  // A better profile than the ready one, that fits but must be downloaded.
  const installable = fitting.find((p) => !p.installed && (!ready || p.tier > ready.tier)) ?? null;
  const localUnavailable = fitting.length === 0;

  return {
    ok: true,
    data: {
      ready,
      installable,
      excluded,
      localUnavailable,
      recommendation: describe(ready, installable, localUnavailable),
    },
    evidence: localUnavailable
      ? `No local profile fits; ${excluded.length} excluded.`
      : `${fitting.length} local profile(s) fit; best ready: ${ready?.label ?? "none installed"}.`,
  };
}

function describe(
  ready: LocalProfile | null,
  installable: LocalProfile | null,
  localUnavailable: boolean,
): string {
  if (localUnavailable) {
    return "Nothing local will run on this machine as it is. Free memory or disk, or use a device with supported local hardware; OCADE will not move the job to public-cloud inference.";
  }
  if (ready && installable) {
    return `${ready.label} is installed and ready. A more capable option, ${installable.label}, would also fit — it needs a ${formatBytes(installable.downloadBytes)} download, which OCADE will not start without your approval.`;
  }
  if (ready) {
    return `${ready.label} is installed and the best local fit. Ready to use now.`;
  }
  if (installable) {
    return `No local profile is installed yet. ${installable.label} would fit and needs a ${formatBytes(installable.downloadBytes)} download — OCADE will not download it without your approval.`;
  }
  return "A local profile fits but its state is unclear; OCADE won't assume it's ready.";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
