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
import type { Database, Json } from "@/integrations/supabase/types";
import { readAllPages } from "@/lib/supabase/read-all";

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
  /*
   * REQUIRED, not optional. An output with no record of what produced it is
   * just a file, and OCADE will not store one — that is how an unchecked result
   * becomes indistinguishable from a checked one.
   */
  producedBy: z.string().trim().min(1).max(300),
  /*
   * Whether the producing step CONFIRMED its own result. Defaulted to false
   * rather than omitted: a caller that forgets to say gets the safe answer.
   */
  verified: z.boolean().default(false),
  evidence: z.string().max(2000).nullable().optional(),
  context: z
    .object({
      conversationId: z.string().max(200).optional(),
      messageId: z.string().max(200).optional(),
      projectId: z.string().max(200).optional(),
      projectName: z.string().max(300).optional(),
      projectInstructions: z.string().max(20_000).optional(),
      files: z
        .array(z.object({ name: z.string().max(500), sha256: z.string().max(64) }))
        .max(100)
        .optional(),
    })
    .nullable()
    .optional(),
});

async function sha256Text(content: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Response("SHA-256 is unavailable; output was not saved", { status: 503 });
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
/* ------------------------------------------------------------ reading ---- */

/**
 * Every project the account has, newest first.
 *
 * This did not exist: the Projects screen read an encrypted browser store, so
 * a project created on a laptop was invisible on a phone and gone when
 * somebody cleared their browser. `PLAN.md` Phase 2 makes the row the project.
 */
export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rows = await readAllPages<OcadeProject>((from, to) =>
      context.supabase
        .from("ocade_projects")
        .select("id, name, instructions, archived, created_at, updated_at")
        .eq("user_id", context.userId)
        .order("updated_at", { ascending: false })
        .range(from, to),
    ).catch((cause: Error) => {
      throw new Response(cause.message, { status: 500 });
    });
    return rows;
  });

/**
 * Delete a project.
 *
 * Its files, folders and item links go with it through their foreign keys.
 * Conversations do NOT: `ocade_conversations.project_id` is nullable and
 * deleting a project must not delete the conversations somebody filed in it.
 */
export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error: unfiled } = await context.supabase
      .from("ocade_conversations")
      .update({ project_id: null })
      .eq("project_id", data.id)
      .eq("user_id", context.userId);
    if (unfiled) throw new Response(unfiled.message, { status: 500 });

    const { error } = await context.supabase
      .from("ocade_projects")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/* ------------------------------------------------------- project files ---- */

export interface OcadeProjectFile {
  id: string;
  project_id: string;
  folder: string;
  name: string;
  mime: string;
  size_bytes: number;
  text: string;
  content_sha256: string;
  created_at: string;
}

export interface OcadeProjectFolder {
  id: string;
  project_id: string;
  path: string;
  created_at: string;
}

const PROJECT_FILE_COLUMNS =
  "id, project_id, folder, name, mime, size_bytes, text, content_sha256, created_at";

export const listProjectFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ projectId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    /*
     * PAGED, NOT CAPPED. A project's files are what its conversations answer
     * from, so a silent truncation at PostgREST's row ceiling would quietly
     * withhold material the person put there on purpose.
     */
    const rows = await readAllPages<OcadeProjectFile>((from, to) =>
      context.supabase
        .from("ocade_project_files")
        .select(PROJECT_FILE_COLUMNS)
        .eq("project_id", data.projectId)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .range(from, to),
    ).catch((cause: Error) => {
      throw new Response(cause.message, { status: 500 });
    });
    return rows;
  });

export const saveProjectFileInput = z.object({
  projectId: uuid,
  folder: z.string().max(400).default(""),
  name: z.string().trim().min(1).max(500),
  mime: z.string().max(200).default("text/plain"),
  sizeBytes: z.number().int().nonnegative(),
  /**
   * The text OCADE extracted on the device.
   *
   * The original binary is deliberately not uploaded: the product reads it in
   * the browser and keeps only what a model would read. Moving to one storage
   * authority is not a reason to start collecting more than before.
   */
  text: z.string().max(250_000),
});

export const saveProjectFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => saveProjectFileInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("ocade_projects")
      .select("id")
      .eq("id", data.projectId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!project) throw new Response("Project not found", { status: 404 });

    const { data: row, error } = await context.supabase
      .from("ocade_project_files")
      .insert({
        user_id: context.userId,
        project_id: data.projectId,
        folder: data.folder,
        name: data.name,
        mime: data.mime,
        size_bytes: data.sizeBytes,
        text: data.text,
        content_sha256: await sha256Text(data.text),
      })
      .select(PROJECT_FILE_COLUMNS)
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return row as OcadeProjectFile;
  });

export const deleteProjectFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ocade_project_files")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

