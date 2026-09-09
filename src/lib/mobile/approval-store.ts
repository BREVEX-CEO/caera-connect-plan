/**
 * The shared approval queue (Plan §27) — in the account, where both sides see it.
 *
 * The producer and the consumer are on DIFFERENT DEVICES: the desktop Copilot
 * raises an approval when an action needs a human decision, and the phone
 * answers it. This queue lived in `localStorage`, which meant the two surfaces
 * could never see the same list — the mobile approvals panel had no producer at
 * all, it was permanently empty, and a desktop waiting on a decision waited
 * forever.
 *
 * A DECISION IS ONE STATEMENT. `ocade_decide_approval` updates only a row that
 * is still pending and still in date, and returns nothing otherwise. The browser
 * version read, decided and wrote back, so two phones answering at the same
 * moment could both believe they had decided it and the second would silently
 * overwrite the first. Here exactly one of them decides and the other is told it
 * was already answered.
 *
 * WHAT IS STORED IS ALREADY REDACTED — a summary reaches this having been
 * through `redactForAudit`, and protected input never reaches it at all.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { LIST_CAP } from "@/lib/supabase/read-all";
import { APPROVAL_TTL_MS, expireIfDue, type ApprovalRequest, type ApprovalStatus } from "./pairing";
import { notify, approvalNotification, expiredNotification } from "./notifications";

const COLUMNS =
  "id, summary, risk, status, requested_at, expires_at, decided_by_device, decided_at";

interface ApprovalRow {
  id: string;
  summary: string;
  risk: ApprovalRequest["risk"];
  status: ApprovalStatus;
  requested_at: string;
  expires_at: string;
  decided_by_device: string | null;
  decided_at: string | null;
}

function toRequest(row: ApprovalRow): ApprovalRequest {
  return {
    id: row.id,
    summary: row.summary,
    risk: row.risk,
    requestedAt: new Date(row.requested_at),
    expiresAt: new Date(row.expires_at),
    status: row.status,
    decidedByDeviceId: row.decided_by_device ?? undefined,
    decidedAt: row.decided_at ? new Date(row.decided_at) : undefined,
  };
}

/**
 * Every approval, expiring any that lapsed while nothing was watching.
 *
 * Expiry is applied on READ, by the server, so a request cannot appear
 * "pending" forever just because no tab was open when it lapsed — and so every
 * surface agrees on the state without a background job that has to be healthy.
 *
 * A request that expires here also NOTIFIES, because somebody was waiting on a
 * decision that will now never happen. Flipping it silently would leave them
 * expecting an outcome that never arrives.
 */
export async function listApprovals(now: Date = new Date()): Promise<ApprovalRequest[]> {
  try {
    const supabase = await loadSupabaseClient();

    /*
     * EXPIRY FIRST, AND ITS FAILURE IS FATAL TO THE READ. If expiry could not
     * run, a request that lapsed may still be stored as pending — and rendering
     * that is exactly how somebody approves an action whose moment has passed.
     * Showing nothing is the safe answer; showing a maybe-stale list is not.
     */
    const { data: lapsed, error: expiryError } = await supabase.rpc("ocade_expire_due_approvals");
    if (expiryError) throw new Error(expiryError.message);
    for (const row of (lapsed as ApprovalRow[] | null) ?? []) {
      void notify(expiredNotification(toRequest(row)));
    }

    /*
     * BOUNDED, and honestly so. What this list is for is "what needs me now":
     * a pending approval lapses in two minutes, and decided ones are pruned.
     * The newest few hundred is every approval anybody could act on, and an
     * unbounded read of a table that grows with use is how a phone eventually
     * spends a second rendering a year of answered requests.
     */
    const { data, error } = await supabase
      .from("ocade_approvals")
      .select(COLUMNS)
      .order("requested_at", { ascending: false })
      .limit(LIST_CAP);
    if (error) throw new Error(error.message);
    /*
     * `expireIfDue` is applied again on the way out. The server expired what was
     * due when it ran; this covers the seconds since, so a request cannot be
     * rendered as decidable a moment after it stopped being one.
     */
    return ((data as ApprovalRow[] | null) ?? []).map((row) => expireIfDue(toRequest(row), now));
  } catch {
    /*
     * An unreachable account shows NOTHING rather than a remembered list.
     * Approvals authorise actions, and a stale copy is how somebody approves
     * something that was already answered or already expired.
     */
    return [];
  }
}

