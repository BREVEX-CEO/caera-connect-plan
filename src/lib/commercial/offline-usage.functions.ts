import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { sqlNullable } from "@/lib/supabase/rpc-null";
import { ALLOWANCES } from "./usage-policy";
import { resolveTierFor } from "./entitlement-resolver";
import {
  OFFLINE_BLOCK_INCREMENT,
  type OfflineUsageLeasePayload,
  type SignedOfflineUsageEvent,
  type SignedOfflineUsageLease,
} from "./offline-lease";

export interface OfflineUsageLeaseView {
  leaseId: string;
  deviceId: string;
  deviceName: string;
  status: string;
  tier: "free" | "pro" | "max";
  allocated?: number;
  consumed?: number;
  remaining?: number;
  usedPercent?: number;
  remainingPercent?: number;
  preissued: boolean;
  sessionWindowStart: string;
  sessionResetAt: string;
  weekWindowStart: string;
  weekResetAt: string;
  notBefore: string;
  expiresAt: string;
  signedLease?: SignedOfflineUsageLease;
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function signingAuthority() {
  const { loadOfflineLeaseSigningAuthority } = await import("./offline-lease.server");
  return loadOfflineLeaseSigningAuthority();
}

function leasePayload(
  row: {
    lease_id: string;
    tier: string;
    allocated_hundredths: number;
    sequence_start: number;
    sequence_end: number;
    session_window_start: string;
    session_reset_at: string;
    week_window_start: string;
    week_reset_at: string;
    issued_at: string;
    not_before: string;
    expires_at: string;
    preissued: boolean;
  },
  accountId: string,
  deviceId: string,
  keyId: string,
): OfflineUsageLeasePayload {
  return {
    version: 1,
    keyId,
    leaseId: row.lease_id,
    accountId,
    deviceId,
    tier: row.tier as "free" | "pro" | "max",
    allocatedHundredths: Number(row.allocated_hundredths),
    sequenceStart: Number(row.sequence_start),
    sequenceEnd: Number(row.sequence_end),
    sessionWindowStart: row.session_window_start,
    sessionResetAt: row.session_reset_at,
    weekWindowStart: row.week_window_start,
    weekResetAt: row.week_reset_at,
    issuedAt: row.issued_at,
    notBefore: row.not_before,
    expiresAt: row.expires_at,
    preissued: row.preissued,
  };
}

export const allocateOfflineUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      deviceId: string;
      browserInstallId: string;
      devicePublicKey: string;
      requestKey: string;
      preissue?: boolean;
    }) => {
      for (const [name, value] of Object.entries(data ?? {})) {
        if (typeof value === "string" && (!value.trim() || value.length > 200)) {
          throw new Error(`The offline usage ${name} is not valid.`);
        }
      }
      if (!data?.deviceId || !data.browserInstallId || !data.devicePublicKey || !data.requestKey) {
        throw new Error("This device is missing its offline usage identity.");
      }
      return {
        deviceId: data.deviceId.trim(),
        browserInstallId: data.browserInstallId.trim(),
        devicePublicKey: data.devicePublicKey.trim(),
        requestKey: data.requestKey.trim(),
        preissue: data.preissue === true,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const [{ supabaseAdmin }, entitlement, authority] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      resolveTierFor(context.userId),
      signingAuthority(),
    ]);
    const allowance = ALLOWANCES[entitlement.tier];
    const incrementHundredths = OFFLINE_BLOCK_INCREMENT[entitlement.tier] * 100;
    const { data: decision, error } = await supabaseAdmin.rpc("ocade_allocate_offline_usage", {
      p_user_id: context.userId,
      p_device_id: data.deviceId,
      p_browser_install_id: data.browserInstallId,
      p_device_public_key: data.devicePublicKey,
      p_request_key: data.requestKey,
      p_tier: entitlement.tier,
      p_session_limit_hundredths: allowance.session * 100,
      p_week_limit_hundredths: sqlNullable(allowance.week === null ? null : allowance.week * 100),
      p_amount_hundredths: incrementHundredths,
      p_preissue: data.preissue,
    });
    if (error) throw new Error(`Offline usage could not be allocated: ${error.message}`);
    const row = first(decision);
    if (!row) throw new Error("The offline usage authority returned no allocation decision.");
    if (row.outcome === "session_exhausted" || row.outcome === "week_exhausted") {
      return {
        ok: false as const,
        reason: row.outcome,
        resetsAt: row.outcome === "session_exhausted" ? row.session_reset_at : row.week_reset_at,
      };
    }
    if (!row.lease_id) throw new Error("The offline usage authority allocated no lease identity.");

    if (row.outcome === "duplicate") {
      const { data: existing, error: readError } = await supabaseAdmin.rpc(
        "ocade_read_offline_usage",
        { p_user_id: context.userId },
      );
      if (readError) throw new Error(`Offline usage could not be read: ${readError.message}`);
      const found = (existing ?? []).find((candidate) => candidate.lease_id === row.lease_id);
      if (found?.signed_payload && found.server_signature) {
        return {
          ok: true as const,
          lease: {
            payload: found.signed_payload as unknown as OfflineUsageLeasePayload,
            signature: found.server_signature,
          } satisfies SignedOfflineUsageLease,
          verificationKeys: authority.verificationKeys,
        };
      }
    }

    const payload = leasePayload(
      { ...row, lease_id: row.lease_id },
      context.userId,
      data.deviceId,
      authority.key.keyId,
    );
    const { signOfflineUsageLease } = await import("./offline-lease.server");
    let signed: SignedOfflineUsageLease;
    try {
      signed = await signOfflineUsageLease(payload, authority.privateKey);
      const { data: activated, error: activateError } = await supabaseAdmin.rpc(
        "ocade_activate_offline_usage_lease",
        {
          p_user_id: context.userId,
          p_lease_id: row.lease_id,
          p_key_id: authority.key.keyId,
          p_signed_payload: payload as unknown as Json,
          p_server_signature: signed.signature,
        },
      );
      if (activateError || activated !== true) {
        throw new Error(activateError?.message ?? "The signed lease was not activated.");
      }
    } catch (cause) {
      await supabaseAdmin.rpc("ocade_cancel_unsigned_offline_usage", {
        p_user_id: context.userId,
        p_device_id: data.deviceId,
        p_lease_id: row.lease_id,
      });
      throw cause;
    }
    return { ok: true as const, lease: signed, verificationKeys: authority.verificationKeys };
  });

