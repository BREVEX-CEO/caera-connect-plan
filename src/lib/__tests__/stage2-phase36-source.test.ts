import { describe, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";

describe("Stage 2 Phase 36: Packaging and Release Preparation", () => {
  it("has Tauri updater and createUpdaterArtifacts configured but disabled until signed", async () => {
    const tauriConfStr = await fs.readFile(
      path.join(process.cwd(), "native/companion/tauri/tauri.conf.json"),
      "utf-8",
    );
    const tauriConf = JSON.parse(tauriConfStr);

    expect(tauriConf.bundle.createUpdaterArtifacts).toBe(false);
    expect(tauriConf.plugins.updater.active).toBe(false);
    expect(tauriConf.plugins.updater.endpoints.length).toBeGreaterThan(0);
  });

  it("has CI and Release GitHub Actions workflows", async () => {
    const ciStat = await fs.stat(path.join(process.cwd(), ".github/workflows/ci.yml"));
    expect(ciStat.isFile()).toBe(true);

    const releaseStat = await fs.stat(path.join(process.cwd(), ".github/workflows/release.yml"));
    expect(releaseStat.isFile()).toBe(true);
  });

  it("has deployment scripts configured", async () => {
    const deployStat = await fs.stat(path.join(process.cwd(), "scripts/deploy.mjs"));
    expect(deployStat.isFile()).toBe(true);
  });
});
