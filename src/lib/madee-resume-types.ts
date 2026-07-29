/**
 * Resume content schema. Client-safe: no server imports, no secrets.
 * This is the exact shape stored in madee_resume_versions.content (or
 * in the IndexedDB adapter for Browser Only projects).
 *
 * Every list field defaults to empty so a brand-new project renders
 * without null checks throughout the editor.
 */

import { z } from "zod";

export const ExperienceLevel = z.enum(["student", "entry", "mid", "senior", "executive", "other"]);
export type ExperienceLevel = z.infer<typeof ExperienceLevel>;

export const EXPERIENCE_LEVEL_LABEL: Record<ExperienceLevel, string> = {
  student: "Student / Intern",
  entry: "Entry level (0–2 years)",
  mid: "Mid level (3–7 years)",
  senior: "Senior (8+ years)",
  executive: "Executive / Director",
  other: "Other",
};

export const StorageMode = z.enum(["browser_only", "private_sync"]);
export type ResumeStorageMode = z.infer<typeof StorageMode>;

export const Personal = z.object({
  fullName: z.string().max(160).default(""),
  headline: z.string().max(200).default(""),
  email: z.string().max(200).default(""),
  phone: z.string().max(60).default(""),
  location: z.string().max(200).default(""),
  website: z.string().max(300).default(""),
});
export type Personal = z.infer<typeof Personal>;

export const WorkItem = z.object({
  id: z.string(),
  role: z.string().max(200).default(""),
  company: z.string().max(200).default(""),
  location: z.string().max(200).default(""),
  start: z.string().max(20).default(""), // "YYYY-MM"
  end: z.string().max(20).default(""),
  current: z.boolean().default(false),
  bullets: z.array(z.string().max(600)).default([]),
});
export type WorkItem = z.infer<typeof WorkItem>;

export const EducationItem = z.object({
  id: z.string(),
  school: z.string().max(200).default(""),
  degree: z.string().max(200).default(""),
  field: z.string().max(200).default(""),
  location: z.string().max(200).default(""),
  start: z.string().max(20).default(""),
  end: z.string().max(20).default(""),
  notes: z.string().max(600).default(""),
});
export type EducationItem = z.infer<typeof EducationItem>;

export const ProjectItem = z.object({
  id: z.string(),
  name: z.string().max(200).default(""),
  role: z.string().max(200).default(""),
  link: z.string().max(300).default(""),
  bullets: z.array(z.string().max(600)).default([]),
});
export type ProjectItem = z.infer<typeof ProjectItem>;

export const CertificationItem = z.object({
  id: z.string(),
  name: z.string().max(200).default(""),
  issuer: z.string().max(200).default(""),
  date: z.string().max(20).default(""),
  id_number: z.string().max(120).default(""),
});
export type CertificationItem = z.infer<typeof CertificationItem>;

export const LanguageItem = z.object({
  id: z.string(),
  name: z.string().max(80).default(""),
  proficiency: z
    .enum(["basic", "conversational", "professional", "fluent", "native"])
    .default("professional"),
});
export type LanguageItem = z.infer<typeof LanguageItem>;

export const LinkItem = z.object({
  id: z.string(),
  label: z.string().max(80).default(""),
  url: z.string().max(300).default(""),
});
export type LinkItem = z.infer<typeof LinkItem>;

export const ResumeContent = z.object({
  personal: Personal.default({} as never),
  summary: z.string().max(2000).default(""),
  work: z.array(WorkItem).default([]),
  education: z.array(EducationItem).default([]),
  skills: z.array(z.string().max(120)).default([]),
  projects: z.array(ProjectItem).default([]),
  certifications: z.array(CertificationItem).default([]),
  achievements: z.array(z.string().max(600)).default([]),
  languages: z.array(LanguageItem).default([]),
  links: z.array(LinkItem).default([]),
});
export type ResumeContent = z.infer<typeof ResumeContent>;

export function emptyResume(): ResumeContent {
  return ResumeContent.parse({});
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/* --------- Server-side project + version record shapes --------- */

export interface ResumeProjectMeta {
  id: string;
  title: string;
  profession: string | null;
  experience_level: ExperienceLevel | null;
  storage_mode: ResumeStorageMode;
  current_version_id: string | null;
  target_role: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResumeVersionMeta {
  id: string;
  project_id: string;
  version_number: number;
  label: string | null;
  content_stored_locally: boolean;
  ai_notes: Record<string, unknown>;
  created_at: string;
}

export interface ResumeVersionFull extends ResumeVersionMeta {
  content: ResumeContent;
}

/* --------- Local storage helpers --------- */

export interface LocalProjectRecord {
  kind: "project";
  meta: ResumeProjectMeta;
}
export interface LocalVersionRecord {
  kind: "version";
  meta: ResumeVersionMeta;
  content: ResumeContent;
}
export type LocalResumeRecord = LocalProjectRecord | LocalVersionRecord;
