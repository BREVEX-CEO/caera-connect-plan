import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Recovery codes end to end on the server: what is stored, what a wrong guess
 * costs, and what a right one does. The database's own lockout is proven
 * against PostgreSQL in `mfa-recovery` migration tests; this is the code around it.
 */

vi.mock("@tanstack/react-start", () => {
  const builder = {
    middleware: () => builder,
    validator: () => builder,
    handler: (fn: unknown) => fn,
  };
  return { createServerFn: () => builder, createMiddleware: () => ({ server: () => ({}) }) };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/security/assurance-middleware", () => ({
  HIGH_RISK: {},
  requireAssurance: () => ({}),
}));
const session = vi.hoisted(() => ({
  standing: "factor_required" as "ok" | "factor_required" | "ended",
}));
vi.mock("@/lib/security/session-middleware", () => ({
  requireSession: {},
  SESSION_ENDED: "Unauthorized: Session ended",
  sessionStanding: async () => session.standing,
}));

const sent: { title: string }[] = [];
vi.mock("@/lib/notifications/send.server", () => ({
  sendNotification: async (input: { title: string }) => void sent.push(input),
}));

let factors: { id: string; status: string }[] = [];
let listing: "ok" | "down" = "ok";
let stored: string[] = [];
let consume: "consumed" | "rejected" | "locked" | "error" = "consumed";
const calls: string[] = [];
const deleteFactor = vi.fn(async ({ id }: { id: string }) => {
  factors = factors.filter((factor) => factor.id !== id);
  return { error: null };
});

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === "ocade_replace_mfa_recovery_codes") {
        stored = args.p_code_hashes as string[];
        return Promise.resolve({ data: stored.length, error: null });
      }
      if (name === "ocade_consume_mfa_recovery_code") {
        return Promise.resolve(
          consume === "error"
            ? { data: null, error: { message: "down" } }
            : {
                data: stored.includes(args.p_code_hash as string) ? consume : "rejected",
                error: null,
              },
        );
      }
      return Promise.resolve({ data: 1, error: null });
    },
    auth: {
      admin: {
        mfa: {
          listFactors: async () =>
            listing === "down"
              ? { data: null, error: { message: "service unavailable" } }
              : { data: { factors }, error: null },
          deleteFactor,
        },
      },
    },
  },
}));

const load = async () => {
  const module = await import("../recovery.functions");
  const call = (fn: unknown, data?: unknown) =>
    (fn as (input: unknown) => Promise<unknown>)({ data, context: { userId: "u1" } });
  return {
    issue: () => call(module.issueRecoveryCodes) as Promise<{ codes: string[] }>,
    redeem: (code: string) =>
      call(module.redeemRecoveryCode, { code }) as Promise<{
        ok: boolean;
        reason?: string;
        message?: string;
      }>,
  };
};

beforeEach(() => {
  factors = [{ id: "f1", status: "verified" }];
  listing = "ok";
  stored = [];
  consume = "consumed";
  calls.length = 0;
  sent.length = 0;
  deleteFactor.mockClear();
});

describe("making a sheet", () => {
  it("returns ten codes once and stores only their hashes", async () => {
    const { issue } = await load();
    const { codes } = await issue();
    expect(codes).toHaveLength(10);
    expect(stored).toHaveLength(10);
    for (const hash of stored) expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Nothing that went to the database contains a code.
    expect(stored.join(" ")).not.toContain(codes[0]!.replaceAll("-", "").toLowerCase());
    expect(sent.map((note) => note.title)).toEqual(["New recovery codes were made"]);
  });

  it("refuses an account with no second factor: there is nothing to recover", async () => {
    factors = [];
    const { issue } = await load();
    await expect(issue()).rejects.toThrow(/Turn on two-step verification first/);
    expect(stored).toEqual([]);
  });
});

