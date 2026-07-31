import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDeploymentPlan, runDeployment } from "../../../scripts/deploy.mjs";

type RunCall = {
  command: string;
  args: string[];
  options: { cwd?: string; env?: NodeJS.ProcessEnv; inherit?: boolean };
};

let root: string;
let sequence = 0;

const deployEnv = (): NodeJS.ProcessEnv => ({
  CLOUDFLARE_API_TOKEN: "synthetic-token-never-print",
  CLOUDFLARE_ACCOUNT_ID: "synthetic-account-never-print",
  OCADE_DEPLOY_HEALTH_URL: "https://ocade.example.invalid/api/health",
  OCADE_DEPLOY_APPROVAL: "I_APPROVE_OCADE_PRODUCTION_DEPLOY",
  OCADE_ROLLBACK_VERSION_ID: "previous_version_1234",
});

function materialiseFixture(options: { generatedName?: string; generatedMain?: string } = {}) {
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "ocade", version: "0.1.0" }));
  writeFileSync(
    join(root, "wrangler.json"),
    JSON.stringify({
      name: "ocade-web",
      keep_vars: true,
      observability: { enabled: true },
    }),
  );
  mkdirSync(join(root, ".output", "server"), { recursive: true });
  writeFileSync(
    join(root, ".output", "server", "wrangler.json"),
    JSON.stringify({
      name: options.generatedName ?? "ocade-web",
      main: options.generatedMain ?? "index.mjs",
      assets: { binding: "ASSETS" },
    }),
  );
  writeFileSync(join(root, ".output", "server", "index.mjs"), "export default {};\n");
}

function recordingRunner(
  calls: RunCall[],
  failAt: ((command: string, args: string[]) => boolean) | null = null,
) {
  return (command: string, args: string[], options: RunCall["options"]) => {
    calls.push({ command, args, options });
    return failAt?.(command, args)
      ? { status: 1, stdout: "", stderr: "synthetic failure" }
      : { status: 0, stdout: "ok", stderr: "" };
  };
}

const healthy = (version = "0.1.0") =>
  new Response(JSON.stringify({ status: "ok", service: "ocade-web", version }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  root = join(tmpdir(), `ocade-deploy-${process.pid}-${sequence++}`);
  mkdirSync(root, { recursive: true });
  materialiseFixture();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("deployment preflight fails closed", () => {
  it("names every missing external prerequisite without exposing values", () => {
    const plan = createDeploymentPlan({ cwd: root, env: {}, mode: "deploy" });
    expect(plan.ready).toBe(false);
    expect(plan.blockers).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/health/i),
        expect.stringMatching(/API_TOKEN/),
        expect.stringMatching(/ACCOUNT_ID/),
        expect.stringMatching(/approval/i),
        expect.stringMatching(/ROLLBACK_VERSION_ID/),
      ]),
    );
    expect(JSON.stringify(plan)).not.toContain("synthetic-token-never-print");
  });

  it("refuses unsafe health endpoints before any command can run", () => {
    for (const url of [
      "http://ocade.example.invalid/api/health",
      "https://user:pass@ocade.example.invalid/api/health",
      "https://ocade.example.invalid/api/health?secret=1",
      "https://ocade.example.invalid/not-health",
    ]) {
      const plan = createDeploymentPlan({
        cwd: root,
        env: { ...deployEnv(), OCADE_DEPLOY_HEALTH_URL: url },
        mode: "deploy",
      });
      expect(plan.ready).toBe(false);
      expect(plan.blockers.join(" ")).toMatch(/HTTPS.*api\/health/i);
    }
  });

  it("keeps the approval phrase and rollback target mandatory", () => {
    const noApproval = createDeploymentPlan({
      cwd: root,
      env: { ...deployEnv(), OCADE_DEPLOY_APPROVAL: "yes" },
      mode: "deploy",
    });
    expect(noApproval.ready).toBe(false);
    const noRecovery = createDeploymentPlan({
      cwd: root,
      env: { ...deployEnv(), OCADE_ROLLBACK_VERSION_ID: "" },
      mode: "deploy",
    });
    expect(noRecovery.ready).toBe(false);
  });
});

