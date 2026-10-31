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

/**
 * `external_effect` actions wait for the person's confirmation before any device may
 * claim them; irreversible actions (payments, deletion, sends without review) are not
 * in the registry at all.
 */
const RISKS = ["read", "reversible_write", "external_effect"] as const;

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

/** An executable's file name, as `apps.list` reports it and an `app:` permission names it. */
const exe = z
  .string()
  .regex(/^[A-Za-z0-9 ._()+-]{1,80}\.exe$/)
  .transform((name) => name.toLowerCase());

/**
 * One top-level window, exactly: a reused PID or HWND, or a restarted app, no
 * longer matches, so a stale observation can never steer input elsewhere.
 */
const windowLease = z.strictObject({
  exe,
  pid: z.number().int().positive(),
  hwnd: z.number().int().positive(),
  started: z.number().positive(),
});

/** An element inside a leased window, found again by what it is, not where it was. */
const element = z
  .strictObject({
    automationId: z.string().max(200).optional(),
    name: z.string().max(200).optional(),
    controlType: z.string().max(40).optional(),
  })
  .refine((e) => e.automationId || e.name, "an element needs an automation id or a name");

const host = z
  .string()
  .regex(/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/)
  .max(253);
/** A public https site by name: no localhost, no address literals, no non-default port. */
const httpsUrl = z
  .url({ protocol: /^https$/ })
  .max(2000)
  .refine((url) => {
    const { hostname, port } = new URL(url);
    return (
      host.safeParse(hostname).success &&
      !port &&
      !/(^|\.)localhost$/.test(hostname) &&
      !/^[0-9.]+$/.test(hostname)
    );
  }, "unsupported host");
const page = z.strictObject({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), site: host });
const selector = z.string().min(1).max(500);

type Target = { app?: string; site?: string; mcp?: string };

/** A call to one tool of an owner-approved external MCP server, checked on the device against its pinned manifest. */
const mcpCall = z.strictObject({
  server: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
  tool: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/),
  arguments: z.record(z.string(), z.unknown()),
});
const mcpTarget = (a: { server: string }): Target => ({ mcp: a.server });

/**
 * The typed capability registry: four local roles (plus the separate verifier),
 * each operation with its permission, risk, argument schema and — for apps and
 * websites — the exact target that also needs the person's `app:`/`site:` grant.
 */
