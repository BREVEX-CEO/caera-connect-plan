import { describe, expect, it, vi } from "vitest";

/**
 * `recordAction` MUST NOT THROW, BECAUSE NOBODY IS HOLDING ITS PROMISE.
 *
 * Every call site in the product writes `void recordAction(...)`, and that is
 * the right shape: failing to write an audit line must never fail the action it
 * was recording. It also means anything this function throws becomes an
 * unhandled rejection with no handler anywhere.
 *
 * It did throw. `supabase.auth.getUser()` sat above the try, so on a deployment
 * whose Supabase binding is missing — the state the root shell deliberately
 * keeps the public and legal pages alive for — every audited control on the
 * screen produced an unhandled rejection. It was found by the settings
 * interaction audit pressing a newly added export button, not by review.
 *
 * The rule is checked against the two ways it can break: the client throwing on
 * first use, and a write that fails after authentication succeeds.
 */

const getUser = vi.fn();
const insert = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      get getUser() {
        return getUser;
      },
    },
    from: () => ({ insert }),
  },
  getSupabaseBrowserConfiguration: () => ({ configured: false }),
}));

const { recordAction } = await import("../actions");

describe("recordAction", () => {
  it("resolves when the Supabase client itself refuses to exist", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // What an unbound deployment does: the client proxy raises on first use.
    getUser.mockImplementation(() => {
      throw new Error(
        "Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY.",
      );
    });
    await expect(recordAction({ actionId: "auth.sign_in" })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "[ActionRegistry] record failed",
      "auth.sign_in",
      expect.any(Error),
    );
    error.mockRestore();
  });

  it("resolves when the session lookup rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    getUser.mockRejectedValue(new Error("fetch failed"));
    await expect(recordAction({ actionId: "auth.sign_in" })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "[ActionRegistry] record failed",
      "auth.sign_in",
      expect.any(Error),
    );
    error.mockRestore();
  });

  it("resolves when the write fails after a good session", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    insert.mockRejectedValue(new Error("permission denied"));
    await expect(recordAction({ actionId: "auth.sign_in" })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "[ActionRegistry] record failed",
      "auth.sign_in",
      expect.any(Error),
    );
    error.mockRestore();
  });

  it("still warns about an action nobody registered", async () => {
    // The warning is the point of the registry: an id that is not declared is a
    // typo, and a silent write under a wrong name is worse than no write.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(recordAction({ actionId: "not.a.real.action" })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("not.a.real.action"));
    warn.mockRestore();
  });

  it("does not reach for a session before deciding the id is unknown", async () => {
    // Cheapest correct order, and it keeps the warning working on a deployment
    // that has no Supabase at all.
    getUser.mockClear();
    getUser.mockImplementation(() => {
      throw new Error("should not be called");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await recordAction({ actionId: "not.a.real.action" });
    expect(getUser).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
