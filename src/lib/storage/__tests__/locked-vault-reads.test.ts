import { describe, expect, it, vi, beforeEach } from "vitest";

/*
 * A LOCKED VAULT MUST NOT READ AS AN EMPTY ONE.
 *
 * Found by walking the customer journey rather than by testing a unit: a
 * brand-new account has an empty browser vault, `list` decrypted row by row so
 * it never asked for the key when there were no rows, and Projects therefore
 * rendered "No projects yet" — a factual-sounding sentence that was false —
 * above a Create button that failed on every press.
 *
 * The negative control is built in. There is no `indexedDB` in this
 * environment, so if the lock check were removed the call would reach
 * `openDb()` and fail with a ReferenceError about `indexedDB` instead of a
 * StorageLockedError. The assertion distinguishes the two.
 */

const unlocked = { value: false };

vi.mock("../vault-session", () => ({
  isUnlocked: () => unlocked.value,
  requireKey: () => {
    if (!unlocked.value) throw new Error("locked");
    return {} as CryptoKey;
  },
}));

const { indexedDbAdapter } = await import("../indexeddb-adapter");
const { StorageLockedError } = await import("../types");

describe("reading a browser vault that is locked", () => {
  beforeEach(() => {
    unlocked.value = false;
  });

  it("refuses to list, rather than returning nothing", async () => {
    await expect(indexedDbAdapter.list("files")).rejects.toBeInstanceOf(StorageLockedError);
  });

  it("says so in words a person can act on", async () => {
    await expect(indexedDbAdapter.list("chats")).rejects.toThrow(/locked.*Settings/i);
  });

  it("refuses every data class, not just the one that was noticed", async () => {
    for (const dataClass of ["chats", "images", "files", "recordings", "copilot"] as const) {
      await expect(indexedDbAdapter.list(dataClass)).rejects.toBeInstanceOf(StorageLockedError);
    }
  });

  it("stops before opening the database at all", async () => {
    /*
     * If the guard were gone this would be a ReferenceError from `indexedDB`,
     * not a StorageLockedError — which is what makes this a real check and not
     * a restatement of the mock.
     */
    const error = await indexedDbAdapter.list("files").catch((e) => e);
    expect(error).toBeInstanceOf(StorageLockedError);
    expect(String(error)).not.toMatch(/indexedDB is not defined/);
  });

  it("gets past the guard once the vault is unlocked", async () => {
    unlocked.value = true;
    const error = await indexedDbAdapter.list("files").catch((e) => e);
    // It fails for want of a database, which is this environment, not the lock.
    expect(error).not.toBeInstanceOf(StorageLockedError);
  });
});