/**
 * Raise an approval.
 *
 * Throws rather than returning a placeholder when it could not be stored: the
 * caller is about to tell somebody a phone can decide this, and OCADE will not
 * claim that about a request that does not exist.
 */
export async function requestApproval(
  input: { id?: string; summary: string; risk: ApprovalRequest["risk"] },
  now: Date = new Date(),
): Promise<ApprovalRequest> {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("An approval requires a valid request time.");
  }
  const summary = input.summary.trim();
  if (!summary) throw new Error("An approval requires a summary of what is being asked.");

  const supabase = await loadSupabaseClient();
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error("Sign in before asking for an approval, so your devices can see it.");
  }

  const { data, error } = await supabase
    .from("ocade_approvals")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: userId,
      summary,
      risk: input.risk,
      status: "pending",
      requested_at: now.toISOString(),
      // `APPROVAL_TTL_MS` from `pairing`, not a second constant here: the
      // window a person has to answer is one product decision, and two of them
      // would eventually disagree.
      expires_at: new Date(now.getTime() + APPROVAL_TTL_MS).toISOString(),
    })
    .select(COLUMNS)
    .single();
  if (error) {
    // 23505 is the primary key: the same approval raised twice.
    if (error.code === "23505") {
      throw new Error("An approval with this id already exists; no duplicate was created.");
    }
    throw new Error(
      `This approval could not be saved: ${error.message}. OCADE will not claim that a phone can decide it.`,
    );
  }

  const request = toRequest(data as ApprovalRow);

  // Alert the paired phone. Fire-and-forget: the desktop must not block on a
  // notification, and with no transport connected this reports unavailable
  // rather than failing the approval.
  void notify(approvalNotification(request));

  return request;
}

/**
 * Record a decision.
 *
 * Returns the updated request, or null when it was already answered, had
 * expired, or is gone. Null is not an error to swallow: the screen has to say
 * the decision did not take, or two people each believe they approved an action
 * once.
 */
export async function saveApprovalStatus(
  id: string,
  status: ApprovalStatus,
  deviceId?: string,
): Promise<ApprovalRequest | null> {
  if (!["approved", "denied", "cancelled"].includes(status)) return null;
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase.rpc("ocade_decide_approval", {
      _id: id,
      _status: status,
      _device_id: deviceId,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as ApprovalRow | null;
    return row ? toRequest(row) : null;
  } catch {
    return null;
  }
}

/** Drop decided and expired rows so the list does not grow without bound. */
export async function pruneApprovals(): Promise<number> {
  try {
    const supabase = await loadSupabaseClient();
    // Expire first, so a request that lapsed a moment ago is pruned with the
    // rest rather than surviving until the next visit.
    await supabase.rpc("ocade_expire_due_approvals");
    const { data, error } = await supabase
      .from("ocade_approvals")
      .delete()
      .neq("status", "pending")
      .select("id");
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Remove everything.
 *
 * Used when a device is revoked: work that device raised must not be decidable
 * afterwards. Deliberately NOT called on sign-out — an approval belongs to the
 * account, and the next sign-in should still see what is waiting.
 */
export async function clearApprovals(): Promise<void> {
  try {
    const supabase = await loadSupabaseClient();
    const { data: session } = await supabase.auth.getUser();
    const userId = session.user?.id;
    if (!userId) return;
    await supabase.from("ocade_approvals").delete().eq("user_id", userId);
  } catch {
    /* Reported by the list still showing them, rather than by a silent claim. */
  }
}
