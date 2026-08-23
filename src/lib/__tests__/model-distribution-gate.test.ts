import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("production model distribution gate", () => {
  it("binds current runtime evidence to pinned manifests without overstating distribution", () => {
    const output = execFileSync(process.execPath, ["scripts/check-model-distribution.mjs"], {
      encoding: "utf8",
    });
    expect(output).toContain("SOURCE-FIXED AND EXECUTED; DISTRIBUTION EXTERNALLY BLOCKED");
    expect(output).toMatch(/EXECUTED 1 .* SOURCE-FIXED 7 .* EXTERNALLY BLOCKED 5/);
    expect(output).toContain("same-origin browser weight is absent");
    expect(output).toContain("desktop publishing is intentionally disabled");
  });

  it("keeps launch proof and the distribution gate reachable from package scripts", async () => {
    const pkg = JSON.parse(
      await import("node:fs").then((fs) => fs.readFileSync("package.json", "utf8")),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["model:distribution-check"]).toContain("check-model-distribution.mjs");
    expect(pkg.scripts?.["model:distribution-proof"]).toContain("--write");
  });
});
