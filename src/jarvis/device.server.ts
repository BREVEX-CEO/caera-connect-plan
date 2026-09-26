/**
 * The device side of JARVIS: enrollment, signed requests and the action exchange.
 *
 * ONE KEY PER DEVICE. A Device Agent or the browser extension makes its own
 * P-256 key pair and enrolls only the public key; every request is signed over
 * the protocol version, method, path, device, a strictly increasing timestamp
 * and the body's hash (see `jarvis-runtime/ocade_protocol.json`, the one
 * contract all three sides read). The server stores nothing that could
 * impersonate a device, a captured request cannot be replayed, and every write
 * here is scoped to the device the signature proves — so one device cannot
 * claim, complete or observe another's actions, and nothing a device sends can
 * change a permission or a task's status.
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import contract from "../../jarvis-runtime/ocade_protocol.json";

type Admin = SupabaseClient<Database>;

export const PROTOCOL = contract;
const ENROLLMENT_MS = 10 * 60_000;

export async function sha256Hex(value: string | Uint8Array<ArrayBuffer>): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (c) =>
    c.charCodeAt(0),
  );
}

const publicKeyText = z.string().regex(/^[A-Za-z0-9_-]{80,200}$/);

async function importKey(publicKey: string): Promise<CryptoKey | null> {
  try {
    return await crypto.subtle.importKey(
      "spki",
      fromBase64Url(publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }
}

/** The text a device signs. Every side builds exactly this string. */
export async function canonical(input: {
  protocol: number;
  method: string;
  path: string;
  deviceId: string;
  timestamp: number;
  body: string;
}): Promise<string> {
  return [
    PROTOCOL.signing.prefix,
    String(input.protocol),
    input.method.toUpperCase(),
    input.path,
    input.deviceId,
    String(input.timestamp),
    await sha256Hex(input.body),
  ].join("\n");
}

/** A short, human-comparable fingerprint of a public key. */
export async function fingerprint(publicKey: string): Promise<string> {
  const hex = (await sha256Hex(publicKey)).slice(0, 16).toUpperCase();
  return hex.match(/.{4}/g)!.join("-");
}

export type SignedRequest =
  | { ok: true; body: string; deviceId: string; timestamp: number; protocol: number }
  | { ok: false; status: number; error: string };

/** Read the protocol headers and body. Signature checking needs the stored key. */
export async function readSigned(request: Request): Promise<SignedRequest> {
  const h = PROTOCOL.headers;
  const protocol = Number(request.headers.get(h.protocol));
  if (!Number.isInteger(protocol) || protocol < PROTOCOL.minimumVersion) {
    // Fail closed, and say what to become: the agent updates itself on this.
    return { ok: false, status: 426, error: "update_required" };
  }
  if (protocol > PROTOCOL.version) return { ok: false, status: 400, error: "unknown_protocol" };
  const timestamp = Number(request.headers.get(h.timestamp));
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(Date.now() - timestamp) > PROTOCOL.signing.skewSeconds * 1000
  ) {
    return { ok: false, status: 401, error: "clock_skew" };
  }
  const body = await request.text();
  if (body.length > 600_000) return { ok: false, status: 413, error: "too_large" };
  return {
    ok: true,
    body,
    deviceId: request.headers.get(h.device) ?? "-",
    timestamp,
    protocol,
  };
}

export async function verifySignature(
  request: Request,
  signed: Extract<SignedRequest, { ok: true }>,
  publicKey: string,
): Promise<boolean> {
  const key = await importKey(publicKey);
  const signature = request.headers.get(PROTOCOL.headers.signature);
  if (!key || !signature || !/^[A-Za-z0-9_-]{80,90}$/.test(signature)) return false;
  const text = await canonical({
    protocol: signed.protocol,
    method: request.method,
    path: new URL(request.url).pathname,
    deviceId: signed.deviceId,
    timestamp: signed.timestamp,
    body: signed.body,
  });
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    fromBase64Url(signature),
    new TextEncoder().encode(text),
  );
}

export const enrollInput = z.object({
  publicKey: publicKeyText,
  name: z.string().trim().min(1).max(120),
  platform: z.string().trim().max(60).optional(),
  kind: z.enum(["agent", "extension"]),
  softwareVersion: z.string().trim().max(40).optional(),
});

/**
 * A new device announces its public key and proves it holds the private half
 * (the enroll request itself is signed). The row belongs to nobody until a
 * signed-in person approves it in OCADE.
 */
