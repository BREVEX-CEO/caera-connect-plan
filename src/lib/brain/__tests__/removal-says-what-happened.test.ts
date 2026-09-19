import { beforeEach, describe, expect, it } from "vitest";
import { ModelInstallationAuthority } from "../installation-authority";
import { ModelVault, versionPath } from "../model-vault";
import type { ModelStore } from "../model-store";

/**
 * "REMOVED" WAS SAID WHETHER OR NOT ANYTHING WAS REMOVED.
 *
 * `removeEverything` cleared each version's metadata even when the file system
 * refused to delete the file, and `uninstall` published the removed state and
 * returned `{ ok: true }` unconditionally — a failed native removal only emitted
 * a diagnostic event nobody sees. So a person could press Remove, be told
 * OCADE's offline intelligence was gone from their device, and still be several
 * hundred megabytes down with no record of it anywhere: nothing to list, nothing
 * to repair, and no reason to try again.
 *
 * A deletion that cannot be verified is not a deletion, and that is what these
 * check: what the store actually holds afterwards decides what is said.
 */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

/** A store whose `remove` can be told to fail, as a locked file system does. */
function stubbornStore() {
  const files = new Map<string, Uint8Array>();
  let refusing = false;
  const store = {
    async sizeOf(key: string) {
      return files.get(key)?.length ?? 0;
    },
    async append(key: string, chunk: Uint8Array) {
      files.set(key, chunk);
      return true;
    },
    async remove(key: string) {
      if (refusing) return false;
      return files.delete(key);
    },
    async readMeta() {
      return null;
    },
    async writeMeta() {},
    async list() {
      return [...files.entries()].map(([key, bytes]) => ({
        key,
        bytes: bytes.length,
        verified: true,
      }));
    },
  } as unknown as ModelStore;
  return {
    store,
    files,
    refuse(on: boolean) {
      refusing = on;
    },
  };
}

let backing: ReturnType<typeof stubbornStore>;
let vault: ModelVault;

beforeEach(async () => {
  backing = stubbornStore();
  vault = new ModelVault({
    store: backing.store,
    storage: memoryStorage(),
  } as unknown as ConstructorParameters<typeof ModelVault>[0]);
  await backing.store.append(versionPath("v1", "v1.bin"), new Uint8Array(4_096).fill(1), 0);
  vault.writeMeta("v1", { verified: true, expectedBytes: 4_096, sha256: "digest-v1" });
});

function authorityOver(uninstallNative?: () => Promise<boolean>) {
  // The intent is held rather than stubbed to a constant, because whether a
  // failed removal still suppresses an automatic reinstall is one of the things
  // being checked.
  let intent: number | null = null;
  return new ModelInstallationAuthority({
    vault,
    uninstallNative,
    now: () => 1_000,
    readIntent: () => intent,
    writeIntent: (at: number | null) => {
      intent = at;
    },
  } as unknown as ConstructorParameters<typeof ModelInstallationAuthority>[0]);
}

describe("a removal that did not remove anything", () => {
  it("leaves the metadata, so the bytes are still something OCADE can see", async () => {
    backing.refuse(true);
    const result = await vault.removeEverything();

    expect(result.versionsRemoved).toBe(0);
    expect(result.remainingFiles).toBe(1);
    expect(result.remainingBytes).toBe(4_096);
    // The record that used to be thrown away, which is the only thing that
    // makes a second attempt — or an honest storage figure — possible.
    expect(vault.readMeta("v1")).not.toBeNull();
    expect((await vault.listVersions()).map((version) => version.version)).toEqual(["v1"]);
  });

  it("says so rather than reporting success", async () => {
    backing.refuse(true);
    const authority = authorityOver();

    const outcome = await authority.uninstall();
    expect(outcome.ok).toBe(false);
    expect(outcome.removed).toBe(0);
    expect(authority.snapshot().stage).toBe("recoverable_error");
    expect(authority.snapshot().problem).toMatch(/could not remove/i);
  });

  it("still refuses to reinstall on its own, because the person asked", async () => {
    backing.refuse(true);
    const authority = authorityOver();
    await authority.uninstall();
    expect(authority.uninstallIntentActive()).toBe(true);
  });

  it("does not claim success when the native copy survives either", async () => {
    const authority = authorityOver(async () => false);
    const outcome = await authority.uninstall();
    // Every browser file went; the companion's did not, and that is the case
    // where the most bytes are left behind.
    expect(backing.files.size).toBe(0);
    expect(outcome.ok).toBe(false);
    expect(authority.snapshot().stage).toBe("recoverable_error");
  });
});

describe("a removal that worked", () => {
  it("says removed, and means it", async () => {
    const authority = authorityOver(async () => true);
    const outcome = await authority.uninstall();

    expect(outcome.ok).toBe(true);
    expect(outcome.removed).toBeGreaterThan(0);
    expect(backing.files.size).toBe(0);
    expect(vault.readMeta("v1")).toBeNull();
    expect(authority.snapshot().stage).toBe("idle");
    expect(authority.snapshot().problem).toBeNull();
  });
});
