import { describe, expect, it, vi } from "vitest";
import type { OcadeAppIdentity } from "../control/control-plane";
import type { UniversalRouteCandidate } from "../control/route-selector";
import {
  ApplicationTwinCache,
  UNKNOWN_APP_LEARNING_REALITY,
  UNKNOWN_APP_SUPPORT_LABELS,
  buildApplicationDigitalTwin,
  fingerprintUnknownApp,
  learnUnknownApplication,
  operateLearnedApplication,
  runUnknownAppLearningCycle,
  type UnknownAppHost,
  type UnknownAppProbe,
} from "../skills/unknown-app-learning";

const NOW = new Date("2026-07-26T03:00:00.000Z");
const APP: OcadeAppIdentity = {
  appId: "controlled.unknown",
  executable: "C:\\Controlled\\unknown.exe",
  product: "Controlled Unknown",
  version: "1.0.0",
};

function candidate(overrides: Partial<UniversalRouteCandidate> = {}): UniversalRouteCandidate {
  return {
    candidateId: "controlled.cli",
    route: "cli",
    interfaceId: "controlled.cli.v1",
    available: true,
    officialOrApproved: true,
    supportedAppIds: [APP.appId],
    versionPrefixes: ["1."],
    taskTypes: ["export_document"],
    requiredPermissions: ["document.export"],
    confidence: 0.94,
    expectedLatencyMs: 40,
    verification: {
      route: "file",
      confidence: 0.96,
      independent: true,
    },
    recovery: { route: "file", ready: true },
    health: "healthy",
    supportsRecording: true,
    evidence: "Controlled CLI advertised by the approved probe.",
    ...overrides,
  };
}

function probe(overrides: Partial<UnknownAppProbe> = {}): UnknownAppProbe {
  return {
    identity: {
      appId: APP.appId,
      executable: APP.executable!,
      publisher: "Controlled Test Publisher",
      signature: "valid",
      product: APP.product!,
      version: APP.version!,
    },
    environment: {
      locale: "en-US",
      theme: "light",
      displayScale: 1.25,
      plugins: ["exporter@1"],
      layoutRevision: "layout-a",
    },
    windows: [{ id: "window.main", label: "Main window" }],
    views: [{ id: "view.document", label: "Document view" }],
    menus: [{ id: "menu.file", label: "File" }],
    controls: [{ id: "control.export", label: "Export" }],
    commands: [{ id: "command.export", label: "Export document" }],
    shortcuts: [{ id: "shortcut.export", label: "Ctrl+E" }],
    projectFileTypes: [".controlled"],
    approvedLocalEvidence: {
      help: ["help:export-command"],
      logs: ["log:operation-status"],
      projectFiles: ["format:.controlled"],
    },
    interfaces: [candidate()],
    capabilities: [
      {
        id: "document.export",
        label: "Export document",
        taskType: "export_document",
        candidateIds: ["controlled.cli"],
        requiredPermission: "document.export",
        risk: "medium",
        verificationMethodId: "verify.export.file",
        recoveryMethodId: "recover.restore.copy",
      },
    ],
    protectedAreas: ["control.credentials"],
    destructiveAreas: ["control.delete.project"],
    errorStates: [{ id: "error.export", label: "Export failed" }],
    verificationMethods: [
      {
        id: "verify.export.file",
        route: "file",
        independent: true,
        description: "Observe the exported file digest independently.",
      },
    ],
    recoveryMethods: [
      {
        id: "recover.restore.copy",
        route: "file",
        ready: true,
        description: "Restore the temporary project copy.",
      },
    ],
    resourceProfile: { cpu: "low", memoryMb: 256, gpuRequired: false },
    compatibilityConstraints: ["Requires exporter plug-in major version 1."],
    evidence: ["Signed controlled test application inspected through an approved host."],
    ...overrides,
  };
}

function makeHost(initialProbe = probe()): UnknownAppHost & {
  current: UnknownAppProbe;
} {
  return {
    current: initialProbe,
    probe: vi.fn(async function (this: { current: UnknownAppProbe }) {
      return structuredClone(this.current);
    }),
    rehearse: vi.fn(async () => ({
      safe: true,
      mode: "temporary_file" as const,
      fixtureId: "fixture:temporary-copy",
      evidence: "Export rehearsed against a disposable copy.",
    })),
    requestPermission: vi.fn(async () => ({
      granted: true,
      grantId: "grant:controlled",
      appId: APP.appId,
      permissions: ["document.export"],
      expiresAt: "2026-07-26T04:00:00.000Z",
      evidence: "User approved one export for this task.",
    })),
    execute: vi.fn(async () => ({
      executed: true,
      executionId: "execution:1",
      startedAt: "2026-07-26T03:00:01.000Z",
      finishedAt: "2026-07-26T03:00:02.000Z",
      evidence: "Controlled CLI returned zero.",
      outputDigest: "sha256:controlled-export",
    })),
    verify: vi.fn(async () => ({
      verified: true,
      methodId: "verify.export.file",
      observedAt: "2026-07-26T03:00:03.000Z",
      evidence: "Independent file observer matched the expected digest.",
    })),
    recover: vi.fn(async () => ({
      recovered: true,
      methodId: "recover.restore.copy",
      evidence: "Temporary project copy restored.",
    })),
  };
}

