/** FRONTEND-04: sign-out deletes the shell and private caches, keeps public assets, and never blocks the sign-out. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  clearPrivateCaches,
  signOutThisDevice,
} from "../../src/lib/security/clear-device-caches.ts";

const fake = (names: string[]) => {
  const deleted: string[] = [];
  return {
    deleted,
    store: {
      keys: async () => names,
      delete: async (name: string) => (deleted.push(name), true),
    },
  };
};

test("the shell and private-asset caches are deleted, the static assets stay", async () => {
  const { store, deleted } = fake([
    "ocade-shell-v20",
    "ocade-shell-v19",
    "ocade-assets",
    "ocade-static-assets",
    "other",
  ]);
  assert.deepEqual(await clearPrivateCaches(store), [
    "ocade-shell-v20",
    "ocade-shell-v19",
    "ocade-assets",
  ]);
  assert.deepEqual(deleted, ["ocade-shell-v20", "ocade-shell-v19", "ocade-assets"]);
});

test("no cache storage is not an error", async () => {
  assert.deepEqual(await clearPrivateCaches(undefined), []);
});

test("caches are cleared even when the sign-out fails, and the failure still reaches the caller", async () => {
  const { store, deleted } = fake(["ocade-shell-v20"]);
  (globalThis as { caches?: unknown }).caches = store;
  try {
    await assert.rejects(
      signOutThisDevice(async () => Promise.reject(new Error("offline"))),
      /offline/,
    );
    assert.deepEqual(deleted, ["ocade-shell-v20"]);
  } finally {
    delete (globalThis as { caches?: unknown }).caches;
  }
});

test("both sign-out buttons go through the cache clearing, and the worker's prefixes match", () => {
  for (const file of [
    "src/components/shell/AppShell.tsx",
    "src/components/settings/settings-dialog.tsx",
  ])
    assert.match(readFileSync(file, "utf8"), /signOutThisDevice\(/, file);
  const worker = readFileSync("public/sw.js", "utf8");
  assert.match(worker, /SHELL_CACHE_PREFIX = "ocade-shell-v"/);
});
