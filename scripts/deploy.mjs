/**
 * OCADE Cloudflare deployment and rollback controller (P27).
 *
 * This script used to report a simulated deployment as successful while the
 * Wrangler command was commented out. It now fails closed. A production
 * success exists only after Wrangler exits zero and an independent HTTPS
 * /api/health probe reports the exact package version.
 *
 * No shell is used. Secrets are presence-checked but never read into output.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEPLOY_APPROVAL = "I_APPROVE_OCADE_PRODUCTION_DEPLOY";
const ROLLBACK_APPROVAL = "I_APPROVE_OCADE_PRODUCTION_ROLLBACK";
const SAFE_VERSION_ID = /^[A-Za-z0-9_-]{8,128}$/;

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readJson(cwd, relativePath) {
  return JSON.parse(readFileSync(path.join(cwd, relativePath), "utf8"));
}

function validHealthUrl(raw) {
  if (!hasValue(raw)) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/api/health"
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function realRunner(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
    shell: false,
  });
}

export function createDeploymentPlan({
  cwd = process.cwd(),
  env = process.env,
  mode = "check",
  versionId = null,
} = {}) {
  const blockers = [];
  const sourceConfigPath = "wrangler.json";
  const generatedConfigPath = ".output/server/wrangler.json";
  const generatedEntryPath = ".output/server/index.mjs";

  if (!existsSync(path.join(cwd, sourceConfigPath))) blockers.push("wrangler.json is missing");
  if (!existsSync(path.join(cwd, "package.json"))) blockers.push("package.json is missing");

  let version = null;
  let workerName = null;
  if (blockers.length === 0) {
    try {
      const source = readJson(cwd, sourceConfigPath);
      const pkg = readJson(cwd, "package.json");
      version = pkg.version;
      workerName = source.name;
      if (!hasValue(version)) blockers.push("package version is missing");
      if (!hasValue(workerName)) blockers.push("worker name is missing");
      if (source.keep_vars !== true) {
        blockers.push("keep_vars must be true so deployment cannot erase dashboard-managed values");
      }
      if (source.observability?.enabled !== true) {
        blockers.push("Cloudflare observability must be enabled");
      }
      if (source.vars !== undefined)
        blockers.push("source config must not contain deploy-time values");
    } catch {
      blockers.push("release source configuration is unreadable");
    }
  }

  const healthUrl = validHealthUrl(env.OCADE_DEPLOY_HEALTH_URL);
  if (healthUrl === null) {
    blockers.push("OCADE_DEPLOY_HEALTH_URL must be an HTTPS /api/health URL");
  }
  if (!hasValue(env.CLOUDFLARE_API_TOKEN)) blockers.push("CLOUDFLARE_API_TOKEN is missing");
  if (!hasValue(env.CLOUDFLARE_ACCOUNT_ID)) blockers.push("CLOUDFLARE_ACCOUNT_ID is missing");

  if (mode === "deploy") {
    if (env.OCADE_DEPLOY_APPROVAL !== DEPLOY_APPROVAL) {
      blockers.push("explicit production deploy approval is missing");
    }
    if (
      !hasValue(env.OCADE_ROLLBACK_VERSION_ID) ||
      !SAFE_VERSION_ID.test(env.OCADE_ROLLBACK_VERSION_ID)
    ) {
      blockers.push("OCADE_ROLLBACK_VERSION_ID must name the previously verified deployment");
    }
  } else if (mode === "rollback") {
    if (env.OCADE_ROLLBACK_APPROVAL !== ROLLBACK_APPROVAL) {
      blockers.push("explicit production rollback approval is missing");
    }
    if (!hasValue(versionId) || !SAFE_VERSION_ID.test(versionId)) {
      blockers.push("rollback requires a safe, explicit Cloudflare version id");
    }
    if (!hasValue(env.OCADE_ROLLBACK_EXPECTED_VERSION)) {
      blockers.push("OCADE_ROLLBACK_EXPECTED_VERSION is missing");
    }
  } else if (mode !== "check") {
    blockers.push(`unsupported deployment mode "${mode}"`);
  }

  return {
    mode,
    ready: blockers.length === 0,
    blockers,
    version,
    workerName,
    healthUrl,
    sourceConfigPath,
    generatedConfigPath,
    generatedEntryPath,
    rollbackVersionId:
      mode === "deploy" ? (env.OCADE_ROLLBACK_VERSION_ID ?? null) : (versionId ?? null),
    expectedHealthVersion:
      mode === "rollback" ? (env.OCADE_ROLLBACK_EXPECTED_VERSION ?? null) : version,
  };
}

function validateBuiltOutput(plan, cwd) {
  const failures = [];
  for (const relativePath of [plan.generatedConfigPath, plan.generatedEntryPath]) {
    if (!existsSync(path.join(cwd, relativePath)))
      failures.push(`build output missing: ${relativePath}`);
  }
  if (failures.length > 0) return failures;
  try {
    const generated = readJson(cwd, plan.generatedConfigPath);
    if (generated.name !== plan.workerName)
      failures.push("generated worker name differs from source");
    if (generated.main !== "index.mjs") failures.push("generated worker entry is unexpected");
    if (generated.assets?.binding !== "ASSETS") failures.push("generated asset binding is missing");
  } catch {
    failures.push("generated Wrangler configuration is unreadable");
  }
  return failures;
}

async function probeHealth(plan, fetcher) {
  try {
    const response = await fetcher(plan.healthUrl, {
      headers: { accept: "application/json", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { ok: false, reason: `health probe returned HTTP ${response.status}` };
    const body = await response.json();
    if (
      body?.status !== "ok" ||
      body?.service !== "ocade-web" ||
      body?.version !== plan.expectedHealthVersion
    ) {
      return {
        ok: false,
        reason: `health payload did not verify service/version ${plan.expectedHealthVersion}`,
      };
    }
    return { ok: true, evidence: `HTTPS health verified ocade-web ${body.version}` };
  } catch (error) {
    return {
      ok: false,
      reason: `health probe failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

function commandFailed(result) {
  return result?.error || result?.status !== 0;
}

export async function runDeployment({
  cwd = process.cwd(),
  env = process.env,
  mode = "check",
  versionId = null,
  runner = realRunner,
  fetcher = fetch,
} = {}) {
  const plan = createDeploymentPlan({ cwd, env, mode, versionId });
  if (!plan.ready) return { status: "blocked", plan, reason: plan.blockers.join("; ") };

  const wranglerVersion = runner("wrangler", ["--version"], { cwd, env });
  if (commandFailed(wranglerVersion)) {
    return {
      status: "blocked",
      plan,
      reason: "Wrangler is unavailable in this release environment.",
    };
  }
  if (mode === "check") {
    return {
      status: "ready",
      plan,
      evidence: "Source, credentials, approval-independent configuration and Wrangler are present.",
    };
  }

  if (mode === "deploy") {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const built = runner(npmCommand, ["run", "build"], { cwd, env, inherit: true });
    if (commandFailed(built)) {
      return {
        status: "failed",
        plan,
        reason: "Production build failed; Wrangler was not called.",
      };
    }
    const outputFailures = validateBuiltOutput(plan, cwd);
    if (outputFailures.length > 0) {
      return { status: "failed", plan, reason: outputFailures.join("; ") };
    }

    const deployed = runner(
      "wrangler",
      ["deploy", "--config", plan.generatedConfigPath, "--message", `OCADE ${plan.version}`],
      { cwd, env, inherit: true },
    );
    if (commandFailed(deployed)) {
      return { status: "failed", plan, reason: "Wrangler deploy failed; no success is recorded." };
    }
  } else {
    const rolledBack = runner(
      "wrangler",
      [
        "rollback",
        plan.rollbackVersionId,
        "--config",
        plan.sourceConfigPath,
        "--message",
        `OCADE rollback to ${plan.expectedHealthVersion}`,
      ],
      { cwd, env, inherit: true },
    );
    if (commandFailed(rolledBack)) {
      return {
        status: "failed",
        plan,
        reason: "Wrangler rollback failed; recovery is unverified.",
      };
    }
  }

  const health = await probeHealth(plan, fetcher);
  if (!health.ok) {
    return {
      status: "failed",
      plan,
      reason: health.reason,
      recovery:
        mode === "deploy"
          ? `Run the separately approved rollback command for version ${plan.rollbackVersionId}.`
          : "Keep the incident open and restore through the Cloudflare deployment history.",
    };
  }
  return {
    status: "verified",
    plan,
    evidence: `${mode === "deploy" ? "Deployment" : "Rollback"} completed; ${health.evidence}.`,
  };
}

function parseArgs(args) {
  if (args.includes("--execute")) return { mode: "deploy", versionId: null };
  const rollbackIndex = args.indexOf("--rollback");
  if (rollbackIndex >= 0) return { mode: "rollback", versionId: args[rollbackIndex + 1] ?? null };
  return { mode: "check", versionId: null };
}

async function cli() {
  const { mode, versionId } = parseArgs(process.argv.slice(2));
  const result = await runDeployment({ mode, versionId });
  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`OCADE deployment controller: ${result.status.toUpperCase()}`);
    console.log(result.evidence ?? result.reason);
    if (result.recovery) console.error(`RECOVERY REQUIRED: ${result.recovery}`);
  }
  process.exitCode = result.status === "verified" || result.status === "ready" ? 0 : 2;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  void cli();
}