export const listProjectFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ projectId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const rows = await readAllPages<OcadeProjectFolder>((from, to) =>
      context.supabase
        .from("ocade_project_folders")
        .select("id, project_id, path, created_at")
        .eq("project_id", data.projectId)
        .eq("user_id", context.userId)
        .order("path", { ascending: true })
        .range(from, to),
    ).catch((cause: Error) => {
      throw new Response(cause.message, { status: 500 });
    });
    return rows;
  });

export const createProjectFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ projectId: uuid, path: z.string().trim().min(1).max(400) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ocade_project_folders")
      .insert({ user_id: context.userId, project_id: data.projectId, path: data.path })
      .select("id, project_id, path, created_at")
      .single();
    /*
     * A folder that already exists is not an error to show anybody: the person
     * asked for a place to put things and that place exists. Read it back
     * rather than refusing.
     */
    if (error?.code === "23505") {
      const { data: existing } = await context.supabase
        .from("ocade_project_folders")
        .select("id, project_id, path, created_at")
        .eq("project_id", data.projectId)
        .eq("path", data.path)
        .maybeSingle();
      if (existing) return existing as OcadeProjectFolder;
    }
    if (error) throw new Response(error.message, { status: 500 });
    return row as OcadeProjectFolder;
  });

export const deleteProjectFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ocade_project_folders")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/* ------------------------------------------------------------ outputs ---- */

/**
 * What OCADE produced, with the record of what made it.
 *
 * The provenance fields are not decoration. The questions that matter when
 * somebody finds an output three weeks later are: what made this, did that step
 * actually check its own result, and are these still the bytes that were
 * written. `produced_by`, `verified` and `content_sha256` answer all three, and
 * `verified: false` is rendered every time the output is listed rather than once
 * at creation — a result nothing confirmed is indistinguishable from a confirmed
 * one by looking at the content.
 */
export interface OcadeOutput {
  id: string;
  project_id: string | null;
  conversation_id: string | null;
  parent_output_id: string | null;
  kind: "document" | "export" | "visual" | "transcript" | "other";
  title: string;
  content: string | null;
  mime: string | null;
  size_bytes: number;
  lineage_id: string;
  version: number;
  content_sha256: string | null;
  /** Null only on rows written before provenance was recorded. */
  produced_by: string | null;
  verified: boolean;
  evidence: string | null;
  context: OutputContext | null;
  expires_at: string | null;
  created_at: string;
}

/** Where an output came from, kept whole and never filtered on. */
export interface OutputContext {
  conversationId?: string;
  messageId?: string;
  projectId?: string;
  projectName?: string;
  projectInstructions?: string;
  files?: Array<{ name: string; sha256: string }>;
}

const OUTPUT_COLUMNS =
  "id, project_id, conversation_id, parent_output_id, kind, title, content, mime, size_bytes, lineage_id, version, content_sha256, produced_by, verified, evidence, context, expires_at, created_at";

export const listOutputs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ projectId: uuid.nullable().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    /*
     * Paged as the row shape the query returns, then narrowed once. `kind` is a
     * text column and `context` is `jsonb`, so the generated types say `string`
     * and `Json`; the shapes OCADE works in are asserted at the boundary rather
     * than pushed into the query, where they would only be claims about the
     * database that the database does not make.
     */
    const rows = await readAllPages<
      Omit<OcadeOutput, "kind" | "context"> & { kind: string; context: Json | null }
    >((from, to) => {
      const query = context.supabase
        .from("ocade_outputs")
        .select(OUTPUT_COLUMNS)
        .eq("user_id", context.userId);
      return (data.projectId ? query.eq("project_id", data.projectId) : query)
        .order("created_at", { ascending: false })
        .range(from, to);
    }).catch((cause: Error) => {
      throw new Response(cause.message, { status: 500 });
    });
    return rows as unknown as OcadeOutput[];
  });

export const getOutput = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ocade_outputs")
      .select(OUTPUT_COLUMNS)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!row) throw new Response("Output not found", { status: 404 });
    return row as unknown as OcadeOutput;
  });

/**
 * Record one output, with its lineage.
 *
 * VERSIONS ARE A CHAIN, NOT A COUNTER. A new version names its parent, inherits
 * that parent's `lineage_id`, and takes the next number in the chain — so the
 * history of an artifact is readable from the rows themselves rather than from
 * a separate table that has to be kept in step.
 */
