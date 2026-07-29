import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fingerprintApp,
  learnAppFromProbe,
  listAppMaps,
  type AppProbeHost,
} from "../skills/app-map";
import { initialHealth, recordOutcome, type AdapterHealth } from "../skills/adapter-health";
import { ExecutorRegistry } from "../skills/executor-registry";
import { runGovernedTask, type GovernedRunInput } from "../skills/governed-run";
import type { RecoveryOption } from "../skills/recovery-graph";
import type { AppIdentity, ControlMethod, SkillCapability, SkillPack } from "../skills/skill-pack";
import { createTaskScope } from "../skills/task-scope";
import { planStep } from "../skills/work-session";

const NOW = new Date("2026-07-25T02:30:00.000Z");

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
    clear: () => storage.clear(),
  });
});

function readCapability(methods: ControlMethod[]): SkillCapability {
  return {
    id: "read",
    label: "Read representative state",
    methods,
    mutating: false,
    verifyBy: "api",
    tested: true,
  };
}

function packFor(app: AppIdentity, capability: SkillCapability): SkillPack {
  return {
    appId: app.appId,
    displayName: app.displayName,
    category: "os_utilities",
    testedVersions: ["1."],
    capabilities: [capability],
    requiresLicensedInstall: false,
  };
}

function scopeFor(kind: "clipboard.read" | "clipboard.write") {
  return createTaskScope({
    id: `scope-${kind}`,
    summary: "Representative universal-control proof",
    capabilities: [kind],
    now: NOW,
  });
}

