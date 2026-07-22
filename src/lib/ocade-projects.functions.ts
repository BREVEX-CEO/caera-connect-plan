/**
 * OCADE projects, outputs and opt-in memory — server functions (Plan §17/§19/§20).
 *
 * STATUS: the backing tables ship in the READY-TO-APPLY migration
 * `20260722090000_ocade_projects_outputs_memory.sql`. Until that migration is
 * applied and Supabase types are regenerated, the generated `Database` type has
 * no knowledge of these tables, so table access goes through the single
 * documented bridge below. Remove `pendingFrom` once the types include them —
 * nothing else in this file changes.
 *
 * Access control: every table is RLS own-row scoped to auth.uid(); these
 * handlers additionally scope by context.userId so a bug can't widen access.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

/**
 * TEMPORARY type bridge for tables that exist in an unapplied migration.
 * Intentionally the ONLY loosely-typed access point in this module.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pendingFrom(supabase: unknown, table: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as { from: (t: string) => any }).from(table);
}

export interface OcadeProject {
  id: string;
  name: string;
  instructions: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface OcadeMemoryRow {
  id: string;
  scope: "user" | "project";
  project_id: string | null;
  content: string;
  source: "user" | "inferred" | "imported";
  pinned: boolean;
  expires_at: string | null;
  updated_at: string;
}

/* ----------------------------------------------------------- projects ---- */

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ includeArchived: z.boolean().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = pendingFrom(context.supabase, "ocade_projects")
      .select("id, name, instructions, archived, created_at, updated_at")
      .eq("user_id", context.userId);
    if (!data.includeArchived) q = q.eq("archived", false);
    const { data: rows, error } = await q.order("updated_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return (rows ?? []) as OcadeProject[];
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        name: z.string().trim().min(1).max(200),
        instructions: z.string().max(20_000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await pendingFrom(context.supabase, "ocade_projects")
      .insert({
        user_id: context.userId,
        name: data.name,
        instructions: data.instructions ?? null,
      })
      .select("id, name, instructions, archived, created_at, updated_at")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return row as OcadeProject;
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: uuid,
        name: z.string().trim().min(1).max(200).optional(),
        instructions: z.string().max(20_000).nullable().optional(),
        archived: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.instructions !== undefined) patch.instructions = data.instructions;
    if (data.archived !== undefined) patch.archived = data.archived;
    const { error } = await pendingFrom(context.supabase, "ocade_projects")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await pendingFrom(context.supabase, "ocade_projects")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/* ------------------------------------------------------------ outputs ---- */

export const listOutputs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ projectId: uuid.nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = pendingFrom(context.supabase, "ocade_outputs")
      .select("id, project_id, conversation_id, kind, title, mime, size_bytes, created_at")
      .eq("user_id", context.userId);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(200);
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

export const createOutput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        projectId: uuid.nullable().optional(),
        conversationId: uuid.nullable().optional(),
        kind: z.enum(["document", "export", "visual", "transcript", "other"]),
        title: z.string().trim().min(1).max(300),
        content: z.string().max(1_000_000).nullable().optional(),
        mime: z.string().max(200).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await pendingFrom(context.supabase, "ocade_outputs")
      .insert({
        user_id: context.userId,
        project_id: data.projectId ?? null,
        conversation_id: data.conversationId ?? null,
        kind: data.kind,
        title: data.title,
        content: data.content ?? null,
        mime: data.mime ?? null,
        size_bytes: data.content ? new TextEncoder().encode(data.content).length : 0,
      })
      .select("id, kind, title, created_at")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return row;
  });

/* ------------------------------------------------------------- memory ---- */

/** Memory is opt-in; this reports and flips the user's setting. */
export const getMemoryEnabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await pendingFrom(context.supabase, "user_settings")
      .select("ocade_memory_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { enabled: Boolean(data?.ocade_memory_enabled) };
  });

export const setMemoryEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await pendingFrom(context.supabase, "user_settings")
      .upsert({ user_id: context.userId, ocade_memory_enabled: data.enabled }, { onConflict: "user_id" });
    if (error) throw new Response(error.message, { status: 500 });
    return { enabled: data.enabled };
  });

export const listMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ projectId: uuid.nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = pendingFrom(context.supabase, "ocade_memory")
      .select("id, scope, project_id, content, source, pinned, expires_at, updated_at")
      .eq("user_id", context.userId);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    const { data: rows, error } = await q.order("updated_at", { ascending: false }).limit(500);
    if (error) throw new Response(error.message, { status: 500 });
    return (rows ?? []) as OcadeMemoryRow[];
  });

export const addMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        content: z.string().trim().min(1).max(8000),
        scope: z.enum(["user", "project"]).default("user"),
        projectId: uuid.nullable().optional(),
        source: z.enum(["user", "inferred", "imported"]).default("user"),
        expiresAt: z.string().datetime().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Memory must be opted in before anything is written.
    const { data: settings } = await pendingFrom(context.supabase, "user_settings")
      .select("ocade_memory_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!settings?.ocade_memory_enabled) {
      throw new Response("Memory is turned off. Enable it in Settings to let OCADE remember.", {
        status: 409,
      });
    }
    const { data: row, error } = await pendingFrom(context.supabase, "ocade_memory")
      .insert({
        user_id: context.userId,
        scope: data.scope,
        project_id: data.scope === "project" ? (data.projectId ?? null) : null,
        content: data.content,
        source: data.source,
        expires_at: data.expiresAt ?? null,
      })
      .select("id, scope, project_id, content, source, pinned, expires_at, updated_at")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return row as OcadeMemoryRow;
  });

export const updateMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: uuid,
        content: z.string().trim().min(1).max(8000).optional(),
        pinned: z.boolean().optional(),
        expiresAt: z.string().datetime().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.content !== undefined) patch.content = data.content;
    if (data.pinned !== undefined) patch.pinned = data.pinned;
    if (data.expiresAt !== undefined) patch.expires_at = data.expiresAt;
    const { error } = await pendingFrom(context.supabase, "ocade_memory")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await pendingFrom(context.supabase, "ocade_memory")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/** Wipe every memory for the current user (privacy control). */
export const clearAllMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await pendingFrom(context.supabase, "ocade_memory")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });
