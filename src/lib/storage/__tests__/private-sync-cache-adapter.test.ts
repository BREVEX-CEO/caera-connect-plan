// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

async function module() {
  return import("../private-sync-cache-adapter");
}

function openRawDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ocade-private-sync-cache", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe("Private Sync automatic encrypted device cache", () => {
  it("writes and reads immediately without a Browser Only vault key", async () => {
    const { privateSyncCacheAdapterFor } = await module();
    const cache = privateSyncCacheAdapterFor("new-user");

    await cache.put("chats", "message-1", { text: "hi" });

    await expect(cache.get<{ text: string }>("chats", "message-1")).resolves.toMatchObject({
      value: { text: "hi" },
    });
  });

  it("keeps a non-extractable key across a full module reload", async () => {
    const firstModule = await module();
    await firstModule
      .privateSyncCacheAdapterFor("returning-user")
      .put("chats", "message-1", { text: "survives reload" });

    vi.resetModules();
    const secondModule = await module();
    const record = await secondModule
      .privateSyncCacheAdapterFor("returning-user")
      .get<{ text: string }>("chats", "message-1");
    expect(record?.value.text).toBe("survives reload");

    const db = await openRawDb();
    const keyRow = (await result(
      db.transaction("device_keys", "readonly").objectStore("device_keys").get("returning-user"),
    )) as { key: CryptoKey };
    db.close();
    expect(keyRow.key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", keyRow.key)).rejects.toThrow();
  });

  it("isolates two accounts that use the same record id", async () => {
    const { privateSyncCacheAdapterFor } = await module();
    const alice = privateSyncCacheAdapterFor("alice");
    const bob = privateSyncCacheAdapterFor("bob");
    await alice.put("chats", "same-id", { owner: "alice" });
    await bob.put("chats", "same-id", { owner: "bob" });

    expect((await alice.get<{ owner: string }>("chats", "same-id"))?.value.owner).toBe("alice");
    expect((await bob.get<{ owner: string }>("chats", "same-id"))?.value.owner).toBe("bob");
  });

  it("fails closed when ciphertext no longer authenticates", async () => {
    const { privateSyncCacheAdapterFor, PrivateSyncCacheError } = await module();
    const cache = privateSyncCacheAdapterFor("tamper-user");
    await cache.put("chats", "message-1", { text: "intact" });

    const db = await openRawDb();
    const transaction = db.transaction("records", "readwrite");
    const store = transaction.objectStore("records");
    const row = (await result(store.get("tamper-user|chats|message-1"))) as {
      ciphertext: string;
    };
    row.ciphertext = `${row.ciphertext.slice(0, -2)}AA`;
    store.put(row);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();

    await expect(cache.get("chats", "message-1")).rejects.toBeInstanceOf(PrivateSyncCacheError);
  });
});
