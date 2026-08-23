/**
 * Device-authoritative Projects and Outputs.
 *
 * Records use the existing encrypted `files` storage class. Browser Only never
 * leaves the device; Private Sync writes the same encrypted local record first
 * and lets the storage outbox copy it to the user's RLS-scoped private records.
 */
import {
  listConversationsLocally,
  newConversationId,
  updateConversationLocally,
} from "@/lib/chat/local-conversations";
import { sha256 } from "@/lib/artifacts/store";
import { resolveAdapter } from "@/lib/storage/resolver";

const PROJECT_PREFIX = "project:";
const OUTPUT_PREFIX = "output:";

export interface LocalProject {
  record_type: "project";
  id: string;
  name: string;
  instructions: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type LocalOutputKind = "document" | "export" | "visual" | "transcript" | "other";

export interface LocalOutput {
  record_type: "output";
  id: string;
  project_id: string | null;
  conversation_id: string | null;
  parent_output_id: string | null;
  kind: LocalOutputKind;
  title: string;
  content: string | null;
  mime: string | null;
  size_bytes: number;
  lineage_id: string;
  version: number;
  content_sha256: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateLocalOutputInput {
  projectId?: string | null;
  conversationId?: string | null;
  parentOutputId?: string | null;
  kind: LocalOutputKind;
  title: string;
  content?: string | null;
  mime?: string | null;
  retentionDays?: number | null;
}

function projectKey(id: string): string {
  return `${PROJECT_PREFIX}${id}`;
}

function outputKey(id: string): string {
  return `${OUTPUT_PREFIX}${id}`;
}

export function isLocalProjectKey(id: string): boolean {
  return id.startsWith(PROJECT_PREFIX);
}

export function isLocalOutputKey(id: string): boolean {
  return id.startsWith(OUTPUT_PREFIX);
}

function validName(name: string, limit: number, label: string): string {
  const value = name.trim();
  if (!value) throw new Error(`${label} is required.`);
  if (value.length > limit) throw new Error(`${label} must be ${limit} characters or fewer.`);
  return value;
}

async function records(userId: string) {
  const adapter = await resolveAdapter(userId, "files");
  return { adapter, rows: await adapter.list<LocalProject | LocalOutput>("files") };
}

export async function listLocalProjects(
  userId: string,
  includeArchived = false,
): Promise<LocalProject[]> {
  const { rows } = await records(userId);
  return rows
    .filter((row) => isLocalProjectKey(row.id))
    .map((row) => row.value as LocalProject)
    .filter(
      (project) =>
        project?.record_type === "project" &&
        !project.deleted_at &&
        (includeArchived || !project.archived),
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function createLocalProject(
  userId: string,
  input: { name: string; instructions?: string | null },
): Promise<LocalProject> {
  const name = validName(input.name, 200, "Project name");
  const instructions = input.instructions ?? null;
  if (instructions && instructions.length > 20_000) {
    throw new Error("Project instructions must be 20,000 characters or fewer.");
  }
  const now = new Date().toISOString();
  const project: LocalProject = {
    record_type: "project",
    id: newConversationId(),
    name,
    instructions,
    archived: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  const adapter = await resolveAdapter(userId, "files");
  await adapter.put("files", projectKey(project.id), project);
  return project;
}

export async function getLocalProject(userId: string, id: string): Promise<LocalProject> {
  const adapter = await resolveAdapter(userId, "files");
  const row = await adapter.get<LocalProject>("files", projectKey(id));
  if (!row?.value || row.value.deleted_at) throw new Error("Project not found.");
  return row.value;
}

export async function updateLocalProject(
  userId: string,
  id: string,
  patch: { name?: string; instructions?: string | null; archived?: boolean },
): Promise<LocalProject> {
  const adapter = await resolveAdapter(userId, "files");
  const current = await adapter.get<LocalProject>("files", projectKey(id));
  if (!current?.value || current.value.deleted_at) throw new Error("Project not found.");
  const name =
    patch.name === undefined ? current.value.name : validName(patch.name, 200, "Project name");
  if (patch.instructions && patch.instructions.length > 20_000) {
    throw new Error("Project instructions must be 20,000 characters or fewer.");
  }
  const next: LocalProject = {
    ...current.value,
    name,
    instructions:
      patch.instructions === undefined ? current.value.instructions : patch.instructions,
    archived: patch.archived ?? current.value.archived,
    updated_at: new Date().toISOString(),
  };
  await adapter.put("files", projectKey(id), next);
  return next;
}

export async function deleteLocalProject(userId: string, id: string): Promise<void> {
  const adapter = await resolveAdapter(userId, "files");
  const current = await adapter.get<LocalProject>("files", projectKey(id));
  if (!current?.value || current.value.deleted_at) throw new Error("Project not found.");
  const now = new Date().toISOString();

  // Conversations survive project deletion. Unfile them first so a partial
  // failure can never leave a live conversation pointing at a deleted parent.
  const conversations = await listConversationsLocally(userId);
  for (const conversation of conversations) {
    if (conversation.project_id === id) {
      await updateConversationLocally(userId, conversation.id, { project_id: null });
    }
  }
  await adapter.put("files", projectKey(id), {
    ...current.value,
    deleted_at: now,
    updated_at: now,
  });

  // Project deletion is a local transaction: its saved outputs cannot remain
  // as apparently live children after the parent disappears.
  const rows = await adapter.list<LocalOutput>("files");
  await Promise.all(
    rows
      .filter(
        (row) => isLocalOutputKey(row.id) && row.value?.project_id === id && !row.value.deleted_at,
      )
      .map((row) =>
        adapter.put("files", row.id, { ...row.value, deleted_at: now, updated_at: now }),
      ),
  );
}

export async function listLocalOutputs(
  userId: string,
  projectId?: string | null,
): Promise<LocalOutput[]> {
  const { rows } = await records(userId);
  return rows
    .filter((row) => isLocalOutputKey(row.id))
    .map((row) => row.value as LocalOutput)
    .filter(
      (output) =>
        output?.record_type === "output" &&
        !output.deleted_at &&
        (projectId === undefined || output.project_id === projectId),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getLocalOutput(userId: string, id: string): Promise<LocalOutput> {
  const adapter = await resolveAdapter(userId, "files");
  const row = await adapter.get<LocalOutput>("files", outputKey(id));
  if (!row?.value || row.value.deleted_at) throw new Error("Output not found.");
  return row.value;
}

export async function createLocalOutput(
  userId: string,
  input: CreateLocalOutputInput,
): Promise<LocalOutput> {
  const title = validName(input.title, 300, "Output title");
  const content = input.content ?? null;
  if (content && content.length > 1_000_000) {
    throw new Error("Output content must be 1,000,000 characters or fewer.");
  }
  if (input.mime && input.mime.length > 200) throw new Error("Output MIME type is too long.");
  if (
    input.retentionDays != null &&
    (!Number.isInteger(input.retentionDays) ||
      input.retentionDays < 1 ||
      input.retentionDays > 3650)
  ) {
    throw new Error("Output retention must be between 1 and 3,650 days.");
  }

  const adapter = await resolveAdapter(userId, "files");
  let parent: LocalOutput | null = null;
  if (input.parentOutputId) parent = await getLocalOutput(userId, input.parentOutputId);
  if (
    parent &&
    ((input.projectId !== undefined && input.projectId !== parent.project_id) ||
      (input.conversationId !== undefined && input.conversationId !== parent.conversation_id) ||
      input.kind !== parent.kind ||
      title !== parent.title)
  ) {
    throw new Error(
      "A new version must keep its parent output's project, conversation, kind and title.",
    );
  }

  const all = await listLocalOutputs(userId);
  const lineageId = parent?.lineage_id ?? newConversationId();
  const version = parent
    ? Math.max(0, ...all.filter((row) => row.lineage_id === lineageId).map((row) => row.version)) +
      1
    : 1;
  const digest = content === null ? null : await sha256(content);
  if (digest && !digest.ok) throw new Error(digest.reason);
  const now = new Date().toISOString();
  const output: LocalOutput = {
    record_type: "output",
    id: newConversationId(),
    project_id: parent?.project_id ?? input.projectId ?? null,
    conversation_id: parent?.conversation_id ?? input.conversationId ?? null,
    parent_output_id: parent?.id ?? null,
    kind: input.kind,
    title,
    content,
    mime: input.mime ?? null,
    size_bytes: content ? new TextEncoder().encode(content).length : 0,
    lineage_id: lineageId,
    version,
    content_sha256: digest?.ok ? digest.data : null,
    expires_at:
      input.retentionDays == null
        ? null
        : new Date(Date.now() + input.retentionDays * 86_400_000).toISOString(),
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  await adapter.put("files", outputKey(output.id), output);
  return output;
}

export async function deleteLocalOutput(userId: string, id: string): Promise<void> {
  const adapter = await resolveAdapter(userId, "files");
  const current = await getLocalOutput(userId, id);
  const now = new Date().toISOString();
  await adapter.put("files", outputKey(id), { ...current, deleted_at: now, updated_at: now });
}

export async function purgeExpiredLocalOutputs(
  userId: string,
  now = new Date(),
): Promise<{ removed: number }> {
  const outputs = await listLocalOutputs(userId);
  const expired = outputs.filter(
    (output) => output.expires_at !== null && Date.parse(output.expires_at) <= now.getTime(),
  );
  await Promise.all(expired.map((output) => deleteLocalOutput(userId, output.id)));
  return { removed: expired.length };
}
