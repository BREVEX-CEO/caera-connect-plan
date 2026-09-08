/**
 * RECOVERY, AS THE SERVER PERFORMS IT.
 *
 * Everything here needs something a browser must never hold: the pepper that
 * keys the stored hashes, and the admin credential that can remove a factor
 * from an account. So all of it is server-side, and the browser's part is
 * limited to typing a code and being told what happened.
 *
 * THE FLOW, and the reason for each step (PLAN.md §B):
 *
 *   1. The person already has a valid AAL1 session. Recovery is not a way IN;
 *      it is a way to fix an account you can already reach but cannot fully
 *      use because the second factor is gone.
 *   2. They type a code. It is normalized, hashed under the pepper, and
 *      checked-and-consumed by ONE atomic database call that also enforces the
 *      durable lockout.
 *   3. On success the server removes the lost factor with the admin API.
 *   4. Every session is revoked, including the one that just did this.
 *   5. They sign in again and must enroll a replacement before full access.
 *
 * STEP 4 IS NOT AN INCONVENIENCE, IT IS THE POINT. A recovery that left the
 * current session running would hand an attacker who guessed a code a live,
 * factor-free session on the account. Revoking everything means the code buys
 * exactly one thing — the factor is gone — and the account still has to be
 * signed into on its own merits.
 *
 * WHAT IS NEVER WRITTEN: the code. Not to the database, not to the audit row,
 * not to a log line. The audit records that recovery happened, when, and for
 * whom — which is everything an investigation needs and nothing an attacker
 * reading the audit could reuse.
 */
import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HIGH_RISK, requireAssurance } from "./assurance-middleware";
import type { Json } from "@/integrations/supabase/types";
import { checkServerLimit } from "@/lib/limits/server";
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
} from "./recovery-codes";
import {
  RecoveryUnconfiguredError,
  hashRecoveryCode,
  recoveryCodesConfigured,
} from "./recovery-pepper.server";
import { sendNotification } from "@/lib/notifications/send.server";

const nodeRandomBytes = (length: number): Uint8Array => new Uint8Array(randomBytes(length));

/**
 * Record a security event on the account's immutable audit trail.
 *
 * Uses the existing compliance log rather than a table of its own: OCADE has
 * one hash-chained audit authority and a second one would be a second story
 * about what happened.
 *
 * Best-effort AFTER the fact it records. An audit write that failed must not
 * undo a factor reset that succeeded — that would leave the person locked out
 * to protect a log entry.
 */
async function audit(userId: string, action: string, result: Json): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: userId,
      action,
      /*
       * `other` because that is what this taxonomy actually offers — the enum
       * runs finance, payment, filing, signature, approval, role_change,
       * sensitive_export, deletion, other, and none of them is "security".
       * Widening a database enum to make one row read better is not worth a
       * schema change: what these events are searched by is `action`, which
       * names each one exactly (`security.recovery_used`, and so on).
       */
      category: "other",
      feature_id: "security.mfa",
      result,
    });
  } catch {
    /* The event happened whether or not it was written down. */
  }
}

export interface RecoveryCodeStatus {
  /** False when this deployment has no pepper: the feature is hidden, not faked. */
  available: boolean;
  remaining: number;
  total: number;
  generatedAt: string | null;
  /** Said plainly when unavailable, so nobody is left guessing. */
  unavailableReason?: string;
}

/**
 * How many codes this account has left.
 *
 * A COUNT and never a code. The plaintext exists only in the response that
 * issued it; there is nothing here that could return one even if a future edit
 * asked.
 */
export const readRecoveryCodeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecoveryCodeStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!recoveryCodesConfigured()) {
      return {
        available: false,
        remaining: 0,
        total: 0,
        generatedAt: null,
        unavailableReason:
          "Recovery codes are not set up on this deployment. Your authenticator app still protects this account; keep it safe, because there is no code to fall back on yet.",
      };
    }

    const { data, error } = await supabaseAdmin
      .rpc("ocade_count_mfa_recovery_codes", { p_user_id: context.userId })
      .maybeSingle();

    if (error) {
      /*
       * Named rather than reported as zero. "0 codes left" on an account that
       * has ten would send somebody to regenerate a sheet they did not need,
       * invalidating the one already in their drawer.
       */
      return {
        available: true,
        remaining: 0,
        total: 0,
        generatedAt: null,
        unavailableReason: "OCADE could not read your recovery codes just now.",
      };
    }

    const row = data as { remaining: number; total: number; generated_at: string | null } | null;
    return {
      available: true,
      remaining: row?.remaining ?? 0,
      total: row?.total ?? 0,
      generatedAt: row?.generated_at ?? null,
    };
  });

export interface IssuedRecoveryCodes {
  ok: true;
  /** Shown ONCE. Never retrievable again by any path. */
  codes: string[];
}

export interface RecoveryCodesRefused {
  ok: false;
  reason: string;
}

