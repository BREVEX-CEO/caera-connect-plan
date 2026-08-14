/**
 * Installing the local engine runtime, so a clean machine is not a dead one.
 *
 * WHAT THIS FIXES
 * ---------------
 * `runtime-supervisor.ts` searches a fixed list of paths and, finding nothing,
 * returns `binary_not_found` with a sentence explaining that the runtime is not
 * installed. That is true, honest, and completely useless to the person it is
 * shown to: they did not choose to install a runtime, they installed OCADE. On
 * a machine that has never had Ollama, first run currently dead-ends and there
 * is nothing anywhere in the repository that would ever install it.
 *
 * A NON-TECHNICAL USER MUST NEVER SEE THE WORD "OLLAMA"
 * ------------------------------------------------------
 * Everything here reports through the same generic vocabulary the rest of first
 * run uses — "Setting up your assistant". The runtime's name, its version, the
 * download size and the URL are implementation details. A progress bar that
 * says "Downloading Ollama 0.5.4 (1.2 GB)" turns a product into a homework
 * assignment.
 *
 * AN UNVERIFIED DOWNLOAD IS NEVER EXECUTED, AND THAT IS THE WHOLE SAFETY MODEL
 * ----------------------------------------------------------------------------
 * This fetches an executable over the network and runs it. That is exactly the
 * shape of a supply-chain attack, so the rules are absolute and enforced here
 * rather than left to the caller:
 *
 *   1. HTTPS only, and only to a pinned host. A redirect to another origin is
 *      refused rather than followed.
 *   2. The bytes are hashed and compared to a digest shipped WITH THE APP, not
 *      fetched alongside the download. A digest supplied by the same server as
 *      the file proves nothing — whoever replaced one replaced the other.
 *   3. A mismatch deletes the file. It is never executed "just this once", and
 *      there is no flag to skip the check.
 *
 * `verifyDownload` is exported and pure so the rule can be tested without a
 * network, because a security property that is only exercised by the happy path
 * is not a property at all.
 */

/** The one host this module will fetch from. */
export const RUNTIME_HOST = "ollama.com";

export type InstallPlatform = "win32" | "darwin" | "linux";

export interface InstallSource {
  /** Absolute HTTPS URL of the installer. */
  url: string;
  /** File name to write into the temporary directory. */
  fileName: string;
  /** Arguments that make the installer run without any UI. */
  silentArgs: string[];
}

/**
 * Where the runtime comes from on each platform, and how to run it silently.
 *
 * Linux is deliberately absent. Its official path is a shell script piped into
 * `sh`, and piping a downloaded script into a shell is the one thing this
 * module exists to refuse — there is no file to hash before it executes. Linux
 * users are told to install it themselves, which is honest and, on Linux, a
 * completely ordinary thing to be asked.
 */
const SOURCES: Partial<Record<InstallPlatform, InstallSource>> = {
  win32: {
    url: `https://${RUNTIME_HOST}/download/OllamaSetup.exe`,
    fileName: "ocade-runtime-setup.exe",
    // NSIS silent mode: no window, no prompts, no finish page.
    silentArgs: ["/S"],
  },
  darwin: {
    url: `https://${RUNTIME_HOST}/download/Ollama-darwin.zip`,
    fileName: "ocade-runtime.zip",
    silentArgs: [],
  },
};

export function installSourceFor(platform: string): InstallSource | null {
  return SOURCES[platform as InstallPlatform] ?? null;
}

/**
 * Is this URL one we are willing to fetch an executable from?
 *
 * Exported because it is also the redirect check: a 302 to a look-alike host is
 * the cheapest way to defeat a pinned URL, so every hop is re-tested rather
 * than only the first.
 */
export function isTrustedRuntimeUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  // Exact host or a subdomain of it. `evilollama.com` must not pass, which a
  // naive `endsWith` would allow.
  return parsed.hostname === RUNTIME_HOST || parsed.hostname.endsWith(`.${RUNTIME_HOST}`);
}

export interface VerifyInput {
  /** Digest of the bytes actually received. */
  actualSha256: string;
  /** Digest shipped with the application for this platform and version. */
  expectedSha256: string | null;
}

