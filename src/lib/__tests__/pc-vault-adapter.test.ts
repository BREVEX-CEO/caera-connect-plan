import { describe, it, expect } from "vitest";
import { pcVaultAdapter } from "../storage/pc-vault-adapter";
import { NativeCompanionRequiredError } from "../storage/types";

/**
 * PC Device Vault adapter — fail-closed by design.
 *
 * The PC Vault needs the native companion process. On the web there is no
 * companion, so EVERY operation must raise NativeCompanionRequiredError rather
 * than quietly falling back to browser storage. A silent fallback would be the
 * worst possible outcome: the user chose "keep this on my PC", and the data
 * would land somewhere else while the UI reported success.
 *
 * This is also the No-Dead-Button contract — every call site is expected to
 * render a "Native Companion Required" state, which it can only do if the
 * adapter actually throws.
 */

describe("pcVaultAdapter refuses every operation without the companion", () => {
  it("declares itself as the pc_vault mode", () => {
    expect(pcVaultAdapter.mode).toBe("pc_vault");
  });

  const operations: Array<[string, () => Promise<unknown>]> = [
    ["put", () => pcVaultAdapter.put("chats", "id", { a: 1 })],
    ["get", () => pcVaultAdapter.get("chats", "id")],
    ["list", () => pcVaultAdapter.list("chats")],
    ["delete", () => pcVaultAdapter.delete("chats", "id")],
    ["clear", () => pcVaultAdapter.clear("chats")],
  ];

  for (const [name, run] of operations) {
    it(`${name}() rejects with NativeCompanionRequiredError`, async () => {
      await expect(run()).rejects.toBeInstanceOf(NativeCompanionRequiredError);
    });

    it(`${name}() never resolves with a value that could look like success`, async () => {
      // Guards against a future "return undefined" refactor: a resolved promise
      // here would read as a successful write to every caller.
      let resolved = false;
      await run()
        .then(() => {
          resolved = true;
        })
        .catch(() => {});
      expect(resolved).toBe(false);
    });
  }

  it("uses an error name the UI can branch on", async () => {
    await expect(pcVaultAdapter.put("chats", "id", {})).rejects.toMatchObject({
      name: "NativeCompanionRequiredError",
    });
  });
});