describe("Phase 27 support truth and fingerprints", () => {
  it("exposes only the specification support labels", () => {
    expect(UNKNOWN_APP_SUPPORT_LABELS).toEqual([
      "LIVE_TESTED",
      "VERIFIED_CONNECTOR",
      "PROBED_AND_REHEARSED",
      "GENERIC_DOM",
      "GENERIC_ACCESSIBILITY",
      "GENERIC_NATIVE",
      "VISION_FALLBACK",
      "FORMAT_ONLY",
      "CONNECTOR_REQUIRED",
      "PERMISSION_REQUIRED",
      "APPLICATION_REQUIRED",
      "UNAVAILABLE",
      "FAILED_VERIFICATION",
    ]);
  });

  it("never equates controlled probing with live testing", () => {
    expect(UNKNOWN_APP_LEARNING_REALITY).toMatch(/not LIVE_TESTED/i);
    expect(UNKNOWN_APP_LEARNING_REALITY).toMatch(/invalidates/i);
  });

  it.each([
    ["version", () => probe({ identity: { ...probe().identity, version: "1.0.1" } })],
    [
      "plugins",
      () =>
        probe({
          environment: {
            ...probe().environment,
            plugins: ["exporter@2"],
          },
        }),
    ],
    [
      "locale",
      () =>
        probe({
          environment: { ...probe().environment, locale: "fr-FR" },
        }),
    ],
    [
      "theme",
      () =>
        probe({
          environment: { ...probe().environment, theme: "dark" },
        }),
    ],
    [
      "display scale",
      () =>
        probe({
          environment: { ...probe().environment, displayScale: 1.5 },
        }),
    ],
    [
      "layout",
      () =>
        probe({
          environment: { ...probe().environment, layoutRevision: "layout-b" },
        }),
    ],
  ])("invalidates the fingerprint after a %s change", (_label, changed) => {
    expect(fingerprintUnknownApp(changed())).not.toBe(fingerprintUnknownApp(probe()));
  });

  it("normalises plug-in order in the structural fingerprint", () => {
    const left = probe({
      environment: {
        ...probe().environment,
        plugins: ["b@1", "a@1"],
      },
    });
    const right = probe({
      environment: {
        ...probe().environment,
        plugins: ["a@1", "b@1"],
      },
    });
    expect(fingerprintUnknownApp(left)).toBe(fingerprintUnknownApp(right));
  });
});

