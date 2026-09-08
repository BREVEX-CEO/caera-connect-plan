/**
 * B1 cold-start evidence: prove OCADE starts and stops the local engine itself.
 *
 * The claim under test is narrow and falsifiable: with the runtime fully
 * stopped and port 11434 closed, invoking OCADE's supervisor opens the port with
 * NO manual step, and the listener is bound to loopback only.
 *
 * Every step below records what it observed, not what it expected. The listener
 * binding is read from the operating system's own socket table rather than
 * inferred from the environment variable we passed — passing OLLAMA_HOST proves
 * intent, and `netstat` proves result.
 *
 * This script STOPS the local engine as its first act. That is the point of a
 * cold-start test, and the engine is restarted before it exits.
 *
 * Usage: node --experimental-strip-types scripts/local-runtime-evidence.mts [--write]
 */
import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { promisify } from "node:util";
import {
  startRuntime,
  stopRuntime,
  DEFAULT_RUNTIME_PORT,
} from "../src/lib/local/runtime-supervisor.ts";
import {
  nodeSupervisorDeps,
  findEngineBinary,
  probeRuntime,
} from "../src/lib/local/runtime-supervisor.node.ts";

const run = promisify(execFile);
const write = process.argv.includes("--write");
const OUT = "release/OCADE_B1_LOCAL_RUNTIME_EVIDENCE.json";
const steps: unknown[] = [];

/**
 * Redact machine-specific absolute paths before anything is retained.
 *
 * Retained evidence is committed, and a home directory is both personal data
 * and the exact defect that made the Stage 2 baseline gate unrunnable anywhere
 * but one laptop. What matters for this proof is that the binary resolved from
 * the ALLOWLIST — the environment-variable form shows that; the expanded path
 * only shows whose computer it was.
 */
function redactPath(value: string): string {
  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const localAppData = process.env.LOCALAPPDATA ?? "";
  let out = value;
  if (localAppData) out = out.split(localAppData).join("%LOCALAPPDATA%");
  if (home) out = out.split(home).join("~");
  return out;
}

function record(step: string, detail: Record<string, unknown>) {
  const entry = { step, at: new Date().toISOString(), ...detail };
  steps.push(entry);
  const summary = Object.entries(detail)
    .filter(([k]) => k !== "raw")
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join("  ");
  console.log(`[${step}] ${summary}`);
  return entry;
}

/**
 * Read the OS socket table for the port. This is the check that the engine is
 * not published: an entry on 0.0.0.0 would mean every interface, regardless of
 * what we asked for.
 */
async function listenersOn(port: number): Promise<{ raw: string; addresses: string[] }> {
  try {
    const { stdout } =
      process.platform === "win32"
        ? await run("netstat", ["-ano", "-p", "TCP"])
        : await run("sh", ["-c", `netstat -an | grep LISTEN || true`]);
    const lines = stdout
      .split("\n")
      .filter((l) => l.includes(`:${port}`) && /LISTEN/i.test(l))
      .map((l) => l.trim());
    const addresses = lines
      .map((l) => {
        const m = /(\[?[0-9a-fA-F.:]+\]?):(\d+)/.exec(l);
        return m && m[2] === String(port) ? m[1] : null;
      })
      .filter((a): a is string => a !== null);
    return { raw: lines.join("\n"), addresses: [...new Set(addresses)] };
  } catch (error) {
    return { raw: `netstat failed: ${String(error)}`, addresses: [] };
  }
}

const LOOPBACK = /^(\[?::1\]?|127\.\d+\.\d+\.\d+)$/;

const deps = nodeSupervisorDeps();
const baseUrl = `http://127.0.0.1:${DEFAULT_RUNTIME_PORT}`;
let failed = false;

// ---------------------------------------------------------------- preconditions
const binary = await findEngineBinary();
record("resolve-binary", {
  found: binary !== null,
  path: binary ? redactPath(binary) : "(none)",
  note: "Resolved from the allowlist only; PATH is never consulted. The path is redacted to its environment-variable form — what this step proves is allowlist resolution, not whose machine it ran on.",
});
if (!binary) {
  console.error("FATAL: engine binary not installed in any allowlisted location.");
  process.exit(1);
}