export const OPERATIONS = {
  "fs.list": {
    role: "fs_sandbox",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({ path: workspacePath.default(".") }),
  },
  "fs.read_text": {
    role: "fs_sandbox",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({ path: workspacePath }),
  },
  "media.inspect": {
    role: "sys_core",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({ path: workspacePath }),
  },
  "media.trim": {
    role: "sys_core",
    capability: "files",
    risk: "reversible_write",
    arguments: z.strictObject({
      source: workspacePath,
      start: z.number().min(0),
      end: z.number().positive(),
      output: workspacePath,
    }),
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
  "office.write_document": {
    role: "sys_core",
    capability: "files",
    risk: "reversible_write",
    arguments: z.strictObject({
      docx: workspacePath,
      pdf: workspacePath.optional(),
      title: z.string().min(1).max(200),
      sections: z
        .array(
          z.strictObject({
            heading: z.string().min(1).max(200),
            paragraphs: z.array(z.string().max(4000)).max(50).default([]),
            table: z
              .array(z.array(z.string().max(500)).max(12))
              .max(200)
              .optional(),
          }),
        )
        .min(1)
        .max(30),
    }),
  },
  "office.write_workbook": {
    role: "sys_core",
    capability: "files",
    risk: "reversible_write",
    arguments: z.strictObject({
      path: workspacePath,
      sheets: z
        .array(
          z.strictObject({
            name: z.string().min(1).max(31),
            rows: z
              .array(z.array(z.union([z.string().max(1000), z.number(), z.null()])).max(50))
              .max(5000),
          }),
        )
        .min(1)
        .max(10),
    }),
  },
  "apps.list": {
    role: "ui_bridge",
    capability: "apps",
    risk: "read",
    arguments: z.strictObject({}),
  },
  "apps.launch": {
    role: "ui_bridge",
    capability: "apps",
    risk: "reversible_write",
    arguments: z.strictObject({ exe, open: workspacePath.optional() }),
    target: (a: { exe: string }): Target => ({ app: a.exe }),
  },
  "ui.inspect": {
    role: "ui_bridge",
    capability: "apps",
    risk: "read",
    arguments: z.strictObject({ window: windowLease }),
    target: (a: { window: { exe: string } }): Target => ({ app: a.window.exe }),
  },
  "ui.invoke": {
    role: "ui_bridge",
    capability: "apps",
    risk: "reversible_write",
    arguments: z.strictObject({ window: windowLease, element }),
    target: (a: { window: { exe: string } }): Target => ({ app: a.window.exe }),
  },
  "ui.set_value": {
    role: "ui_bridge",
    capability: "apps",
    risk: "reversible_write",
    arguments: z.strictObject({ window: windowLease, element, value: z.string().max(4000) }),
    target: (a: { window: { exe: string } }): Target => ({ app: a.window.exe }),
  },
  "ui.send_keys": {
    role: "ui_bridge",
    capability: "apps",
    risk: "reversible_write",
    arguments: z.strictObject({
      window: windowLease,
      keys: z.string().min(1).max(200),
    }),
    target: (a: { window: { exe: string } }): Target => ({ app: a.window.exe }),
  },
  "ui.click_point": {
    role: "ui_bridge",
    capability: "computer_control",
    risk: "reversible_write",
    arguments: z.strictObject({
      window: windowLease,
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      expectTitle: z.string().min(1).max(200),
    }),
    target: (a: { window: { exe: string } }): Target => ({ app: a.window.exe }),
  },
  "web.open": {
    role: "web_automation",
    capability: "browser",
    risk: "read",
    arguments: z.strictObject({ url: httpsUrl }),
    target: (a: { url: string }): Target => ({ site: new URL(a.url).hostname }),
  },
  "web.read": {
    role: "web_automation",
    capability: "browser",
    risk: "read",
    arguments: z.strictObject({ page }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.fill": {
    role: "web_automation",
    capability: "browser",
    risk: "reversible_write",
    arguments: z.strictObject({
      page,
      selector,
      value: z.string().max(2000),
      frame: selector.optional(),
    }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.select": {
    role: "web_automation",
    capability: "browser",
    risk: "reversible_write",
    arguments: z.strictObject({
      page,
      selector,
      option: z.string().min(1).max(200),
      frame: selector.optional(),
    }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.click": {
    role: "web_automation",
    capability: "browser",
    risk: "external_effect",
    arguments: z.strictObject({ page, selector, frame: selector.optional() }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.upload": {
    role: "web_automation",
    capability: "browser",
    risk: "external_effect",
    arguments: z.strictObject({ page, selector, path: workspacePath }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.screenshot": {
    role: "web_automation",
    capability: "browser",
    risk: "reversible_write",
    arguments: z.strictObject({ page, output: workspacePath }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.close": {
    role: "web_automation",
    capability: "browser",
    risk: "read",
    arguments: z.strictObject({ page }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.download": {
    role: "web_automation",
    capability: "browser",
    risk: "reversible_write",
    arguments: z.strictObject({ page, selector, output: workspacePath }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "mcp.read": {
    role: "mcp",
    capability: "mcp",
    risk: "read",
    arguments: mcpCall,
    target: mcpTarget,
  },
  "mcp.write": {
    role: "mcp",
    capability: "mcp",
    risk: "reversible_write",
    arguments: mcpCall,
    target: mcpTarget,
  },
  "mcp.external": {
    role: "mcp",
    capability: "mcp",
    risk: "external_effect",
    arguments: mcpCall,
    target: mcpTarget,
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
  "verify.checks": {
    role: "verifier",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({
      checks: z
        .array(z.lazy(() => outcomeCheck))
        .min(1)
        .max(10),
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
    target: z
      .strictObject({
        app: z.string().optional(),
        site: z.string().optional(),
        mcp: z.string().optional(),
      })
      .optional(),
    deadlineUtc: z.iso.datetime(),
  })
  .strict()
  .superRefine((intent, context) => {
    const spec: {
      capability: string;
      risk: string;
      arguments: z.ZodType;
      target?: (a: never) => Target;
    } = OPERATIONS[intent.operation];
    if (intent.capability !== spec.capability || intent.risk !== spec.risk) {
      context.addIssue({
        code: "custom",
        message: "capability or risk does not match the registry",
      });
    }
    const parsed = spec.arguments.safeParse(intent.arguments);
    if (!parsed.success) {
      context.addIssue({ code: "custom", message: "invalid arguments" });
      return;
    }
    const target = spec.target?.(parsed.data as never);
    if (JSON.stringify(target ?? null) !== JSON.stringify(intent.target ?? null)) {
      context.addIssue({ code: "custom", message: "target does not match the arguments" });
    }
  });
export type ActionIntent = z.infer<typeof actionIntent>;

/** Build a registry-consistent intent; the only way the planner makes one. */
export function intent<O extends Operation>(
  operation: O,
  key: string,
  args: z.input<(typeof OPERATIONS)[O]["arguments"]>,
  deadline: Date,
): ActionIntent {
  const spec: {
    capability: string;
    risk: string;
    arguments: z.ZodType;
    target?: (a: never) => Target;
  } = OPERATIONS[operation];
  const parsed = spec.arguments.parse(args) as Record<string, unknown>;
  const target = spec.target?.(parsed as never);
  return actionIntent.parse({
    v: PROTOCOL_VERSION,
    key,
    operation,
    capability: spec.capability,
    risk: spec.risk,
    arguments: parsed,
    ...(target ? { target } : {}),
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

/**
 * A fixed goal check, set when the task opens (`jarvis_tasks.outcome`). A check
 * with a `kind` is a typed predicate the separate verifier evaluates by reading
 * the real file, window or page; one without is settled by its own workflow's
 * verifier (Journey 1).
 */
export const outcomeCheck = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,60}$/),
  description: z.string().min(1).max(200),
  kind: z
    .enum([
      "file_exists",
      "file_contains",
      "workbook_cell_equals",
      "web_text_contains",
      "window_exists",
      "media_duration",
    ])
    .optional(),
  params: z
    .strictObject({
      path: workspacePath.optional(),
      text: z.string().min(1).max(500).optional(),
      sheet: z.string().max(31).optional(),
      cell: z
        .string()
        .regex(/^[A-Z]{1,3}[0-9]{1,7}$/)
        .optional(),
      value: z.union([z.string().max(500), z.number()]).optional(),
      url: httpsUrl.optional(),
      exe: exe.optional(),
    })
    .optional(),
});
export type OutcomeCheck = z.infer<typeof outcomeCheck>;

/** The settlement record: every fixed check lands in exactly one list. */
const verificationResult = z.object({
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
  z
    .object({
      op: z.literal("inventory"),
      apps: z.array(z.strictObject({ name: z.string().max(120), exe })).max(300),
      mcp: z
        .array(
          z.strictObject({
            id: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
            publisher: z.string().max(120),
            version: z.string().max(40),
            tools: z
              .array(
                z.strictObject({
                  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/),
                  risk: z.enum(RISKS),
                  description: z.string().max(200),
                  inputSchema: z.record(z.string(), z.unknown()),
                }),
              )
              .max(64),
          }),
        )
        .max(50)
        .default([]),
    })
    .strict(),
  z.object({ op: z.literal("receipt"), activityId: z.uuid(), receipt: actionReceipt }).strict(),
]);

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
