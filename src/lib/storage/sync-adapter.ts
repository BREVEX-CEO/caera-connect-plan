/**
 * Private Sync adapter — persists records to a single Supabase table
 * (`user_private_records`) keyed by (user_id, data_class, id). Feature
 * modules with rich schemas (chats, invoices, resumes…) will layer their
 * own tables on top; this generic adapter covers the storage-adapter
 * contract for anything that doesn't need a bespoke schema yet.
 *
 * Rows are protected by RLS scoped to auth.uid(); nothing here bypasses it.
 */

import { supabase } from "@/integrations/supabase/client";
import type { DataClass, StorageAdapter, StoredRecord } from "./types";

type Row = {
  user_id: string;
  data_class: string;
  id: string;
  value: unknown;
  created_at: string;
  updated_at: string;
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Private Sync requires an authenticated session.");
  return id;
}

function toRecord<T>(r: Row): StoredRecord<T> {
  return {
    id: r.id,
    dataClass: r.data_class as DataClass,
    createdAt: Date.parse(r.created_at),
    updatedAt: Date.parse(r.updated_at),
    value: r.value as T,
  };
}

/** Falls back gracefully when `user_private_records` isn't in the schema
 *  yet — the adapter still satisfies its contract by surfacing a clear
 *  error rather than silently swallowing writes. */
export const syncAdapter: StorageAdapter = {
  mode: "private_sync",

  async put(dataClass, id, value) {
    const user_id = await uid();
    // @ts-expect-error generated types may lag the runtime schema
    const { error } = await supabase.from("user_private_records").upsert(
      { user_id, data_class: dataClass, id, value },
      { onConflict: "user_id,data_class,id" },
    );
    if (error) throw error;
  },
  async get(dataClass, id) {
    const user_id = await uid();
    // @ts-expect-error generated types may lag the runtime schema
    const { data, error } = await supabase
      .from("user_private_records")
      .select("*")
      .eq("user_id", user_id)
      .eq("data_class", dataClass)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toRecord(data as Row) : null;
  },
  async list(dataClass) {
    const user_id = await uid();
    // @ts-expect-error generated types may lag the runtime schema
    const { data, error } = await supabase
      .from("user_private_records")
      .select("*")
      .eq("user_id", user_id)
      .eq("data_class", dataClass);
    if (error) throw error;
    return (data as Row[] | null)?.map(toRecord) ?? [];
  },
  async delete(dataClass, id) {
    const user_id = await uid();
    // @ts-expect-error generated types may lag the runtime schema
    const { error } = await supabase
      .from("user_private_records")
      .delete()
      .eq("user_id", user_id)
      .eq("data_class", dataClass)
      .eq("id", id);
    if (error) throw error;
  },
  async clear(dataClass) {
    const user_id = await uid();
    // @ts-expect-error generated types may lag the runtime schema
    let q = supabase.from("user_private_records").delete().eq("user_id", user_id);
    if (dataClass) q = q.eq("data_class", dataClass);
    const { error } = await q;
    if (error) throw error;
  },
};
