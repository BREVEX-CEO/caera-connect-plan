/**
 * PROJECTS AND SAVED OUTPUTS, STORED WHERE THE PERSON SAID TO STORE THEM.
 *
 * THE DEFECT THIS CLOSES, and it is a privacy-promise violation rather than a
 * bug in the ordinary sense.
 *
 * Settings › Privacy says, in those words: "Browser Only writes never reach the
 * cloud." Chat honours that — `ocade-chat-store.ts` resolves the adapter from
 * the person's choice and a Browser Only conversation genuinely never leaves
 * the device. Projects did not. `ocade-projects.functions.ts` is a set of
 * server functions that insert straight into `ocade_projects` and
 * `ocade_outputs`, and a grep of that file for the privacy mode returns
 * nothing at all — not a check that fails open, no check.
 *
 * So somebody who chose Browser Only, and whose Chat honoured it, had their
 * project names, up to twenty thousand characters of their own project
 * instructions, and every saved output uploaded to the server anyway. The
 * setting was true where they could see it and false where they could not,
 * which is the worst arrangement of the two.
 *
 * WHY THE FIX HAS TO LIVE IN THE BROWSER. The privacy mode is a browser-side
 * fact: `getModeFor` reads it through the browser's own Supabase client. A
 * server function cannot consult it without being told, and a server function
 * that is TOLD its own privacy mode by its caller is not a gate — anything
 * that can call it can claim any mode. So the gate is here, above the server
 * functions, and Browser Only never calls them at all. Not "calls them and
 * discards the result": never calls them, so there is no request to intercept
 * and nothing to leak.
 *
 * WHICH DATA CLASS. `files` — projects and outputs are the person's own
 * written material, which is what that class governs, and it means one choice
 * in Settings covers their documents and the projects those documents live in
 * rather than splitting a single intuition across two switches.
 */
import { resolveAdapter, getModeFor } from "./storage/resolver";
import type { StorageMode } from "./storage/types";
import {
  listProjects as listProjectsRemote,
  createProject as createProjectRemote,
  updateProject as updateProjectRemote,
  deleteProject as deleteProjectRemote,
  listOutputs as listOutputsRemote,
  getOutput as getOutputRemote,
  createOutput as createOutputRemote,
  deleteOutput as deleteOutputRemote,
  purgeExpiredOutputs as purgeExpiredOutputsRemote,
  type OcadeProject,
} from "./ocade-projects.functions";

const DATA_CLASS = "files" as const;

/** Vault ids are prefixed so projects and outputs share one class without collision. */
const PROJECT_PREFIX = "project:";
const OUTPUT_PREFIX = "output:";

/**
 * A client-generated id, so a Browser Only project has a stable identity with
 * no server round trip — and so the same id survives if the person later
 * switches the class to Private Sync.
 */
function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export type ProjectsMode = StorageMode;

export async function projectsMode(userId: string): Promise<ProjectsMode> {
  return getModeFor(userId, DATA_CLASS);
}

/**
 * True when this person's projects must never be uploaded.
 *
 * Exported so a screen can say so plainly rather than a reader having to infer
 * it from an absent network request.
 */
export async function projectsStayOnThisDevice(userId: string): Promise<boolean> {
  return (await projectsMode(userId)) !== "private_sync";
}

/* ------------------------------------------------------------- projects -- */