/**
 * Issue a fresh sheet, replacing whatever the account had.
 *
 * REQUIRES A VERIFIED FACTOR FIRST, as PLAN.md §B step 1 sets out. Codes reset
 * a factor; issuing them to an account with no factor would create a
 * credential that resets nothing, and hand somebody a printed secret whose only
 * effect is to be lost.
 *
 * The plaintext is returned in this response and nowhere else. It is not
 * logged, not stored, and not recoverable — regenerating is the only way to
 * get a readable sheet again, and regenerating invalidates the old one.
 */
/*
 * ASSURED AND RECENT, THROUGH THE CANONICAL MIDDLEWARE.
 *
 * A sheet of recovery codes is a credential: issuing one to a session that has
 * not completed a factor challenge would let somebody who found an unlocked
 * browser print themselves a permanent way past the factor.
 *
 * This was written first as a hand-rolled check inside the handler —
 * `context.supabase.auth.getClaims()` with no argument, which does not decode
 * the bearer token and so never saw `aal` at all. It refused every request,
 * including one from a person who had verified their app seconds earlier. A
 * browser run found it; a second copy of a rule is how that happens, which is
 * exactly why there is one middleware and every high-risk path uses it.
 */
export const issueRecoveryCodes = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .handler(async ({ context }): Promise<IssuedRecoveryCodes | RecoveryCodesRefused> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!recoveryCodesConfigured()) {
      return {
        ok: false,
        reason:
          "Recovery codes are not set up on this deployment, so OCADE will not issue any. It will not store them under an unkeyed hash to make this button work.",
      };
    }

    const { data: factors, error: factorError } = await context.supabase.auth.mfa.listFactors();
    if (factorError) {
      return { ok: false, reason: "OCADE could not read this account's factors just now." };
    }
    const verified = (factors?.all ?? []).filter((factor) => factor.status === "verified");
    if (verified.length === 0) {
      return {
        ok: false,
        reason:
          "Set up an authenticator app first. Recovery codes exist to get you past a lost factor, so there is nothing for them to recover yet.",
      };
    }

    const limit = checkServerLimit("auth_mail", context.userId);
    if (!limit.allowed) {
      return {
        ok: false,
        reason: limit.decision.message ?? "Too many attempts just now. Try again shortly.",
      };
    }

    let codes: string[];
    let hashes: string[];
    try {
      codes = generateRecoveryCodes(nodeRandomBytes, RECOVERY_CODE_COUNT);
      hashes = codes.map((code) => hashRecoveryCode(context.userId, normalizeRecoveryCode(code)));
    } catch (error) {
      if (error instanceof RecoveryUnconfiguredError) return { ok: false, reason: error.message };
      throw error;
    }

    const { error } = await supabaseAdmin.rpc("ocade_replace_mfa_recovery_codes", {
      p_user_id: context.userId,
      p_code_hashes: hashes,
    });
    /*
     * THE CODES ARE ONLY REAL ONCE THE WRITE SUCCEEDS. Returning them before
     * this point would print a sheet that recovers nothing, and the person
     * would not find out until the day they needed it.
     */
    if (error) {
      return { ok: false, reason: "OCADE could not save these codes, so it will not show them." };
    }

    await audit(context.userId, "security.recovery_codes_issued", { count: codes.length });
    /*
     * A NEW SHEET INVALIDATES THE OLD ONE, so somebody who did not do this
     * needs to know it happened. §D's `security` category, which no mute
     * setting silences.
     *
     * The key is the write itself rather than the codes: two issues on the same
     * day are two genuinely different events, and the count distinguishes them
     * without putting anything recoverable in the record.
     */
    await sendNotification({
      userId: context.userId,
      category: "security",
      title: "New recovery codes were issued",
      body: "Any recovery codes issued before now no longer work.",
      deepLink: "/settings/security",
      idempotencyKey: `recovery-codes-issued:${new Date().toISOString()}`,
    });
    return { ok: true, codes };
  });

export type FactorResetOutcome =
  | { ok: true; removedFactors: number }
  | { ok: false; reason: "rejected" | "locked" | "unavailable" | "no_factor"; message: string };

/**
 * Spend a recovery code to remove a lost factor.
 *
 * ONE ATOMIC CHECK. The database function validates the code, consumes it, and
 * enforces the lockout in a single statement — two calls would be a race in
 * which the same code is spent twice.
 *
 * ORDER MATTERS AFTER THAT: remove the factor, THEN revoke every session. The
 * other order signs the person out before the fix lands, and if the removal
 * then fails they have spent a code, lost their session, and changed nothing.
 */