export async function enroll(
  admin: Admin,
  request: Request,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const signed = await readSigned(request);
  if (!signed.ok) return { status: signed.status, body: { error: signed.error } };
  let parsed: z.infer<typeof enrollInput>;
  try {
    parsed = enrollInput.parse(JSON.parse(signed.body));
  } catch {
    return { status: 400, body: { error: "invalid_request" } };
  }
  if (signed.deviceId !== "-" || !(await verifySignature(request, signed, parsed.publicKey))) {
    return { status: 401, body: { error: "signature_invalid" } };
  }
  // Enrollments nobody approved in time leave nothing behind.
  await admin
    .from("jarvis_devices")
    .delete()
    .is("user_id", null)
    .lt("enrollment_expires_at", new Date().toISOString());
  const { data, error } = await admin
    .from("jarvis_devices")
    .insert({
      name: parsed.name,
      platform: parsed.platform ?? null,
      kind: parsed.kind,
      software_version: parsed.softwareVersion ?? null,
      protocol_version: signed.protocol,
      public_key: parsed.publicKey,
      enrollment_expires_at: new Date(Date.now() + ENROLLMENT_MS).toISOString(),
      last_request_ms: signed.timestamp,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return { status: 409, body: { error: "already_enrolled" } };
  if (error) throw new Error(error.message);
  return {
    status: 200,
    body: {
      deviceId: data.id,
      fingerprint: await fingerprint(parsed.publicKey),
      approve: `/ocade-jarvis?connect=${data.id}`,
    },
  };
}

export type DeviceIdentity =
  | { ok: true; id: string; userId: string; body: unknown }
  | { ok: false; status: number; error: string };

/**
 * The device a signed request proves, after its replay guard has advanced.
 * A pending enrollment answers 202 until a person approves it.
 */
export async function authenticate(admin: Admin, request: Request): Promise<DeviceIdentity> {
  const signed = await readSigned(request);
  if (!signed.ok) return signed;
  if (!z.string().uuid().safeParse(signed.deviceId).success) {
    return { ok: false, status: 401, error: "device_not_enrolled" };
  }
  const { data: device, error } = await admin
    .from("jarvis_devices")
    .select("id, user_id, public_key, revoked_at, enrollment_expires_at")
    .eq("id", signed.deviceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!device?.public_key || device.revoked_at) {
    return { ok: false, status: 401, error: "device_not_enrolled" };
  }
  if (!(await verifySignature(request, signed, device.public_key))) {
    return { ok: false, status: 401, error: "signature_invalid" };
  }
  const { data: advanced } = await admin
    .from("jarvis_devices")
    .update({
      last_request_ms: signed.timestamp,
      protocol_version: signed.protocol,
      ...(device.user_id ? { last_seen_at: new Date().toISOString() } : {}),
    })
    .eq("id", device.id)
    .lt("last_request_ms", signed.timestamp)
    .select("id")
    .maybeSingle();
  if (!advanced) return { ok: false, status: 401, error: "replayed" };
  if (!device.user_id) {
    return Date.parse(device.enrollment_expires_at ?? "") > Date.now()
      ? { ok: false, status: 202, error: "awaiting_approval" }
      : { ok: false, status: 410, error: "enrollment_expired" };
  }
  let body: unknown = null;
  try {
    body = signed.body ? JSON.parse(signed.body) : {};
  } catch {
    return { ok: false, status: 400, error: "invalid_request" };
  }
  return { ok: true, id: device.id, userId: device.user_id, body };
}

/**
 * Replace this device's key, signed by the key being replaced. The device
 * rotates on its own schedule; the person never sees it.
 */
export async function rotateKey(
  admin: Admin,
  deviceId: string,
  publicKey: string,
): Promise<boolean> {
  if (!publicKeyText.safeParse(publicKey).success || !(await importKey(publicKey))) return false;
  const { data, error } = await admin
    .from("jarvis_devices")
    .update({ public_key: publicKey, key_rotated_at: new Date().toISOString() })
    .eq("id", deviceId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return Boolean(data);
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
        /** What a computer action returned: a listing, file text, command output. */
        detail: z.unknown().optional(),
      }),
    )
    .max(20),
  frame: z
    .object({ taskId: z.string().uuid(), jpeg: z.string().max(400_000) })
    .nullable()
    .optional(),
  capabilities: z.record(z.string().max(40), z.boolean()).optional(),
  softwareVersion: z.string().trim().max(40).optional(),
  apps: z.array(z.string().max(80)).max(300).optional(),
  /** STOP JARVIS from the computer's own tray or mini-control. */
  stop: z.boolean().optional(),
  /** The device disconnects itself (Disconnect, or uninstall): its key stops working. */
  forget: z.boolean().optional(),
  rotate: z.object({ publicKey: publicKeyText }).optional(),
});

/** Matches how long the planning loop waits for one action. */
export const ACTION_TTL_MS = 120_000;

export interface DeviceCommand {
  id: string;
  taskId: string;
  action: Record<string, unknown>;
  confirmed: boolean;
  mode: "isolated" | "real";
  /** The person chose to work alongside JARVIS: their input does not pause it. */
  cowork: boolean;
}