export async function listProjectsFor(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<OcadeProject[]> {
  const mode = await projectsMode(userId);
  if (mode === "private_sync") {
    return listProjectsRemote({ data: { includeArchived: options.includeArchived } });
  }

  const adapter = await resolveAdapter(userId, DATA_CLASS);
  const rows = await adapter.list<OcadeProject>(DATA_CLASS);
  return rows
    .filter((row) => row.id.startsWith(PROJECT_PREFIX))
    .map((row) => row.value)
    .filter((project) => (options.includeArchived ? true : !project.archived))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function createProjectFor(
  userId: string,
  input: { name: string; instructions?: string | null },
): Promise<OcadeProject> {
  const mode = await projectsMode(userId);
  if (mode === "private_sync") {
    return createProjectRemote({ data: input });
  }

  const adapter = await resolveAdapter(userId, DATA_CLASS);
  const at = nowIso();
  const project: OcadeProject = {
    id: newId(),
    name: input.name,
    instructions: input.instructions ?? null,
    archived: false,
    created_at: at,
    updated_at: at,
  };
  await adapter.put(DATA_CLASS, `${PROJECT_PREFIX}${project.id}`, project);
  return project;
}

/**
 * Returns nothing on purpose.
 *
 * The server function answers `{ ok: true }` rather than the updated row, so a
 * local implementation that returned the row would make the two modes
 * differently shaped and quietly reward a caller for using one of them. The
 * screen refetches after an edit either way.
 */
export async function updateProjectFor(
  userId: string,
  input: { id: string; name?: string; instructions?: string | null; archived?: boolean },
): Promise<void> {
  const mode = await projectsMode(userId);
  if (mode === "private_sync") {
    await updateProjectRemote({ data: input });
    return;
  }

  const adapter = await resolveAdapter(userId, DATA_CLASS);
  const key = `${PROJECT_PREFIX}${input.id}`;
  const existing = await adapter.get<OcadeProject>(DATA_CLASS, key);
  if (!existing) throw new Error("That project is not on this device.");
  const updated: OcadeProject = {
    ...existing.value,
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.instructions === undefined ? {} : { instructions: input.instructions }),
    ...(input.archived === undefined ? {} : { archived: input.archived }),
    updated_at: nowIso(),
  };
  await adapter.put(DATA_CLASS, key, updated);
}

export async function deleteProjectFor(userId: string, id: string): Promise<void> {
  const mode = await projectsMode(userId);
  if (mode === "private_sync") {
    await deleteProjectRemote({ data: { id } });
    return;
  }
  const adapter = await resolveAdapter(userId, DATA_CLASS);
  await adapter.delete(DATA_CLASS, `${PROJECT_PREFIX}${id}`);
}

/* -------------------------------------------------------------- outputs -- */

/**
 * An output row, in the shape the server returns.
 *
 * Written out here rather than imported because the server function returns an
 * inferred Supabase row type and this file has to CONSTRUCT one locally. Two
 * shapes that must match, so a test asserts they do — the alternative is a
 * local output missing a column the screen reads, which renders as a blank
 * card with no error.
 */
export interface OcadeOutputRow {
  id: string;
  project_id: string | null;
  conversation_id: string | null;
  kind: string;
  title: string;
  mime: string | null;
  size_bytes: number | null;
  lineage_id: string;
  version: number;
  content_sha256: string | null;
  expires_at: string | null;
  created_at: string;
}

async function sha256Of(text: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Locally stored outputs keep their body alongside the row the screen reads. */
interface StoredOutput {
  row: OcadeOutputRow;
  content: string | null;
}

export async function listOutputsFor(
  userId: string,
  options: { projectId?: string | null } = {},
): Promise<OcadeOutputRow[]> {
  const mode = await projectsMode(userId);
  if (mode === "private_sync") {
    return (await listOutputsRemote({
      data: { projectId: options.projectId ?? undefined },
    })) as OcadeOutputRow[];
  }

  const adapter = await resolveAdapter(userId, DATA_CLASS);
  const rows = await adapter.list<StoredOutput>(DATA_CLASS);
  const now = Date.now();
  return (
    rows
      .filter((row) => row.id.startsWith(OUTPUT_PREFIX))
      .map((row) => row.value.row)
      /*
       * Expiry is enforced on READ as well as by the sweep. The sweep only runs
       * while the app is open, and an output whose retention has passed must not
       * reappear simply because nobody swept recently.
       */
      .filter((output) => !output.expires_at || Date.parse(output.expires_at) > now)
      .filter((output) => (options.projectId ? output.project_id === options.projectId : true))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  );
}

export async function getOutputFor(
  userId: string,
  id: string,
): Promise<(OcadeOutputRow & { content: string | null }) | null> {
  const mode = await projectsMode(userId);
  if (mode === "private_sync") {
    return (await getOutputRemote({ data: { id } })) as OcadeOutputRow & {
      content: string | null;
    };
  }
  const adapter = await resolveAdapter(userId, DATA_CLASS);
  const stored = await adapter.get<StoredOutput>(DATA_CLASS, `${OUTPUT_PREFIX}${id}`);
  return stored ? { ...stored.value.row, content: stored.value.content } : null;
}

export interface CreateOutputInput {
  title: string;
  kind: string;
  content?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
  mime?: string | null;
  /** Creating a new VERSION of an existing output rather than a new lineage. */
  parentOutputId?: string | null;
  retentionDays?: number | null;
}

export async function createOutputFor(
  userId: string,
  input: CreateOutputInput,
): Promise<OcadeOutputRow> {
  const mode = await projectsMode(userId);
  if (mode === "private_sync") {
    return (await createOutputRemote({ data: input })) as OcadeOutputRow;
  }

  const adapter = await resolveAdapter(userId, DATA_CLASS);
  const id = newId();
  let lineageId = id;
  let version = 1;
  let projectId = input.projectId ?? null;
  let conversationId = input.conversationId ?? null;

  /*
   * VERSIONING FOLLOWS THE SERVER'S RULES EXACTLY, including the refusal.
   *
   * A "new version" that quietly moved to a different project or changed its
   * title is not a version, it is a different document wearing the old one's
   * history — and the server returns 409 for precisely that. Local storage
   * being more permissive would mean an output's lineage meant one thing on a
   * synced account and another on a Browser Only one.
   */
  if (input.parentOutputId) {
    const parent = await adapter.get<StoredOutput>(
      DATA_CLASS,
      `${OUTPUT_PREFIX}${input.parentOutputId}`,
    );
    if (!parent) throw new Error("That output is not on this device.");
    const p = parent.value.row;
    if (
      (input.projectId !== undefined && (input.projectId ?? null) !== p.project_id) ||
      (input.conversationId !== undefined &&
        (input.conversationId ?? null) !== p.conversation_id) ||
      input.kind !== p.kind ||
      input.title !== p.title
    ) {
      throw new Error(
        "A new version must keep its parent output's project, conversation, kind and title.",
      );
    }
    projectId = p.project_id;
    conversationId = p.conversation_id;
    lineageId = p.lineage_id;
    const siblings = await adapter.list<StoredOutput>(DATA_CLASS);
    version =
      siblings
        .filter((row) => row.id.startsWith(OUTPUT_PREFIX))
        .filter((row) => row.value.row.lineage_id === lineageId)
        .reduce((highest, row) => Math.max(highest, row.value.row.version), 0) + 1;
  }

  const content = input.content ?? null;
  const row: OcadeOutputRow = {
    id,
    project_id: projectId,
    conversation_id: conversationId,
    kind: input.kind,
    title: input.title,
    mime: input.mime ?? null,
    size_bytes: content === null ? null : new TextEncoder().encode(content).byteLength,
    lineage_id: lineageId,
    version,
    content_sha256: content === null ? null : await sha256Of(content),
    expires_at:
      input.retentionDays == null
        ? null
        : new Date(Date.now() + input.retentionDays * 24 * 60 * 60 * 1000).toISOString(),
    created_at: nowIso(),
  };
  await adapter.put<StoredOutput>(DATA_CLASS, `${OUTPUT_PREFIX}${id}`, { row, content });
  return row;
}

export async function deleteOutputFor(userId: string, id: string): Promise<void> {
  const mode = await projectsMode(userId);
  if (mode === "private_sync") {
    await deleteOutputRemote({ data: { id } });
    return;
  }
  const adapter = await resolveAdapter(userId, DATA_CLASS);
  await adapter.delete(DATA_CLASS, `${OUTPUT_PREFIX}${id}`);
}

/** Remove outputs whose retention has passed, wherever they are kept. */
export async function purgeExpiredOutputsFor(userId: string): Promise<number> {
  const mode = await projectsMode(userId);
  if (mode === "private_sync") {
    /*
     * Delegated rather than skipped. Returning 0 here would have silently
     * removed the sweep for every synced account — the button would report
     * "no expired outputs to delete" while the expired outputs stayed.
     */
    const result = await purgeExpiredOutputsRemote();
    return typeof result === "number" ? result : (result?.removed ?? 0);
  }

  const adapter = await resolveAdapter(userId, DATA_CLASS);
  const rows = await adapter.list<StoredOutput>(DATA_CLASS);
  const now = Date.now();
  let removed = 0;
  for (const row of rows) {
    if (!row.id.startsWith(OUTPUT_PREFIX)) continue;
    const expiresAt = row.value.row.expires_at;
    if (expiresAt && Date.parse(expiresAt) <= now) {
      await adapter.delete(DATA_CLASS, row.id);
      removed += 1;
    }
  }
  return removed;
}
