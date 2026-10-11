/**
 * The device side of JARVIS: enrollment, signed requests and the action exchange.
 *
 * ONE KEY PER DEVICE. A Device Agent or the OCADE app on a phone makes its own
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
import { isAllowed, needsConfirmation, refuseAction } from "./permissions";
import type { DeviceAction } from "./protocol";

type Admin = SupabaseClient<Database>;

export const PROTOCOL = contract;

/**
 * THE EMERGENCY STOP FOR ALL DEVICE WORK. Paused by an admin in Administration
 * (the `jarvis_execution` service control), or by the Worker variable
 * `JARVIS_EXECUTION_DISABLED=1` when the database itself is in doubt. While
 * paused no device receives work, every running action is cancelled at its
 * next check, and no task can start. Chat and ordinary answers keep working.
 */
let pausedCache: { at: number; paused: Set<string> } | null = null;
/**
 * `kind` narrows to one device family: the Device Agent (`agent`) and the
 * OCADE app on phones (`android`) can be paused on their own, and pausing all
 * device work pauses both.
 */
export async function executionDisabled(admin: Admin, kind?: string): Promise<boolean> {
  if (process.env.JARVIS_EXECUTION_DISABLED === "1") return true;
  // A few seconds of caching keeps a device's once-a-second exchange cheap.
  if (!pausedCache || Date.now() - pausedCache.at >= 5000) {
    const { data, error } = await admin
      .from("ocade_service_controls")
      .select("key, paused")
      .limit(10);
    if (error || !data) {
      // FAIL CLOSED: a stop nobody can read must still stop physical work.
      // Not cached, so the next exchange reads again and work resumes as soon
      // as the controls are readable.
      pausedCache = null;
      return true;
    }
    pausedCache = {
      at: Date.now(),
      paused: new Set(data.filter((row) => row.paused).map((row) => row.key)),
    };
  }
  return (
    pausedCache.paused.has("jarvis_execution") ||
    (kind !== undefined && pausedCache.paused.has(`jarvis_${kind}`))
  );
}
const ENROLLMENT_MS = 10 * 60_000;

/** A running task whose planning loop has not written for this long has no driver. */
export const ORPHAN_MS = 3 * 60_000;
const ORPHANED_BLOCKER =
  "Paused because JARVIS was closed. Resume to continue from where it stopped.";

/**
 * TRUTH ABOUT TASKS NOBODY DRIVES. The planning loop runs in an open OCADE
 * surface and touches its task every minute. When that surface closes, the
 * task would read "Working" for ever; instead it waits at its checkpoint, and
 * any surface resumes it. A task with work queued, running or awaiting the
 * person's confirmation is never paused here.
 */
export async function pauseOrphanedTasks(
  admin: Admin,
  scope: { deviceId: string } | { userId: string },
): Promise<number> {
  const cutoff = new Date(Date.now() - ORPHAN_MS).toISOString();
  let stale = admin
    .from("jarvis_tasks")
    .select("id")
    .eq("status", "running")
    .lt("updated_at", cutoff)
    .limit(10);
  stale =
    "deviceId" in scope ? stale.eq("device_id", scope.deviceId) : stale.eq("user_id", scope.userId);
  const { data: tasks } = await stale;
  let paused = 0;
  for (const task of tasks ?? []) {
    const { data: busy, error } = await admin
      .from("jarvis_activity")
      .select("id")
      .eq("task_id", task.id)
      .in("status", ["queued", "claimed"])
      .limit(1);
    if (error || busy?.length) continue; // the device is working on it, or we cannot tell
    const { data: done } = await admin
      .from("jarvis_tasks")
      .update({ status: "waiting", blocker: ORPHANED_BLOCKER })
      .eq("id", task.id)
      .eq("status", "running")
      .lt("updated_at", cutoff)
      .select("id");
    if (done?.length) {
      // A confirmation nobody is left to answer is withdrawn; Resume asks again.
      await admin
        .from("jarvis_activity")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("task_id", task.id)
        .eq("status", "needs_confirmation");
      paused += 1;
    }
  }
  return paused;
}
/**
 * Enrollment is public (a device has no account yet), so waiting requests are
 * capped: each expires in ten minutes, and past this many at once new ones
 * are asked to try again rather than filling the table.
 */
const MAX_PENDING_ENROLLMENTS = 5000;
/**
 * And per source: one address may hold only a few at once. The total alone
 * was 200, which one script generating key pairs could fill, stopping every
 * new computer everywhere from connecting.
 */
