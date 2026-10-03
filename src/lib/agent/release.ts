/**
 * THE DEVICE AGENT'S DOWNLOAD AND UPDATE FEED.
 *
 * One folder in the private bucket (`agent/`) holds the signed release
 * manifest, its signature, the update archives and the installers. This file
 * decides which names may be asked for, and what the site may say is
 * available — nothing here trusts a name or a manifest it did not check.
 *
 * The agent verifies the manifest's signature and each archive's hash itself
 * (`jarvis-runtime/ocade_update.py`); this side only hands the bytes over.
 */

const VERSION = String.raw`\d+(?:\.\d+){1,3}`;
const ARCHIVE = new RegExp(`^ocade-agent-${VERSION}-(?:windows|macos|linux)-(?:x64|arm64)\\.zip$`);
const INSTALLER = new RegExp(`^OCADE-Device-Agent-${VERSION}-Setup\\.exe$`);
const FIXED = new Set(["manifest.json", "manifest.json.sig"]);

/** The bucket key for a file a visitor may fetch, or null. Never built from an unchecked name. */
export function agentFileKey(name: string): string | null {
  return FIXED.has(name) || ARCHIVE.test(name) || INSTALLER.test(name) ? `agent/${name}` : null;
}

/** Manifest and signature must always be fresh; versioned files never change under one name. */
export function agentFileHeaders(name: string): Record<string, string> {
  if (FIXED.has(name)) {
    return {
      "content-type": name.endsWith(".json") ? "application/json" : "text/plain; charset=utf-8",
      "cache-control": "no-store",
    };
  }
  return {
    "content-type": "application/octet-stream",
    "content-disposition": `attachment; filename="${name}"`,
    "cache-control": "public, max-age=31536000, immutable",
  };
}

export interface AgentRelease {
  version: string;
  /** Path of the Windows installer on this site, when one is published. */
  windows: string | null;
  /** False until the installer carries a publisher signature Windows recognises. */
  publisherVerified: boolean;
}

/** What the site may offer, from the published manifest. Null when nothing usable is published. */
export function agentReleaseFrom(manifest: unknown): AgentRelease | null {
  if (!manifest || typeof manifest !== "object") return null;
  const { version, installers, publisherVerified } = manifest as Record<string, unknown>;
  if (typeof version !== "string" || !new RegExp(`^${VERSION}$`).test(version)) return null;
  const windows = (installers as Record<string, unknown> | undefined)?.["windows-x64"];
  return {
    version,
    windows: typeof windows === "string" && INSTALLER.test(windows) ? `/agent/${windows}` : null,
    publisherVerified: publisherVerified === true,
  };
}