describe("using a code", () => {
  it("removes the factor, ends every session, and tells the account", async () => {
    const { issue, redeem } = await load();
    const { codes } = await issue();
    // Typed the way people type: lower case, no hyphens.
    const outcome = await redeem(codes[3]!.toLowerCase().replaceAll("-", " "));
    expect(outcome).toEqual({ ok: true });
    expect(factors).toEqual([]);
    expect(calls).toContain("ocade_revoke_other_account_sessions");
    expect(sent.at(-1)!.title).toMatch(/turned off with a recovery code/);
  });

  it("is refused to a session that was signed out, whatever code it brings", async () => {
    const { issue, redeem } = await load();
    const { codes } = await issue();
    session.standing = "ended";
    try {
      await expect(redeem(codes[0]!)).rejects.toThrow(/Session ended/);
      expect(calls).not.toContain("ocade_consume_mfa_recovery_code");
    } finally {
      session.standing = "factor_required";
    }
  });

  it("does not spend one of five attempts on something that is not a code", async () => {
    const { redeem } = await load();
    const outcome = await redeem("me@example.com");
    expect(outcome).toMatchObject({ ok: false, reason: "rejected" });
    expect(calls).not.toContain("ocade_consume_mfa_recovery_code");
  });

  it("refuses a wrong code and a locked account without touching the factor", async () => {
    const { issue, redeem } = await load();
    await issue();
    expect(await redeem("A1B2C-3D4E5-F6G7H-J8K9M")).toMatchObject({
      ok: false,
      reason: "rejected",
    });
    const { codes } = await issue();
    consume = "locked";
    expect(await redeem(codes[0]!)).toMatchObject({ ok: false, reason: "locked" });
    expect(deleteFactor).not.toHaveBeenCalled();
    expect(factors).toHaveLength(1);
  });

  it("spends no code and claims nothing removed when the factors cannot be read", async () => {
    const { issue, redeem } = await load();
    const { codes } = await issue();
    listing = "down";
    sent.length = 0;
    expect(await redeem(codes[0]!)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(calls).not.toContain("ocade_consume_mfa_recovery_code");
    expect(calls).not.toContain("ocade_revoke_other_account_sessions");
    expect(sent).toEqual([]);
  });

  it("does not say every session was signed out when that failed", async () => {
    const { issue, redeem } = await load();
    const { codes } = await issue();
    const { supabaseAdmin } =
      (await import("@/integrations/supabase/client.server")) as unknown as {
        supabaseAdmin: { rpc: (name: string, args: Record<string, unknown>) => Promise<unknown> };
      };
    const rpc = supabaseAdmin.rpc;
    supabaseAdmin.rpc = (name, args) =>
      name === "ocade_revoke_other_account_sessions"
        ? Promise.resolve({ data: null, error: { message: "down" } })
        : rpc(name, args);
    try {
      expect(await redeem(codes[0]!)).toMatchObject({ ok: false, reason: "unavailable" });
      expect((sent.at(-1) as { body?: string }).body).toMatch(/could not all be signed out/);
    } finally {
      supabaseAdmin.rpc = rpc;
    }
  });

  it("uses nothing up when the database cannot be asked", async () => {
    const { issue, redeem } = await load();
    const { codes } = await issue();
    consume = "error";
    expect(await redeem(codes[0]!)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(deleteFactor).not.toHaveBeenCalled();
  });
});

describe("the one door a password-only session may use", () => {
  it("is the recovery redemption, and nothing else skips the session check", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) {
          if (name !== "__tests__" && name !== "node_modules") walk(file);
        } else if (/\.tsx?$/.test(name)) {
          const matches = readFileSync(file, "utf8").match(
            /\.middleware\(\[requireSupabaseAuth\]\)/g,
          );
          for (const _ of matches ?? []) hits.push(file.replaceAll("\\", "/"));
        }
      }
    };
    walk("src");
    // The session check itself is built on it; the redemption is the one exception.
    expect(hits.sort()).toEqual([
      "src/lib/security/recovery.functions.ts",
      "src/lib/security/session-middleware.ts",
    ]);
  });
});
