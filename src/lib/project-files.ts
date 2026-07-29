import { sha256, type ArtifactOutcome } from "./artifacts/store";

const STORAGE_KEY = "ocade.project-files.v1";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_CHARS = 250_000;
const MAX_FILES = 200;

export interface ProjectFile {
  id: string;
  projectId: string;
  /** Empty string is the project root; otherwise a normalized folder path. */
  folder: string;
  name: string;
  mime: string;
  sizeBytes: number;
  text: string;
  sha256: string;
  createdAt: string;
}

function validFile(value: unknown): value is ProjectFile {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<ProjectFile>;
  return (
    typeof file.id === "string" &&
    typeof file.projectId === "string" &&
    (file.folder === undefined || typeof file.folder === "string") &&
    typeof file.name === "string" &&
    typeof file.mime === "string" &&
    typeof file.sizeBytes === "number" &&
    typeof file.text === "string" &&
    typeof file.sha256 === "string" &&
    /^[0-9a-f]{64}$/.test(file.sha256) &&
    typeof file.createdAt === "string"
  );
}

function read(): ArtifactOutcome<ProjectFile[]> {
  const storage = globalThis.localStorage;
  if (!storage) return { ok: false, reason: "Browser storage is unavailable for project files." };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ok: true, data: [], evidence: "No project files stored." };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_FILES || !parsed.every(validFile)) {
      return { ok: false, reason: "Project file storage is corrupt; nothing was changed." };
    }
    const files = parsed.map((file) => ({ ...file, folder: file.folder ?? "" }));
    return { ok: true, data: files, evidence: `${files.length} project files read.` };
  } catch {
    return { ok: false, reason: "Project file storage is corrupt; nothing was changed." };
  }
}

function write(files: ProjectFile[]): ArtifactOutcome<number> {
  const storage = globalThis.localStorage;
  if (!storage) return { ok: false, reason: "Browser storage is unavailable for project files." };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(files));
    return { ok: true, data: files.length, evidence: `${files.length} project files stored.` };
  } catch (error) {
    return {
      ok: false,
      reason: `Project file could not be saved: ${
        error instanceof Error ? error.message : "storage refused it"
      }.`,
    };
  }
}

export function listProjectFiles(projectId: string): ArtifactOutcome<ProjectFile[]> {
  const stored = read();
  if (!stored.ok) return stored;
  const files = stored.data.filter((file) => file.projectId === projectId);
  return { ok: true, data: files, evidence: `${files.length} files in this project.` };
}

export async function saveProjectFile(input: {
  projectId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  text: string;
  folder?: string;
  id?: string;
  now?: Date;
}): Promise<ArtifactOutcome<ProjectFile>> {
  if (!input.projectId.trim()) return { ok: false, reason: "A project is required." };
  if (!input.name.trim()) return { ok: false, reason: "A file name is required." };
  if (input.sizeBytes < 0 || input.sizeBytes > MAX_FILE_BYTES) {
    return { ok: false, reason: "Project files must be 20 MB or smaller." };
  }
  if (!input.text.trim())
    return { ok: false, reason: "No readable text was extracted from this file." };
  if (input.text.length > MAX_TEXT_CHARS) {
    return {
      ok: false,
      reason: "Extracted project-file text exceeds the 250,000 character limit.",
    };
  }
  const stored = read();
  if (!stored.ok) return stored;
  if (stored.data.length >= MAX_FILES) {
    return { ok: false, reason: `Project file storage is full (${MAX_FILES} files).` };
  }
  const folder = normalizeProjectFolder(input.folder ?? "");
  if (folder === null)
    return { ok: false, reason: "Project folder paths cannot contain . or .. segments." };
  const digest = await sha256(input.text);
  if (!digest.ok) return digest;
  if (
    stored.data.some(
      (existing) =>
        existing.projectId === input.projectId &&
        existing.folder === folder &&
        existing.name === input.name.trim() &&
        existing.sha256 === digest.data,
    )
  ) {
    return { ok: false, reason: "That exact project file is already saved in this folder." };
  }
  const file: ProjectFile = {
    id: input.id ?? `project-file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: input.projectId,
    folder,
    name: input.name.trim(),
    mime: input.mime,
    sizeBytes: input.sizeBytes,
    text: input.text,
    sha256: digest.data,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
  const saved = write([file, ...stored.data]);
  if (!saved.ok) return saved;
  return {
    ok: true,
    data: file,
    evidence: `Saved and fingerprinted “${file.name}” on this device.`,
  };
}

export function normalizeProjectFolder(path: string): string | null {
  const normalized = path
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (normalized.some((segment) => segment === "." || segment === "..")) return null;
  return normalized.join("/");
}

export function removeProjectFile(id: string): ArtifactOutcome<{ removed: boolean }> {
  const stored = read();
  if (!stored.ok) return stored;
  const next = stored.data.filter((file) => file.id !== id);
  if (next.length === stored.data.length) {
    return { ok: false, reason: "That project file is not here; nothing was deleted." };
  }
  const saved = write(next);
  if (!saved.ok) return saved;
  return { ok: true, data: { removed: true }, evidence: "Project file deleted from this device." };
}

export function removeProjectFilesForProject(
  projectId: string,
): ArtifactOutcome<{ removed: number }> {
  const stored = read();
  if (!stored.ok) return stored;
  const next = stored.data.filter((file) => file.projectId !== projectId);
  const removed = stored.data.length - next.length;
  if (removed === 0) {
    return { ok: true, data: { removed: 0 }, evidence: "No on-device project files to delete." };
  }
  const saved = write(next);
  if (!saved.ok) return saved;
  return {
    ok: true,
    data: { removed },
    evidence: `${removed} on-device project ${removed === 1 ? "file" : "files"} deleted.`,
  };
}
