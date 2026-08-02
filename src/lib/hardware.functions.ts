/**
 * Hardware detection server function (W2 production wiring).
 *
 * Node-only, for the same reason `sandbox.functions.ts` is: the measurement
 * imports `node:os`, `node:fs/promises` and `node:child_process`, and a
 * client-reachable import would pull Node builtins into the browser bundle. The
 * `await import()` inside the handler keeps it on the server.
 *
 * What it returns is deliberately narrow. The raw snapshot carries a CPU model
 * string and adapter names; the profile carries rounded sizes and a sentence.
 * Only the profile crosses to the client, so nothing machine-identifying is
 * handed to the page beyond what the user is being told anyway.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { profileFrom, type HardwareProfile } from "@/lib/hardware/detect";

export const detectHardwareFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<HardwareProfile> => {
    const { measureHardware } = await import("@/lib/hardware/detect.node");
    return profileFrom(await measureHardware());
  });
