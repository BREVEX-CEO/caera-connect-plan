/**
 * RECOVERY CODES: ISSUED WITH THE SECOND FACTOR, REDEEMED WHEN IT IS LOST.
 *
 * An account with two-step verification is reachable only by a session that
 * answered it — the database enforces that on every request. So a lost phone
 * is a locked account unless there is a way back that does not need the phone.
 * This is it, and it is deliberately narrow:
 *
 *   A code does not sign anybody in. It removes the lost factor and ends every
 *   session, this one included. The person signs in again and sets two-step up
 *   on the new phone. If a code let somebody straight in, a stolen sheet of
 *   paper would be a password.
 *
 * The database holds only a SHA-256 of each code (`recovery-codes.ts` says why
 * no server secret is needed), counts wrong guesses durably and locks after
 * five. An earlier version could redeem codes and had nothing that issued them;
 * they are issued here, from the screen that turns two-step on.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HIGH_RISK, requireAssurance } from "./assurance-middleware";
import { requireSession, SESSION_ENDED, sessionStanding } from "./session-middleware";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
} from "./recovery-codes";

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

export interface RecoveryCodeStatus {
  remaining: number;
  total: number;
}

/** How many codes are left. A count, never a code. */
export const readRecoveryCodes = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<RecoveryCodeStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .rpc("ocade_count_mfa_recovery_codes", { p_user_id: context.userId })
      .maybeSingle();
    // Named rather than reported as zero: "0 left" on an account that has ten
    // would send somebody to replace a sheet that still works.
    if (error) throw new Error("OCADE could not read your recovery codes just now.");
    return { remaining: data?.remaining ?? 0, total: data?.total ?? 0 };
  });

/**
 * A new sheet, shown once. It replaces any earlier one, which is why it needs
 * the second factor and a recent proof: whoever can replace the sheet can later
 * remove the factor.
 */
export const issueRecoveryCodes = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .handler(async ({ context }): Promise<{ codes: string[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: factors, error: factorError } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: context.userId,
    });
    if (factorError) throw new Error("OCADE could not read this account just now. Try again.");
    if (!(factors?.factors ?? []).some((factor) => factor.status === "verified")) {
      throw new Error("Turn on two-step verification first. There is nothing to recover yet.");
    }
    const codes = generateRecoveryCodes(randomBytes);
    const hashes = await Promise.all(
      codes.map((code) => hashRecoveryCode(context.userId, normalizeRecoveryCode(code))),
    );
    const { error } = await supabaseAdmin.rpc("ocade_replace_mfa_recovery_codes", {
      p_user_id: context.userId,
      p_code_hashes: hashes,
    });
    // The codes are only real once the write succeeds: a sheet that recovers
    // nothing would be found out on the day it was needed.
    if (error) throw new Error("OCADE could not save these codes, so it will not show them.");
    const { sendNotification } = await import("@/lib/notifications/send.server");
    await sendNotification({
      userId: context.userId,
      category: "security",
      title: "New recovery codes were made",
      body: "Any recovery codes made before now no longer work.",
      idempotencyKey: `recovery-codes:${hashes[0]}`,
    }).catch(() => undefined);
    return { codes };
  });

export type RecoveryOutcome =
  { ok: true } | { ok: false; reason: "rejected" | "locked" | "unavailable"; message: string };

/**
 * Remove the lost factor with a recovery code.
 *
 * `requireSupabaseAuth`, not `requireSession`: the caller is exactly the
 * password-only session the second-factor rule refuses, and this is the one
 * thing that session may still ask for.
 */
export const redeemRecoveryCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { code: string }) => {
    const code = String(data?.code ?? "").trim();
    if (!code || code.length > 64) throw new Error("Enter one of your recovery codes.");
    return { code };
  })
  .handler(async ({ data, context }): Promise<RecoveryOutcome> => {
    // Still never a session that was signed out: its token outlives it by up to an hour.
    const standing = await sessionStanding(
      context.supabase as unknown as Parameters<typeof sessionStanding>[0],
      context.claims as Record<string, unknown>,
    );
    if (standing === "ended") throw new Error(SESSION_ENDED);
    const normalized = normalizeRecoveryCode(data.code);
    // Shape first, so a pasted email address does not cost one of five attempts.
    if (!looksLikeRecoveryCode(normalized)) {
      return {
        ok: false,
        reason: "rejected",
        message: "That does not look like a recovery code. They look like A1B2C-3D4E5-F6G7H-J8K9M.",
      };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: status, error } = await supabaseAdmin.rpc("ocade_consume_mfa_recovery_code", {
      p_user_id: context.userId,
      p_code_hash: await hashRecoveryCode(context.userId, normalized),
    });
    if (error) {
      return {
        ok: false,
        reason: "unavailable",
        message: "OCADE could not check that code just now. Nothing was used up.",
      };
    }
    if (status === "locked") {
      return {
        ok: false,
        reason: "locked",
        message: "Too many wrong codes. Recovery is paused for fifteen minutes.",
      };
    }
    if (status !== "consumed") {
      return {
        ok: false,
        reason: "rejected",
        message: "That code was not accepted. Check the sheet and try another.",
      };
    }

    // The code is spent from here on, whatever follows.
    const { data: factors } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: context.userId,
    });
    let failed = false;
    for (const factor of factors?.factors ?? []) {
      const { error: removeError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: context.userId,
      });
      if (removeError) failed = true;
    }
    if (failed) {
      return {
        ok: false,
        reason: "unavailable",
        message:
          "That code was correct, but OCADE could not remove the authenticator app. The code is used up; try another one.",
      };
    }
    /*
     * EVERY SESSION, this one included. A recovery that left this session
     * running would hand whoever performed it a live session with no second
     * factor, which is what somebody who found the sheet wants.
     */
    const { error: revokeError } = await supabaseAdmin.rpc("ocade_revoke_other_account_sessions", {
      p_user_id: context.userId,
    });
    const { sendNotification } = await import("@/lib/notifications/send.server");
    await sendNotification({
      userId: context.userId,
      category: "security",
      title: "Two-step verification was turned off with a recovery code",
      body: "Every session was signed out. If this was not you, change your password and turn two-step verification on again now.",
      idempotencyKey: `recovery-used:${await hashRecoveryCode(context.userId, normalized)}`,
    }).catch(() => undefined);
    if (revokeError) {
      return {
        ok: false,
        reason: "unavailable",
        message:
          "Your authenticator app was removed, but OCADE could not sign out your other sessions. Sign in, then use Sign out everywhere else in Settings.",
      };
    }
    return { ok: true };
  });
