/**
 * Resolves the correct StorageAdapter for a given (user, data class).
 *
 * Reads the user's data_class_privacy row and returns the matching
 * adapter. Callers should never instantiate adapters directly — that
 * would bypass the user's privacy choice.
 */

import { supabase } from "@/integrations/supabase/client";
import type { DataClass, StorageAdapter, StorageMode } from "./types";
import { DATA_CLASSES } from "./types";
import { indexedDbAdapter } from "./indexeddb-adapter";
import { pcVaultAdapter } from "./pc-vault-adapter";
import { syncAdapterFor } from "./sync-adapter";

export const DEFAULT_MODE: Record<DataClass, StorageMode> = {
  chats: "private_sync",
  images: "private_sync",
  files: "private_sync",
  recordings: "browser_only",
  copilot: "browser_only",
  learning_replays: "browser_only",
};

const cache = new Map<string, StorageMode>(); // key = `${userId}:${dataClass}`

/*
 * THE PRIVACY MODE HAS TO BE KNOWN OFFLINE, BECAUSE IT DECIDES WHERE TO READ.
 *
 * This lookup is a Supabase round trip, and it sat in front of every read of
 * local data. With the network down the request never settles, so `Promise.all`
 * never settles, so Projects sat on "Loading projects…" for as long as anybody
 * cared to watch — with the projects themselves sitting decrypted-and-ready in
 * a store on the same machine. A local-first product asking a server for
 * permission to open a local file is the wrong shape, and offline is exactly
 * when it shows.
 *
 * The answer is not to guess: it is to remember. The mode changes when a person
 * changes it, and when they do we write it here as well as to the server, so
 * the next read knows without asking. The network is consulted only when this
 * device has never seen an answer, and even then it is time-boxed — after which
 * the documented default applies rather than a spinner.
 */
const REMEMBERED = "ocade.storage.mode.v1";
/** Long enough for a slow connection, short enough not to read as a hang. */
const LOOKUP_TIMEOUT_MS = 4_000;
/*
 * When the browser already says there is no network there is nothing to wait
 * for, and four seconds of spinner on every storage-backed screen is the whole
 * offline experience. Long enough only to let a request that is already in
 * flight finish.
 */
const OFFLINE_LOOKUP_TIMEOUT_MS = 400;

function remembered(): Record<string, StorageMode> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(REMEMBERED);
    return raw ? (JSON.parse(raw) as Record<string, StorageMode>) : {};
  } catch {
    return {};
  }
}

function remember(key: string, mode: StorageMode) {
  cache.set(key, mode);
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(REMEMBERED, JSON.stringify({ ...remembered(), [key]: mode }));
  } catch {
    /* Private browsing, or a full quota. The in-memory cache still holds. */
  }
}

function adapterFor(mode: StorageMode, userId: string): StorageAdapter {
  switch (mode) {
    case "browser_only":
      return indexedDbAdapter;
    case "pc_vault":
      return pcVaultAdapter;
    case "private_sync":
      return syncAdapterFor(userId);
  }
}

export async function getModeFor(userId: string, dataClass: DataClass): Promise<StorageMode> {
  const key = `${userId}:${dataClass}`;
  const hit = cache.get(key) ?? remembered()[key];
  if (hit) {
    cache.set(key, hit);
    return hit;
  }
  /*
   * Never seen on this device. Ask, but do not wait forever: whatever this
   * returns, the caller has a page to render.
   */
  const lookup = Promise.resolve(
    supabase
      .from("data_class_privacy")
      .select("mode")
      .eq("user_id", userId)
      .eq("data_class", dataClass)
      .maybeSingle(),
  )
    .then(({ data }) => data?.mode as StorageMode | undefined)
    .catch(() => undefined);
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const timeout = new Promise<undefined>((resolve) =>
    setTimeout(() => resolve(undefined), offline ? OFFLINE_LOOKUP_TIMEOUT_MS : LOOKUP_TIMEOUT_MS),
  );
  const answered = await Promise.race([lookup, timeout]);
  if (!answered) {
    /*
     * Not remembered: an unanswered question is not an answer, and writing the
     * default down would make a temporary network failure permanent.
     */
    return DEFAULT_MODE[dataClass];
  }
  remember(key, answered);
  return answered;
}

export async function setModeFor(userId: string, dataClass: DataClass, mode: StorageMode) {
  const { error } = await supabase
    .from("data_class_privacy")
    .upsert({ user_id: userId, data_class: dataClass, mode }, { onConflict: "user_id,data_class" });
  if (error) throw error;
  remember(`${userId}:${dataClass}`, mode);
}

export async function loadAllModes(userId: string): Promise<Record<DataClass, StorageMode>> {
  const { data } = await supabase
    .from("data_class_privacy")
    .select("data_class, mode")
    .eq("user_id", userId);
  const out = { ...DEFAULT_MODE };
  for (const row of (data ?? []) as { data_class: DataClass; mode: StorageMode }[]) {
    out[row.data_class] = row.mode;
    remember(`${userId}:${row.data_class}`, row.mode);
  }
  return out;
}

export async function resolveAdapter(
  userId: string,
  dataClass: DataClass,
): Promise<StorageAdapter> {
  return adapterFor(await getModeFor(userId, dataClass), userId);
}

export function invalidateModeCache(userId?: string) {
  if (!userId) return cache.clear();
  for (const k of Array.from(cache.keys())) if (k.startsWith(`${userId}:`)) cache.delete(k);
}

export { DATA_CLASSES };
