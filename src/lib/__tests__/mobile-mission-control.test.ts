import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  MOBILE_MISSION_COMMAND_KINDS,
  MOBILE_MISSION_RUNTIME_BOUNDARY,
  canonicalMobileMissionCommand,
  executeMobileMissionCommand,
  sanitizeMobileMissionSnapshot,
  signMobileMissionCommand,
  verifyMobileMissionCommand,
  type MobileMissionHost,
  type MobileMissionSnapshot,
  type MobileMissionTrust,
  type SignedMobileMissionCommand,
  type UnsignedMobileMissionCommand,
} from "../mobile/mission-control";

const NOW = new Date("2026-07-26T05:30:00.000Z");
let privateKey: CryptoKey;
let publicKey: JsonWebKey;

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  privateKey = pair.privateKey;
  publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
});

function unsigned(over: Partial<UnsignedMobileMissionCommand> = {}): UnsignedMobileMissionCommand {
  return {
    v: 1,
    commandId: "command-1",
    deviceId: "device-1",
    sessionId: "session-1",
    target: "pc_task_only",
    nonce: "abcdefghijklmnopqrstuv",
    issuedAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + 60_000).toISOString(),
    scope: {
      capabilities: ["run.pause"],
      taskIds: ["task-1"],
      applicationIds: [],
      fileIds: [],
    },
    body: { kind: "run.pause", taskId: "task-1" },
    ...over,
  };
}

async function signed(
  over: Partial<UnsignedMobileMissionCommand> = {},
): Promise<SignedMobileMissionCommand> {
  return signMobileMissionCommand(unsigned(over), { keyId: "key-1", privateKey });
}

function trust(over: Partial<MobileMissionTrust> = {}): MobileMissionTrust {
  return {
    deviceId: "device-1",
    sessionId: "session-1",
    keyId: "key-1",
    publicKey,
    revoked: false,
    now: NOW,
    ...over,
  };
}

describe("signed scoped PC-task commands", () => {
  it("canonicalizes scope order deterministically", () => {
    const left = unsigned({
      scope: {
        capabilities: ["run.pause", "run.cancel"],
        taskIds: ["task-2", "task-1"],
        applicationIds: ["b", "a"],
        fileIds: [],
      },
    });
    const right = unsigned({
      scope: {
        capabilities: ["run.cancel", "run.pause"],
        taskIds: ["task-1", "task-2"],
        applicationIds: ["a", "b"],
        fileIds: [],
      },
    });
    expect(canonicalMobileMissionCommand(left)).toBe(canonicalMobileMissionCommand(right));
  });

  it("signs and verifies a short-lived command bound to device, session and key", async () => {
    const result = await verifyMobileMissionCommand(await signed(), trust());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.evidence).toContain("scope:run.pause");
  });

  it("rejects tampering after signature", async () => {
    const command = await signed();
    const tampered: SignedMobileMissionCommand = {
      ...command,
      body: { kind: "run.cancel", taskId: "task-1" },
      scope: {
        ...command.scope,
        capabilities: ["run.pause", "run.cancel"],
      },
    };
    const result = await verifyMobileMissionCommand(tampered, trust());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/signature/i);
  });

  it("rejects revoked, wrong-device and expired sessions", async () => {
    const command = await signed();
    expect((await verifyMobileMissionCommand(command, trust({ revoked: true }))).ok).toBe(false);
    expect((await verifyMobileMissionCommand(command, trust({ deviceId: "device-2" }))).ok).toBe(
      false,
    );
    expect(
      (await verifyMobileMissionCommand(command, trust({ now: new Date(NOW.getTime() + 120_000) })))
        .ok,
    ).toBe(false);
  });

  it("refuses capabilities, tasks and outputs outside the exact scope", async () => {
    await expect(
      signMobileMissionCommand(unsigned({ body: { kind: "run.cancel", taskId: "task-1" } }), {
        keyId: "key-1",
        privateKey,
      }),
    ).rejects.toThrow(/scope/i);
    await expect(
      signMobileMissionCommand(unsigned({ body: { kind: "run.pause", taskId: "task-2" } }), {
        keyId: "key-1",
        privateKey,
      }),
    ).rejects.toThrow(/task scope/i);
    await expect(
      signMobileMissionCommand(
        unsigned({
          scope: {
            capabilities: ["output.download"],
            taskIds: ["task-1"],
            applicationIds: [],
            fileIds: [],
          },
          body: { kind: "output.download", taskId: "task-1", outputId: "output-1" },
        }),
        { keyId: "key-1", privateKey },
      ),
    ).rejects.toThrow(/file scope/i);
  });

  it("refuses protected or unbounded remote instructions", async () => {
    const command = unsigned({
      scope: {
        capabilities: ["task.create"],
        taskIds: [],
        applicationIds: [],
        fileIds: [],
      },
      body: { kind: "task.create", text: "My password is hunter2" },
    });
    await expect(signMobileMissionCommand(command, { keyId: "key-1", privateKey })).rejects.toThrow(
      /protected input/i,
    );
    await expect(
      signMobileMissionCommand(
        {
          ...command,
          body: { kind: "task.create", text: "x".repeat(8_001) },
        },
        { keyId: "key-1", privateKey },
      ),
    ).rejects.toThrow(/bounded/i);
  });

  it("has no arbitrary PC or phone-screen automation command", () => {
    expect(MOBILE_MISSION_COMMAND_KINDS).not.toContain("desktop.execute");
    expect(MOBILE_MISSION_COMMAND_KINDS).not.toContain("phone.tap");
    expect(MOBILE_MISSION_COMMAND_KINDS).not.toContain("input.type");
    expect(MOBILE_MISSION_RUNTIME_BOUNDARY).toMatch(/never automates the phone screen/i);
  });
});

