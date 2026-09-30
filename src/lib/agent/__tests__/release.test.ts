import { describe, expect, it } from "vitest";
import { agentFileHeaders, agentFileKey, agentReleaseFrom } from "../release";

describe("which Device Agent files may be fetched", () => {
  it("serves the manifest, its signature, versioned archives and installers", () => {
    for (const name of [
      "manifest.json",
      "manifest.json.sig",
      "ocade-agent-0.2.0-windows-x64.zip",
      "ocade-agent-1.10.3-macos-arm64.zip",
      "OCADE-Device-Agent-0.2.0-Setup.exe",
    ]) {
      expect(agentFileKey(name), name).toBe(`agent/${name}`);
    }
  });

  it("never turns an unchecked name into a bucket key", () => {
    for (const name of [
      "",
      "../r/ocr-0000000000000000/a",
      "..%2Fmanifest.json",
      "manifest.json/../../secret",
      "ocade-agent-1.0.0-windows-x64.zip.exe",
      "ocade-agent-latest-windows-x64.zip",
      "OCADE-Device-Agent-Setup.exe",
      "release.key",
      "a",
    ]) {
      expect(agentFileKey(name), name).toBeNull();
    }
  });

  it("keeps the manifest fresh and lets versioned files be cached for ever", () => {
    expect(agentFileHeaders("manifest.json")["cache-control"]).toBe("no-store");
    expect(agentFileHeaders("manifest.json.sig")["cache-control"]).toBe("no-store");
    const installer = agentFileHeaders("OCADE-Device-Agent-0.2.0-Setup.exe");
    expect(installer["cache-control"]).toContain("immutable");
    expect(installer["content-disposition"]).toContain("attachment");
  });
});

describe("what the site offers to download", () => {
  it("offers the Windows installer the manifest names", () => {
    expect(
      agentReleaseFrom({
        version: "0.2.0",
        installers: { "windows-x64": "OCADE-Device-Agent-0.2.0-Setup.exe" },
      }),
    ).toEqual({
      version: "0.2.0",
      windows: "/agent/OCADE-Device-Agent-0.2.0-Setup.exe",
      publisherVerified: false,
    });
  });

  it("offers nothing it cannot serve: no manifest, a bad version, a name outside the feed", () => {
    expect(agentReleaseFrom(null)).toBeNull();
    expect(agentReleaseFrom({ version: "latest" })).toBeNull();
    expect(
      agentReleaseFrom({
        version: "1.0.0",
        installers: { "windows-x64": "https://evil.example/x.exe" },
      }),
    ).toMatchObject({ windows: null });
    expect(agentReleaseFrom({ version: "1.0.0" })).toMatchObject({ windows: null });
  });
});
