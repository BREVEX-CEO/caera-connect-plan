import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/cloudflare-production.yml", "utf8");

describe("the Cloudflare production workflow stays under human control", () => {
  it("can only be started manually", () => {
    expect(workflow).toMatch(/^on:\n {2}workflow_dispatch:/m);
    expect(workflow).not.toMatch(/^ {2}(push|pull_request|schedule):/m);
  });

  it("requires the exact production approval and recovery target", () => {
    expect(workflow).toContain("I_APPROVE_OCADE_PRODUCTION_DEPLOY");
    expect(workflow).toContain("rollback_version_id");
    expect(workflow).toContain("OCADE_ROLLBACK_VERSION_ID");
    expect(workflow).toContain("environment: cloudflare-production");
  });

  it("uses secret references, not embedded credentials", () => {
    expect(workflow).toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(workflow).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
    expect(workflow).not.toMatch(/AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,}/);
  });

  it("tests, deploys through the fail-closed controller and checks production health", () => {
    for (const command of [
      "npm run typecheck",
      "npm test",
      "npm run release:source-check",
      "npm run operations:check",
      "npm run performance:budget",
      "npm run deploy:web",
    ]) {
      expect(workflow).toContain(command);
    }
    expect(workflow).toContain("https://ocade.in/api/health");
  });
});
