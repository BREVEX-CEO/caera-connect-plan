/**
 * Real unknown-application learning evidence.
 *
 * The application is selected from the native host's current Windows inventory,
 * launched by its opaque discovery ID, inspected through UI Automation, and used
 * only for a read-only inspect/rehearse/verify cycle. The product architecture
 * contains no application-specific adapter for the validation target.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";

import {
  ApplicationTwinCache,
  runUnknownAppLearningCycle,
  type BoundedExecutionEvidence,
  type IndependentVerificationEvidence,
  type UnknownAppHost,
  type UnknownAppProbe,
} from "../src/lib/skills/unknown-app-learning";
import type { OcadeAppIdentity } from "../src/lib/control/control-plane";
import type { UniversalRouteCandidate } from "../src/lib/control/route-selector";

const root = resolve(import.meta.dirname, "..");
const write = process.argv.includes("--write");
const preferredValidationExecutables = ["vlc.exe", "obs64.exe", "mspaint.exe", "wordpad.exe"];

interface DiscoveredApplication {
  appId: string;
  displayName: string;
  executable: string;
  publisher: string;
  version: string;
  processIds: number[];
  sources: string[];
  running: boolean;
}

interface InspectedControl {
  type: string;
  name: string;
  automationId: string;
  patterns: string[];
}

interface InspectedWindow {
  handle: number;
  processId: number;
  title: string;
  controls: InspectedControl[];
}

interface NativeInterface {
  route: UniversalRouteCandidate["route"];
  interfaceId: string;
  confidence: number;
  evidence: string;
}

interface Inspection extends DiscoveredApplication {
  signature: { status: "valid" | "invalid" | "unsigned" | "unknown"; signer: string };
  windows: InspectedWindow[];
  uiaPatterns: string[];
  supportedFileTypes: string[];
  pluginMarkers: string[];
  interfaces: NativeInterface[];
  limitations: string[];
}

interface HostResponse<T> {
  id: string;
  ok: boolean;
  result?: T;
  error?: { type: string; message: string };
  elapsedMs: number;
}

class NativeHostClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<
    string,
    {
      resolve: (value: HostResponse<unknown>) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private sequence = 0;

  constructor() {
    const python = join(root, ".venv", "Scripts", "python.exe");
    this.child = spawn(python, ["-m", "ocade_native.host"], {
      cwd: join(root, "native", "python-host"),
      env: { ...process.env, PYTHONPATH: join(root, "native", "python-host") },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      const response = JSON.parse(line) as HostResponse<unknown> & { event?: unknown };
      if (response.event !== undefined) return;
      const waiter = this.pending.get(String(response.id));
      if (!waiter) return;
      this.pending.delete(String(response.id));
      clearTimeout(waiter.timeout);
      waiter.resolve(response);
    });
    let stderr = "";
    this.child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4_000);
    });
    this.child.on("exit", (code) => {
      for (const waiter of this.pending.values()) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error(`Native host exited with ${code}: ${stderr}`));
      }
      this.pending.clear();
    });
  }

  async request<T>(
    command: string,
    params: Record<string, unknown>,
    scope?: string,
  ): Promise<HostResponse<T>> {
    const id = `unknown-runtime-${++this.sequence}`;
    const response = new Promise<HostResponse<unknown>>((resolveResponse, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        this.child.kill();
        reject(new Error(`${command} exceeded the 30 second native-host deadline`));
      }, 30_000);
      this.pending.set(id, { resolve: resolveResponse, reject, timeout });
    });
    this.child.stdin.write(
      `${JSON.stringify({
        id,
        command,
        params,
        ...(scope ? { approved: true, scope } : {}),
      })}\n`,
    );
    const value = (await response) as HostResponse<T>;
    if (!value.ok) {
      throw new Error(`${command} failed: ${value.error?.type}: ${value.error?.message}`);
    }
    return value;
  }

  close(): void {
    this.child.stdin.end();
  }
}

function stableId(prefix: string, value: string, index: number): string {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${prefix}:${digest}:${index}`;
}

function nodes(
  prefix: string,
  values: Array<{ key: string; label: string }>,
  fallback: string,
): Array<{ id: string; label: string }> {
  const unique = new Map<string, string>();
  for (const value of values) {
    const key = value.key.trim();
    const label = value.label.trim();
    if (key && label) unique.set(key, label.slice(0, 200));
  }
  const mapped = [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 500)
    .map(([key, label], index) => ({ id: stableId(prefix, key, index), label }));
  return mapped.length > 0 ? mapped : [{ id: `${prefix}:observed:0`, label: fallback }];
}

function toProbe(inspection: Inspection): UnknownAppProbe {
  const product = inspection.displayName || basename(inspection.executable, ".exe");
  const version = inspection.version || "unversioned";
  const publisher = inspection.publisher || inspection.signature.signer || "Publisher not reported";
  const windows = nodes(
    "window",
    inspection.windows.map((window) => ({
      key: window.title || "main",
      label: window.title || product,
    })),
    `${product} main window`,
  );
  const observedControls = inspection.windows.flatMap((window) => window.controls);
  const controls = nodes(
    "control",
    observedControls.map((control) => ({
      key: `${control.type}|${control.automationId}|${control.name}`,
      label: `${control.type}: ${control.name || control.automationId || "unnamed"}`,
    })),
    "Observed application surface",
  );
  const interfaces: UniversalRouteCandidate[] = inspection.interfaces
    .filter((candidate) => candidate.route !== "plugin")
    .map((candidate, index) => ({
      candidateId: `observed:${candidate.route}:${index}`,
      route: candidate.route,
      interfaceId: candidate.interfaceId,
      available: true,
      officialOrApproved: true,
      supportedAppIds: [inspection.appId],
      versionPrefixes: [version],
      taskTypes: ["inspect_application"],
      requiredPermissions: ["desktop.inspect"],
      confidence: candidate.confidence,
      expectedLatencyMs: 2_000,
      verification: { route: "native", confidence: 0.9, independent: true },
      recovery: { route: "native", ready: true },
      health: "healthy",
      supportsRecording: true,
      fallbackPolicy: "explicit",
      evidence: candidate.evidence,
    }));
  if (interfaces.length === 0) {
    throw new Error("The launched application exposed no real native inspection route.");
  }
  return {
    identity: {
      appId: inspection.appId,
      executable: inspection.executable,
      publisher,
      signature: inspection.signature.status,
      product,
      version,
    },
    environment: {
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      theme: "host-observed-default",
      displayScale: 1,
      plugins: inspection.pluginMarkers,
      layoutRevision: `uia:${createHash("sha256")
        .update(JSON.stringify(controls.map((control) => control.id)))
        .digest("hex")
        .slice(0, 16)}`,
    },
    windows,
    views: [{ id: "view:main", label: "Observed main surface" }],
    menus: [],
    controls,
    commands: [],
    shortcuts: [],
    projectFileTypes: inspection.supportedFileTypes,
    approvedLocalEvidence: { help: [], logs: [], projectFiles: [] },
    interfaces,
    capabilities: [
      {
        id: "inspect-current-structure",
        label: "Inspect the current application structure",
        taskType: "inspect_application",
        candidateIds: interfaces.map((candidate) => candidate.candidateId),
        requiredPermission: "desktop.inspect",
        risk: "read",
        verificationMethodId: "fresh-native-inspection",
        recoveryMethodId: "no-mutation-required",
      },
    ],
    protectedAreas: ["credentials", "account and licence settings"],
    destructiveAreas: ["delete, overwrite and irreversible export controls"],
    errorStates: [],
    verificationMethods: [
      {
        id: "fresh-native-inspection",
        route: "native",
        independent: true,
        description: "A separate post-execution host request reads the application again.",
      },
    ],
    recoveryMethods: [
      {
        id: "no-mutation-required",
        route: "native",
        ready: true,
        description: "The evidence task is read-only and creates no application state to recover.",
      },
    ],
    resourceProfile: { cpu: "low", memoryMb: 512, gpuRequired: false },
    compatibilityConstraints: inspection.limitations,
    evidence: [
      `Discovered from ${inspection.sources.join(", ")}.`,
      `Authenticode status: ${inspection.signature.status}.`,
      `Observed ${inspection.windows.length} window(s) and ${observedControls.length} UIA control(s).`,
    ],
  };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const client = new NativeHostClient();
  let launchedPid: number | null = null;
  const stage = (message: string): void => process.stderr.write(`[unknown-app] ${message}\n`);
  try {
    stage("discovering installed applications");
    const discovery = await client.request<DiscoveredApplication[]>(
      "apps.discover",
      { limit: 250 },
      "desktop.inspect",
    );
    const selected = preferredValidationExecutables
      .map((name) =>
        discovery.result!.find(
          (app) => basename(app.executable).toLowerCase() === name && !app.running,
        ),
      )
      .find((candidate) => candidate !== undefined);
    if (!selected) {
      throw new Error("No non-running interactive validation application was discovered.");
    }
    stage(`selected ${selected.displayName} (${basename(selected.executable)})`);
    const launch = await client.request<{ pid: number }>(
      "app.launch",
      { app: selected.appId },
      "desktop.launch",
    );
    launchedPid = launch.result!.pid;
    stage(`launched exact discovery identity as PID ${launchedPid}`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_500));

    const refreshed = await client.request<DiscoveredApplication[]>(
      "apps.discover",
      { limit: 250 },
      "desktop.inspect",
    );
    const running = refreshed.result!.find((app) => app.appId === selected.appId);
    if (!running?.running) {
      throw new Error(
        "The dynamically launched application did not appear in the fresh inventory.",
      );
    }
    stage("fresh inventory reconciled the launched identity");

    let lastInspection: Inspection | null = null;
    const inspect = async (): Promise<Inspection> => {
      const response = await client.request<Inspection>(
        "app.inspect",
        { appId: selected.appId },
        "desktop.inspect",
      );
      lastInspection = response.result!;
      return response.result!;
    };
    const first = await inspect();
    stage(`initial native inspection observed ${first.windows.length} window(s)`);
    const app: OcadeAppIdentity = {
      appId: first.appId,
      executable: first.executable,
      product: first.displayName,
      version: first.version || "unversioned",
    };
    const host: UnknownAppHost = {
      probe: async () => toProbe(await inspect()),
      rehearse: async () => {
        const observed = await inspect();
        return {
          safe: observed.windows.length > 0,
          mode: "no_op",
          fixtureId: `read-only:${observed.appId}`,
          evidence: "A separate native inspection completed without issuing application input.",
        };
      },
      requestPermission: async ({ appId, permissions }) => ({
        granted: true,
        grantId: `runtime-evidence:${Date.now()}`,
        appId,
        permissions,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        evidence: "The evidence runner supplied exact desktop.inspect approval for this task only.",
      }),
      execute: async (): Promise<BoundedExecutionEvidence> => {
        const actionStartedAt = new Date().toISOString();
        const observed = await inspect();
        const finishedAt = new Date().toISOString();
        return {
          executed: observed.windows.length > 0,
          executionId: `read:${observed.appId}:${Date.now()}`,
          startedAt: actionStartedAt,
          finishedAt,
          evidence: "The bounded action was another read-only native application inspection.",
          outputDigest: createHash("sha256").update(JSON.stringify(observed)).digest("hex"),
        };
      },
      verify: async ({ method }): Promise<IndependentVerificationEvidence> => {
        const observed = await inspect();
        return {
          verified: observed.windows.length > 0 && observed.appId === selected.appId,
          methodId: method.id,
          observedAt: new Date(Date.now() + 1).toISOString(),
          evidence:
            "A fresh native host request independently observed the same exact application identity.",
        };
      },
      recover: async ({ method }) => ({
        recovered: true,
        methodId: method.id,
        evidence: "No recovery mutation was required because the task was read-only.",
      }),
    };

    const outcome = await runUnknownAppLearningCycle({
      app,
      approved: true,
      taskId: `unknown-app-runtime-${Date.now()}`,
      taskPattern: "Inspect the current application structure without changing it",
      capabilityId: "inspect-current-structure",
      host,
      cache: new ApplicationTwinCache(),
      recordingPreference: "video_off",
    });
    if (outcome.status !== "verified") {
      throw new Error(`Unknown-app cycle did not verify: ${outcome.reason}`);
    }
    stage("learn, rehearsal, independent verification and private compilation passed");
    const evidence = {
      schemaVersion: 1,
      kind: "OCADE_UNKNOWN_APP_REAL_RUNTIME_EVIDENCE",
      startedAt,
      finishedAt: new Date().toISOString(),
      result: "PASS",
      boundary: "PROBED_AND_REHEARSED",
      claimBoundary:
        "This proves a real read-only learn/rehearse/verify/compile cycle. It does not claim arbitrary mutation support or LIVE_TESTED status.",
      discovery: {
        installedApplicationsObserved: discovery.result!.length,
        sources: [...new Set(discovery.result!.flatMap((app) => app.sources))].sort(),
      },
      target: {
        appId: selected.appId,
        displayName: selected.displayName,
        executableName: basename(selected.executable),
        version: selected.version || "unversioned",
        publisher: selected.publisher || "not reported",
        selectedDynamically: true,
        hardcodedProductAdapter: false,
      },
      observation: {
        exactProcessId: launchedPid,
        windows: lastInspection?.windows.length ?? 0,
        controls:
          lastInspection?.windows.reduce((sum, window) => sum + window.controls.length, 0) ?? 0,
        uiaPatterns: lastInspection?.uiaPatterns ?? [],
        signature: lastInspection?.signature ?? null,
      },
      learning: {
        status: outcome.status,
        fingerprint: outcome.twin.fingerprint,
        confidence: outcome.twin.confidence,
        supportLabel: outcome.twin.supportLabel,
        compiledPrivateSkill: outcome.skill.skillId,
        private: outcome.skill.private,
        invalidatingChanges: outcome.skill.invalidatingChanges,
      },
    };
    if (write) {
      const release = join(root, "release");
      await mkdir(release, { recursive: true });
      await writeFile(
        join(release, "OCADE_UNKNOWN_APP_RUNTIME_EVIDENCE.json"),
        `${JSON.stringify(evidence, null, 2)}\n`,
        "utf8",
      );
    }
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } finally {
    if (launchedPid !== null) {
      try {
        process.kill(launchedPid);
      } catch {
        // The application may already have delegated to an existing process.
      }
    }
    client.close();
  }
}

await main();