describe("execution receipts", () => {
  const host = (receipt: Awaited<ReturnType<MobileMissionHost["execute"]>>): MobileMissionHost => ({
    execute: vi.fn(async () => receipt),
  });

  it("accepts only a correlated acknowledged completed receipt with evidence", async () => {
    const command = await signed();
    const result = await executeMobileMissionCommand(
      command,
      trust(),
      host({
        commandId: command.commandId,
        acknowledged: true,
        outcome: "completed",
        observedAt: NOW.toISOString(),
        evidence: ["desktop:paused", "checkpoint:verified"],
        detail: "Paused at a verified checkpoint.",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("never turns refusal, missing evidence or a wrong command ID into success", async () => {
    const command = await signed();
    const receipts = [
      {
        commandId: command.commandId,
        acknowledged: false,
        outcome: "refused" as const,
        observedAt: NOW.toISOString(),
        evidence: ["desktop:refused"],
        detail: "The task is already complete.",
      },
      {
        commandId: "different",
        acknowledged: true,
        outcome: "completed" as const,
        observedAt: NOW.toISOString(),
        evidence: ["desktop:paused"],
        detail: "Paused.",
      },
      {
        commandId: command.commandId,
        acknowledged: true,
        outcome: "completed" as const,
        observedAt: NOW.toISOString(),
        evidence: [],
        detail: "Paused.",
      },
    ];
    for (const receipt of receipts) {
      expect((await executeMobileMissionCommand(command, trust(), host(receipt))).ok).toBe(false);
    }
  });

  it("cancels before host execution", async () => {
    const command = await signed();
    const abort = new AbortController();
    abort.abort();
    const execute = vi.fn();
    const result = await executeMobileMissionCommand(command, trust(), { execute }, abort.signal);
    expect(result.ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("mobile monitoring privacy", () => {
  const snapshot = (over: Partial<MobileMissionSnapshot> = {}): MobileMissionSnapshot => ({
    observedAt: NOW.toISOString(),
    task: {
      id: "task-1",
      title: "Prepare release",
      state: "running",
      pcOnline: true,
      companionHealth: "healthy",
      activeApplication: "VS Code",
      currentStep: "Run tests",
      lastVerifiedCheckpoint: "checkpoint-1",
      progressPercent: 45,
      error: null,
      blocker: null,
      preview: { enabled: false, redacted: false, dataUrl: null },
    },
    approvals: [],
    outputs: [
      {
        id: "output-1",
        taskId: "task-1",
        name: "report.pdf",
        sizeBytes: 123,
        sha256: "a".repeat(64),
        status: "ready",
        downloadable: true,
      },
    ],
    receipts: [
      {
        id: "receipt-1",
        taskId: "task-1",
        headline: "Tests passed",
        outcome: "succeeded",
        observedAt: NOW.toISOString(),
      },
    ],
    ...over,
  });

  it("keeps disabled previews absent and validates outputs and receipts", () => {
    const result = sanitizeMobileMissionSnapshot(snapshot(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data.task?.preview.dataUrl).toBeNull();
    expect(result.data.outputs[0].sha256).toBe("a".repeat(64));
  });

  it("refuses a screenshot unless preview is enabled and independently redacted", () => {
    const unsafe = snapshot({
      task: {
        ...snapshot().task!,
        preview: { enabled: true, redacted: false, dataUrl: "data:image/png;base64,AA==" },
      },
    });
    const result = sanitizeMobileMissionSnapshot(unsafe, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/redacted preview/i);
  });

  it("refuses protected approval summaries and malformed output hashes", () => {
    const protectedApproval = snapshot({
      approvals: [
        {
          id: "approval-1",
          taskId: "task-1",
          summary: "Enter OTP 123456",
          risk: "high",
          expiresAt: new Date(NOW.getTime() + 30_000).toISOString(),
          status: "pending",
        },
      ],
    });
    expect(sanitizeMobileMissionSnapshot(protectedApproval, NOW).ok).toBe(false);
    expect(
      sanitizeMobileMissionSnapshot(
        snapshot({ outputs: [{ ...snapshot().outputs[0], sha256: "not-a-hash" }] }),
        NOW,
      ).ok,
    ).toBe(false);
  });
});
