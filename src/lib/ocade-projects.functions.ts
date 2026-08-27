/**
 * OCADE projects, outputs and opt-in memory — server functions (Plan §17/§19/§20).
 *
 * The backing tables ship in `20260722090000_ocade_projects_outputs_memory.sql`
 * and are declared in the generated `Database` type, so every query here is
 * checked against the real schema. `scripts/check-supabase-types.mjs` keeps the
 * two in step; the `pendingFrom(): any` bridge that used to stand in for the
 * missing declarations is gone, along with the type checking it disabled.
 *
 * Access control: every table is RLS own-row scoped to auth.uid(); these
 * handlers additionally scope by context.userId so a bug can't widen access.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { readAllPages } from "@/lib/supabase/read-all";
import type { Json } from "@/integrations/supabase/types";

const uuid = z.string().uuid();

/* ---------------------------------------------------------- validation ----
 * The input schemas are exported so the rules they encode can be tested
 * directly, without standing up Supabase. They are the first line of defence:
 * anything that fails here never reaches a query.
 */

export const projectNameSchema = z.string().trim().min(1).max(200);
export const instructionsSchema = z.string().max(20_000).nullable().optional();

export const createProjectInput = z.object({
  name: projectNameSchema,
  instructions: instructionsSchema,
});

export const updateProjectInput = z.object({
  id: uuid,
  name: projectNameSchema.optional(),
  instructions: instructionsSchema,
  archived: z.boolean().optional(),
});

export const setConversationProjectInput = z.object({
  conversationId: uuid,
  /** null means "unfile" — an explicit, supported operation. */
  projectId: uuid.nullable(),
});

export const branchConversationInput = z.object({
  conversationId: uuid,
  fromMessageId: uuid,
  title: z.string().max(200).optional(),
});

export const forkConversationBeforeInput = z.object({
  conversationId: uuid,
  fromMessageId: uuid,
  title: z.string().max(200).optional(),
});

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
export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => createProjectInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ocade_projects")
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
  .validator((i) => updateProjectInput.parse(i))
  .handler(async ({ data, context }) => {
    // Typed against the table's own Update shape, so a renamed or misspelled
    // column is a compile error rather than a patch key the database ignores.
    const patch: Database["public"]["Tables"]["ocade_projects"]["Update"] = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.instructions !== undefined) patch.instructions = data.instructions;
    if (data.archived !== undefined) patch.archived = data.archived;
    const { data: row, error } =
      Object.keys(patch).length > 0
        ? await context.supabase
            .from("ocade_projects")
            .update(patch)
            .eq("id", data.id)
            .eq("user_id", context.userId)
            .select("id")
            .maybeSingle()
        : await context.supabase
            .from("ocade_projects")
            .select("id")
            .eq("id", data.id)
            .eq("user_id", context.userId)
            .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!row) throw new Response("Project not found", { status: 404 });
    return { ok: true as const };
  });
/* ------------------------------------------------------------ outputs ---- */

export const createOutputInput = z.object({
  projectId: uuid.nullable().optional(),
  conversationId: uuid.nullable().optional(),
  parentOutputId: uuid.nullable().optional(),
  kind: z.enum(["document", "export", "visual", "transcript", "other"]),
  title: z.string().trim().min(1).max(300),
  content: z.string().max(1_000_000).nullable().optional(),
  mime: z.string().max(200).nullable().optional(),
  retentionDays: z.number().int().min(1).max(3650).nullable().optional(),
});

async function sha256Text(content: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Response("SHA-256 is unavailable; output was not saved", { status: 503 });
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
/* ------------------------------------- conversations <-> projects -------- */

export interface ProjectConversation {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  project_id: string | null;
  updated_at: string;
}

/**
 * The shape a message takes when history is replayed into a new conversation.
 * Named because two call sites read it and an inline literal in both drifts.
 */
type BranchedMessage = {
  role: string;
  content: string;
  attachments: Json;
  model_id: string | null;
  provider_id: string | null;
  created_at: string;
};

export const branchConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => branchConversationInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: source } = await context.supabase
      .from("ocade_conversations")
      .select("id, title, project_id, model_id, provider_id, privacy_mode")
      .eq("id", data.conversationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!source) throw new Response("Conversation not found", { status: 404 });

    // The pivot must belong to the conversation being branched. Without this,
    // a message id from a different thread silently produces a branch cut at an
    // unrelated timestamp — and the lookup would rely on RLS alone, where every
    // other handler in this file double-scopes.
    const { data: pivot } = await context.supabase
      .from("ocade_messages")
      .select("created_at")
      .eq("id", data.fromMessageId)
      .eq("conversation_id", data.conversationId)
      .maybeSingle();
    if (!pivot) throw new Response("Message not found", { status: 404 });

    /*
     * The branch IS this history. Truncating it at the row ceiling would cut
     * the beginning off the new conversation without saying so.
     */
    const msgs = await readAllPages<BranchedMessage>((from, to) =>
      context.supabase
        .from("ocade_messages")
        .select("role, content, attachments, model_id, provider_id, created_at")
        .eq("conversation_id", data.conversationId)
        .lte("created_at", pivot.created_at)
        .order("created_at", { ascending: true })
        .range(from, to),
    );

    const { data: created, error: cErr } = await context.supabase
      .from("ocade_conversations")
      .insert({
        user_id: context.userId,
        title: data.title ?? `${source.title} (branch)`,
        project_id: source.project_id ?? null,
        model_id: source.model_id ?? null,
        provider_id: source.provider_id ?? null,
        privacy_mode: source.privacy_mode ?? "private_sync",
      })
      .select("id, title")
      .single();
    if (cErr) throw new Response(cErr.message, { status: 500 });

    if ((msgs ?? []).length > 0) {
      const rows = (msgs ?? []).map((m) => ({
        conversation_id: created.id,
        user_id: context.userId,
        role: m.role,
        content: m.content,
        attachments: m.attachments as never,
        model_id: m.model_id,
        provider_id: m.provider_id,
      }));
      const { error: mErr } = await context.supabase.from("ocade_messages").insert(rows as never);
      if (mErr) throw new Response(mErr.message, { status: 500 });
    }
    return created as { id: string; title: string };
  });

