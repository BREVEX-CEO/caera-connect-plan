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
  OCADE_DEPLOY_EXPECT_ASSET_STATE: "locked",
});

function materialiseFixture(options: { generatedName?: string; generatedMain?: string } = {}) {
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "ocade", version: "0.1.0" }));
  mkdirSync(join(root, "node_modules", "wrangler", "bin"), { recursive: true });
  writeFileSync(join(root, "node_modules", "wrangler", "bin", "wrangler.js"), "");
  writeFileSync(
    join(root, "wrangler.json"),
    JSON.stringify({
      name: "ocade-web",
      keep_vars: true,
      workers_dev: false,
      preview_urls: false,
      observability: { enabled: true },
      assets: { run_worker_first: true },
      version_metadata: { binding: "CF_VERSION_METADATA" },
    }),
  );
  mkdirSync(join(root, ".output", "server"), { recursive: true });
  writeFileSync(
    join(root, ".output", "server", "wrangler.json"),
    JSON.stringify({
      name: options.generatedName ?? "ocade-web",
      main: options.generatedMain ?? "index.mjs",
      assets: { binding: "ASSETS", run_worker_first: true },
      workers_dev: false,
      preview_urls: false,
      version_metadata: { binding: "CF_VERSION_METADATA" },
    }),
  );
  writeFileSync(
    join(root, ".output", "server", "index.mjs"),
    'const gate = "x-ocade-edge-gate"; export default {};\n',
  );
  mkdirSync(join(root, ".output", "public", "assets"), { recursive: true });
  writeFileSync(join(root, ".output", "public", "assets", "index-fixture123.js"), "export {};\n");
}

function recordingRunner(
  calls: RunCall[],
  failAt: ((command: string, args: string[]) => boolean) | null = null,
) {
  return (command: string, args: string[], options: RunCall["options"]) => {
    calls.push({ command, args, options });
    const failed = failAt?.(command, args) ?? false;
    const outputPath = options.env?.WRANGLER_OUTPUT_FILE_PATH;
    if (!failed && args.includes("upload") && typeof outputPath === "string") {
      writeFileSync(
        outputPath,
        JSON.stringify({
          type: "version-upload",
          worker_name: "ocade-web",
          version_id: "new_version_1234",
        }) + "\n",
      );
    }
    return failed
      ? { status: 1, stdout: "", stderr: "synthetic failure" }
      : { status: 0, stdout: "ok", stderr: "" };
  };
}

const healthy = (version = "0.1.0", deploymentId = "new_version_1234") =>
  new Response(JSON.stringify({ status: "ok", service: "ocade-web", version, deploymentId }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const lockedAsset = () =>
  new Response("locked", {
    status: 503,
    headers: {
      "cache-control": "no-store",
      "x-ocade-launch-state": "prelaunch",
      "x-ocade-edge-gate": "asset-v1",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
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

  it("requires an explicit locked or open staged asset expectation", () => {
    for (const expectedAssetState of ["", "unknown"]) {
      const plan = createDeploymentPlan({
        cwd: root,
        env: { ...deployEnv(), OCADE_DEPLOY_EXPECT_ASSET_STATE: expectedAssetState },
        mode: "deploy",
      });
      expect(plan.ready).toBe(false);
      expect(plan.blockers.join(" ")).toMatch(/asset.*locked or open/i);
    }
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
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      command: process.execPath,
      args: [join(root, "node_modules", "wrangler", "bin", "wrangler.js"), "--version"],
    });
    expect(fetched).toBe(false);
  });

  it("reports missing Wrangler as blocked, never as simulated success", async () => {
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "check",
      runner: recordingRunner([], (_command, args) => args.includes("--version")),
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
    const observedVersionOverrides: Array<string | null> = [];
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "deploy",
      runner: recordingRunner(calls),
      fetcher: async (url: string | URL | Request, init?: RequestInit) => {
        observedSignal = init?.signal as AbortSignal;
        observedVersionOverrides.push(
          new Headers(init?.headers).get("Cloudflare-Workers-Version-Overrides"),
        );
        const pathname = new URL(url instanceof Request ? url.url : url.toString()).pathname;
        return pathname.startsWith("/assets/") ? lockedAsset() : healthy();
      },
    });
    expect(result.status).toBe("verified");
    expect(result.evidence).toMatch(/Deployment completed.*health verified/i);
    expect(calls).toHaveLength(6);
    expect(calls[3].args).toEqual([
      join(root, "node_modules", "wrangler", "bin", "wrangler.js"),
      "versions",
      "upload",
      "--strict",
      "--config",
      ".output/server/wrangler.json",
      "--message",
      "OCADE 0.1.0",
    ]);
    expect(calls.every((call) => !("shell" in call.options))).toBe(true);
    expect(observedSignal).toBeInstanceOf(AbortSignal);
    expect(observedVersionOverrides).toEqual([
      'ocade-web="new_version_1234"',
      'ocade-web="new_version_1234"',
      null,
    ]);
  });

  it("never calls Wrangler deploy after a failed build", async () => {
    const calls: RunCall[] = [];
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "deploy",
      runner: recordingRunner(calls, (_command, args) => args.includes("run")),
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/build failed/i);
    expect(calls.some((call) => call.args.includes("deploy"))).toBe(false);
  });

  it("can verify the same staged entry asset as launch-open", async () => {
    const calls: RunCall[] = [];
    const result = await runDeployment({
      cwd: root,
      env: { ...deployEnv(), OCADE_DEPLOY_EXPECT_ASSET_STATE: "open" },
      mode: "deploy",
      runner: recordingRunner(calls),
      fetcher: async (url: string | URL | Request) => {
        const pathname = new URL(url instanceof Request ? url.url : url.toString()).pathname;
        return pathname.startsWith("/assets/")
          ? new Response("export {};", {
              status: 200,
              headers: { "content-type": "text/javascript; charset=utf-8" },
            })
          : healthy();
      },
    });
    expect(result.status).toBe("verified");
    expect(calls.filter((call) => call.args.includes("deploy"))).toHaveLength(2);
  });

  it("never reports success when Wrangler fails", async () => {
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "deploy",
      runner: recordingRunner([], (_command, args) => args.includes("upload")),
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/version upload failed/);
  });

  it("keeps the incident open and names the prior version when health fails", async () => {
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "deploy",
      runner: recordingRunner([]),
      fetcher: async () => healthy("9.9.9"),
      waiter: async () => {},
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/did not verify/);
    expect(result.recovery).toContain("previous_version_1234");
  });

  it("refuses promotion when a staged application asset bypasses the edge gate", async () => {
    const calls: RunCall[] = [];
    const result = await runDeployment({
      cwd: root,
      env: deployEnv(),
      mode: "deploy",
      runner: recordingRunner(calls),
      fetcher: async (url: string | URL | Request) => {
        const pathname = new URL(url instanceof Request ? url.url : url.toString()).pathname;
        return pathname.startsWith("/assets/")
          ? new Response("public bundle", {
              status: 200,
              headers: { "content-type": "text/javascript" },
            })
          : healthy();
      },
      waiter: async () => {},
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/asset-gate.*bypassed/i);
    expect(
      calls.filter((call) => call.args.includes("versions") && call.args.includes("deploy")),
    ).toHaveLength(1);
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
    expect(calls.some((call) => call.args.includes("deploy"))).toBe(false);
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
      fetcher: async () => healthy("0.0.9", "previous_version_1234"),
    });
    expect(result.status).toBe("verified");
    expect(calls[2].args).toEqual([
      join(root, "node_modules", "wrangler", "bin", "wrangler.js"),
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
