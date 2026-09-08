import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/** Guards the no-cost default CI contract and its local parity entry point. */
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const platforms = readFileSync(".github/workflows/platforms.yml", "utf8");
const windowsProof = readFileSync(".github/workflows/windows-proof.yml", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

function jobNamesIn(source: string): string[] {
  const lines = source.split(/\r?\n/);
  const jobsLine = lines.findIndex((line) => line === "jobs:");
  return lines
    .slice(jobsLine + 1)
    .map((line) => /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line)?.[1])
    .filter((name): name is string => Boolean(name));
}

describe("the ordinary CI workflow is deliberately small", () => {
  it("runs exactly one Ubuntu Node 22 job", () => {
    expect(jobNamesIn(ci)).toEqual(["portable-core"]);
    expect(ci).toContain("runs-on: ubuntu-latest");
    expect(ci).toContain("node-version-file: .node-version");
    expect(ci).not.toContain("windows-latest");
    expect(ci).not.toContain("macos-latest");
    expect(ci).not.toContain("strategy:");
  });

  it("uses the same portable gate developers run locally", () => {
    expect(pkg.scripts["verify:full"]).toBe("node scripts/verify-full.mjs");
    expect(ci).toContain("npm run verify:full");
    expect(ci).toContain("npm ci --no-audit --no-fund");
    expect(ci).toContain("npm audit --omit=dev");
  });

  it("cancels superseded runs and uploads artifacts only on failure", () => {
    expect(ci).toMatch(/cancel-in-progress:\s*true/);
    expect(ci).toMatch(/if:\s*failure\(\)/);
    expect(ci).toMatch(/retention-days:\s*3/);
    expect(ci).not.toMatch(/if:\s*always\(\)/);
  });
});

describe("platform proof remains explicit and honest", () => {
  it("keeps Windows, macOS, Android, iOS and Rust proof outside push CI", () => {
    expect(platforms).toContain("workflow_dispatch:");
    expect(platforms).toContain("windows-latest");
    expect(platforms).toContain("macos-latest");
    expect(platforms).toContain("cargo test --all-targets");
    expect(windowsProof).toContain("workflow_dispatch:");
    expect(windowsProof).not.toMatch(/^\s*push:/m);
  });
});

describe("workflow hygiene", () => {
  it("triggers on the mission branch family and pull requests to main", () => {
    expect(ci).toMatch(/claude\/\*\*/);
    expect(ci).toMatch(/pull_request:/);
  });

  it("embeds no credential-shaped literal", () => {
    expect(ci).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
    expect(ci).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(ci).not.toMatch(/password:\s*['"][^'"]{6,}['"]/i);
  });

  it("does not deploy, publish or sign from CI", () => {
    expect(ci).not.toMatch(/\bnpx? wrangler deploy\b|\bnpm publish\b|\btauri-action\b/);
  });
});
