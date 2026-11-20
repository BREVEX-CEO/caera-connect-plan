import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/lib/security/session-middleware";
import { builtInSkills } from "./packages";

/**
 * THE PERSON'S OWN SKILLS (plan 14E.6.6, REPO-57/67): named procedures they write and name with
 * `/name` in a JARVIS request. Everything here runs as the caller, so the row-level policies
 * decide what each call touches; the database keeps every earlier version itself.
 */
const uuid = z.string().uuid();
export const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

export interface SkillRow {
  id: string;
  name: string;
  title: string;
  body: string;
  version: number;
  updated_at: string;
  versions: { version: number; title: string; body: string; created_at: string }[];
}

export const listSkills = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<SkillRow[]> => {
    const [skills, versions] = await Promise.all([
      context.supabase
        .from("ocade_skills")
        .select("id, name, title, body, version, updated_at")
        .order("name")
        .limit(200),
      context.supabase
        .from("ocade_skill_versions")
        .select("skill_id, version, title, body, created_at")
        .order("version", { ascending: false })
        .limit(1000),
    ]);
    if (skills.error || versions.error) throw new Error("Your skills could not be read just now.");
    return (skills.data ?? []).map((skill) => ({
      ...skill,
      versions: (versions.data ?? [])
        .filter((v) => v.skill_id === skill.id)
        .map(({ skill_id: _skill, ...v }) => v),
    }));
  });

export const saveSkill = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) =>
    z
      .object({
        id: uuid.nullable(),
        name: z
          .string()
          .trim()
          .toLowerCase()
          .regex(SKILL_NAME, "Use lowercase letters, digits and hyphens."),
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(8000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error, data: row } = await context.supabase
        .from("ocade_skills")
        .update({ title: data.title, body: data.body })
        .eq("id", data.id)
        .select("id")
        .maybeSingle();
      if (error || !row) throw new Error("That skill could not be saved.");
      return { id: row.id };
    }
    if (builtInSkills([data.name]).length)
      throw new Error(`/${data.name} is one of OCADE's own packages. Choose another name.`);
    const { error, data: row } = await context.supabase
      .from("ocade_skills")
      .insert({ user_id: context.userId, name: data.name, title: data.title, body: data.body })
      .select("id")
      .single();
    if (error?.code === "23505") throw new Error(`You already have a skill called /${data.name}.`);
    if (error || !row) throw new Error("That skill could not be saved.");
    return { id: row.id };
  });

/** Write an earlier version's exact text back; the current text becomes a version too. */
export const restoreSkill = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid, version: z.number().int().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: old, error } = await context.supabase
      .from("ocade_skill_versions")
      .select("title, body")
      .eq("skill_id", data.id)
      .eq("version", data.version)
      .maybeSingle();
    if (error || !old) throw new Error("That version is not available.");
    const updated = await context.supabase
      .from("ocade_skills")
      .update({ title: old.title, body: old.body })
      .eq("id", data.id)
      .select("version")
      .maybeSingle();
    if (updated.error || !updated.data) throw new Error("That version could not be restored.");
    return { version: updated.data.version };
  });

export const deleteSkill = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ocade_skills").delete().eq("id", data.id);
    if (error) throw new Error("That skill could not be deleted.");
    return { deleted: true };
  });
