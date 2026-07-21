/**
 * MADEE Resume server functions — CRUD for projects and versions.
 *
 * Rules:
 * - Every mutation runs behind requireSupabaseAuth; RLS enforces ownership.
 * - Create requires the caller's attestation (full name + acceptance text).
 *   The DB trigger enforcement_resume_attestation is the second line of defence.
 * - Version content is stored server-side ONLY when storage_mode = "private_sync".
 *   For "browser_only" projects we still create the version row (so history
 *   works cross-device for metadata / labels), but content_stored_locally = true
 *   and content stays in the client's IndexedDB adapter.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

const NewProjectInput = z.object({
  title: z.string().trim().min(1).max(160),
  profession: z.string().max(160).nullable().optional(),
  experienceLevel: z
    .enum(["student", "entry", "mid", "senior", "executive", "other"])
    .nullable()
    .optional(),
  storageMode: z.enum(["browser_only", "private_sync"]).default("private_sync"),
  attestationFullName: z.string().trim().min(2).max(160),
  attestationText: z.string().max(2000),
  targetRole: z.string().max(200).nullable().optional(),
});

export const listResumeProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("madee_resume_projects")
      .select(
        "id, title, profession, experience_level, storage_mode, current_version_id, target_role, archived, created_at, updated_at",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const createResumeProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => NewProjectInput.parse(i))
  .handler(async ({ data, context }) => {
    // Soft rate-limit: no more than 20 non-archived resume projects per user.
    const { count } = await context.supabase
      .from("madee_resume_projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("archived", false);
    if ((count ?? 0) >= 20) {
      throw new Response(
        "Resume project cap reached (20 active). Archive an old project to add a new one.",
        { status: 429 },
      );
    }

    const { data: proj, error } = await context.supabase
      .from("madee_resume_projects")
      .insert({
        user_id: context.userId,
        title: data.title,
        profession: data.profession ?? null,
        experience_level: data.experienceLevel ?? null,
        storage_mode: data.storageMode,
        target_role: data.targetRole ?? null,
        attestation_accepted_at: new Date().toISOString(),
        attestation_full_name: data.attestationFullName,
        attestation_text: data.attestationText,
      })
      .select("*")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return proj;
  });

const UpdateProjectInput = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(160).optional(),
  profession: z.string().max(160).nullable().optional(),
  experienceLevel: z
    .enum(["student", "entry", "mid", "senior", "executive", "other"])
    .nullable()
    .optional(),
  targetRole: z.string().max(200).nullable().optional(),
  archived: z.boolean().optional(),
  currentVersionId: uuid.nullable().optional(),
});

export const updateResumeProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpdateProjectInput.parse(i))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.profession !== undefined) patch.profession = data.profession;
    if (data.experienceLevel !== undefined) patch.experience_level = data.experienceLevel;
    if (data.targetRole !== undefined) patch.target_role = data.targetRole;
    if (data.archived !== undefined) patch.archived = data.archived;
    if (data.currentVersionId !== undefined) patch.current_version_id = data.currentVersionId;
    const { data: row, error } = await context.supabase
      .from("madee_resume_projects")
      .update(patch as never)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return row;
  });

export const deleteResumeProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("madee_resume_projects")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/* -------------------- Versions -------------------- */

export const listResumeVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ projectId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("madee_resume_versions")
      .select("id, project_id, version_number, label, content_stored_locally, ai_notes, created_at")
      .eq("project_id", data.projectId)
      .eq("user_id", context.userId)
      .order("version_number", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

export const getResumeVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("madee_resume_versions")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return row;
  });

const CreateVersionInput = z.object({
  projectId: uuid,
  label: z.string().max(160).nullable().optional(),
  content: z.unknown().optional(), // full content when private_sync; omitted when browser_only
  contentStoredLocally: z.boolean().default(false),
  aiNotes: z.record(z.string(), z.unknown()).optional(),
  setAsCurrent: z.boolean().default(true),
});

export const createResumeVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateVersionInput.parse(i))
  .handler(async ({ data, context }) => {
    // Verify caller owns the project (RLS also enforces this).
    const { data: proj, error: pErr } = await context.supabase
      .from("madee_resume_projects")
      .select("id, storage_mode")
      .eq("id", data.projectId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (pErr) throw new Response(pErr.message, { status: 500 });
    if (!proj) throw new Response("Project not found", { status: 404 });

    const storeContent = proj.storage_mode === "private_sync" && !data.contentStoredLocally;
    const { data: v, error } = await context.supabase
      .from("madee_resume_versions")
      .insert({
        project_id: data.projectId,
        user_id: context.userId,
        label: data.label ?? null,
        content: storeContent ? ((data.content ?? {}) as never) : ({} as never),
        content_stored_locally: !storeContent,
        ai_notes: (data.aiNotes ?? {}) as never,
        version_number: 0, // trigger set_resume_version_number overrides
      })
      .select("*")
      .single();
    if (error) throw new Response(error.message, { status: 500 });

    if (data.setAsCurrent) {
      await context.supabase
        .from("madee_resume_projects")
        .update({ current_version_id: v.id } as never)
        .eq("id", data.projectId)
        .eq("user_id", context.userId);
    }
    return v;
  });

export const renameResumeVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: uuid, label: z.string().max(160) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("madee_resume_versions")
      .update({ label: data.label } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

export const deleteResumeVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("madee_resume_versions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/**
 * Duplicate project + copy every version. Content copy only for private_sync
 * projects (browser_only content lives in IndexedDB on the origin device).
 * Attestation is re-required on the caller side; we reuse the existing one.
 */
export const duplicateResumeProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: uuid, newTitle: z.string().trim().min(1).max(160) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: src, error: pErr } = await context.supabase
      .from("madee_resume_projects")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (pErr) throw new Response(pErr.message, { status: 500 });
    if (!src) throw new Response("Project not found", { status: 404 });

    const { data: dup, error: cErr } = await context.supabase
      .from("madee_resume_projects")
      .insert({
        user_id: context.userId,
        title: data.newTitle,
        profession: src.profession,
        experience_level: src.experience_level,
        storage_mode: src.storage_mode,
        target_role: src.target_role,
        attestation_accepted_at: src.attestation_accepted_at,
        attestation_full_name: src.attestation_full_name,
        attestation_text: src.attestation_text,
      })
      .select("*")
      .single();
    if (cErr) throw new Response(cErr.message, { status: 500 });

    if (src.storage_mode === "private_sync" && src.current_version_id) {
      const { data: v } = await context.supabase
        .from("madee_resume_versions")
        .select("content, ai_notes, label")
        .eq("id", src.current_version_id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (v) {
        const { data: nv } = await context.supabase
          .from("madee_resume_versions")
          .insert({
            project_id: dup.id,
            user_id: context.userId,
            label: v.label ? `${v.label} (copy)` : "Duplicated",
            content: v.content as never,
            ai_notes: v.ai_notes as never,
            content_stored_locally: false,
            version_number: 0, // trigger overrides
          })
          .select("id")
          .single();
        if (nv) {
          await context.supabase
            .from("madee_resume_projects")
            .update({ current_version_id: nv.id } as never)
            .eq("id", dup.id)
            .eq("user_id", context.userId);
        }
      }
    }
    return dup;
  });
