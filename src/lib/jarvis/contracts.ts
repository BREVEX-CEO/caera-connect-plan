/**
 * THE JARVIS PROTOCOL, ONCE (plan.md §4.2, §22.3, P01/P05).
 *
 * Every object that crosses a trust boundary — planner to queue, queue to
 * device, device to server, verifier to settlement — is defined here and
 * validated at runtime on both sides. The companion reads the JSON Schema this
 * file exports (`device-agent/protocol.json`), so TypeScript and Python check
 * the same contract. Nothing a device, document or tool description sends can
 * add an operation, raise a risk or grant a permission: the registry below is
 * the only list, and an unknown operation is refused.
 */
import { z } from "zod";

export const PROTOCOL_VERSION = 1;

/** Version 1 executes only these; external effects and irreversible actions fail closed. */
export const RISKS = ["read", "reversible_write"] as const;

/** Paths are relative to a workspace folder the person chose on the device itself. */
const workspacePath = z
  .string()
  .min(1)
  .max(260)
  .refine((path) => !/\p{Cc}/u.test(path), "control characters");

const column = z.strictObject({
  sheet: z.string().min(1).max(31),
  key: z.string().min(1).max(100),
  amount: z.string().min(1).max(100),
});

/**
 * The typed capability registry: four local roles, each operation with its
 * permission, risk and argument schema. `role` names the bundled worker that
 * serves it; `verify.*` runs in a separate process from the actor.
 */
export const OPERATIONS = {
  "fs.list": {
    role: "fs_sandbox",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({ path: workspacePath.default(".") }),
  },
  "office.inspect_workbook": {
    role: "sys_core",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({ path: workspacePath }),
  },
  "office.reconcile_workbook": {
    role: "sys_core",
    capability: "files",
    risk: "reversible_write",
    arguments: z.strictObject({
      source: workspacePath,
      left: column,
      right: column,
      output: workspacePath,
    }),
  },
  "office.write_report": {
    role: "sys_core",
    capability: "files",
    risk: "reversible_write",
    arguments: z.strictObject({
      workbook: workspacePath,
      docx: workspacePath,
      pdf: workspacePath,
      title: z.string().min(1).max(200),
    }),
  },
  "verify.reconciliation_report": {
    role: "verifier",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({
      source: workspacePath,
      sourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
      left: column,
      right: column,
      workbook: workspacePath,
      docx: workspacePath,
      pdf: workspacePath,
    }),
  },
} as const;

export type Operation = keyof typeof OPERATIONS;
const operationNames = Object.keys(OPERATIONS) as [Operation, ...Operation[]];

/** One queued action, as stored in `jarvis_activity.action` and sent to the device. */
export const actionIntent = z
  .object({
    v: z.literal(PROTOCOL_VERSION),
    key: z.string().regex(/^[a-z0-9_.:-]{1,80}$/),
    operation: z.enum(operationNames),
    capability: z.string(),
    risk: z.enum(RISKS),
    arguments: z.record(z.string(), z.unknown()),
    deadlineUtc: z.iso.datetime(),
  })
  .strict()
  .superRefine((intent, context) => {
    const spec = OPERATIONS[intent.operation];
    if (intent.capability !== spec.capability || intent.risk !== spec.risk) {
      context.addIssue({
        code: "custom",
        message: "capability or risk does not match the registry",
      });
    }
    const parsed = spec.arguments.safeParse(intent.arguments);
    if (!parsed.success) context.addIssue({ code: "custom", message: "invalid arguments" });
  });
export type ActionIntent = z.infer<typeof actionIntent>;

/** Build a registry-consistent intent; the only way the planner makes one. */
export function intent<O extends Operation>(
  operation: O,
  key: string,
  args: z.input<(typeof OPERATIONS)[O]["arguments"]>,
  deadline: Date,
): ActionIntent {
  const spec = OPERATIONS[operation];
  return actionIntent.parse({
    v: PROTOCOL_VERSION,
    key,
    operation,
    capability: spec.capability,
    risk: spec.risk,
    arguments: spec.arguments.parse(args),
    deadlineUtc: deadline.toISOString(),
  });
}

/** Evidence is small and typed: hashes, counts, names. Never file bytes or screenshots. */
const evidence = z
  .record(z.string().max(80), z.unknown())
  .refine((value) => JSON.stringify(value).length <= 16_000, "evidence too large");

/** What a device observed. The actor's own "success" is not a status here. */
export const actionReceipt = z
  .object({
    status: z.enum(["observed", "not_applied", "unknown"]),
    maybeChanged: z.boolean(),
    observedAtUtc: z.iso.datetime(),
    evidence: evidence.default({}),
    errorCode: z
      .string()
      .regex(/^[a-z0-9_]{1,60}$/)
      .optional(),
  })
  .strict();
export type ActionReceipt = z.infer<typeof actionReceipt>;

/** A fixed goal check, set when the task opens (`jarvis_tasks.outcome`). */
export const outcomeCheck = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,60}$/),
  description: z.string().min(1).max(200),
});
export type OutcomeCheck = z.infer<typeof outcomeCheck>;

/** The settlement record: every fixed check lands in exactly one list. */
export const verificationResult = z.object({
  passed: z.array(z.string()),
  failed: z.array(z.string()),
  unverified: z.array(z.string()),
  evidence: evidence,
  verifierVersion: z.string().max(40),
});
export type VerificationResult = z.infer<typeof verificationResult>;

/** Device → server requests (signed). */
export const deviceRequest = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("enroll"),
      publicKey: z.string().regex(/^[A-Za-z0-9_-]{80,200}$/),
      name: z.string().trim().min(1).max(120),
      platform: z.string().trim().max(60),
      softwareVersion: z.string().trim().max(40),
    })
    .strict(),
  z.object({ op: z.literal("claim") }).strict(),
  z.object({ op: z.literal("receipt"), activityId: z.uuid(), receipt: actionReceipt }).strict(),
]);
export type DeviceRequest = z.infer<typeof deviceRequest>;

/** The machine-readable contract the companion validates against. */
export function protocolSchema() {
  return {
    version: PROTOCOL_VERSION,
    risks: RISKS,
    signing: { prefix: "OCADE-JARVIS-1", skewSeconds: 300 },
    operations: Object.fromEntries(
      Object.entries(OPERATIONS).map(([name, spec]) => [
        name,
        {
          role: spec.role,
          capability: spec.capability,
          risk: spec.risk,
          arguments: z.toJSONSchema(spec.arguments, { io: "input" }),
        },
      ]),
    ),
    receipt: z.toJSONSchema(actionReceipt, { io: "input" }),
  };
}
