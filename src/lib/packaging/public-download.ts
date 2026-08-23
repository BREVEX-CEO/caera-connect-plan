/**
 * Public installer publication gate.
 *
 * Building an EXE and publishing one are deliberately separate. Windows code
 * signing identifies the publisher; the detached update signature protects
 * the bytes after download. OCADE offers a public installer only when both are
 * present and the release pipeline has recorded a clean-device result.
 */
export interface PublicWindowsRelease {
  version: string | null;
  url: string | null;
  sha256: string | null;
  authenticodeSigned: boolean;
  updateSignatureVerified: boolean;
  cleanDeviceTested: boolean;
  publisher: string | null;
}

export type PublicReleaseVerdict =
  | { ready: true; url: string; label: string }
  | { ready: false; reason: "signing_required" | "verification_required" | "invalid_manifest" };

/**
 * Prelaunch default. The repository intentionally contains no paid publisher
 * certificate and no pretend release URL.
 */
export const PUBLIC_WINDOWS_RELEASE: PublicWindowsRelease = {
  version: null,
  url: null,
  sha256: null,
  authenticodeSigned: false,
  updateSignatureVerified: false,
  cleanDeviceTested: false,
  publisher: null,
};

const SHA256 = /^[a-f0-9]{64}$/;

export function evaluatePublicWindowsRelease(release: PublicWindowsRelease): PublicReleaseVerdict {
  if (!release.authenticodeSigned || !release.publisher) {
    return { ready: false, reason: "signing_required" };
  }
  if (!release.updateSignatureVerified || !release.cleanDeviceTested) {
    return { ready: false, reason: "verification_required" };
  }
  if (!release.version || !release.url || !release.sha256 || !SHA256.test(release.sha256)) {
    return { ready: false, reason: "invalid_manifest" };
  }
  try {
    const url = new URL(release.url);
    if (url.protocol !== "https:") return { ready: false, reason: "invalid_manifest" };
  } catch {
    return { ready: false, reason: "invalid_manifest" };
  }
  return {
    ready: true,
    url: release.url,
    label: `Download OCADE ${release.version} for Windows`,
  };
}

export type ClientPlatform = "windows" | "macos" | "android" | "ios" | "other";

export function detectClientPlatform(userAgent: string): ClientPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/windows/.test(ua)) return "windows";
  if (/macintosh|mac os x/.test(ua)) return "macos";
  return "other";
}
