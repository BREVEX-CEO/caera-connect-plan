/**
 * OCADE Cloudflare deployment and rollback controller (P27).
 *
 * This script used to report a simulated deployment as successful while the
 * Wrangler command was commented out. It now fails closed. A production
 * success exists only after the locked Wrangler uploads an immutable version,
 * stages it at zero traffic, an override request verifies that exact version,
 * the version is promoted, and an independent HTTPS /api/health probe reports
 * the same package and Cloudflare version IDs.
 *
 * No shell is used. Secrets are presence-checked but never read into output.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

function validSupabaseBuildUrl(raw, projectRef) {
  if (!hasValue(raw) || !hasValue(projectRef)) return false;
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      url.hostname === `${projectRef}.supabase.co`
    );
  } catch {
    return false;
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
      if (source.assets?.run_worker_first !== true) {
        blockers.push(
          "Cloudflare assets must run the Worker first so the launch gate cannot be bypassed",
        );
      }
      if (source.workers_dev !== false) {
        blockers.push("workers_dev must be false so production cannot bypass the custom domain");
      }
      if (source.preview_urls !== false) {
        blockers.push(
          "preview_urls must be false unless a protected preview is explicitly approved",
        );
      }
      if (source.version_metadata?.binding !== "CF_VERSION_METADATA") {
        blockers.push("Cloudflare version metadata binding is missing");
      }
      if (source.vars !== undefined)
        blockers.push("source config must not contain deploy-time values");
      /*
       * THE ONE CONFIG HAS TO BE DEPLOYABLE ON ITS OWN.
       *
       * It was not, and that is what broke production. `main`, the asset
       * binding and the asset directory lived only in a copy generated into
       * `.output/server/`, so `wrangler deploy` found this file, saw an
       * `assets` block with no `directory`, and refused. Anything that did not
       * pass `--config` at the generated copy failed — including Cloudflare's
       * own build. Nothing here needs the build to be known: every value is a
       * fixed relative path, so they live here and the copy is gone.
       */
      if (!hasValue(source.main)) blockers.push("wrangler.json must name the Worker entry");
      if (source.assets?.binding !== "ASSETS") blockers.push("the ASSETS binding is missing");
      if (!hasValue(source.assets?.directory))
        blockers.push("wrangler.json must name the assets directory");
    } catch {
      blockers.push("release source configuration is unreadable");
    }
  }

  const healthUrl = validHealthUrl(env.OCADE_DEPLOY_HEALTH_URL);
  if (healthUrl === null) {
    blockers.push("OCADE_DEPLOY_HEALTH_URL must be an HTTPS /api/health URL");
  }
  const useWranglerOAuth = env.OCADE_DEPLOY_USE_WRANGLER_OAUTH === "true";
  if (!hasValue(env.CLOUDFLARE_API_TOKEN) && !useWranglerOAuth) {
    blockers.push(
      "CLOUDFLARE_API_TOKEN is missing and persisted Wrangler OAuth was not explicitly selected",
    );
  }
  if (!hasValue(env.CLOUDFLARE_ACCOUNT_ID) && !useWranglerOAuth) {
    blockers.push("CLOUDFLARE_ACCOUNT_ID is missing");
  }
  if (mode !== "rollback") {
    if (!validSupabaseBuildUrl(env.VITE_SUPABASE_URL, env.OCADE_SUPABASE_PROJECT_REF)) {
      blockers.push(
        "VITE_SUPABASE_URL must identify the explicitly selected HTTPS Supabase project",
      );
    }
    if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "")) {
      blockers.push("VITE_SUPABASE_PUBLISHABLE_KEY must be an active modern publishable key");
    }
  }

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
    generatedEntryPath,
    rollbackVersionId:
      mode === "deploy" ? (env.OCADE_ROLLBACK_VERSION_ID ?? null) : (versionId ?? null),
    expectedHealthVersion:
      mode === "rollback" ? (env.OCADE_ROLLBACK_EXPECTED_VERSION ?? null) : version,
    assetProbePath: null,
  };
}

