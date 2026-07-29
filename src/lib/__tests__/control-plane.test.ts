import { describe, expect, it, vi } from "vitest";
import {
  EyesRegistry,
  HandsRegistry,
  InMemoryControlJournal,
  decodeBrainProposal,
  directBrainProposal,
  planBrainGoal,
  runDirectedAction,
  validateOcadeActionRequest,
  verifyObservations,
  type DirectorContext,
  type DirectedAction,
  type OcadeActionRequest,
  type ToolDefinition,
} from "../control/control-plane";

const NOW = new Date("2026-07-26T00:00:00.000Z");

const tool: ToolDefinition = {
  capability: "file.write",
  route: "file",
  argumentSchema: {
    type: "object",
    properties: {
      path: { type: "string", minLength: 1, maxLength: 500 },
      content: { type: "string", maxLength: 10_000 },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
  requiredPermission: "file.write",
  risk: (arguments_) => (String(arguments_.content).length > 0 ? "high" : "low"),
  mutating: true,
  timeoutMs: 2_000,
  retryBudget: 1,
  requiredResources: ["file-broker"],
  fileArguments: ["path"],
  expectedPostconditions: () => [
    {
      id: "file-hash",
      kind: "file",
      selector: "C:/approved/report.txt",
      operator: "sha256",
      expected: "abc123",
    },
  ],
  verificationPlan: () => [
    {
      id: "read-back",
      observerId: "filesystem-hash",
      route: "file",
      postconditionIds: ["file-hash"],
    },
  ],
  rollbackPlan: () => [
    {
      id: "restore-file",
      kind: "restore",
      description: "Restore the pre-write copy.",
      ready: true,
    },
  ],
};

const proposal = {
  taskId: "task-21",
  goal: "Write and verify the report",
  actions: [
    {
      stepId: "write-report",
      app: { appId: "ocade.files" },
      capability: "file.write",
      arguments: { path: "C:/approved/report.txt", content: "hello" },
    },
  ],
};

function context(overrides: Partial<DirectorContext> = {}): DirectorContext {
  return {
    tools: [tool],
    permission: {
      grantId: "grant-21",
      taskId: "task-21",
      permissions: ["file.write"],
      appIds: ["ocade.files"],
      fileRoots: ["C:/approved"],
      grantedAt: "2026-07-25T23:59:00.000Z",
      expiresAt: "2026-07-26T00:30:00.000Z",
    },
    availableResources: ["file-broker"],
    resolveApp: async (hint) =>
      hint.appId === "ocade.files" ? { appId: "ocade.files", product: "OCADE file broker" } : null,
    resolveFile: async (path) =>
      path.replace(/\\/g, "/") === "C:/approved/report.txt" ? "C:/approved/report.txt" : null,
    createCheckpoint: async () => ({
      checkpointId: "checkpoint-21",
      evidence: "Pre-write bytes were durably captured.",
    }),
    now: NOW,
    ...overrides,
  };
}

async function directed(overrides: Partial<DirectorContext> = {}): Promise<DirectedAction> {
  const result = await directBrainProposal(proposal, context(overrides));
  if (!result.ok) throw new Error(result.reason);
  return result.data.actions[0];
}

describe("strict Brain and Director boundary", () => {
  it("strictly decodes bounded model output and rejects unknown fields", () => {
    expect(decodeBrainProposal(proposal)?.actions).toHaveLength(1);
    expect(decodeBrainProposal({ ...proposal, directOsAuthority: true })).toBeNull();
    expect(
      decodeBrainProposal({
        ...proposal,
        actions: [{ ...proposal.actions[0], arguments: { value: Number.NaN } }],
      }),
    ).toBeNull();
  });

  it("derives risk, route, verification, recovery and idempotency from tool metadata", async () => {
    const result = await directBrainProposal(proposal, context());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.actions[0]).toMatchObject({
      authorizationGrantId: "grant-21",
      checkpoint: { checkpointId: "checkpoint-21" },
      request: {
        risk: "high",
        route: "file",
        requiredPermission: "file.write",
        retryBudget: 1,
      },
    });
    expect(result.data.actions[0].request.idempotencyKey).toMatch(/^ocade:task-21:write-report:/);
    expect(validateOcadeActionRequest(result.data.actions[0].request)).toBeNull();
  });

  it("binds a multi-interface tool to the Director's audited universal route decision", async () => {
    const result = await directBrainProposal(
      proposal,
      context({
        tools: [
          {
            ...tool,
            routeCandidates: () => [
              {
                candidateId: "official-api",
                route: "api",
                interfaceId: "files-api",
                available: false,
                officialOrApproved: true,
                supportedAppIds: ["ocade.files"],
                taskTypes: ["file.write"],
                requiredPermissions: ["file.write"],
                confidence: 1,
                expectedLatencyMs: 20,
                verification: {
                  route: "file",
                  confidence: 1,
                  independent: true,
                },
                recovery: { route: "file", ready: true },
                health: "unknown",
                supportsRecording: true,
                evidence: "The official API health probe was unavailable.",
              },
              {
                candidateId: "documented-cli",
                route: "cli",
                interfaceId: "files-cli",
                available: true,
                officialOrApproved: true,
                supportedAppIds: ["ocade.files"],
                taskTypes: ["file.write"],
                requiredPermissions: ["file.write"],
                confidence: 1,
                expectedLatencyMs: 200,
                verification: {
                  route: "file",
                  confidence: 1,
                  independent: true,
                },
                recovery: { route: "file", ready: true },
                health: "healthy",
                supportsRecording: true,
                evidence: "The documented CLI probe is healthy.",
              },
            ],
          },
        ],
        routePolicy: {
          taskType: "file.write",
          recordingPreference: "video_off",
        },
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      data: {
        actions: [
          {
            request: { route: "cli" },
            routeSelection: {
              candidateId: "documented-cli",
              route: "cli",
              fallbackFrom: ["api"],
            },
          },
        ],
      },
    });
    if (!result.ok) return;
    const action = result.data.actions[0];
    const hands = new HandsRegistry();
    const eyes = new EyesRegistry();
    expect(hands.get(action.request)).toBeNull();
    hands.register("file.write", "cli", "documented-cli-writer", async () => ({
      executorId: "documented-cli-writer",
      route: "cli",
      startedAt: NOW.toISOString(),
      finishedAt: NOW.toISOString(),
      evidence: ["The documented CLI wrote the approved temporary file."],
    }));
    eyes.register("filesystem-hash", async (_request, step) => [
      {
        observerId: "filesystem-hash",
        route: "file",
        postconditionId: step.postconditionIds[0],
        value: "abc123",
        observedAt: NOW.toISOString(),
        evidence: "Independent file hashing matched the expected result.",
        redacted: false,
      },
    ]);
    expect(
      await runDirectedAction({
        action,
        hands,
        eyes,
        journal: new InMemoryControlJournal(),
        now: NOW,
      }),
    ).toMatchObject({ status: "verified" });
  });

  it("refuses multi-interface actions without policy or an adequate semantic route", async () => {
    const inputOnlyTool: ToolDefinition = {
      ...tool,
      routeCandidates: () => [
        {
          candidateId: "coordinate-input",
          route: "input",
          interfaceId: "signed-input-broker",
          available: true,
          officialOrApproved: true,
          supportedAppIds: ["ocade.files"],
          taskTypes: ["file.write"],
          requiredPermissions: ["file.write"],
          confidence: 1,
          expectedLatencyMs: 100,
          verification: {
            route: "file",
            confidence: 1,
            independent: true,
          },
          recovery: { route: "file", ready: true },
          health: "healthy",
          supportsRecording: true,
          evidence: "Only coordinate input is available.",
        },
      ],
    };
    expect(await directBrainProposal(proposal, context({ tools: [inputOnlyTool] }))).toMatchObject({
      ok: false,
      code: "route_unavailable",
    });
    expect(
      await directBrainProposal(
        proposal,
        context({
          tools: [inputOnlyTool],
          routePolicy: {
            taskType: "file.write",
            recordingPreference: "video_on",
            explicitCoordinateFallbackApproval: true,
          },
        }),
      ),
    ).toMatchObject({
      ok: false,
      code: "route_unavailable",
      reason: expect.stringContaining("high-risk mutation"),
    });
  });

  it("fails closed on malformed, unknown, unresolved and unbounded actions", async () => {
    const malformed = await directBrainProposal(
      {
        ...proposal,
        actions: [
          {
            ...proposal.actions[0],
            arguments: { ...proposal.actions[0].arguments, surprise: true },
          },
        ],
      },
      context(),
    );
    expect(malformed).toMatchObject({ ok: false, code: "malformed" });

    const unknown = await directBrainProposal(
      {
        ...proposal,
        actions: [{ ...proposal.actions[0], capability: "shell.anything" }],
      },
      context(),
    );
    expect(unknown).toMatchObject({ ok: false, code: "unknown_tool" });

    const unresolved = await directBrainProposal(
      proposal,
      context({ resolveApp: async () => null }),
    );
    expect(unresolved).toMatchObject({ ok: false, code: "identity_unresolved" });
    const unresolvedFile = await directBrainProposal(
      proposal,
      context({ resolveFile: async () => null }),
    );
    expect(unresolvedFile).toMatchObject({ ok: false, code: "identity_unresolved" });

    const tooMany = await directBrainProposal(
      { ...proposal, actions: [proposal.actions[0], proposal.actions[0]] },
      context({ maxActions: 1 }),
    );
    expect(tooMany).toMatchObject({ ok: false, code: "too_many_steps" });
  });

  it("fails closed on missing permission, resources, verification, recovery or checkpoint", async () => {
    expect(await directBrainProposal(proposal, context({ permission: null }))).toMatchObject({
      ok: false,
      code: "unauthorized",
    });
    expect(
      await directBrainProposal(
        proposal,
        context({
          permission: {
            ...context().permission!,
            fileRoots: ["C:/another-folder"],
          },
        }),
      ),
    ).toMatchObject({ ok: false, code: "unauthorized" });
    expect(await directBrainProposal(proposal, context({ availableResources: [] }))).toMatchObject({
      ok: false,
      code: "resource_unavailable",
    });
    expect(
      await directBrainProposal(
        proposal,
        context({
          tools: [{ ...tool, verificationPlan: () => [] }],
        }),
      ),
    ).toMatchObject({ ok: false, code: "unverifiable" });
    expect(
      await directBrainProposal(
        proposal,
        context({
          tools: [{ ...tool, rollbackPlan: () => [] }],
        }),
      ),
    ).toMatchObject({ ok: false, code: "recovery_missing" });
    expect(
      await directBrainProposal(proposal, context({ createCheckpoint: undefined })),
    ).toMatchObject({ ok: false, code: "checkpoint_failed" });
    expect(
      await directBrainProposal(proposal, context({ tools: [{ ...tool, risk: "protected" }] })),
    ).toMatchObject({ ok: false, code: "unauthorized" });
  });

  it("keeps the Brain behind the Director even when the model throws", async () => {
    const brain = { propose: vi.fn(async () => proposal) };
    expect(await planBrainGoal(brain, proposal.goal, context())).toMatchObject({ ok: true });
    expect(brain.propose).toHaveBeenCalledOnce();

    expect(
      await planBrainGoal(
        { propose: async () => Promise.reject(new Error("model offline")) },
        proposal.goal,
        context(),
      ),
    ).toMatchObject({ ok: false, code: "malformed", reason: "model offline" });
  });
});

describe("Hands, Eyes, Verifier and journal boundary", () => {
  function runtime() {
    const hands = new HandsRegistry();
    const eyes = new EyesRegistry();
    const execute = vi.fn(async () => ({
      executorId: "file-writer",
      route: "file" as const,
      startedAt: NOW.toISOString(),
      finishedAt: NOW.toISOString(),
      evidence: ["Wrote bytes through the approved file broker."],
    }));
    hands.register("file.write", "file", "file-writer", execute);
    eyes.register("filesystem-hash", async (_request, step) => [
      {
        observerId: "filesystem-hash",
        route: "file",
        postconditionId: step.postconditionIds[0],
        value: "abc123",
        observedAt: NOW.toISOString(),
        evidence: "Independent read-back hash is abc123.",
        redacted: false,
      },
    ]);
    return { hands, eyes, execute, journal: new InMemoryControlJournal() };
  }

  it("only reports verified after an independent Eyes observation matches", async () => {
    const action = await directed();
    const setup = runtime();
    const result = await runDirectedAction({ action, ...setup, now: NOW });
    expect(result).toMatchObject({
      status: "verified",
      receipt: { verified: true, missingPostconditions: [], mismatchedPostconditions: [] },
    });
    expect(setup.execute).toHaveBeenCalledOnce();
  });

  it("replays a verified idempotency receipt without mutating twice", async () => {
    const action = await directed();
    const setup = runtime();
    expect((await runDirectedAction({ action, ...setup, now: NOW })).status).toBe("verified");
    expect((await runDirectedAction({ action, ...setup, now: NOW })).status).toBe("replayed");
    expect(setup.execute).toHaveBeenCalledOnce();
  });

  it("reports an absent or mismatching independent observer as unverified", async () => {
    const action = await directed();
    const noEyes = runtime();
    noEyes.eyes = new EyesRegistry();
    expect(await runDirectedAction({ action, ...noEyes, now: NOW })).toMatchObject({
      status: "unverified",
      reason: expect.stringMatching(/observer/i),
    });

    const mismatch = runtime();
    mismatch.eyes = new EyesRegistry();
    mismatch.eyes.register("filesystem-hash", async (_request, step) => [
      {
        observerId: "filesystem-hash",
        route: "file",
        postconditionId: step.postconditionIds[0],
        value: "wrong",
        observedAt: NOW.toISOString(),
        evidence: "Independent read-back hash did not match.",
        redacted: false,
      },
    ]);
    expect(await runDirectedAction({ action, ...mismatch, now: NOW })).toMatchObject({
      status: "unverified",
      receipt: { verified: false, mismatchedPostconditions: ["file-hash"] },
    });
  });

  it("does not allow executor-authored observations to verify themselves", async () => {
    const action = await directed();
    const execution = {
      executorId: "same-component",
      route: "file" as const,
      startedAt: NOW.toISOString(),
      finishedAt: NOW.toISOString(),
      evidence: ["executor says done"],
    };
    expect(
      verifyObservations(action.request, execution, [
        {
          observerId: "same-component",
          route: "file",
          postconditionId: "file-hash",
          value: "abc123",
          observedAt: NOW.toISOString(),
          evidence: "self-authored",
          redacted: false,
        },
      ]),
    ).toMatchObject({ verified: false, missingPostconditions: ["file-hash"] });
  });

  it("revalidates grant expiry, checkpoint and protected-risk boundaries at dispatch", async () => {
    const setup = runtime();
    const action = await directed();
    expect(
      await runDirectedAction({
        action,
        ...setup,
        now: new Date("2026-07-26T00:31:00.000Z"),
      }),
    ).toMatchObject({ status: "refused", reason: expect.stringMatching(/expired/i) });
    expect(
      await runDirectedAction({
        action: { ...action, checkpoint: null },
        ...runtime(),
        now: NOW,
      }),
    ).toMatchObject({ status: "refused", reason: expect.stringMatching(/checkpoint/i) });

    const protectedRequest: OcadeActionRequest = {
      ...action.request,
      risk: "protected",
    };
    expect(validateOcadeActionRequest(protectedRequest)).toMatch(/never executable/i);
  });

  it("enforces the deadline and fails closed when the receipt journal cannot persist", async () => {
    const action = await directed();
    action.request.timeoutMs = 5;
    const hanging = runtime();
    hanging.hands = new HandsRegistry();
    hanging.hands.register(
      "file.write",
      "file",
      "hanging-writer",
      async () => await new Promise(() => undefined),
    );
    expect(await runDirectedAction({ action, ...hanging, now: NOW })).toMatchObject({
      status: "failed",
      reason: expect.stringMatching(/timed out/i),
    });

    const brokenJournal = {
      lookup: async () => null,
      begin: async () => true,
      complete: async () => {
        throw new Error("disk unavailable");
      },
    };
    expect(
      await runDirectedAction({
        action: await directed(),
        ...runtime(),
        journal: brokenJournal,
        now: NOW,
      }),
    ).toMatchObject({
      status: "failed",
      reason: expect.stringMatching(/not durable.*disk unavailable/i),
    });
  });
});