// ------------------------------------------------------------------ go cold
const stopResult = await stopRuntime(deps, { timeoutMs: 20_000, pollMs: 400 });
record("stop-to-go-cold", {
  ok: stopResult.ok,
  detail: stopResult.ok
    ? `alreadyStopped=${stopResult.alreadyStopped} waitedMs=${stopResult.waitedMs}`
    : `${stopResult.failure}: ${stopResult.reason}`,
});
if (!stopResult.ok) failed = true;

const coldProbe = await probeRuntime(baseUrl);
const coldSockets = await listenersOn(DEFAULT_RUNTIME_PORT);
record("verify-cold", {
  portAnswers: coldProbe,
  listeners: coldSockets.addresses,
  raw: coldSockets.raw,
  verdict: !coldProbe && coldSockets.addresses.length === 0 ? "COLD - port closed" : "NOT COLD",
});
if (coldProbe || coldSockets.addresses.length > 0) {
  record("abort", { why: "The port did not close, so a cold start cannot be demonstrated." });
  failed = true;
}

// ------------------------------------------------------- start, with no manual step
const startedAt = Date.now();
const startResult = await startRuntime(deps, { timeoutMs: 60_000, pollMs: 500 });
record("start-via-ocade", {
  ok: startResult.ok,
  detail: startResult.ok
    ? `alreadyRunning=${startResult.alreadyRunning} waitedMs=${startResult.waitedMs} probes=${startResult.probes}`
    : `${startResult.failure}: ${startResult.reason}`,
  manualSteps: 0,
  elapsedMs: Date.now() - startedAt,
});
if (!startResult.ok) failed = true;

const warmProbe = await probeRuntime(baseUrl);
const warmSockets = await listenersOn(DEFAULT_RUNTIME_PORT);
const published = warmSockets.addresses.filter((a) => !LOOPBACK.test(a));
record("verify-open-and-loopback-only", {
  portAnswers: warmProbe,
  listeners: warmSockets.addresses,
  raw: warmSockets.raw,
  publishedAddresses: published,
  verdict:
    warmProbe && published.length === 0
      ? "OPEN and LOOPBACK-ONLY"
      : warmProbe
        ? "OPEN but PUBLISHED - security failure"
        : "NOT OPEN",
});
if (!warmProbe || published.length > 0) failed = true;

// ------------------------------------------------------------- idempotent restart
const secondStart = await startRuntime(deps, { timeoutMs: 10_000, pollMs: 400 });
record("start-again-is-idempotent", {
  ok: secondStart.ok,
  alreadyRunning: secondStart.ok ? secondStart.alreadyRunning : null,
  expectation: "already running, nothing spawned",
});
if (!secondStart.ok || !secondStart.alreadyRunning) failed = true;

// ------------------------------------------------------------------- refusal
const refused = await startRuntime(deps, { bind: "0.0.0.0" });
record("refuse-public-bind", {
  refused: !refused.ok,
  failure: refused.ok ? "(not refused)" : refused.failure,
  reason: refused.ok ? "" : refused.reason,
});
if (refused.ok) failed = true;

// --------------------------------------------------------- leave the machine warm
const finalProbe = await probeRuntime(baseUrl);
record("final-state", {
  engineRunning: finalProbe,
  note: "The engine is left running, as it was found, so this test does not change the machine's state.",
});

const document = {
  schemaVersion: 1,
  item: "B1 - start/stop the local runtime from OCADE, bound to loopback",
  generatedAt: new Date().toISOString(),
  host: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
  },
  claim:
    "With the runtime fully stopped and port 11434 closed, OCADE's supervisor opens the port with no manual step, and the listener is bound to loopback only.",
  verdict: failed ? "FAILED" : "PROVEN",
  method:
    "The listener binding is read from the OS socket table (netstat), not inferred from the OLLAMA_HOST value passed to the process. Passing the variable proves intent; netstat proves result.",
  steps,
};

console.log(`\nB1 cold-start evidence: ${document.verdict}`);
if (write) {
  writeFileSync(OUT, JSON.stringify(document, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}

/*
 * Set exitCode rather than calling process.exit().
 *
 * process.exit() tore the loop down while the child-process handles from the
 * stop step were still closing, and libuv aborted with
 * "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" — a 0xC0000409
 * crash AFTER the evidence had already printed PROVEN. A script that reports
 * success and then dies with a native assertion is a red CI job, and worse, an
 * ambiguous one: the reader cannot tell whether the test or the teardown failed.
 */
process.exitCode = failed ? 1 : 0;
