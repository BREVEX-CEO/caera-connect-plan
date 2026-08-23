import { NativeCompanionRequiredError, type StorageAdapter } from "./types";

/** PC Device Vault requires the OCADE Native Companion process on the OS.
 *  On the web this adapter surfaces a clear error instead of falling back
 *  silently to browser storage — the No-Dead-Button policy expects a
 *  Native Companion Required state at every call site. */
export const pcVaultAdapter: StorageAdapter = {
  mode: "pc_vault",
  async put() {
    throw new NativeCompanionRequiredError();
  },
  async get() {
    throw new NativeCompanionRequiredError();
  },
  async list() {
    throw new NativeCompanionRequiredError();
  },
  async delete() {
    throw new NativeCompanionRequiredError();
  },
  async clear() {
    throw new NativeCompanionRequiredError();
  },
};