describe("representative universal-control routes", () => {
  it.each([
    ["official API", "official_api"],
    ["CLI", "cli"],
    ["file", "file"],
    ["DOM", "dom"],
    ["accessibility", "accessibility"],
    ["native adapter", "adapter"],
    ["vision", "vision_input"],
  ] satisfies [string, ControlMethod][])(
    "executes and independently verifies the %s route",
    async (_label, method) => {
      const app: AppIdentity = {
        appId: `representative.${method}`,
        displayName: `Representative ${method}`,
        version: "1.0",
      };
      const capability = readCapability([method]);
      const registry = new ExecutorRegistry();
      registry.register(
        app.appId,
        capability.id,
        async (plan) => ({
          ok: true,
          evidence: `executed through ${plan.method}`,
          data: plan.method,
        }),
        (plan, execution) => ({
          verified: execution.data === plan.method,
          evidence: `independently observed ${plan.method}`,
        }),
      );

      const result = await runGovernedTask({
        taskId: `route-${method}`,
        intent: `Prove ${method}`,
        initialState: "Representative app ready",
        finalState: "Representative state read and verified",
        steps: [
          {
            action: { kind: "clipboard.read" },
            capability,
            app,
            risk: "read",
            recovery: [],
            canReobserve: false,
          },
        ],
        packs: [packFor(app, capability)],
        scope: scopeFor("clipboard.read"),
        health: new Map(),
        availableMethods: [method],
        recording: "video_off",
        registry,
        now: NOW,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.haltedAt).toBe(-1);
      expect(result.data.ledger.outcome).toBe("succeeded");
      expect(result.data.ledger.steps[0].receipt).toMatchObject({
        method,
        verified: true,
      });
    },
  );

  it("re-scores a failed API fallback as vision and blocks an unapproved mutation", async () => {
    const app: AppIdentity = {
      appId: "representative.fallback",
      displayName: "Representative Fallback",
      version: "1.0",
    };
    const capability: SkillCapability = {
      id: "write",
      label: "Write representative state",
      methods: ["official_api", "vision_input"],
      mutating: true,
      verifyBy: "ui",
      tested: true,
    };
    const failingApi = recordOutcome(recordOutcome(initialHealth("official_api"), { ok: false }), {
      ok: false,
    });
    const execute = vi.fn(async () => ({ ok: true, evidence: "vision mutation executed" }));
    const registry = new ExecutorRegistry();
    registry.register(app.appId, capability.id, execute, () => ({
      verified: true,
      evidence: "UI matched",
    }));
    const cancel: RecoveryOption = {
      kind: "cancel",
      plan: "Cancel before commit",
      ready: true,
    };
    const input: GovernedRunInput = {
      taskId: "route-fallback",
      intent: "Prove route failure and guarded fallback",
      initialState: "API route failing",
      finalState: "Mutation verified",
      steps: [
        {
          action: { kind: "clipboard.write", text: "approved non-sensitive sample" },
          capability,
          app,
          risk: "low",
          recovery: [cancel],
          canReobserve: false,
        },
      ],
      packs: [packFor(app, capability)],
      scope: scopeFor("clipboard.write"),
      health: new Map<ControlMethod, AdapterHealth>([["official_api", failingApi]]),
      availableMethods: ["official_api", "vision_input"],
      recording: "video_off",
      registry,
      now: NOW,
    };

    const result = await runGovernedTask(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.haltedAt).toBe(0);
    expect(result.data.haltReason).toMatch(/approval|confidence/i);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("Unknown-App Learning", () => {
  const app: AppIdentity = {
    appId: "unknown.editor",
    displayName: "Unknown Editor",
    version: "4.2",
  };
  const probe: AppProbeHost = {
    inspect: vi.fn(async () => ({
      appId: app.appId,
      version: app.version ?? null,
      windowTitle: "Unknown Editor - Untitled",
      locale: "en",
      controls: [
        {
          id: "document.read",
          label: "Document",
          method: "accessibility" as const,
          anchor: "role=document[name=Editor]",
        },
      ],
      evidence: "Observed version and accessibility tree.",
    })),
  };

  it("learns an approved structural map and makes the exact unknown app usable as probed", async () => {
    const learned = await learnAppFromProbe({ app, approved: true, probe, now: NOW });
    expect(learned.status).toBe("learned");
    if (learned.status !== "learned") return;

    const capability = {
      ...readCapability(["accessibility"]),
      id: "document.read",
    };
    const planned = planStep({
      action: { kind: "clipboard.read" },
      capability,
      app,
      packs: [],
      scope: scopeFor("clipboard.read"),
      health: new Map(),
      availableMethods: ["accessibility"],
      recording: "video_off",
      fingerprintInput: {
        version: app.version,
        windowTitle: "Unknown Editor - Untitled",
        locale: "en",
        controlCount: 1,
      },
      now: NOW,
    });

    expect(planned.status).toBe("ready");
    if (planned.status !== "ready") return;
    expect(planned.plan.method).toBe("accessibility");
    expect(planned.plan.confidence).toBe(0.7);
  });

  it("requires approval before probing and does not create a map on refusal", async () => {
    const inspect = vi.fn(probe.inspect);
    const result = await learnAppFromProbe({
      app,
      approved: false,
      probe: { inspect },
      now: NOW,
    });

    expect(result.status).toBe("refused");
    expect(inspect).not.toHaveBeenCalled();
    expect(listAppMaps()).toEqual([]);
  });

  it("reports learning as failed when the structural map cannot be persisted", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => undefined,
      clear: () => undefined,
    });
    const result = await learnAppFromProbe({ app, approved: true, probe, now: NOW });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("unreachable");
    expect(result.reason).toMatch(/could not be saved/i);
  });

  it("invalidates the learned cache when the observed application fingerprint changes", async () => {
    const learned = await learnAppFromProbe({ app, approved: true, probe, now: NOW });
    expect(learned.status).toBe("learned");
    const changedFingerprint = fingerprintApp({
      version: "4.3",
      windowTitle: "Unknown Editor - Untitled",
      locale: "en",
      controlCount: 1,
    });
    const capability = readCapability(["accessibility"]);

    const planned = planStep({
      action: { kind: "clipboard.read" },
      capability,
      app: { ...app, version: "4.3" },
      packs: [],
      scope: scopeFor("clipboard.read"),
      health: new Map(),
      availableMethods: ["accessibility"],
      recording: "video_off",
      fingerprintInput: {
        version: "4.3",
        windowTitle: "Unknown Editor - Untitled",
        locale: "en",
        controlCount: 1,
      },
      now: NOW,
    });

    expect(changedFingerprint).not.toBe(
      learned.status === "learned" ? learned.map.fingerprint : "",
    );
    expect(planned.status).toBe("needs_inspection");
  });

  it("refuses a capability that is absent from the exact learned map", async () => {
    const learned = await learnAppFromProbe({ app, approved: true, probe, now: NOW });
    expect(learned.status).toBe("learned");

    const planned = planStep({
      action: { kind: "clipboard.read" },
      capability: readCapability(["accessibility"]),
      app,
      packs: [],
      scope: scopeFor("clipboard.read"),
      health: new Map(),
      availableMethods: ["accessibility"],
      recording: "video_off",
      fingerprintInput: {
        version: app.version,
        windowTitle: "Unknown Editor - Untitled",
        locale: "en",
        controlCount: 1,
      },
      now: NOW,
    });

    expect(planned.status).toBe("refused");
    if (planned.status !== "refused") return;
    expect(planned.reason).toMatch(/exact|will not substitute/i);
  });

  it("reports coordinate-only probing as unsupported and saves no unsafe map", async () => {
    const result = await learnAppFromProbe({
      app,
      approved: true,
      probe: {
        inspect: async () => ({
          appId: app.appId,
          version: app.version ?? null,
          windowTitle: "Unknown Editor",
          locale: "en",
          controls: [
            {
              id: "document.read",
              label: "Document",
              method: "vision_input",
              anchor: "480,220",
            },
          ],
          evidence: "Only a screen coordinate was observed.",
        }),
      },
      now: NOW,
    });

    expect(result.status).toBe("unsupported");
    expect(listAppMaps()).toEqual([]);
  });
});
