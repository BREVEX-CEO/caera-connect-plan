/**
 * Private Sync adapter — persists records to `user_private_records`,
 * keyed by (user_id, data_class, id). Feature modules with rich schemas
 * (chats, invoices, resumes…) layer their own tables on top; this generic
 * adapter covers the storage-adapter contract for anything without a
 * bespoke schema yet.
 *
 * All access is protected by RLS scoped to auth.uid(); nothing here bypasses it.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { DataClass, StorageAdapter, StoredRecord } from "./types";

type Row = {
  user_id: string;
  data_class: string;
  id: string;
  value: Json;
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

export const syncAdapter: StorageAdapter = {
  mode: "private_sync",

  async put<T>(dataClass: DataClass, id: string, value: T) {
    const user_id = await uid();
    const { error } = await supabase.from("user_private_records").upsert(
      { user_id, data_class: dataClass, id, value: value as Json },
      { onConflict: "user_id,data_class,id" },
    );
    if (error) throw error;
  },
  async get<T>(dataClass: DataClass, id: string) {
    const user_id = await uid();
    const { data, error } = await supabase
      .from("user_private_records")
      .select("*")
      .eq("user_id", user_id)
      .eq("data_class", dataClass)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toRecord<T>(data as Row) : null;
  },
  async list<T>(dataClass: DataClass) {
    const user_id = await uid();
    const { data, error } = await supabase
      .from("user_private_records")
      .select("*")
      .eq("user_id", user_id)
      .eq("data_class", dataClass);
    if (error) throw error;
    return ((data ?? []) as Row[]).map((r) => toRecord<T>(r));
  },
  async delete(dataClass, id) {
    const user_id = await uid();
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
    let q = supabase.from("user_private_records").delete().eq("user_id", user_id);
    if (dataClass) q = q.eq("data_class", dataClass);
    const { error } = await q;
    if (error) throw error;
  },
};