describe("check mode is read-only", () => {
  it("probes only Wrangler and performs no build, deploy, rollback or fetch", async () => {
    const calls: RunCall[] = [];
    let fetched = false;
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "check",
      runner: recordingRunner(calls),
      fetcher: async () => {
        fetched = true;
        return healthy();
      },
    });
    expect(result.status).toBe("ready");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ command: "wrangler", args: ["--version"] });
    expect(fetched).toBe(false);
  });

  it("reports missing Wrangler as blocked, never as simulated success", async () => {
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "check",
      runner: recordingRunner([], (command) => command === "wrangler"),
    });
    expect(result.status).toBe("blocked");
    expect(result.reason).toMatch(/Wrangler is unavailable/);
    expect(JSON.stringify(result)).not.toMatch(/simulated successfully/i);
  });
});

describe("deploy success requires an independent postcondition", () => {
  it("builds, deploys without a shell, then verifies the exact health version", async () => {
    const calls: RunCall[] = [];
    let observedSignal: AbortSignal | undefined;
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "deploy",
      runner: recordingRunner(calls),
      fetcher: async (_url: string | URL | Request, init?: RequestInit) => {
        observedSignal = init?.signal as AbortSignal;
        return healthy();
      },
    });
    expect(result.status).toBe("verified");
    expect(result.evidence).toMatch(/Deployment completed.*health verified/i);
    expect(calls.map((call) => call.args[0])).toEqual(["--version", "run", "deploy"]);
    expect(calls[2].args).toEqual([
      "deploy",
      "--config",
      ".output/server/wrangler.json",
      "--message",
      "OCADE 0.1.0",
    ]);
    expect(calls.every((call) => !("shell" in call.options))).toBe(true);
    expect(observedSignal).toBeInstanceOf(AbortSignal);
  });

  it("never calls Wrangler deploy after a failed build", async () => {
    const calls: RunCall[] = [];
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "deploy",
      runner: recordingRunner(calls, (_command, args) => args[0] === "run"),
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/build failed/i);
    expect(calls.some((call) => call.args[0] === "deploy")).toBe(false);
  });

  it("never reports success when Wrangler fails", async () => {
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "deploy",
      runner: recordingRunner([], (_command, args) => args[0] === "deploy"),
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/Wrangler deploy failed/);
  });

  it("keeps the incident open and names the prior version when health fails", async () => {
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "deploy",
      runner: recordingRunner([]),
      fetcher: async () => healthy("9.9.9"),
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/did not verify/);
    expect(result.recovery).toContain("previous_version_1234");
  });

  it("rejects mismatched generated output before Wrangler deploy", async () => {
    rmSync(join(root, ".output"), { recursive: true, force: true });
    materialiseFixture({ generatedName: "other-worker" });
    const calls: RunCall[] = [];
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "deploy",
      runner: recordingRunner(calls),
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/worker name differs/i);
    expect(calls.some((call) => call.args[0] === "deploy")).toBe(false);
  });
});

describe("rollback is separately approved and independently verified", () => {
  it("runs the explicit version rollback and verifies its expected version", async () => {
    const calls: RunCall[] = [];
    const env = {
      ...deployEnv(),
      OCADE_ROLLBACK_APPROVAL: "I_APPROVE_OCADE_PRODUCTION_ROLLBACK",
      OCADE_ROLLBACK_EXPECTED_VERSION: "0.0.9",
    };
    const result = await runDeployment({
      cwd: root,
      env,
      mode: "rollback",
      versionId: "previous_version_1234",
      runner: recordingRunner(calls),
      fetcher: async () => healthy("0.0.9"),
    });
    expect(result.status).toBe("verified");
    expect(calls[1].args).toEqual([
      "rollback",
      "previous_version_1234",
      "--config",
      "wrangler.json",
      "--message",
      "OCADE rollback to 0.0.9",
    ]);
  });

  it("refuses an unapproved or unsafe rollback id", async () => {
    for (const versionId of ["", "../latest", "id; deploy"]) {
      const plan = createDeploymentPlan({
        cwd: root,
        env: {
          ...deployEnv(),
          OCADE_ROLLBACK_APPROVAL: "no",
          OCADE_ROLLBACK_EXPECTED_VERSION: "0.0.9",
        },
        mode: "rollback",
        versionId,
      });
      expect(plan.ready).toBe(false);
    }
  });
});
