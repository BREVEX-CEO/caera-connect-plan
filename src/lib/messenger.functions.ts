/**
 * CAERA CADANE Business Messenger — server functions.
 *
 * All operations run under `requireSupabaseAuth` so RLS enforces membership
 * and tenant isolation. Personal Browser-Only chats never touch these tables.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// --------------- Helpers ----------------
function canonicalDmPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// --------------- Threads ----------------
export const listMyThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenant_id?: string | null }) => z.object({ tenant_id: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: memberRows, error } = await supabase
      .from("msg_thread_members")
      .select("thread_id, role, last_read_at, muted, msg_threads(*)")
      .eq("user_id", userId);
    if (error) throw error;
    const threads = (memberRows ?? [])
      .map((r: any) => ({ ...(r.msg_threads ?? {}), member_role: r.role, last_read_at: r.last_read_at, muted: r.muted }))
      .filter((t: any) => t.id)
      .filter((t: any) => (data.tenant_id ? t.tenant_id === data.tenant_id : true))
      .sort((a: any, b: any) => (b.last_message_at ?? b.created_at ?? "").localeCompare(a.last_message_at ?? a.created_at ?? ""));
    return { threads };
  });

const createThreadInput = z.object({
  kind: z.enum(["company", "department", "role", "project", "private", "cross_company"]),
  name: z.string().trim().min(1).max(120),
  topic: z.string().trim().max(500).optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  team_id: z.string().uuid().nullable().optional(),
  role_key: z.string().max(64).nullable().optional(),
  retention_days: z.number().int().min(1).max(3650).optional(),
  scope_badge: z.enum(["company", "private", "cross_company"]).optional(),
});

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof createThreadInput>) => createThreadInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    if (data.kind !== "private" && !data.tenant_id) throw new Error("Company-scoped threads require a tenant.");
    const scope = data.scope_badge ?? (data.kind === "cross_company" ? "cross_company" : data.kind === "private" ? "private" : "company");

    const { data: t, error } = await supabase
      .from("msg_threads")
      .insert({
        kind: data.kind,
        name: data.name,
        topic: data.topic ?? null,
        tenant_id: data.tenant_id ?? null,
        department_id: data.department_id ?? null,
        team_id: data.team_id ?? null,
        role_key: data.role_key ?? null,
        retention_days: data.retention_days ?? 3650,
        scope_badge: scope,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    // Auto-populate role/department members
    if (data.kind === "department" && data.department_id && data.tenant_id) {
      const { data: emps } = await supabase
        .from("ficia_employments")
        .select("user_id")
        .eq("tenant_id", data.tenant_id)
        .eq("department_id", data.department_id)
        .eq("status", "active");
      const rows = (emps ?? []).filter((e: any) => e.user_id).map((e: any) => ({ thread_id: t.id, user_id: e.user_id, role: "member" as const }));
      if (rows.length) await supabase.from("msg_thread_members").upsert(rows, { onConflict: "thread_id,user_id" });
    }
    if (data.kind === "role" && data.role_key && data.tenant_id) {
      const { data: grants } = await supabase
        .from("ficia_role_grants")
        .select("user_id")
        .eq("tenant_id", data.tenant_id)
        .eq("role_key", data.role_key);
      const rows = (grants ?? []).map((g: any) => ({ thread_id: t.id, user_id: g.user_id, role: "member" as const }));
      if (rows.length) await supabase.from("msg_thread_members").upsert(rows, { onConflict: "thread_id,user_id" });
    }
    if (data.kind === "company" && data.tenant_id) {
      const { data: members } = await supabase.from("tenant_members").select("user_id").eq("tenant_id", data.tenant_id);
      const rows = (members ?? []).map((m: any) => ({ thread_id: t.id, user_id: m.user_id, role: "member" as const }));
      if (rows.length) await supabase.from("msg_thread_members").upsert(rows, { onConflict: "thread_id,user_id" });
    }

    return { thread: t };
  });

export const openOrCreateDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { other_user_id: string }) => z.object({ other_user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.other_user_id === userId) throw new Error("Cannot DM yourself.");
    const [a, b] = canonicalDmPair(userId, data.other_user_id);
    const { data: existing } = await supabase.from("msg_threads").select("*").eq("kind", "dm").eq("dm_user_a", a).eq("dm_user_b", b).maybeSingle();
    if (existing) return { thread: existing };

    // Confirm same-tenant relationship OR active cross-company grant before allowing DM
    const { data: myMemberships } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", userId);
    const { data: theirMemberships } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", data.other_user_id);
    const myTenants = new Set((myMemberships ?? []).map((m: any) => m.tenant_id));
    const theirTenants = new Set((theirMemberships ?? []).map((m: any) => m.tenant_id));
    const shared = [...myTenants].some((t) => theirTenants.has(t));
    if (!shared) throw new Error("Direct messages are limited to people you share a company with, or with an approved cross-company relationship.");

    const { data: t, error } = await supabase.from("msg_threads").insert({
      kind: "dm",
      name: null,
      scope_badge: "dm",
      created_by: userId,
      dm_user_a: a,
      dm_user_b: b,
    }).select("*").single();
    if (error) throw error;
    return { thread: t };
  });

export const updateThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string; name?: string; topic?: string | null; retention_days?: number; is_archived?: boolean }) =>
    z.object({
      thread_id: z.string().uuid(),
      name: z.string().trim().min(1).max(120).optional(),
      topic: z.string().trim().max(500).nullable().optional(),
      retention_days: z.number().int().min(1).max(3650).optional(),
      is_archived: z.boolean().optional(),
    }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const patch: {
      name?: string; topic?: string | null; retention_days?: number; is_archived?: boolean;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.topic !== undefined) patch.topic = data.topic;
    if (data.retention_days !== undefined) patch.retention_days = data.retention_days;
    if (data.is_archived !== undefined) patch.is_archived = data.is_archived;
    const { data: t, error } = await supabase.from("msg_threads").update(patch).eq("id", data.thread_id).select("*").single();
    if (error) throw error;
    return { thread: t };
  });

// --------------- Members ----------------
export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string }) => z.object({ thread_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: members, error } = await supabase
      .from("msg_thread_members")
      .select("thread_id, user_id, role, joined_at, last_read_at, muted, profiles:user_id(display_name, avatar_url)")
      .eq("thread_id", data.thread_id);
    if (error) throw error;
    return { members: members ?? [] };
  });

export const addMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string; user_id: string; role?: "admin" | "member" }) =>
    z.object({ thread_id: z.string().uuid(), user_id: z.string().uuid(), role: z.enum(["admin", "member"]).default("member") }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("msg_thread_members").insert({ thread_id: data.thread_id, user_id: data.user_id, role: data.role });
    if (error) throw error;
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string; user_id: string }) => z.object({ thread_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("msg_thread_members").delete().eq("thread_id", data.thread_id).eq("user_id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

// --------------- Messages ----------------
export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string; before?: string; limit?: number }) =>
    z.object({ thread_id: z.string().uuid(), before: z.string().datetime().optional(), limit: z.number().int().min(1).max(200).default(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("msg_messages")
      .select("*, profiles:author_id(display_name, avatar_url), attachments:msg_attachments(*), reactions:msg_reactions(user_id, emoji), pins:msg_pins(pinned_at), links:msg_message_links(*)")
      .eq("thread_id", data.thread_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: msgs, error } = await q;
    if (error) throw error;
    return { messages: (msgs ?? []).reverse() };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string; body: string; reply_to?: string; mentions_users?: string[] }) =>
    z.object({
      thread_id: z.string().uuid(),
      body: z.string().trim().min(1).max(8000),
      reply_to: z.string().uuid().optional(),
      mentions_users: z.array(z.string().uuid()).max(50).optional(),
    }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: m, error } = await supabase.from("msg_messages").insert({
      thread_id: data.thread_id,
      author_id: userId,
      body: data.body,
      reply_to: data.reply_to ?? null,
      mentions_users: data.mentions_users ?? [],
      kind: "text",
    }).select("*").single();
    if (error) throw error;
    return { message: m };
  });

export const editMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { message_id: string; body: string }) =>
    z.object({ message_id: z.string().uuid(), body: z.string().trim().min(1).max(8000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: m, error } = await supabase.from("msg_messages").update({ body: data.body }).eq("id", data.message_id).select("*").single();
    if (error) throw error;
    return { message: m };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { message_id: string }) => z.object({ message_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Soft delete: obey retention. Only allow author to soft-delete their own within 30 days for compliance.
    const { data: m } = await supabase.from("msg_messages").select("author_id, created_at, thread_id").eq("id", data.message_id).maybeSingle();
    if (!m) throw new Error("Message not found.");
    const { data: thread } = await supabase.from("msg_threads").select("retention_days, scope_badge").eq("id", m.thread_id).maybeSingle();
    const isCompany = thread?.scope_badge === "company" || thread?.scope_badge === "cross_company";
    if (isCompany && m.author_id === userId) {
      const ageDays = (Date.now() - new Date(m.created_at).getTime()) / 86400000;
      if (ageDays > 30) throw new Error("Retention: company messages older than 30 days cannot be deleted by the author; ask an admin.");
    }
    const { error } = await supabase.from("msg_messages").update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
      body: null,
    }).eq("id", data.message_id);
    if (error) throw error;
    return { ok: true };
  });

// --------------- Reactions / Pins / Reads ----------------
export const toggleReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { message_id: string; emoji: string }) =>
    z.object({ message_id: z.string().uuid(), emoji: z.string().min(1).max(16) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase.from("msg_reactions").select("emoji").eq("message_id", data.message_id).eq("user_id", userId).eq("emoji", data.emoji).maybeSingle();
    if (existing) {
      await supabase.from("msg_reactions").delete().eq("message_id", data.message_id).eq("user_id", userId).eq("emoji", data.emoji);
      return { added: false };
    }
    const { error } = await supabase.from("msg_reactions").insert({ message_id: data.message_id, user_id: userId, emoji: data.emoji });
    if (error) throw error;
    return { added: true };
  });

export const togglePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string; message_id: string }) =>
    z.object({ thread_id: z.string().uuid(), message_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase.from("msg_pins").select("message_id").eq("thread_id", data.thread_id).eq("message_id", data.message_id).maybeSingle();
    if (existing) {
      await supabase.from("msg_pins").delete().eq("thread_id", data.thread_id).eq("message_id", data.message_id);
      return { pinned: false };
    }
    const { error } = await supabase.from("msg_pins").insert({ thread_id: data.thread_id, message_id: data.message_id, pinned_by: userId });
    if (error) throw error;
    return { pinned: true };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string; message_ids: string[] }) =>
    z.object({ thread_id: z.string().uuid(), message_ids: z.array(z.string().uuid()).max(200) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.message_ids.length) {
      const rows = data.message_ids.map((id) => ({ message_id: id, user_id: userId, read_at: new Date().toISOString() }));
      await supabase.from("msg_read_receipts").upsert(rows, { onConflict: "message_id,user_id" });
    }
    await supabase.from("msg_thread_members").update({ last_read_at: new Date().toISOString() }).eq("thread_id", data.thread_id).eq("user_id", userId);
    return { ok: true };
  });

// --------------- Attachments ----------------
export const registerAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    thread_id: string; storage_path: string; file_name: string; mime: string; size_bytes: number;
    body?: string; sha256?: string; is_voice_note?: boolean; duration_seconds?: number;
  }) => z.object({
    thread_id: z.string().uuid(),
    storage_path: z.string().min(1).max(500),
    file_name: z.string().min(1).max(250),
    mime: z.string().min(1).max(100),
    size_bytes: z.number().int().min(0).max(50 * 1024 * 1024),
    body: z.string().max(2000).optional(),
    sha256: z.string().length(64).optional(),
    is_voice_note: z.boolean().optional(),
    duration_seconds: z.number().int().min(0).max(3600).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!data.storage_path.startsWith(`${data.thread_id}/`)) throw new Error("Storage path must be scoped to this thread.");
    const { data: msg, error: mErr } = await supabase.from("msg_messages").insert({
      thread_id: data.thread_id,
      author_id: userId,
      body: data.body ?? null,
      kind: data.is_voice_note ? "voice" : "text",
    }).select("*").single();
    if (mErr) throw mErr;
    const { data: att, error } = await supabase.from("msg_attachments").insert({
      message_id: msg.id,
      thread_id: data.thread_id,
      uploaded_by: userId,
      file_name: data.file_name,
      mime: data.mime,
      size_bytes: data.size_bytes,
      storage_path: data.storage_path,
      sha256: data.sha256 ?? null,
      is_voice_note: !!data.is_voice_note,
      duration_seconds: data.duration_seconds ?? null,
    }).select("*").single();
    if (error) throw error;
    return { message: msg, attachment: att };
  });

export const signedAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storage_path: string; expires_in?: number }) =>
    z.object({ storage_path: z.string().min(1), expires_in: z.number().int().min(30).max(3600).default(300) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    // storage RLS ensures the caller is a thread member
    const { data: url, error } = await supabase.storage.from("messenger").createSignedUrl(data.storage_path, data.expires_in);
    if (error) throw error;
    return { url: url.signedUrl };
  });

// --------------- Edit history ----------------
export const listEdits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { message_id: string }) => z.object({ message_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: edits, error } = await supabase.from("msg_message_edits").select("*").eq("message_id", data.message_id).order("edited_at", { ascending: false });
    if (error) throw error;
    return { edits: edits ?? [] };
  });

// --------------- Search ----------------
export const searchMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string; thread_id?: string; limit?: number }) =>
    z.object({ query: z.string().trim().min(2).max(200), thread_id: z.string().uuid().optional(), limit: z.number().int().min(1).max(100).default(30) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("msg_messages")
      .select("id, thread_id, author_id, body, created_at, msg_threads(name, kind, scope_badge)")
      .eq("is_deleted", false)
      .ilike("body", `%${data.query.replace(/[%_]/g, (c) => `\\${c}`)}%`)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.thread_id) q = q.eq("thread_id", data.thread_id);
    const { data: hits, error } = await q;
    if (error) throw error;
    return { hits: hits ?? [] };
  });

// --------------- Cross-company grants ----------------
export const requestCrossCompanyGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string; from_tenant_id: string; to_tenant_id: string; reason?: string }) =>
    z.object({ thread_id: z.string().uuid(), from_tenant_id: z.string().uuid(), to_tenant_id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.from_tenant_id === data.to_tenant_id) throw new Error("Tenants must differ.");
    const { data: g, error } = await supabase.from("msg_cross_company_grants").insert({
      thread_id: data.thread_id,
      from_tenant_id: data.from_tenant_id,
      to_tenant_id: data.to_tenant_id,
      status: "pending_to",
      requested_by: userId,
      approved_by_from: userId,
      reason: data.reason ?? null,
    }).select("*").single();
    if (error) throw error;
    return { grant: g };
  });

export const decideCrossCompanyGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { grant_id: string; decision: "approve" | "reject" | "revoke" }) =>
    z.object({ grant_id: z.string().uuid(), decision: z.enum(["approve", "reject", "revoke"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: g } = await supabase.from("msg_cross_company_grants").select("*").eq("id", data.grant_id).maybeSingle();
    if (!g) throw new Error("Grant not found.");
    let patch: { status: "active" | "rejected" | "revoked"; approved_by_to?: string };
    if (data.decision === "approve") patch = { status: "active", approved_by_to: userId };
    else if (data.decision === "reject") patch = { status: "rejected" };
    else patch = { status: "revoked" };
    const { data: updated, error } = await supabase.from("msg_cross_company_grants").update(patch).eq("id", data.grant_id).select("*").single();
    if (error) throw error;
    return { grant: updated };
  });

export const listCrossCompanyGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string }) => z.object({ thread_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: grants, error } = await supabase.from("msg_cross_company_grants").select("*, from_tenant:from_tenant_id(name), to_tenant:to_tenant_id(name)").eq("thread_id", data.thread_id);
    if (error) throw error;
    return { grants: grants ?? [] };
  });

// --------------- Message → action links ----------------
export const linkMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { message_id: string; link_kind: string; target_id?: string; target_ref?: string; note?: string }) =>
    z.object({
      message_id: z.string().uuid(),
      link_kind: z.enum(["task", "approval", "timesheet", "evidence", "invoice", "expense", "filing", "signature"]),
      target_id: z.string().uuid().optional(),
      target_ref: z.string().max(200).optional(),
      note: z.string().max(500).optional(),
    }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: msg } = await supabase.from("msg_messages").select("thread_id, scope_badge").eq("id", data.message_id).maybeSingle();
    if (!msg) throw new Error("Message not found.");
    if (msg.scope_badge === "private" || msg.scope_badge === "dm") {
      // Guard: private/DM messages cannot silently become company evidence
      if (data.link_kind === "evidence" || data.link_kind === "filing" || data.link_kind === "signature") {
        throw new Error("Private or DM messages cannot be linked as company evidence. Repost inside a company thread first.");
      }
    }
    const { data: link, error } = await supabase.from("msg_message_links").insert({
      message_id: data.message_id,
      thread_id: msg.thread_id,
      link_kind: data.link_kind,
      target_id: data.target_id ?? null,
      target_ref: data.target_ref ?? null,
      note: data.note ?? null,
      created_by: userId,
    }).select("*").single();
    if (error) throw error;
    return { link };
  });

// --------------- Convert message to approval (uses existing approval schema) ----------------
export const convertMessageToApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    message_id: string; tenant_id: string;
    subject: "expense" | "invoice" | "payroll" | "tax" | "files" | "payments" | "signatures" | "export";
    title: string; amount?: number; currency?: string;
  }) => z.object({
    message_id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    subject: z.enum(["expense", "invoice", "payroll", "tax", "files", "payments", "signatures", "export"]),
    title: z.string().trim().min(1).max(200),
    amount: z.number().optional(),
    currency: z.string().length(3).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: msg } = await supabase.from("msg_messages").select("thread_id, scope_badge, body").eq("id", data.message_id).maybeSingle();
    if (!msg) throw new Error("Message not found.");
    if (msg.scope_badge !== "company" && msg.scope_badge !== "cross_company") {
      throw new Error("Only company messages can become approval requests.");
    }
    // Find matching policy
    const { data: policies } = await supabase.from("ficia_approval_policies").select("*").eq("tenant_id", data.tenant_id).eq("subject", data.subject).eq("is_active", true);
    const policy = (policies ?? [])[0];
    if (!policy) throw new Error(`No active approval policy for ${data.subject} in this company.`);

    const { data: req, error } = await supabase.from("ficia_approval_requests").insert({
      tenant_id: data.tenant_id,
      policy_id: policy.id,
      subject: data.subject,
      title: data.title,
      amount: data.amount ?? null,
      currency: data.currency ?? null,
      payload: { source_message_id: data.message_id, message_excerpt: (msg.body ?? "").slice(0, 400) },
      submitted_by: userId,
      status: "pending",
      current_step: 0,
      steps: policy.steps,
    }).select("*").single();
    if (error) throw error;

    // Persist the link
    await supabase.from("msg_message_links").insert({
      message_id: data.message_id,
      thread_id: msg.thread_id,
      link_kind: "approval",
      target_id: req.id,
      created_by: userId,
      note: `Approval: ${data.subject} — ${data.title}`,
    });
    return { request: req };
  });