describe("Application Digital Twin construction", () => {
  it("contains every required structural, safety and recovery surface", () => {
    const result = buildApplicationDigitalTwin({
      app: APP,
      probe: probe(),
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toMatchObject({
      schemaVersion: 1,
      compatibleVersions: ["1.0.0"],
      supportLabel: "PERMISSION_REQUIRED",
      confidence: 0.62,
      lastVerification: null,
      resourceProfile: { cpu: "low", memoryMb: 256, gpuRequired: false },
    });
    expect(result.data.windows).toHaveLength(1);
    expect(result.data.views).toHaveLength(1);
    expect(result.data.menus).toHaveLength(1);
    expect(result.data.controls).toHaveLength(1);
    expect(result.data.commands).toHaveLength(1);
    expect(result.data.shortcuts).toHaveLength(1);
    expect(result.data.projectFileTypes).toEqual([".controlled"]);
    expect(result.data.protectedAreas).toEqual(["control.credentials"]);
    expect(result.data.destructiveAreas).toEqual(["control.delete.project"]);
    expect(result.data.errorStates).toHaveLength(1);
    expect(result.data.verificationMethods[0].independent).toBe(true);
    expect(result.data.recoveryMethods[0].ready).toBe(true);
    expect(result.data.knownAdapterRoutes).toEqual([
      {
        candidateId: "controlled.cli",
        route: "cli",
        interfaceId: "controlled.cli.v1",
      },
    ]);
  });

  it("rejects mismatched identity", () => {
    const result = buildApplicationDigitalTwin({
      app: APP,
      probe: probe({
        identity: { ...probe().identity, appId: "other.app" },
      }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.reason).toMatch(/mismatched application identity/i);
  });

  it("rejects a probe without a closed verification graph", () => {
    const result = buildApplicationDigitalTwin({
      app: APP,
      probe: probe({ verificationMethods: [] }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.reason).toMatch(/verification and recovery graph/i);
  });

  it("rejects implausible display scaling", () => {
    const result = buildApplicationDigitalTwin({
      app: APP,
      probe: probe({
        environment: { ...probe().environment, displayScale: 0 },
      }),
    });
    expect(result.ok).toBe(false);
  });
});

describe("unknown-app learning and bounded operation", () => {
  it("requires explicit inspection approval", async () => {
    const host = makeHost();
    const result = await learnUnknownApplication({
      app: APP,
      approved: false,
      host,
      cache: new ApplicationTwinCache(),
      now: NOW,
    });
    expect(result.status).toBe("refused");
    expect(host.probe).not.toHaveBeenCalled();
  });

  it("learns, rehearses, scopes permission, operates, verifies and compiles privately", async () => {
    const host = makeHost();
    const cache = new ApplicationTwinCache();
    const result = await runUnknownAppLearningCycle({
      app: APP,
      approved: true,
      taskId: "task:controlled",
      taskPattern: "Export the controlled document",
      capabilityId: "document.export",
      host,
      cache,
      recordingPreference: "video_off",
      now: NOW,
    });
    expect(result.status).toBe("verified");
    if (result.status !== "verified") throw new Error(result.reason);
    expect(result.twin.supportLabel).toBe("PROBED_AND_REHEARSED");
    expect(result.twin.lastVerification).toBe("2026-07-26T03:00:03.000Z");
    expect(result.skill).toMatchObject({
      private: true,
      appId: APP.appId,
      compatibleVersions: ["1.0.0"],
      requiredFingerprint: result.twin.fingerprint,
      permissions: ["document.export"],
      actions: [
        {
          capabilityId: "document.export",
          route: "cli",
          interfaceId: "controlled.cli.v1",
        },
      ],
      verification: {
        methodId: "verify.export.file",
        independent: true,
      },
      recovery: { methodId: "recover.restore.copy", ready: true },
    });
    expect(result.skill.invalidatingChanges).toEqual([
      "version",
      "plugins",
      "locale",
      "theme",
      "display_scale",
      "layout",
    ]);
    expect(cache.getSkills(APP.appId)).toHaveLength(1);
    expect(host.probe).toHaveBeenCalledTimes(2);
    expect(host.rehearse).toHaveBeenCalledBefore(
      host.requestPermission as ReturnType<typeof vi.fn>,
    );
    expect(host.requestPermission).toHaveBeenCalledBefore(host.execute as ReturnType<typeof vi.fn>);
    expect(host.execute).toHaveBeenCalledBefore(host.verify as ReturnType<typeof vi.fn>);
  });

  it("invalidates both twin and compiled skill, refuses stale execution, then relearns", async () => {
    const host = makeHost();
    const cache = new ApplicationTwinCache();
    const first = await runUnknownAppLearningCycle({
      app: APP,
      approved: true,
      taskId: "task:first",
      taskPattern: "Export once",
      capabilityId: "document.export",
      host,
      cache,
      recordingPreference: "video_off",
      now: NOW,
    });
    expect(first.status).toBe("verified");
    expect(cache.getSkills(APP.appId)).toHaveLength(1);

    const appV2 = { ...APP, version: "2.0.0" };
    host.current = probe({
      identity: { ...probe().identity, version: "2.0.0" },
      environment: {
        ...probe().environment,
        plugins: ["exporter@2"],
        layoutRevision: "layout-b",
      },
      interfaces: [
        candidate({
          versionPrefixes: ["2."],
          evidence: "Controlled CLI v2 advertised by the approved probe.",
        }),
      ],
    });
    const stale = await operateLearnedApplication({
      app: appV2,
      taskId: "task:stale",
      taskPattern: "Export after update",
      capabilityId: "document.export",
      host,
      cache,
      recordingPreference: "video_off",
      now: new Date("2026-07-26T03:10:00.000Z"),
    });
    expect(stale.status).toBe("stale");
    if (stale.status !== "stale") throw new Error("expected stale result");
    expect(stale.invalidation?.priorFingerprint).not.toBe(stale.invalidation?.observedFingerprint);
    expect(cache.getTwin(APP.appId)).toBeNull();
    expect(cache.getSkills(APP.appId)).toHaveLength(0);
    expect(host.execute).toHaveBeenCalledTimes(1);

    const relearned = await runUnknownAppLearningCycle({
      app: appV2,
      approved: true,
      taskId: "task:relearn",
      taskPattern: "Export after controlled update",
      capabilityId: "document.export",
      host,
      cache,
      recordingPreference: "video_off",
      now: new Date("2026-07-26T03:11:00.000Z"),
    });
    expect(relearned.status).toBe("verified");
    if (relearned.status !== "verified") throw new Error(relearned.reason);
    expect(relearned.twin.compatibleVersions).toEqual(["2.0.0"]);
    expect(relearned.skill.requiredFingerprint).toBe(relearned.twin.fingerprint);
    expect(cache.listInvalidations()).toHaveLength(1);
    expect(host.execute).toHaveBeenCalledTimes(2);
  });

  it("does not execute when scoped permission is denied", async () => {
    const host = makeHost();
    host.requestPermission = vi.fn(async () => ({
      granted: false,
      grantId: "grant:denied",
      appId: APP.appId,
      permissions: [],
      expiresAt: "2026-07-26T04:00:00.000Z",
      evidence: "Denied.",
    }));
    const cache = new ApplicationTwinCache();
    await learnUnknownApplication({
      app: APP,
      approved: true,
      host,
      cache,
      now: NOW,
    });
    const result = await operateLearnedApplication({
      app: APP,
      taskId: "task:denied",
      taskPattern: "Export",
      capabilityId: "document.export",
      host,
      cache,
      recordingPreference: "video_off",
      now: NOW,
    });
    expect(result.status).toBe("refused");
    expect(host.execute).not.toHaveBeenCalled();
  });

  it("recovers and compiles no skill after failed independent verification", async () => {
    const host = makeHost();
    host.verify = vi.fn(async () => ({
      verified: false,
      methodId: "verify.export.file",
      observedAt: "2026-07-26T03:00:03.000Z",
      evidence: "Digest did not match.",
    }));
    const cache = new ApplicationTwinCache();
    await learnUnknownApplication({
      app: APP,
      approved: true,
      host,
      cache,
      now: NOW,
    });
    const result = await operateLearnedApplication({
      app: APP,
      taskId: "task:failed-verify",
      taskPattern: "Export",
      capabilityId: "document.export",
      host,
      cache,
      recordingPreference: "video_off",
      now: NOW,
    });
    expect(result.status).toBe("failed_verification");
    if (result.status !== "failed_verification") {
      throw new Error("expected failed verification");
    }
    expect(result.recovery?.recovered).toBe(true);
    expect(host.recover).toHaveBeenCalledTimes(1);
    expect(cache.getSkills(APP.appId)).toHaveLength(0);
  });

  it("refuses high-risk coordinate-only control before rehearsal", async () => {
    const inputOnly = candidate({
      candidateId: "controlled.input",
      route: "input",
      interfaceId: "controlled.input.v1",
      versionPrefixes: ["1."],
      confidence: 0.99,
      verification: {
        route: "vision",
        confidence: 0.99,
        independent: true,
      },
      recovery: { route: "input", ready: true },
      fallbackPolicy: "explicit",
    });
    const unsafe = probe({
      interfaces: [inputOnly],
      capabilities: [
        {
          ...probe().capabilities[0],
          candidateIds: ["controlled.input"],
          risk: "high",
        },
      ],
    });
    const host = makeHost(unsafe);
    const cache = new ApplicationTwinCache();
    await learnUnknownApplication({
      app: APP,
      approved: true,
      host,
      cache,
      now: NOW,
    });
    const result = await operateLearnedApplication({
      app: APP,
      taskId: "task:high-risk",
      taskPattern: "High risk export",
      capabilityId: "document.export",
      host,
      cache,
      recordingPreference: "video_off",
      explicitCoordinateFallbackApproval: true,
      now: NOW,
    });
    expect(result.status).toBe("refused");
    expect(host.rehearse).not.toHaveBeenCalled();
    expect(host.execute).not.toHaveBeenCalled();
  });

  it("honours cancellation before probing", async () => {
    const host = makeHost();
    const controller = new AbortController();
    controller.abort();
    const result = await learnUnknownApplication({
      app: APP,
      approved: true,
      host,
      cache: new ApplicationTwinCache(),
      signal: controller.signal,
    });
    expect(result.status).toBe("refused");
    expect(host.probe).not.toHaveBeenCalled();
  });
});