export const redeemRecoveryCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { code: string }) => {
    const code = String(data?.code ?? "").trim();
    if (!code) throw new Error("Enter one of your recovery codes.");
    if (code.length > 64) throw new Error("That is not a recovery code.");
    return { code };
  })
  .handler(async ({ data, context }): Promise<FactorResetOutcome> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!recoveryCodesConfigured()) {
      return {
        ok: false,
        reason: "unavailable",
        message: "Recovery codes are not set up on this deployment.",
      };
    }

    const normalized = normalizeRecoveryCode(data.code);
    /*
     * Shape-checked BEFORE the database is touched, so obviously-wrong input
     * does not consume an attempt from the lockout budget. A person who pasted
     * their email address by mistake should not lose a fifth of their attempts.
     */
    if (!looksLikeRecoveryCode(normalized)) {
      return {
        ok: false,
        reason: "rejected",
        message:
          "That does not look like a recovery code. They are ten characters, like A1B2C-3D4E.",
      };
    }

    const { data: status, error } = await supabaseAdmin.rpc("ocade_consume_mfa_recovery_code", {
      p_user_id: context.userId,
      p_code_hash: hashRecoveryCode(context.userId, normalized),
    });

    if (error) {
      return {
        ok: false,
        reason: "unavailable",
        message: "OCADE could not check that code just now. Nothing was used up.",
      };
    }

    if (status === "locked") {
      await audit(context.userId, "security.recovery_locked_out", {});
      return {
        ok: false,
        reason: "locked",
        message:
          "Too many incorrect codes. Recovery is paused for fifteen minutes — this is what stops somebody working through the sheet.",
      };
    }
    if (status !== "consumed") {
      return {
        ok: false,
        reason: "rejected",
        message: "That code was not accepted. Check the sheet and try the next one.",
      };
    }

    // The code is spent from here on, whatever follows.
    const { data: factors } = await context.supabase.auth.mfa.listFactors();
    const verified = (factors?.all ?? []).filter((factor) => factor.status === "verified");
    if (verified.length === 0) {
      await audit(context.userId, "security.recovery_used", { removed: 0, note: "no_factor" });
      return {
        ok: false,
        reason: "no_factor",
        message:
          "That code was correct, and there was no authenticator app to remove. The code has been used up; your account is unchanged.",
      };
    }

    let removed = 0;
    for (const factor of verified) {
      const { error: removeError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: context.userId,
      });
      if (!removeError) removed += 1;
    }

    if (removed === 0) {
      await audit(context.userId, "security.recovery_used", { removed: 0, note: "removal_failed" });
      return {
        ok: false,
        reason: "unavailable",
        message:
          "That code was correct, but OCADE could not remove the authenticator app. The code has been used up. Try another one, or contact support.",
      };
    }

    /*
     * EVERY SESSION, including this one. A recovery that left the current
     * session running would hand whoever performed it a live, factor-free
     * session — which is precisely what an attacker who guessed a code wants.
     *
     * THROUGH THE SESSION AUTHORITY, NOT `admin.signOut`. This was written as
     * `admin.signOut(context.userId, "global")` first, and that call takes a
     * JWT rather than a user id: it posted the account's UUID to the logout
     * endpoint as a bearer token, failed, and was swallowed by the `.catch`.
     * Nothing was revoked, while the code and its comment both said otherwise.
     *
     * Deleting the rows is the real thing — `auth.refresh_tokens` and
     * `auth.mfa_amr_claims` cascade from `auth.sessions`, so every session dies
     * with its refresh token. `NULL` keeps nothing.
     */
    const { error: revokeError } = await supabaseAdmin.rpc(
      "ocade_revoke_other_account_sessions",
      // No session kept: the argument is omitted, which the function reads as
      // "revoke everything".
      { p_user_id: context.userId },
    );
    if (revokeError) {
      /*
       * The factor is gone and the sessions are not. Said plainly rather than
       * reported as a clean recovery: the person needs to know to change their
       * password, and a silent partial success is how they would not.
       */
      await audit(context.userId, "security.recovery_used", {
        removed,
        sessions_revoked: false,
      });
      return {
        ok: false,
        reason: "unavailable",
        message:
          "Your authenticator app has been removed, but OCADE could not sign out your other sessions. Change your password now, and sign out of all devices from the Security page.",
      };
    }

    await audit(context.userId, "security.recovery_used", { removed, sessions_revoked: true });
    /*
     * THE MOST IMPORTANT NOTIFICATION IN THE PRODUCT.
     *
     * A recovery code just removed this account's second factor and ended every
     * session. If the person reading this did not do it, somebody else worked
     * through their recovery sheet — and the record of that is the only thing
     * that tells them. §D lists `security` among the kinds that stay recorded
     * whatever the mute settings say, and this is why the rule exists.
     */
    await sendNotification({
      userId: context.userId,
      category: "security",
      title: "A recovery code was used",
      body: "Two-step sign-in was removed with a recovery code, and every session was signed out. If this was not you, change your password now.",
      deepLink: "/settings/security",
      idempotencyKey: `recovery-used:${new Date().toISOString()}`,
    });
    return { ok: true, removedFactors: removed };
  });