export const reconcileOfflineUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { deviceId: string; leaseId: string; events: SignedOfflineUsageEvent[] }) => {
    if (
      !data?.deviceId ||
      !data.leaseId ||
      !Array.isArray(data.events) ||
      data.events.length > 2_000
    ) {
      throw new Error("That offline usage reconciliation is not valid.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("ocade_read_offline_usage", {
      p_user_id: context.userId,
    });
    if (error) throw new Error(`Offline usage could not be read: ${error.message}`);
    const row = (rows ?? []).find(
      (candidate) => candidate.lease_id === data.leaseId && candidate.device_id === data.deviceId,
    );
    if (!row?.signed_payload || !row.server_signature) {
      throw new Error("That offline usage lease is not active for this account and device.");
    }
    const { importDeviceEventPublicKey, verifyOfflineEventChain } =
      await import("./offline-lease.server");
    const lease = row.signed_payload as unknown as OfflineUsageLeasePayload;
    const publicKey = await importDeviceEventPublicKey(row.device_public_key);
    const verified = await verifyOfflineEventChain({
      events: data.events,
      publicKey,
      lease,
      afterSequence: lease.sequenceStart - 1,
      previousHash: "",
    });
    const { data: consumed, error: reconcileError } = await supabaseAdmin.rpc(
      "ocade_reconcile_offline_usage",
      {
        p_user_id: context.userId,
        p_device_id: data.deviceId,
        p_lease_id: data.leaseId,
        p_consumed_hundredths: verified.consumedHundredths,
        p_last_sequence: verified.lastSequence,
        p_last_event_hash: verified.lastHash,
        p_events: data.events as unknown as Json,
      },
    );
    if (reconcileError) {
      throw new Error(`Offline usage could not be reconciled: ${reconcileError.message}`);
    }
    return { consumedHundredths: Number(consumed) };
  });
