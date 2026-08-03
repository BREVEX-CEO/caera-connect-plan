import type { ArtifactOutcome } from "./artifacts/store";
import { listProjectFiles, normalizeProjectFolder } from "./project-files";

const STORAGE_KEY = "ocade.project-folders.v1";
const MAX_FOLDERS = 500;

export interface ProjectFolder {
  id: string;
  projectId: string;
  path: string;
  createdAt: string;
}

function validFolder(value: unknown): value is ProjectFolder {
  if (!value || typeof value !== "object") return false;
  const folder = value as Partial<ProjectFolder>;
  return (
    typeof folder.id === "string" &&
    typeof folder.projectId === "string" &&
    typeof folder.path === "string" &&
    folder.path.length > 0 &&
    normalizeProjectFolder(folder.path) === folder.path &&
    typeof folder.createdAt === "string"
  );
}

function read(): ArtifactOutcome<ProjectFolder[]> {
  const storage = globalThis.localStorage;
  if (!storage) return { ok: false, reason: "Browser storage is unavailable for project folders." };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ok: true, data: [], evidence: "No project folders stored." };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_FOLDERS || !parsed.every(validFolder)) {
      return { ok: false, reason: "Project folder storage is corrupt; nothing was changed." };
    }
    return { ok: true, data: parsed, evidence: `${parsed.length} project folders read.` };
  } catch {
    return { ok: false, reason: "Project folder storage is corrupt; nothing was changed." };
  }
}

function write(folders: ProjectFolder[]): ArtifactOutcome<number> {
  const storage = globalThis.localStorage;
  if (!storage) return { ok: false, reason: "Browser storage is unavailable for project folders." };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(folders));
    return {
      ok: true,
      data: folders.length,
      evidence: `${folders.length} project folders stored.`,
    };
  } catch (error) {
    return {
      ok: false,
      reason: `Project folders could not be saved: ${
        error instanceof Error ? error.message : "storage refused it"
      }.`,
    };
  }
}

export function listProjectFolders(projectId: string): ArtifactOutcome<ProjectFolder[]> {
  const current = read();
  if (!current.ok) return current;
  const folders = current.data
    .filter((folder) => folder.projectId === projectId)
    .sort((a, b) => a.path.localeCompare(b.path));
  return { ok: true, data: folders, evidence: `${folders.length} folders in this project.` };
}

export function createProjectFolder(input: {
  projectId: string;
  path: string;
  id?: string;
  now?: Date;
}): ArtifactOutcome<ProjectFolder> {
  const path = normalizeProjectFolder(input.path);
  if (!input.projectId.trim()) return { ok: false, reason: "A project is required." };
  if (!path) return { ok: false, reason: "Enter a non-root folder without . or .. segments." };
  if (path.length > 500)
    return { ok: false, reason: "Project folder paths are limited to 500 characters." };
  const current = read();
  if (!current.ok) return current;
  if (current.data.length >= MAX_FOLDERS) {
    return { ok: false, reason: `Project folder storage is full (${MAX_FOLDERS} folders).` };
  }
  if (current.data.some((folder) => folder.projectId === input.projectId && folder.path === path)) {
    return { ok: false, reason: "That project folder already exists." };
  }
  const folder: ProjectFolder = {
    id: input.id ?? `project-folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: input.projectId,
    path,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
  const saved = write([folder, ...current.data]);
  if (!saved.ok) return saved;
  return { ok: true, data: folder, evidence: `Created project folder “${path}”.` };
}

export function removeProjectFolder(
  projectId: string,
  path: string,
): ArtifactOutcome<{ removed: boolean }> {
  const normalized = normalizeProjectFolder(path);
  if (!normalized) return { ok: false, reason: "That project folder path is invalid." };
  const files = listProjectFiles(projectId);
  if (!files.ok) return files;
  if (
    files.data.some(
      (file) => file.folder === normalized || file.folder.startsWith(`${normalized}/`),
    )
  ) {
    return { ok: false, reason: "Move or delete files in this folder before deleting it." };
  }
  const current = read();
  if (!current.ok) return current;
  if (
    current.data.some(
      (folder) =>
        folder.projectId === projectId &&
        folder.path !== normalized &&
        folder.path.startsWith(`${normalized}/`),
    )
  ) {
    return { ok: false, reason: "Delete nested folders before deleting this folder." };
  }
  const next = current.data.filter(
    (folder) => folder.projectId !== projectId || folder.path !== normalized,
  );
  if (next.length === current.data.length) {
    return { ok: false, reason: "That project folder is not here; nothing was deleted." };
  }
  const saved = write(next);
  if (!saved.ok) return saved;
  return { ok: true, data: { removed: true }, evidence: `Deleted project folder “${normalized}”.` };
}

export function removeProjectFoldersForProject(
  projectId: string,
): ArtifactOutcome<{ removed: number }> {
  const current = read();
  if (!current.ok) return current;
  const next = current.data.filter((folder) => folder.projectId !== projectId);
  const removed = current.data.length - next.length;
  const saved = write(next);
  if (!saved.ok) return saved;
  return { ok: true, data: { removed }, evidence: `${removed} project folders deleted.` };
}