export async function exchange(
  admin: Admin,
  device: { id: string; userId: string },
  input: z.infer<typeof exchangeInput>,
): Promise<{
  protocol: number;
  deviceId: string;
  busy: boolean;
  background: boolean;
  /** The open task, for the tray and mini-control: title and progress only. */
  task: { title: string; step: number; steps: number; status: string } | null;
  commands: DeviceCommand[];
  rotated?: boolean;
}> {
  if (input.forget) {
    const at = new Date().toISOString();
    await admin
      .from("jarvis_tasks")
      .update({ status: "stopped", blocker: "The device was disconnected." })
      .eq("device_id", device.id)
      .in("status", ["running", "waiting", "taken_over"]);
    await admin
      .from("jarvis_devices")
      .update({ revoked_at: at, public_key: null })
      .eq("id", device.id);
    return {
      protocol: PROTOCOL.version,
      deviceId: device.id,
      busy: false,
      background: false,
      task: null,
      commands: [],
    };
  }
  if (input.stop) {
    // The global Stop: every unfinished task on this device ends, and nothing
    // queued for it runs.
    const at = new Date().toISOString();
    await admin
      .from("jarvis_tasks")
      .update({ status: "stopped", blocker: "Stopped from the computer." })
      .eq("device_id", device.id)
      .in("status", ["running", "waiting", "taken_over"]);
    await admin
      .from("jarvis_activity")
      .update({ status: "cancelled", completed_at: at })
      .eq("device_id", device.id)
      .in("status", ["queued", "needs_confirmation"]);
  }
  const [{ data: open }, { data: self }] = await Promise.all([
    admin
      .from("jarvis_tasks")
      .select("title, current_step, plan, status")
      .eq("device_id", device.id)
      .in("status", ["running", "waiting", "taken_over"])
      .limit(1),
    admin.from("jarvis_devices").select("background_enabled").eq("id", device.id).maybeSingle(),
  ]);
  // Every reply names the protocol and the device it is for, so a device can
  // refuse work that was not addressed to it; `busy` and `background` decide
  // whether it stays active or goes dormant.
  const envelope = {
    protocol: PROTOCOL.version,
    deviceId: device.id,
    busy: Boolean(open?.length),
    background: Boolean(self?.background_enabled),
    task: open?.[0]
      ? {
          title: open[0].title,
          step: open[0].current_step,
          steps: (open[0].plan as string[]).length,
          status: open[0].status,
        }
      : null,
  };
  const now = new Date().toISOString();

  if (input.capabilities || input.softwareVersion || input.apps) {
    await admin
      .from("jarvis_devices")
      .update({
        ...(input.capabilities ? { capabilities: input.capabilities } : {}),
        ...(input.softwareVersion ? { software_version: input.softwareVersion } : {}),
        ...(input.apps ? { installed_apps: input.apps } : {}),
      })
      .eq("id", device.id);
  }
  const rotated = input.rotate
    ? await rotateKey(admin, device.id, input.rotate.publicKey)
    : undefined;

  for (const result of input.results) {
    // A person decides a confirmation; the result says one is needed.
    const status = result.status === "stale" ? "done" : result.status;
    const outcome = JSON.stringify({
      status: result.status,
      changed: result.changed ?? [],
      observation: result.observation ?? null,
      ...(result.detail === undefined ? {} : { detail: result.detail }),
    });
    await admin
      .from("jarvis_activity")
      .update({
        status,
        ...(result.summary ? { summary: result.summary.slice(0, 300) } : {}),
        result:
          outcome.length <= 40_000
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

  // An action nobody ran in time never runs later against a page that moved on,
  // and one a device claimed but never answered is reported as failed.
  await admin
    .from("jarvis_activity")
    .update({ status: "cancelled", completed_at: now })
    .eq("device_id", device.id)
    .eq("status", "queued")
    .lt("created_at", new Date(Date.now() - ACTION_TTL_MS).toISOString());
  await admin
    .from("jarvis_activity")
    .update({ status: "failed", completed_at: now })
    .eq("device_id", device.id)
    .eq("status", "claimed")
    .lt("created_at", new Date(Date.now() - 2 * ACTION_TTL_MS).toISOString());

  const { data: queued } = await admin
    .from("jarvis_activity")
    .select("id, task_id, action, confirmed")
    .eq("device_id", device.id)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(5);
  if (!queued?.length) return { ...envelope, commands: [], rotated };

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
  const { data: cowork } = await admin
    .from("jarvis_permissions")
    .select("allowed, device_id")
    .eq("user_id", device.userId)
    .eq("capability", "cowork")
    .limit(50);
  const coworking =
    (cowork ?? []).find((row) => row.device_id === device.id)?.allowed ??
    (cowork ?? []).find((row) => row.device_id === null)?.allowed ??
    false;

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
        cowork: coworking,
      });
    }
  }
  return { ...envelope, commands, rotated };
}