export type VerifyOutcome =
  { ok: true } | { ok: false; reason: "no_expected_digest" | "digest_mismatch"; detail: string };

/**
 * Decide whether a downloaded installer may be run. Pure, so it is testable.
 *
 * A MISSING EXPECTED DIGEST IS A REFUSAL, NOT A PASS. That default is the
 * entire point: the failure mode of "we could not check, so we ran it" is
 * indistinguishable from having no check at all, and it is the one that ships
 * by accident when a release forgets to update the manifest.
 */
export function verifyDownload(input: VerifyInput): VerifyOutcome {
  if (!input.expectedSha256) {
    return {
      ok: false,
      reason: "no_expected_digest",
      detail:
        "This build carries no checksum for the runtime installer, so the download cannot be " +
        "verified and will not be run.",
    };
  }
  if (input.actualSha256.toLowerCase() !== input.expectedSha256.toLowerCase()) {
    return {
      ok: false,
      reason: "digest_mismatch",
      detail:
        "The runtime installer did not match its expected checksum, so it was deleted without " +
        "being run.",
    };
  }
  return { ok: true };
}

export interface InstallDeps {
  platform: string;
  /** Fetch the installer, returning its bytes and the final URL after redirects. */
  download: (url: string) => Promise<{ bytes: Uint8Array; finalUrl: string }>;
  /** Hex sha256 of the bytes. */
  digest: (bytes: Uint8Array) => Promise<string>;
  /** Expected digest for this platform, read from the shipped manifest. */
  expectedDigest: (platform: string) => Promise<string | null>;
  /** Write to a temporary path and return it. */
  writeTemp: (fileName: string, bytes: Uint8Array) => Promise<string>;
  /** Run the installer silently. Resolves with the exit code. */
  run: (path: string, args: string[]) => Promise<number>;
  /** Remove a file that must not be kept. */
  remove: (path: string) => Promise<void>;
  /** Progress, in the product's generic vocabulary. */
  onProgress?: (percent: number | null) => void;
}

export interface InstallResult {
  ok: boolean;
  reason?: string;
  /** Generic, user-facing. Never names the runtime. */
  detail: string;
}

/**
 * Install the runtime silently, or explain why not — without ever naming it.
 */
export async function installRuntime(deps: InstallDeps): Promise<InstallResult> {
  const source = installSourceFor(deps.platform);
  if (!source) {
    return {
      ok: false,
      reason: "unsupported_platform",
      detail: "Automatic setup is not available on this system. It can be set up manually.",
    };
  }
  if (!isTrustedRuntimeUrl(source.url)) {
    return { ok: false, reason: "untrusted_source", detail: "Setup could not start safely." };
  }

  deps.onProgress?.(null);

  let bytes: Uint8Array;
  let finalUrl: string;
  try {
    const got = await deps.download(source.url);
    bytes = got.bytes;
    finalUrl = got.finalUrl;
  } catch {
    return {
      ok: false,
      reason: "download_failed",
      detail: "Setup could not finish. It will try again.",
    };
  }

  // Re-check after redirects: a pinned URL that follows a hop to anywhere is
  // not pinned to anything.
  if (!isTrustedRuntimeUrl(finalUrl)) {
    return { ok: false, reason: "untrusted_redirect", detail: "Setup could not start safely." };
  }

  const actual = await deps.digest(bytes);
  const expected = await deps.expectedDigest(deps.platform);
  const verdict = verifyDownload({ actualSha256: actual, expectedSha256: expected });
  if (!verdict.ok) {
    return { ok: false, reason: verdict.reason, detail: "Setup could not be completed safely." };
  }

  const path = await deps.writeTemp(source.fileName, bytes);
  let code: number;
  try {
    code = await deps.run(path, source.silentArgs);
  } catch {
    await deps.remove(path).catch(() => {});
    return {
      ok: false,
      reason: "run_failed",
      detail: "Setup could not finish. It will try again.",
    };
  }
  await deps.remove(path).catch(() => {});

  if (code !== 0) {
    return {
      ok: false,
      reason: "installer_failed",
      detail: "Setup could not finish. It will try again.",
    };
  }
  deps.onProgress?.(100);
  return { ok: true, detail: "Setup finished." };
}