export const createOutput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => createOutputInput.parse(i))
  .handler(async ({ data, context }) => {
    const content = data.content ?? null;

    let lineageId: string | null = null;
    let version = 1;
    if (data.parentOutputId) {
      const { data: parent } = await context.supabase
        .from("ocade_outputs")
        .select("id, lineage_id, version")
        .eq("id", data.parentOutputId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!parent) throw new Response("Parent output not found", { status: 404 });
      lineageId = parent.lineage_id;
      version = parent.version + 1;
    }

    const expiresAt = data.retentionDays
      ? new Date(Date.now() + data.retentionDays * 86_400_000).toISOString()
      : null;

    const insert: Database["public"]["Tables"]["ocade_outputs"]["Insert"] = {
      user_id: context.userId,
      project_id: data.projectId ?? null,
      conversation_id: data.conversationId ?? null,
      parent_output_id: data.parentOutputId ?? null,
      kind: data.kind,
      title: data.title,
      content,
      mime: data.mime ?? null,
      size_bytes: content ? new TextEncoder().encode(content).length : 0,
      version,
      content_sha256: content ? await sha256Text(content) : null,
      produced_by: data.producedBy,
      verified: data.verified,
      evidence: data.evidence ?? null,
      context: (data.context ??
        null) as Database["public"]["Tables"]["ocade_outputs"]["Insert"]["context"],
      expires_at: expiresAt,
    };
    /*
     * A first version is its own lineage, and the id is only known after the
     * insert. Written in two steps rather than pre-generating an id, so the
     * database stays the source of both.
     */
    if (lineageId) insert.lineage_id = lineageId;

    const { data: row, error } = await context.supabase
      .from("ocade_outputs")
      .insert(insert)
      .select(OUTPUT_COLUMNS)
      .single();
    if (error) throw new Response(error.message, { status: 500 });

    if (!lineageId && row.lineage_id !== row.id) {
      const { error: seeded } = await context.supabase
        .from("ocade_outputs")
        .update({ lineage_id: row.id })
        .eq("id", row.id)
        .eq("user_id", context.userId);
      if (seeded) throw new Response(seeded.message, { status: 500 });
      return { ...row, lineage_id: row.id } as unknown as OcadeOutput;
    }
    return row as unknown as OcadeOutput;
  });

/**
 * Change how long an output is kept.
 *
 * `null` days means keep until deleted, and it is a supported operation rather
 * than an omission: somebody who set a retention has to be able to take it off
 * again, and a function that could only set one would leave them no way back.
 */
export const setOutputRetention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z.object({ id: uuid, days: z.number().int().min(1).max(3650).nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const expiresAt =
      data.days === null ? null : new Date(Date.now() + data.days * 86_400_000).toISOString();
    const { data: row, error } = await context.supabase
      .from("ocade_outputs")
      .update({ expires_at: expiresAt })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select(OUTPUT_COLUMNS)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!row) throw new Response("Output not found", { status: 404 });
    return row as unknown as OcadeOutput;
  });

export const deleteOutput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ocade_outputs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/**
 * Remove outputs whose retention has run out.
 *
 * Called when the Projects screen opens rather than on a schedule: retention
 * that only runs when a background job is healthy is retention nobody can
 * rely on, and the read that would have listed them is already happening.
 */
export const purgeExpiredOutputs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("ocade_outputs")
      .delete()
      .eq("user_id", context.userId)
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString())
      .select("id");
    if (error) throw new Response(error.message, { status: 500 });
    return { removed: rows?.length ?? 0 };
  });

/* ------------------------------------- conversations <-> projects -------- */

/**
 * File a conversation into a project, or take it out of one.
 *
 * `null` is a supported operation rather than an omission: "not in a project"
 * is a state somebody chooses, and a function that could only file would leave
 * them no way back.
 */
export const setConversationProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => setConversationProjectInput.parse(i))
  .handler(async ({ data, context }) => {
    if (data.projectId) {
      const { data: project } = await context.supabase
        .from("ocade_projects")
        .select("id")
        .eq("id", data.projectId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!project) throw new Response("Project not found", { status: 404 });
    }
    const { data: row, error } = await context.supabase
      .from("ocade_conversations")
      .update({ project_id: data.projectId })
      .eq("id", data.conversationId)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!row) throw new Response("Conversation not found", { status: 404 });
    return { ok: true as const };
  });

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

/**
 * The setting and the rows in ONE request.
 *
 * Every screen that uses memory needs both: rows are meaningless without
 * knowing whether memory is on, and asking for them separately means two round
 * trips before a message can be sent, plus a window in which the two answers
 * disagree.
 */
export const readMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: settings, error: settingsError } = await context.supabase
      .from("user_settings")
      .select("ocade_memory_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (settingsError) throw new Response(settingsError.message, { status: 500 });
    const enabled = Boolean(settings?.ocade_memory_enabled);
    /*
     * Rows are returned even when memory is switched OFF. Pausing memory stops
     * it growing; it does not delete what is there, and the export and the
     * review list both have to keep telling the truth about that. Whether the
     * rows reach a model is the caller's decision, and it is made from
     * `enabled`.
     */
    const { data: rows, error } = await context.supabase
      .from("ocade_memory")
      .select("id, scope, project_id, content, source, pinned, expires_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Response(error.message, { status: 500 });
    return { enabled, rows: (rows ?? []) as OcadeMemoryRow[] };
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
