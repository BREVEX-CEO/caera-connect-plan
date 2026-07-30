/**
 * Generated-code sandbox server function (P21 production wiring).
 *
 * `createNodePermissionSandboxHost` is the only real isolation boundary in the
 * repository — a spawned Node process with the permission model, bounded
 * resources and declared outputs. It was imported by nothing but tests, so the
 * only host production could reach was the unavailable one, and
 * `runGeneratedSandbox` refused every request.
 *
 * It has to be a server function. The host statically imports
 * `node:child_process`, `node:fs/promises` and `node:os`; a client-reachable
 * import would either break the browser bundle or, worse, pull Node builtins
 * into it. The `await import()` inside the handler guarantees the module is
 * only ever resolved on the server.
 *
 * Executing model-written code is the single most dangerous capability here,
 * so the handler adds constraints of its own on top of the sandbox's:
 * authentication is required, network access is never granted from this
 * entry point, and the limits are capped server-side regardless of what the
 * caller asks for.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  runGeneratedSandbox,
  type GeneratedSandboxRequest,
  type GeneratedSandboxResult,
} from "@/lib/code/generated-sandbox";

/**
 * Ceilings the caller cannot raise.
 *
 * A client-supplied limit is a request, not an instruction. Letting a caller
 * name its own timeout or memory ceiling would make the limits decorative.
 */
const MAX_TIMEOUT_MS = 15_000;
const MAX_MEMORY_MB = 256;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_SCRIPT_CHARS = 100_000;

const sandboxInput = z.object({
  taskId: z.string().min(1).max(200),
  language: z.enum(["javascript", "python"]),
  script: z.string().min(1).max(MAX_SCRIPT_CHARS),
  inputs: z
    .array(z.object({ path: z.string().max(200), content: z.string().max(1_000_000) }))
    .max(20)
    .default([]),
  outputs: z
    .array(
      z.object({
        path: z.string().max(200),
        mediaType: z.string().max(100).default("application/octet-stream"),
        maxBytes: z.number().int().positive().optional(),
      }),
    )
    .max(20)
    .default([]),
  allowedImports: z.array(z.string().max(100)).max(50).default([]),
  timeoutMs: z.number().int().positive().max(MAX_TIMEOUT_MS).default(5_000),
  memoryMb: z.number().int().positive().max(MAX_MEMORY_MB).default(128),
});

export type SandboxRunResponse =
  | { ok: true; result: GeneratedSandboxResult }
  | { ok: false; reason: string };

export const runSandboxScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => sandboxInput.parse(raw))
  .handler(async ({ data }): Promise<SandboxRunResponse> => {
    // Server-only. Resolved here so Node builtins never enter a client bundle.
    const { createNodePermissionSandboxHost } = await import("@/lib/code/generated-sandbox-node");
    const host = createNodePermissionSandboxHost();

    const request: GeneratedSandboxRequest = {
      taskId: data.taskId,
      language: data.language,
      script: data.script,
      inputs: data.inputs.map((i) => ({ path: i.path, content: i.content })),
      outputs: data.outputs.map((o) => ({
        path: o.path,
        mediaType: o.mediaType,
        maxBytes: Math.min(o.maxBytes ?? MAX_OUTPUT_BYTES, MAX_OUTPUT_BYTES),
      })),
      allowedImports: data.allowedImports,
      /*
       * Never "approved" from this entry point. Granting network access to
       * generated code is a decision that needs its own approval flow with its
       * own audit trail, not a boolean a caller can set.
       */
      network: "disabled",
      limits: {
        wallTimeMs: Math.min(data.timeoutMs, MAX_TIMEOUT_MS),
        // CPU time is capped at wall time: a script cannot legitimately burn
        // more CPU than the wall clock it is allowed to run for.
        cpuTimeMs: Math.min(data.timeoutMs, MAX_TIMEOUT_MS),
        memoryMb: Math.min(data.memoryMb, MAX_MEMORY_MB),
        storageBytes: MAX_OUTPUT_BYTES,
        outputBytes: MAX_OUTPUT_BYTES,
      },
    };

    const outcome = await runGeneratedSandbox(request, host);
    /*
     * `SandboxOutcome` is `{ ok: boolean; data?: T; reason?: string }` rather
     * than a discriminated union, so `ok` alone does not guarantee `data`.
     * Checking both is not defensive noise: reporting success with no result
     * would hand the caller `undefined` where it expects a sandbox result.
     */
    if (outcome.ok && outcome.data) return { ok: true, result: outcome.data };
    return {
      ok: false,
      reason:
        outcome.reason ??
        (outcome.ok
          ? "The sandbox reported success but returned no result."
          : "The sandbox refused the request."),
    };
  });