/**
 * Fork immediately before a user message. Used by edit-and-resend and retry so
 * the replacement prompt is written exactly once in the new branch.
 */
export const forkConversationBeforeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => forkConversationBeforeInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: source } = await context.supabase
      .from("ocade_conversations")
      .select("id, title, project_id, model_id, provider_id, privacy_mode")
      .eq("id", data.conversationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!source) throw new Response("Conversation not found", { status: 404 });

    // Edit-and-retry finds a pivot inside this list; a truncated list means the
    // pivot is "not found" for anybody with a long conversation.
    const messages = await readAllPages<BranchedMessage & { id: string }>((from, to) =>
      context.supabase
        .from("ocade_messages")
        .select("id, role, content, attachments, model_id, provider_id, created_at")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true })
        .range(from, to),
    );

    const pivot = (messages ?? []).findIndex((message) => message.id === data.fromMessageId);
    if (pivot < 0) throw new Response("Message not found", { status: 404 });
    if (messages![pivot].role !== "user") {
      throw new Response("Edit and retry must begin from a user message", { status: 409 });
    }

    const { data: created, error: conversationError } = await context.supabase
      .from("ocade_conversations")
      .insert({
        user_id: context.userId,
        title: data.title ?? `${source.title} (branch)`,
        project_id: source.project_id ?? null,
        model_id: source.model_id ?? null,
        provider_id: source.provider_id ?? null,
        privacy_mode: source.privacy_mode ?? "private_sync",
      })
      .select("id, title")
      .single();
    if (conversationError) throw new Response(conversationError.message, { status: 500 });

    const preceding = (messages ?? []).slice(0, pivot);
    if (preceding.length > 0) {
      const rows = preceding.map((message) => ({
        conversation_id: created.id,
        user_id: context.userId,
        role: message.role,
        content: message.content,
        attachments: message.attachments as never,
        model_id: message.model_id,
        provider_id: message.provider_id,
      }));
      const { error } = await context.supabase.from("ocade_messages").insert(rows as never);
      if (error) throw new Response(error.message, { status: 500 });
    }

    return created as { id: string; title: string };
  });

/* ------------------------------------------------------ output detail ---- */
/* ------------------------------------------------------------- memory ---- */

/** Memory is opt-in; this reports and flips the user's setting. */
export const getMemoryEnabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_settings")
      .select("ocade_memory_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return { enabled: Boolean(data?.ocade_memory_enabled) };
  });

export const setMemoryEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_settings")
      .upsert(
        { user_id: context.userId, ocade_memory_enabled: data.enabled },
        { onConflict: "user_id" },
      );
    if (error) throw new Response(error.message, { status: 500 });
    return { enabled: data.enabled };
  });

export const listMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ projectId: uuid.nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("ocade_memory")
      .select("id, scope, project_id, content, source, pinned, expires_at, updated_at")
      .eq("user_id", context.userId);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    const { data: rows, error } = await q.order("updated_at", { ascending: false }).limit(500);
    if (error) throw new Response(error.message, { status: 500 });
    return (rows ?? []) as OcadeMemoryRow[];
  });

export const addMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
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
    const { data: settings, error: settingsError } = await context.supabase
      .from("user_settings")
      .select("ocade_memory_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (settingsError) throw new Response(settingsError.message, { status: 500 });
    if (!settings?.ocade_memory_enabled) {
      throw new Response("Memory is turned off. Enable it in Settings to let OCADE remember.", {
        status: 409,
      });
    }
    const { data: row, error } = await context.supabase
      .from("ocade_memory")
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
  .validator((i) =>
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
    const patch: Database["public"]["Tables"]["ocade_memory"]["Update"] = {};
    if (data.content !== undefined) patch.content = data.content;
    if (data.pinned !== undefined) patch.pinned = data.pinned;
    if (data.expiresAt !== undefined) patch.expires_at = data.expiresAt;
    const { data: row, error } =
      Object.keys(patch).length > 0
        ? await context.supabase
            .from("ocade_memory")
            .update(patch)
            .eq("id", data.id)
            .eq("user_id", context.userId)
            .select("id")
            .maybeSingle()
        : await context.supabase
            .from("ocade_memory")
            .select("id")
            .eq("id", data.id)
            .eq("user_id", context.userId)
            .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!row) throw new Response("Memory not found", { status: 404 });
    return { ok: true as const };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ocade_memory")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!row) throw new Response("Memory not found", { status: 404 });
    return { ok: true as const };
  });

/** Wipe every memory for the current user (privacy control). */
export const clearAllMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("ocade_memory")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

export const purgeExpiredMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ocade_memory")
      .delete()
      .eq("user_id", context.userId)
      .lt("expires_at", new Date().toISOString())
      .select("id");
    if (error) throw new Response(error.message, { status: 500 });
    return { removed: (data ?? []).length };
  });