/**
 * WHAT THE BUILD PRODUCED, NOT WHAT THE CONFIG CLAIMS.
 *
 * The config is already checked in `createDeploymentPlan`, and there is only
 * one of it now, so re-reading it here proved the same file twice. What is left
 * is the half a config cannot answer: did the build actually emit the entry the
 * config points at, exactly one client entry asset, and a client carrying the
 * approved Supabase public values.
 */
function validateBuiltOutput(plan, cwd, env) {
  const failures = [];
  if (!existsSync(path.join(cwd, plan.generatedEntryPath))) {
    return [`build output missing: ${plan.generatedEntryPath}`];
  }
  try {
    const assetsDirectory = path.join(cwd, ".output", "public", "assets");
    const assetNames = existsSync(assetsDirectory) ? readdirSync(assetsDirectory) : [];
    const entryAssets = assetNames.filter((name) => /^index-[A-Za-z0-9_-]+\.js$/.test(name));
    if (entryAssets.length !== 1) {
      failures.push("generated client entry asset is missing or ambiguous");
    } else {
      plan.assetProbePath = `/assets/${entryAssets[0]}`;
    }
    const clientJavaScript = assetNames.filter((name) => name.endsWith(".js"));
    const hasSupabaseUrl = clientJavaScript.some((name) =>
      readFileSync(path.join(assetsDirectory, name), "utf8").includes(env.VITE_SUPABASE_URL),
    );
    const hasSupabasePublishableKey = clientJavaScript.some((name) =>
      readFileSync(path.join(assetsDirectory, name), "utf8").includes(
        env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ),
    );
    if (!hasSupabaseUrl || !hasSupabasePublishableKey) {
      failures.push("generated client is missing the approved Supabase public configuration");
    }
  } catch {
    failures.push("the build output could not be read");
  }
  return failures;
}

/**
 * THE STAGED VERSION MUST ACTUALLY SERVE ITS OWN CLIENT.
 *
 * A health probe proves the Worker answers; this proves the build it was
 * uploaded with is reachable, because a version whose entry asset 404s renders
 * a blank page while /api/health stays green.
 */
async function probeAssetGateOnce(plan, fetcher, expectedDeploymentId) {
  try {
    const assetUrl = new URL(plan.assetProbePath, plan.healthUrl);
    assetUrl.searchParams.set("ocade-version-probe", expectedDeploymentId);
    const response = await fetcher(assetUrl, {
      headers: {
        accept: "text/javascript,*/*;q=0.1",
        "cache-control": "no-cache",
        "Cloudflare-Workers-Version-Overrides": `${plan.workerName}="${expectedDeploymentId}"`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    return response.ok && contentType.includes("javascript")
      ? { ok: true, evidence: `staged asset ${plan.assetProbePath} is served` }
      : {
          ok: false,
          reason:
            `staged asset ${plan.assetProbePath} was not served ` +
            `(HTTP ${response.status}, ${contentType || "no content type"})`,
        };
  } catch (error) {
    return {
      ok: false,
      reason: `asset gate probe failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

async function probeAssetGate(
  plan,
  fetcher,
  expectedDeploymentId,
  waiter = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  let lastResult;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    lastResult = await probeAssetGateOnce(plan, fetcher, expectedDeploymentId);
    if (lastResult.ok) return lastResult;
    if (attempt < 5) await waiter(Math.min(2_000 * 2 ** attempt, 5_000));
  }
  return lastResult;
}

function readWranglerVersionId(outputPath, recordType) {
  if (!existsSync(outputPath)) return null;
  const records = readFileSync(outputPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const deployed = records.findLast(
    (record) => record?.type === recordType && typeof record?.version_id === "string",
  );
  return deployed?.version_id ?? null;
}

/**
 * EVERY BINDING A RELEASE NEEDS, NAMED WHEN ONE IS ABSENT.
 *
 * The gate used to ask only about the two public Supabase values the browser
 * also holds, so a deployment with no service-role secret went green and then
 * refused every authenticated request. Each entry here is something whose
 * absence a customer meets as a broken feature rather than as an error:
 *
 *   supabasePublic  no sign-in at all
 *   supabaseServer  every authenticated server function throws
 *   modelDelivery   the only door to the artifact answers 503; Offline never
 *                   finishes installing
 *   offlineLeases   no offline capacity can be signed, so Offline cannot run
 *                   even once it is installed
 *
 * Presence, not correctness: a wrong value still fails at the point of use. The
 * question this answers is the one a release gate can ask from outside.
 */
const REQUIRED_CONFIGURATION = [
  "supabasePublic",
  "supabaseServer",
  "modelDelivery",
  "offlineLeases",
];

function missingConfiguration(configuration) {
  return REQUIRED_CONFIGURATION.filter((name) => configuration?.[name] !== true);
}

async function probeHealthOnce(plan, fetcher, expectedDeploymentId, useVersionOverride) {
  try {
    const headers = { accept: "application/json", "cache-control": "no-cache" };
    if (useVersionOverride) {
      headers["Cloudflare-Workers-Version-Overrides"] =
        `${plan.workerName}="${expectedDeploymentId}"`;
    }
    const response = await fetcher(plan.healthUrl, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { ok: false, reason: `health probe returned HTTP ${response.status}` };
    const body = await response.json();
    if (
      body?.status !== "ok" ||
      body?.service !== "ocade-web" ||
      body?.version !== plan.expectedHealthVersion ||
      body?.deploymentId !== expectedDeploymentId ||
      (plan.mode === "deploy" && missingConfiguration(body?.configuration).length > 0)
    ) {
      const missing = missingConfiguration(body?.configuration);
      return {
        ok: false,
        reason:
          `health payload did not verify service/version ${plan.expectedHealthVersion} ` +
          `at Cloudflare version ${expectedDeploymentId}` +
          (missing.length > 0 ? `; runtime configuration missing: ${missing.join(", ")}` : ""),
      };
    }
    return {
      ok: true,
      evidence:
        `HTTPS health verified ocade-web ${body.version} ` +
        `at Cloudflare version ${body.deploymentId}`,
    };
  } catch (error) {
    return {
      ok: false,
      reason: `health probe failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

async function probeHealth(
  plan,
  fetcher,
  expectedDeploymentId,
  useVersionOverride = false,
  waiter = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  // Both the version override and the promoted production route can take a
  // short time to converge at Cloudflare's edge. Keep the probe fail-closed,
  // but do not declare a recovery incident from a single stale edge read.
  const attempts = 6;
  let lastResult;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastResult = await probeHealthOnce(plan, fetcher, expectedDeploymentId, useVersionOverride);
    if (lastResult.ok) return lastResult;
    if (attempt + 1 < attempts) {
      await waiter(Math.min(2_000 * 2 ** attempt, 5_000));
    }
  }
  return lastResult;
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
  waiter,
} = {}) {
  const plan = createDeploymentPlan({ cwd, env, mode, versionId });
  if (!plan.ready) return { status: "blocked", plan, reason: plan.blockers.join("; ") };

  const nodeCommand = process.execPath;
  const wranglerCli = path.join(cwd, "node_modules", "wrangler", "bin", "wrangler.js");
  if (!existsSync(wranglerCli)) {
    return {
      status: "blocked",
      plan,
      reason: "The lockfile-installed Wrangler entrypoint is missing; run npm ci first.",
    };
  }
  const wranglerVersion = runner(nodeCommand, [wranglerCli, "--version"], {
    cwd,
    env,
  });
  if (commandFailed(wranglerVersion)) {
    return {
      status: "blocked",
      plan,
      reason: "Wrangler is unavailable in this release environment.",
    };
  }
  const wranglerIdentity = runner(nodeCommand, [wranglerCli, "whoami"], {
    cwd,
    env,
  });
  if (commandFailed(wranglerIdentity)) {
    return {
      status: "blocked",
      plan,
      reason: "Wrangler is not authenticated to a Cloudflare account.",
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
    const npmCli = env.npm_execpath ?? process.env.npm_execpath;
    if (!hasValue(npmCli) || !existsSync(npmCli)) {
      return {
        status: "blocked",
        plan,
        reason:
          "The npm CLI entrypoint is unavailable; invoke deployment through npm run deploy:web.",
      };
    }
    const built = runner(nodeCommand, [npmCli, "run", "build"], {
      cwd,
      env,
      inherit: true,
    });
    if (commandFailed(built)) {
      return {
        status: "failed",
        plan,
        reason: "Production build failed; Wrangler was not called.",
      };
    }
    const outputFailures = validateBuiltOutput(plan, cwd, env);
    if (outputFailures.length > 0) {
      return { status: "failed", plan, reason: outputFailures.join("; ") };
    }

    const outputDirectory = mkdtempSync(path.join(tmpdir(), "ocade-wrangler-"));
    const outputPath = path.join(outputDirectory, "upload.ndjson");
    let uploaded;
    let uploadedVersionId;
    try {
      uploaded = runner(
        nodeCommand,
        [
          wranglerCli,
          "versions",
          "upload",
          "--strict",
          "--config",
          plan.sourceConfigPath,
          "--message",
          `OCADE ${plan.version}`,
        ],
        {
          cwd,
          env: { ...env, WRANGLER_OUTPUT_FILE_PATH: outputPath },
          inherit: true,
        },
      );
      uploadedVersionId = readWranglerVersionId(outputPath, "version-upload");
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
    if (commandFailed(uploaded)) {
      return {
        status: "failed",
        plan,
        reason: "Wrangler version upload failed; production traffic was not changed.",
      };
    }
    if (!uploadedVersionId) {
      return {
        status: "failed",
        plan,
        reason: "Wrangler did not emit the immutable uploaded version id; traffic was not changed.",
      };
    }
    plan.expectedDeploymentId = uploadedVersionId;

    const staged = runner(
      nodeCommand,
      [
        wranglerCli,
        "versions",
        "deploy",
        `${plan.rollbackVersionId}@100%`,
        `${uploadedVersionId}@0%`,
        "--name",
        plan.workerName,
        "--message",
        `OCADE ${plan.version} staged at zero traffic`,
        "--yes",
      ],
      { cwd, env, inherit: true },
    );
    if (commandFailed(staged)) {
      return {
        status: "failed",
        plan,
        reason: "Wrangler could not stage the uploaded version at zero traffic.",
      };
    }

    const stagedHealth = await probeHealth(plan, fetcher, uploadedVersionId, true, waiter);
    if (!stagedHealth.ok) {
      return {
        status: "failed",
        plan,
        reason: `Zero-traffic staged version failed smoke verification: ${stagedHealth.reason}`,
        recovery:
          `Production remains on Cloudflare version ${plan.rollbackVersionId} at 100 percent. ` +
          "Remove the zero-percent staged version after investigating.",
      };
    }

    const stagedAsset = await probeAssetGate(plan, fetcher, uploadedVersionId, waiter);
    if (!stagedAsset.ok) {
      return {
        status: "failed",
        plan,
        reason: `Zero-traffic staged version failed asset-gate verification: ${stagedAsset.reason}`,
        recovery:
          `Production remains on Cloudflare version ${plan.rollbackVersionId} at 100 percent. ` +
          "Remove the zero-percent staged version after investigating.",
      };
    }

    const promoted = runner(
      nodeCommand,
      [
        wranglerCli,
        "versions",
        "deploy",
        `${uploadedVersionId}@100%`,
        "--name",
        plan.workerName,
        "--message",
        `OCADE ${plan.version} verified promotion`,
        "--yes",
      ],
      { cwd, env, inherit: true },
    );
    if (commandFailed(promoted)) {
      return {
        status: "failed",
        plan,
        reason: "Wrangler promotion failed; the previous version remains the traffic target.",
      };
    }
  } else {
    const rolledBack = runner(
      nodeCommand,
      [
        wranglerCli,
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
    plan.expectedDeploymentId = plan.rollbackVersionId;
  }

  const health = await probeHealth(plan, fetcher, plan.expectedDeploymentId, false, waiter);
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