export const MAX_PENDING_PER_SOURCE = 5;

/** Who is asking, as a hash: an IPv6 client is its /64, which one host controls whole. */
export async function enrollmentSource(request: Request): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  // ponytail: "::"-compressed addresses group slightly differently; still one bucket per network.
  return sha256Hex(ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip);
}

/** Room for one more pending enrollment, from this source and in total. Unreadable is no room. */
export async function enrollmentRoom(admin: Admin, source: string): Promise<boolean> {
  const pending = () =>
    admin.from("jarvis_devices").select("id", { count: "exact", head: true }).is("user_id", null);
  const [all, mine] = await Promise.all([pending(), pending().eq("enrollment_source", source)]);
  if (all.error || mine.error) return false;
  return (all.count ?? 0) < MAX_PENDING_ENROLLMENTS && (mine.count ?? 0) < MAX_PENDING_PER_SOURCE;
}

async function sha256Hex(value: string | Uint8Array<ArrayBuffer>): Promise<string> {
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
    // 409, not 401: a wrong clock is fixable and must never read as "removed".
    return { ok: false, status: 409, error: "clock_skew" };
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

const enrollInput = z.object({
  publicKey: publicKeyText,
  name: z.string().trim().min(1).max(120),
  platform: z.string().trim().max(60).optional(),
  kind: z.enum(["agent", "android"]),
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
  const source = await enrollmentSource(request);
  if (!(await enrollmentRoom(admin, source))) {
    return { status: 429, body: { error: "busy" } };
  }
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
      enrollment_source: source,
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
  | { ok: true; id: string; userId: string; kind: string; body: unknown }
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
    .select("id, user_id, kind, public_key, revoked_at, enrollment_expires_at")
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
  if (!advanced) return { ok: false, status: 409, error: "replayed" };
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
  return { ok: true, id: device.id, userId: device.user_id, kind: device.kind, body };
}

/**
 * Replace this device's key, signed by the key being replaced. The device
 * rotates on its own schedule; the person never sees it.
 */
async function rotateKey(admin: Admin, deviceId: string, publicKey: string): Promise<boolean> {
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

/**
 * The last line of defence for what a device says in Activity: local paths
 * and the user names inside them never reach the account's cloud history.
 */
export function redactLocal(text: string): string {
  return text
    .replace(/\\\\[^\s"'<>|]+/g, "[path]")
    .replace(/\b[A-Za-z]:[\\/][^\s"'<>|]*/g, "[path]")
    .replace(/(?:~|\/(?:Users|home|root|var\/folders))\/[^\s"'<>|]*/g, "[path]");
}

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
  /** The action the device is executing now; the reply says whether to cancel it. */
  running: z.array(z.string().uuid()).max(1).optional(),
  /** STOP JARVIS from the computer's own tray. */
  stop: z.boolean().optional(),
  /** Pause from the tray: the person takes control of this computer's task. */
  pause: z.boolean().optional(),
  /** Resume from the tray: the task continues from a fresh observation. */
  resume: z.boolean().optional(),
  /** The device disconnects itself (Disconnect, or uninstall): its key stops working. */
  forget: z.boolean().optional(),
  rotate: z.object({ publicKey: publicKeyText }).optional(),
});

/** Matches how long the planning loop waits for one action. */
const ACTION_TTL_MS = 120_000;

export interface DeviceCommand {
  id: string;
  taskId: string;
  action: Record<string, unknown>;
  confirmed: boolean;
  mode: "isolated" | "real";
  /** The person chose to work alongside JARVIS: their input does not pause it. */
  cowork: boolean;
  /** Sites the person allowed; only these may resolve to a private network address. */
  sites: string[];
}

export async function exchange(
  admin: Admin,
  device: { id: string; userId: string; kind?: string },
  input: z.infer<typeof exchangeInput>,
): Promise<{
  protocol: number;
  deviceId: string;
  busy: boolean;
  background: boolean;
  /** The open task, for the tray: title, progress and status only. */
  task: { title: string; step: number; steps: number; status: string } | null;
  commands: DeviceCommand[];
  /** Running actions the device must cancel now (STOP, Take Over, task ended). */
  cancel: string[];
  /** What happened to each reported result: kept, or why not; "retry": send it again. */
  acks?: { id: string; outcome: "accepted" | "stopped" | "unknown" | "retry" }[];
  /** Background Mode: the running task this computer should ask OCADE to continue now. */
  continue?: string;
  rotated?: boolean;
}> {
  if (input.forget) {
    const at = new Date().toISOString();
    // Work ends first and the key last: a failure leaves a key that can ask again.
    const ended = await Promise.all([
      admin
        .from("jarvis_activity")
        .update({ status: "cancelled", completed_at: at })
        .eq("device_id", device.id)
        .in("status", ["queued", "needs_confirmation", "claimed"]),
      admin
        .from("jarvis_tasks")
        .update({ status: "stopped", blocker: "The device was disconnected." })
        .eq("device_id", device.id)
        .in("status", ["running", "waiting", "taken_over"]),
    ]);
    const failed = ended.find((write) => write.error);
    if (failed?.error) throw new Error(failed.error.message);
    const revoked = await admin
      .from("jarvis_devices")
      .update({ revoked_at: at, public_key: null })
      .eq("id", device.id)
      .select("id");
    if (revoked.error) throw new Error(revoked.error.message);
    if (revoked.data?.length !== 1) throw new Error("The device was not disconnected.");
    return {
      protocol: PROTOCOL.version,
      deviceId: device.id,
      busy: false,
      background: false,
      task: null,
      commands: [],
      cancel: input.running ?? [],
    };
  }
  if (input.stop) {
    // The global Stop: every unfinished task on this device ends, and nothing
    // queued, waiting or running for it continues.
    const at = new Date().toISOString();
    const stopped = await Promise.all([
      admin
        .from("jarvis_tasks")
        .update({ status: "stopped", blocker: "Stopped from the computer." })
        .eq("device_id", device.id)
        .in("status", ["running", "waiting", "taken_over"]),
      admin
        .from("jarvis_activity")
        .update({ status: "cancelled", completed_at: at })
        .eq("device_id", device.id)
        .in("status", ["queued", "needs_confirmation", "claimed"]),
    ]);
    // Unsaved, the computer must not believe its STOP arrived: it keeps asking.
    const failed = stopped.find((write) => write.error);
    if (failed?.error) throw new Error(failed.error.message);
  }
  const toggled =
    input.pause && !input.stop
      ? await admin
          .from("jarvis_tasks")
          .update({ status: "taken_over", blocker: "Paused on the computer." })
          .eq("device_id", device.id)
          .in("status", ["running", "waiting"])
      : input.resume && !input.stop
        ? await admin
            .from("jarvis_tasks")
            .update({ status: "running", blocker: null })
            .eq("device_id", device.id)
            .eq("status", "taken_over")
        : null;
  if (toggled?.error) throw new Error(toggled.error.message);
  // A task nobody drives waits at its checkpoint, unless this computer may
  // carry on with it (Background Mode): then it is told to ask for the next step.
  const { taskToCarryOn } = await import("./background.server");
  const carry = await taskToCarryOn(admin, device);
  if (!carry) await pauseOrphanedTasks(admin, { deviceId: device.id });
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
  const acks: { id: string; outcome: "accepted" | "stopped" | "unknown" | "retry" }[] = [];
  const envelope = {
    acks,
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
    // A person decides a confirmation; the result says one is needed. A stale action did not
    // happen (the screen changed first): recorded as not done, never as "done".
    const status = result.status === "stale" ? "failed" : result.status;
    const outcome = JSON.stringify({
      status: result.status,
      changed: result.changed ?? [],
      observation: result.observation ?? null,
      ...(result.detail === undefined ? {} : { detail: result.detail }),
    });
    const { data: settled, error: settleError } = await admin
      .from("jarvis_activity")
      .update({
        status,
        ...(result.summary ? { summary: redactLocal(result.summary).slice(0, 300) } : {}),
        result:
          outcome.length <= 40_000
            ? JSON.parse(outcome)
            : { status: result.status, truncated: true },
        completed_at: status === "needs_confirmation" ? null : now,
      })
      .eq("id", result.id)
      .eq("device_id", device.id)
      .eq("status", "claimed")
      .select("id");
    if (settled?.length) {
      acks.push({ id: result.id, outcome: "accepted" });
      continue;
    }
    // Not saved: the device keeps this result and sends it again, never drops the only copy.
    if (settleError) {
      acks.push({ id: result.id, outcome: "retry" });
      continue;
    }
    // A result for an action that was stopped meanwhile never counts as done;
    // it is kept only as the device's acknowledgement of the Stop.
    const { data: stopped, error: stopError } = await admin
      .from("jarvis_activity")
      .update({ result: { status: "stopped", late: result.status } })
      .eq("id", result.id)
      .eq("device_id", device.id)
      .eq("status", "cancelled")
      .is("result", null)
      .select("id");
    acks.push({
      id: result.id,
      outcome: stopError ? "retry" : stopped?.length ? "stopped" : "unknown",
    });
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

  // The action the device runs now continues only while it is still claimed
  // and its task still running; anything else (STOP, Take Over, the task
  // ended, the action timed out) cancels it on the device.
  if (await executionDisabled(admin, device.kind)) {
    return { ...envelope, commands: [], cancel: input.running ?? [], rotated };
  }
  const cancel: string[] = [];
  if (input.running?.length) {
    const { data: live } = await admin
      .from("jarvis_activity")
      .select("id, status, task_id")
      .eq("device_id", device.id)
      .in("id", input.running)
      .limit(1);
    const { data: liveTasks } = await admin
      .from("jarvis_tasks")
      .select("id")
      .eq("device_id", device.id)
      .eq("status", "running")
      .in(
        "id",
        (live ?? []).map((row) => row.task_id),
      )
      .limit(1);
    const runningTasks = new Set((liveTasks ?? []).map((task) => task.id));
    for (const id of input.running) {
      const row = live?.find((r) => r.id === id);
      if (!row || row.status !== "claimed" || !runningTasks.has(row.task_id)) cancel.push(id);
    }
    // One action at a time owns the device: nothing new while one runs.
    return { ...envelope, commands: [], cancel, rotated };
  }

  const { data: queued } = await admin
    .from("jarvis_activity")
    .select("id, task_id, action, confirmed")
    .eq("device_id", device.id)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);
  if (!queued?.length) {
    return { ...envelope, commands: [], cancel, rotated, ...(carry ? { continue: carry } : {}) };
  }
  const row = queued[0];

  const [
    { data: task, error: taskError },
    { data: rows, error: rowsError },
    { data: deviceRow, error: deviceError },
  ] = await Promise.all([
    admin
      .from("jarvis_tasks")
      .select("id, browser_mode")
      .eq("id", row.task_id)
      .eq("device_id", device.id)
      .eq("status", "running")
      .maybeSingle(),
    admin
      .from("jarvis_permissions")
      .select("capability, allowed, device_id")
      .eq("user_id", device.userId)
      .limit(500),
    admin
      .from("jarvis_devices")
      .select("capabilities")
      .eq("id", device.id)
      .is("revoked_at", null)
      .maybeSingle(),
  ]);
  // Nothing leaves for the device unless its task, the person's permissions and
  // the device itself were all read: an unreadable permission is not a default.
  if (!task || taskError || rowsError || deviceError || !rows) {
    return { ...envelope, commands: [], cancel, rotated };
  }
  const permissions = rows;
  const action = row.action as DeviceAction;
  const mode = task.browser_mode as "isolated" | "real";
  // Permission is checked again when the action leaves for the device, not
  // only when it was queued: a switch turned off meanwhile stops it here.
  const refusal = deviceRow
    ? refuseAction(permissions, {
        deviceId: device.id,
        mode,
        action,
        offered: (deviceRow.capabilities ?? {}) as Record<string, boolean>,
      })
    : { message: "This device was removed." };
  if (refusal || (needsConfirmation(permissions, action, device.id) && !row.confirmed)) {
    await admin
      .from("jarvis_activity")
      .update({
        status: "cancelled",
        completed_at: now,
        result: { status: "refused", reason: refusal?.message ?? "Needs confirmation again." },
      })
      .eq("id", row.id)
      .eq("status", "queued");
    return { ...envelope, commands: [], cancel, rotated };
  }

  const { data: claimed } = await admin
    .from("jarvis_activity")
    .update({ status: "claimed" })
    .eq("id", row.id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (!claimed) return { ...envelope, commands: [], cancel, rotated };
  return {
    ...envelope,
    commands: [
      {
        id: row.id,
        taskId: row.task_id,
        action: row.action as Record<string, unknown>,
        confirmed: row.confirmed,
        mode,
        cowork: isAllowed(permissions, "cowork", device.id),
        sites: permissions
          .filter((p) => p.allowed && p.device_id === null && p.capability.startsWith("site:"))
          .map((p) => p.capability.slice(5)),
      },
    ],
    cancel,
    rotated,
  };
}
