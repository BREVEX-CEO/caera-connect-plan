/**
 * MADEE AI helpers — grammar, stronger bullets, summary, ATS guidance,
 * job-description matching, upload-parsing.
 *
 * Every call goes through Lovable AI Gateway (server-side only). If the
 * key is missing or the gateway errors, we return an { error } shape so
 * the editor stays fully usable via manual editing.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableGateway, OCADE_DEFAULT_MODEL } from "./ai-gateway.server";

type AiFailure = { ok: false; error: string };
type AiSuccess<T> = { ok: true; result: T };
type AiResult<T> = AiSuccess<T> | AiFailure;

function fail(msg: string): AiFailure {
  return { ok: false, error: msg };
}

async function runModel(system: string, user: string): Promise<AiResult<string>> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return fail("AI is not configured on this server. Manual editing still works.");
  try {
    const gateway = createLovableGateway(key);
    const { text } = await generateText({
      model: gateway(OCADE_DEFAULT_MODEL),
      system,
      prompt: user,
    });
    return { ok: true, result: text.trim() };
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status === 429) return fail("AI rate limit hit. Try again in a moment.");
    if (err.status === 402) return fail("AI credits exhausted for this workspace.");
    return fail(err.message ?? "AI request failed. Manual editing is unaffected.");
  }
}

/* -------------------- Bullet improvement -------------------- */

export const improveResumeBullet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        bullet: z.string().trim().min(1).max(800),
        role: z.string().max(200).optional(),
        company: z.string().max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const context = [data.role, data.company].filter(Boolean).join(" at ");
    return runModel(
      "You are a resume writing coach. Rewrite a single bullet point to be stronger: start with a strong action verb, keep it concise (one sentence), quantify impact when the input contains numbers, and never invent facts. Return only the rewritten bullet, no quotes, no explanation.",
      `Context: ${context || "(no role provided)"}\nOriginal bullet: ${data.bullet}`,
    );
  });

/* -------------------- Summary generation -------------------- */

export const generateResumeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        profession: z.string().max(200).optional(),
        experienceLevel: z.string().max(60).optional(),
        skills: z.array(z.string().max(120)).max(50).optional(),
        highlights: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    return runModel(
      "You draft resume professional summaries. Write a 2 to 3 sentence summary in the first person implicit voice (no 'I'). Keep it factual — use only the facts provided. Do not fabricate metrics, employers, or credentials. Return the summary as plain prose, no headings.",
      JSON.stringify({
        profession: data.profession ?? "",
        experienceLevel: data.experienceLevel ?? "",
        skills: data.skills ?? [],
        highlights: data.highlights ?? "",
      }),
    );
  });

/* -------------------- Grammar check -------------------- */

export const grammarCheckResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ text: z.string().trim().min(1).max(4000) }).parse(i))
  .handler(async ({ data }) => {
    return runModel(
      "You are a grammar and clarity editor. Fix grammar, punctuation and awkward phrasing while preserving the writer's meaning and every fact. Do not add facts. Return only the corrected text.",
      data.text,
    );
  });

/* -------------------- ATS guidance -------------------- */

const AtsResult = z.object({
  score: z.number().min(0).max(100),
  strengths: z.array(z.string()).max(10),
  issues: z.array(z.string()).max(10),
  suggestions: z.array(z.string()).max(10),
});
export type AtsResult = z.infer<typeof AtsResult>;

export const atsCheckResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        resume: z.record(z.string(), z.unknown()),
        targetRole: z.string().max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const res = await runModel(
      "You audit resumes for Applicant Tracking System compatibility. Output STRICT JSON matching this schema: {score:number(0-100), strengths:string[], issues:string[], suggestions:string[]}. Be conservative: never invent facts about the candidate; only judge the resume as written.",
      JSON.stringify({ targetRole: data.targetRole ?? "", resume: data.resume }),
    );
    if (!res.ok) return res;
    try {
      const parsed = AtsResult.parse(JSON.parse(extractJson(res.result)));
      return { ok: true as const, result: parsed };
    } catch {
      return fail("AI response was not valid JSON. Try again or edit manually.");
    }
  });

/* -------------------- Job description match -------------------- */

const JdMatchResult = z.object({
  matchScore: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()).max(30),
  missingKeywords: z.array(z.string()).max(30),
  tailoringTips: z.array(z.string()).max(10),
});
export type JdMatchResult = z.infer<typeof JdMatchResult>;

export const jobDescriptionMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        resume: z.record(z.string(), z.unknown()),
        jobDescription: z.string().trim().min(20).max(8000),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const res = await runModel(
      "You match resumes to job descriptions. Return STRICT JSON: {matchScore:number(0-100), matchedKeywords:string[], missingKeywords:string[], tailoringTips:string[]}. Keywords must actually appear in the JD. Never fabricate candidate facts.",
      JSON.stringify({ resume: data.resume, jobDescription: data.jobDescription }),
    );
    if (!res.ok) return res;
    try {
      const parsed = JdMatchResult.parse(JSON.parse(extractJson(res.result)));
      return { ok: true as const, result: parsed };
    } catch {
      return fail("AI response was not valid JSON. Try again or edit manually.");
    }
  });

/* -------------------- Uploaded resume parsing -------------------- */

export const parseUploadedResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ text: z.string().trim().min(20).max(20000) }).parse(i))
  .handler(async ({ data }) => {
    const res = await runModel(
      "You extract structured resume data from raw text. Return STRICT JSON matching this schema exactly (use empty strings and empty arrays for missing fields, never invent):\n" +
        `{"personal":{"fullName":"","headline":"","email":"","phone":"","location":"","website":""},"summary":"","work":[{"id":"","role":"","company":"","location":"","start":"","end":"","current":false,"bullets":[]}],"education":[{"id":"","school":"","degree":"","field":"","location":"","start":"","end":"","notes":""}],"skills":[],"projects":[{"id":"","name":"","role":"","link":"","bullets":[]}],"certifications":[{"id":"","name":"","issuer":"","date":"","id_number":""}],"achievements":[],"languages":[{"id":"","name":"","proficiency":"professional"}],"links":[{"id":"","label":"","url":""}]}\nUse simple string ids like "w1","w2" etc.`,
      data.text,
    );
    if (!res.ok) return res;
    try {
      const parsed = JSON.parse(extractJson(res.result)) as unknown;
      return { ok: true as const, result: JSON.stringify(parsed) };
    } catch {
      return fail("Could not parse the uploaded resume. You can still start from an empty template.");
    }
  });

function extractJson(text: string): string {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) return t;
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) return t.slice(first, last + 1);
  return t;
}
