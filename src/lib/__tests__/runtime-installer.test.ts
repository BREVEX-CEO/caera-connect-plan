import { describe, it, expect } from "vitest";
import {
  installRuntime,
  installSourceFor,
  isTrustedRuntimeUrl,
  verifyDownload,
} from "@/lib/local/runtime-installer";

/**
 * This module downloads an executable and runs it. That is the exact shape of a
 * supply-chain attack, so the refusals matter more than the happy path — and a
 * refusal that is never exercised is not a refusal.
 */

const bytes = new Uint8Array([1, 2, 3]);

function deps(over: Partial<Parameters<typeof installRuntime>[0]> = {}) {
  const ran: string[] = [];
  const removed: string[] = [];
  return {
    ran,
    removed,
    d: {
      platform: "win32",
      download: async (url: string) => ({ bytes, finalUrl: url }),
      digest: async () => "abc123",
      expectedDigest: async () => "abc123",
      writeTemp: async (name: string) => `/tmp/${name}`,
      run: async (path: string) => {
        ran.push(path);
        return 0;
      },
      remove: async (path: string) => {
        removed.push(path);
      },
      ...over,
    },
  };
}

describe("only a pinned, verified source is ever executed", () => {
  it("accepts the official host and its subdomains", () => {
    expect(isTrustedRuntimeUrl("https://ollama.com/download/OllamaSetup.exe")).toBe(true);
    expect(isTrustedRuntimeUrl("https://cdn.ollama.com/x.exe")).toBe(true);
  });

  it("rejects a look-alike host", () => {
    // The naive check is `endsWith("ollama.com")`, which this defeats.
    expect(isTrustedRuntimeUrl("https://evilollama.com/x.exe")).toBe(false);
    expect(isTrustedRuntimeUrl("https://ollama.com.attacker.net/x.exe")).toBe(false);
  });

  it("rejects plain http even on the right host", () => {
    expect(isTrustedRuntimeUrl("http://ollama.com/download/OllamaSetup.exe")).toBe(false);
  });

  it("refuses a redirect that leaves the pinned host", async () => {
    const { d, ran } = deps({
      download: async () => ({ bytes, finalUrl: "https://elsewhere.example/x.exe" }),
    });
    const result = await installRuntime(d);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("untrusted_redirect");
    // The point of the check: nothing ran.
    expect(ran).toEqual([]);
  });
});

describe("an unverified download is never run", () => {
  it("refuses when the build carries no expected checksum", () => {
    // The default that must fail closed. "We could not check, so we ran it" is
    // indistinguishable from having no check.
    const v = verifyDownload({ actualSha256: "abc", expectedSha256: null });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toBe("no_expected_digest");
  });

  it("refuses when the checksum does not match", () => {
    const v = verifyDownload({ actualSha256: "abc", expectedSha256: "def" });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toBe("digest_mismatch");
  });

  it("is case-insensitive about hex, and only that", () => {
    expect(verifyDownload({ actualSha256: "ABC123", expectedSha256: "abc123" }).ok).toBe(true);
  });

  it("does not execute a mismatched installer", async () => {
    const { d, ran } = deps({ expectedDigest: async () => "totally-different" });
    const result = await installRuntime(d);
    expect(result.ok).toBe(false);
    expect(ran, "a mismatched installer must never be executed").toEqual([]);
  });
});

describe("what the user is told", () => {
  it("never names the runtime in any message", async () => {
    const outcomes = [
      await installRuntime(deps({ expectedDigest: async () => null }).d),
      await installRuntime(deps({ platform: "linux" }).d),
      await installRuntime(
        deps({
          download: async () => {
            throw new Error("network");
          },
        }).d,
      ),
      await installRuntime(deps({ run: async () => 1 }).d),
    ];
    for (const outcome of outcomes) {
      expect(outcome.detail.toLowerCase(), outcome.detail).not.toContain("ollama");
      expect(outcome.detail.toLowerCase(), outcome.detail).not.toContain(".exe");
      expect(outcome.detail.toLowerCase(), outcome.detail).not.toContain("sha256");
    }
  });

  it("declines Linux rather than piping a script into a shell", () => {
    // There is no file to hash before it executes, so the one safety rule this
    // module has cannot be applied. Declining honestly beats a silent exception.
    expect(installSourceFor("linux")).toBeNull();
  });
});

describe("the happy path still works", () => {
  it("runs the installer silently and cleans up after itself", async () => {
    const { d, ran, removed } = deps();
    const result = await installRuntime(d);
    expect(result.ok).toBe(true);
    expect(ran).toHaveLength(1);
    // The downloaded executable must not be left lying in temp.
    expect(removed).toEqual(ran);
  });
});
