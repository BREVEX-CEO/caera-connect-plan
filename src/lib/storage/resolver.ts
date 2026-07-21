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
import { syncAdapter } from "./sync-adapter";

export const DEFAULT_MODE: Record<DataClass, StorageMode> = {
  chats: "private_sync",
  images: "private_sync",
  files: "private_sync",
  recordings: "browser_only",
  copilot: "browser_only",
  learning_replays: "browser_only",
  resumes: "private_sync",
  company: "private_sync",
  timesheets: "private_sync",
  accounting: "private_sync",
};

const cache = new Map<string, StorageMode>(); // key = `${userId}:${dataClass}`

function adapterFor(mode: StorageMode): StorageAdapter {
  switch (mode) {
    case "browser_only": return indexedDbAdapter;
    case "pc_vault": return pcVaultAdapter;
    case "private_sync": return syncAdapter;
  }
}

export async function getModeFor(userId: string, dataClass: DataClass): Promise<StorageMode> {
  const key = `${userId}:${dataClass}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { data } = await supabase
    .from("data_class_privacy")
    .select("mode")
    .eq("user_id", userId)
    .eq("data_class", dataClass)
    .maybeSingle();
  const mode = ((data?.mode as StorageMode | undefined) ?? DEFAULT_MODE[dataClass]);
  cache.set(key, mode);
  return mode;
}

export async function setModeFor(userId: string, dataClass: DataClass, mode: StorageMode) {
  const { error } = await supabase.from("data_class_privacy").upsert(
    { user_id: userId, data_class: dataClass, mode },
    { onConflict: "user_id,data_class" },
  );
  if (error) throw error;
  cache.set(`${userId}:${dataClass}`, mode);
}

export async function loadAllModes(userId: string): Promise<Record<DataClass, StorageMode>> {
  const { data } = await supabase
    .from("data_class_privacy")
    .select("data_class, mode")
    .eq("user_id", userId);
  const out = { ...DEFAULT_MODE };
  for (const row of (data ?? []) as { data_class: DataClass; mode: StorageMode }[]) {
    out[row.data_class] = row.mode;
    cache.set(`${userId}:${row.data_class}`, row.mode);
  }
  return out;
}

export async function resolveAdapter(userId: string, dataClass: DataClass): Promise<StorageAdapter> {
  return adapterFor(await getModeFor(userId, dataClass));
}

export function invalidateModeCache(userId?: string) {
  if (!userId) return cache.clear();
  for (const k of Array.from(cache.keys())) if (k.startsWith(`${userId}:`)) cache.delete(k);
}

export { DATA_CLASSES };
