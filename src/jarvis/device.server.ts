/**
 * The paired-device side of JARVIS: pairing and the action exchange.
 *
 * A device authenticates with a random bearer token whose SHA-256 is the only
 * thing stored. Every write here is scoped to the device the token names, so
 * one device cannot claim, complete or observe another device's actions, and
 * nothing a device sends can change a permission or a task's status.
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function token(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const pairInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .transform((code) => code.replace(/-/g, ""))
    .pipe(z.string().regex(/^[A-Z0-9]{8}$/)),
  name: z.string().trim().min(1).max(120),
  platform: z.string().trim().max(60).optional(),
});

export async function pairDevice(
  admin: Admin,
  input: z.infer<typeof pairInput>,
  now = new Date(),
): Promise<{ deviceId: string; token: string } | null> {
  const secret = token();
  const { data, error } = await admin
    .from("jarvis_devices")
    .update({
      token_hash: await sha256Hex(secret),
      pairing_code_hash: null,
      pairing_expires_at: null,
      name: input.name,
      platform: input.platform ?? null,
      last_seen_at: now.toISOString(),
    })
    .eq("pairing_code_hash", await sha256Hex(input.code))
    .is("token_hash", null)
    .is("revoked_at", null)
    .gt("pairing_expires_at", now.toISOString())
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { deviceId: data.id, token: secret } : null;
}

const RESULT_STATUSES = [
  "done",
  "failed",
  "blocked",
  "human_required",
  "needs_confirmation",
  "stale",
] as const;

export const exchangeInput = z.object({
  results: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(RESULT_STATUSES),
        summary: z.string().max(300).optional(),
        changed: z.array(z.string().max(20)).max(10).optional(),
        observation: z.unknown().optional(),
      }),
    )
    .max(20),
  frame: z
    .object({ taskId: z.string().uuid(), jpeg: z.string().max(400_000) })
    .nullable()
    .optional(),
  capabilities: z.record(z.string().max(40), z.boolean()).optional(),
});

export interface DeviceCommand {
  id: string;
  taskId: string;
  action: Record<string, unknown>;
  confirmed: boolean;
  mode: "isolated" | "real";
}

export async function exchange(
  admin: Admin,
  bearer: string,
  input: z.infer<typeof exchangeInput>,
): Promise<{ commands: DeviceCommand[] } | null> {
  const { data: device, error } = await admin
    .from("jarvis_devices")
    .select("id, user_id")
    .eq("token_hash", await sha256Hex(bearer))
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!device) return null;
  const now = new Date().toISOString();

  await admin
    .from("jarvis_devices")
    .update({
      last_seen_at: now,
      ...(input.capabilities ? { capabilities: input.capabilities } : {}),
    })
    .eq("id", device.id);

  for (const result of input.results) {
    // A person decides a confirmation; the result says one is needed.
    const status = result.status === "stale" ? "done" : result.status;
    const outcome = JSON.stringify({
      status: result.status,
      changed: result.changed ?? [],
      observation: result.observation ?? null,
    });
    await admin
      .from("jarvis_activity")
      .update({
        status,
        ...(result.summary ? { summary: result.summary.slice(0, 300) } : {}),
        result:
          outcome.length <= 60_000
            ? JSON.parse(outcome)
            : { status: result.status, truncated: true },
        completed_at: status === "needs_confirmation" ? null : now,
      })
      .eq("id", result.id)
      .eq("device_id", device.id)
      .eq("status", "claimed");
  }

  if (input.frame) {
    await admin
      .from("jarvis_tasks")
      .update({ live_frame: input.frame.jpeg })
      .eq("id", input.frame.taskId)
      .eq("device_id", device.id)
      .in("status", ["running", "waiting", "taken_over"]);
  }

  const { data: queued } = await admin
    .from("jarvis_activity")
    .select("id, task_id, action, confirmed")
    .eq("device_id", device.id)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(5);
  if (!queued?.length) return { commands: [] };

  const { data: tasks } = await admin
    .from("jarvis_tasks")
    .select("id, browser_mode")
    .eq("device_id", device.id)
    .eq("status", "running")
    .in(
      "id",
      queued.map((row) => row.task_id),
    )
    .limit(5);
  const running = new Map((tasks ?? []).map((task) => [task.id, task.browser_mode]));

  const commands: DeviceCommand[] = [];
  for (const row of queued) {
    const mode = running.get(row.task_id);
    if (!mode) continue;
    const { data: claimed } = await admin
      .from("jarvis_activity")
      .update({ status: "claimed" })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (claimed) {
      commands.push({
        id: row.id,
        taskId: row.task_id,
        action: row.action as Record<string, unknown>,
        confirmed: row.confirmed,
        mode: mode as "isolated" | "real",
      });
    }
  }
  return { commands };
}
