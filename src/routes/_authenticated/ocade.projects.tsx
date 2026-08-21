import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FolderOpen,
  Plus,
  Loader2,
  Archive,
  ArchiveRestore,
  Trash2,
  Save,
  MessageSquare,
  FileOutput,
  Download,
  X,
  Paperclip,
  FolderPlus,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";
import { classifyUnavailable } from "@/lib/unavailable-reason";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  listOutputs,
  getOutput,
  createOutput,
  deleteOutput,
  purgeExpiredOutputs,
  listProjectConversations,
  setConversationProject,
  type OcadeProject,
  type ProjectConversation,
} from "@/lib/ocade-projects.functions";
import {
  listProjectFiles,
  saveProjectFile,
  removeProjectFilesForProject,
  type ProjectFile,
} from "@/lib/project-files";
import { deleteAttachment, describeSite } from "@/lib/attachments/deletion";
import {
  createProjectFolder,
  listProjectFolders,
  removeProjectFolder,
  removeProjectFoldersForProject,
  type ProjectFolder,
} from "@/lib/project-folders";

export const Route = createFileRoute("/_authenticated/ocade/projects")({
  head: () => ({
    meta: [{ title: "OCADE Projects — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectsPage,
});

interface OutputRow {
  id: string;
  kind: string;
  title: string;
  mime: string | null;
  size_bytes: number;
  created_at: string;
  lineage_id: string;
  version: number;
  content_sha256: string | null;
  expires_at: string | null;
}

type OutputKind = "document" | "export" | "visual" | "transcript" | "other";

function ProjectsPage() {
  const [projects, setProjects] = useState<OcadeProject[] | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [instructions, setInstructions] = useState("");
  const [nameDraft, setNameDraft] = useState("");

  const [conversations, setConversations] = useState<ProjectConversation[] | null>(null);
  const [unfiled, setUnfiled] = useState<ProjectConversation[] | null>(null);
  const [outputs, setOutputs] = useState<OutputRow[] | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[] | null>(null);
  const [projectFolders, setProjectFolders] = useState<ProjectFolder[] | null>(null);
  const [projectFileError, setProjectFileError] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState("");
  const [uploadFolder, setUploadFolder] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [fileSearch, setFileSearch] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<OcadeProject | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    title: string;
    content: string | null;
    mime: string | null;
    kind: OutputKind;
  } | null>(null);
  const [previewDraft, setPreviewDraft] = useState("");
  const [outputRetention, setOutputRetention] = useState<"keep" | "30" | "90" | "365">("keep");
  const [savingVersion, setSavingVersion] = useState(false);

  const selected = projects?.find((p) => p.id === selectedId) ?? null;
  const visibleProjects =
    projects?.filter((project) =>
      project.name.toLowerCase().includes(projectSearch.trim().toLowerCase()),
    ) ?? [];
  const visibleProjectFiles = (projectFiles ?? []).filter((file) => {
    const query = fileSearch.trim().toLowerCase();
    return !query || `${file.folder}/${file.name}`.toLowerCase().includes(query);
  });

  const refreshProjects = useCallback(async () => {
    setUnavailable(null);
    try {
      const rows = await listProjects({ data: { includeArchived: showArchived } });
      setProjects(rows);
      setSelectedId((cur) => (cur && rows.some((r) => r.id === cur) ? cur : (rows[0]?.id ?? null)));
    } catch (e) {
      setProjects(null);
      setUnavailable(
        e instanceof Error ? e.message : "Projects aren't available until the database is set up.",
      );
    }
  }, [showArchived]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  // Load the selected project's contents.
  useEffect(() => {
    if (!selected) {
      setConversations(null);
      setOutputs(null);
      setProjectFiles(null);
      setProjectFolders(null);
      return;
    }
    setNameDraft(selected.name);
    setInstructions(selected.instructions ?? "");
    setUploadFolder("");
    setFolderDraft("");
    setFileSearch("");
    const localFiles = listProjectFiles(selected.id);
    const localFolders = listProjectFolders(selected.id);
    if (localFiles.ok) {
      setProjectFiles(localFiles.data);
      setProjectFileError(null);
    } else {
      setProjectFiles(null);
      setProjectFileError(localFiles.reason);
    }
    if (localFolders.ok) {
      setProjectFolders(localFolders.data);
    } else {
      setProjectFolders(null);
      setProjectFileError((current) =>
        current ? `${current} ${localFolders.reason}` : localFolders.reason,
      );
    }
    let live = true;
    void (async () => {
      try {
        const [c, o, u] = await Promise.all([
          listProjectConversations({ data: { projectId: selected.id } }),
          listOutputs({ data: { projectId: selected.id } }),
          listProjectConversations({ data: { projectId: null } }),
        ]);
        if (!live) return;
        setConversations(c);
        setOutputs(o as OutputRow[]);
        setUnfiled(u);
      } catch {
        if (!live) return;
        setConversations([]);
        setOutputs([]);
        setUnfiled([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [selected]);

  async function addProjectFiles(files: FileList | null) {
    if (!selected || !files) return;
    for (const file of [...files]) {
      const textLike =
        file.type.startsWith("text/") || /\.(txt|md|csv|json|xml|yaml|yml|log)$/i.test(file.name);
      if (!textLike) {
        toast.error(`${file.name}: add this through Chat first so OCADE can extract it safely.`);
        continue;
      }
      const result = await saveProjectFile({
        projectId: selected.id,
        name: file.name,
        mime: file.type || "text/plain",
        sizeBytes: file.size,
        text: await file.text(),
        folder: uploadFolder,
      });
      if (!result.ok) toast.error(`${file.name}: ${result.reason}`);
      else toast.success(result.evidence);
    }
    refreshLocalProjectItems(selected.id);
  }

  function refreshLocalProjectItems(projectId: string) {
    const files = listProjectFiles(projectId);
    const folders = listProjectFolders(projectId);
    if (!files.ok || !folders.ok) {
      setProjectFileError(!files.ok ? files.reason : !folders.ok ? folders.reason : null);
      return;
    }
    setProjectFiles(files.data);
    setProjectFolders(folders.data);
    setProjectFileError(null);
  }

  function addProjectFolder() {
    if (!selected) return;
    const created = createProjectFolder({ projectId: selected.id, path: folderDraft });
    if (!created.ok) {
      toast.error(created.reason);
      return;
    }
    setFolderDraft("");
    setUploadFolder(created.data.path);
    refreshLocalProjectItems(selected.id);
    toast.success(created.evidence);
  }

  function deleteProjectFolder(path: string) {
    if (!selected) return;
    const removed = removeProjectFolder(selected.id, path);
    if (!removed.ok) {
      toast.error(removed.reason);
      return;
    }
    if (uploadFolder === path) setUploadFolder("");
    refreshLocalProjectItems(selected.id);
    toast.success(removed.evidence);
  }

  /**
   * Delete a project file from EVERY place it left a trace.
   *
   * This used to call `removeProjectFile` alone, which deletes the extracted
   * text and nothing else. Verbatim excerpts of the same document stayed in
   * saved citations under old assistant replies, and cached copies stayed in
   * Cache Storage — so a user who deleted a document to make it go away was
   * shown a success toast while its text was still readable in the app.
   */
  async function deleteProjectFile(id: string, name: string) {
    const receipt = await deleteAttachment({ fileId: id, name });
    if (selected) refreshLocalProjectItems(selected.id);

    if (receipt.complete) {
      toast.success(receipt.summary);
      return;
    }
    // Names the places that still hold data instead of a bare "failed", so a
    // retry is informed and the user knows exactly what remains.
    toast.error(receipt.summary, {
      description: receipt.remaining.map(describeSite).join(", "),
    });
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const p = await createProject({ data: { name } });
      toast.success(`Project “${p.name}” created.`);
      setNewName("");
      await refreshProjects();
      setSelectedId(p.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the project.");
    } finally {
      setCreating(false);
    }
  }

  async function saveDetails() {
    if (!selected) return;
    setBusy(true);
    try {
      await updateProject({
        data: {
          id: selected.id,
          name: nameDraft.trim() || selected.name,
          instructions: instructions.trim() ? instructions : null,
        },
      });
      toast.success("Project saved.");
      await refreshProjects();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the project.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(p: OcadeProject) {
    setBusy(true);
    try {
      await updateProject({ data: { id: p.id, archived: !p.archived } });
      toast.success(p.archived ? "Project restored." : "Project archived.");
      await refreshProjects();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the project.");
    } finally {
      setBusy(false);
    }
  }

  async function reallyDelete(p: OcadeProject) {
    setBusy(true);
    try {
      /*
       * Sweep each file's OTHER traces before the bulk removal.
       *
       * `removeProjectFilesForProject` deletes the project-file records and
       * nothing else. Read the names first — after the bulk delete there is
       * nothing left to tell us which documents were quoted, and the excerpts
       * would stay behind with no record that they belong to a deleted file.
       */
      const doomed = listProjectFiles(p.id);
      await deleteProject({ data: { id: p.id } });
      if (doomed.ok) {
        for (const file of doomed.data) {
          await deleteAttachment({ name: file.name });
        }
      }
      const localRemoval = removeProjectFilesForProject(p.id);
      const folderRemoval = removeProjectFoldersForProject(p.id);
      setConfirmDelete(null);
      await refreshProjects();
      if (!localRemoval.ok || !folderRemoval.ok) {
        toast.error(
          `Project deleted and its conversations were kept, but on-device project data could not be fully removed: ${
            !localRemoval.ok ? localRemoval.reason : !folderRemoval.ok ? folderRemoval.reason : ""
          }`,
        );
      } else {
        toast.success(
          localRemoval.data.removed > 0
            ? `Project deleted, conversations unfiled, and ${localRemoval.data.removed} on-device ${localRemoval.data.removed === 1 ? "file" : "files"} removed.`
            : "Project deleted. Its conversations were kept and unfiled.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the project.");
    } finally {
      setBusy(false);
    }
  }

  async function moveConversation(conversationId: string, projectId: string | null) {
    try {
      await setConversationProject({ data: { conversationId, projectId } });
      toast.success(projectId ? "Conversation moved into the project." : "Conversation unfiled.");
      if (selected) {
        const [c, u] = await Promise.all([
          listProjectConversations({ data: { projectId: selected.id } }),
          listProjectConversations({ data: { projectId: null } }),
        ]);
        setConversations(c);
        setUnfiled(u);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move the conversation.");
    }
  }

  async function openPreview(id: string) {
    try {
      const row = await getOutput({ data: { id } });
      setPreview({
        id: row.id,
        title: row.title,
        content: row.content ?? null,
        mime: row.mime ?? null,
        kind: row.kind as OutputKind,
      });
      setPreviewDraft(row.content ?? "");
      setOutputRetention("keep");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open this output.");
    }
  }

  function exportPreview() {
    if (!preview || !previewDraft) return;
    const blob = new Blob([previewDraft], { type: preview.mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${preview.title.replace(/[^\w.-]+/g, "_") || "ocade-output"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveNewOutputVersion() {
    if (!preview || !selected || !previewDraft.trim()) return;
    setSavingVersion(true);
    try {
      const created = await createOutput({
        data: {
          projectId: selected.id,
          parentOutputId: preview.id,
          kind: preview.kind,
          title: preview.title,
          content: previewDraft,
          mime: preview.mime,
          retentionDays: outputRetention === "keep" ? null : Number(outputRetention),
        },
      });
      toast.success(`Saved ${preview.title} as version ${created.version}.`);
      setOutputs((await listOutputs({ data: { projectId: selected.id } })) as OutputRow[]);
      setPreview(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the new output version.",
      );
    } finally {
      setSavingVersion(false);
    }
  }

  async function removeOutput(id: string) {
    try {
      await deleteOutput({ data: { id } });
      toast.success("Output deleted.");
      if (selected)
        setOutputs((await listOutputs({ data: { projectId: selected.id } })) as OutputRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the output.");
    }
  }

  async function removeExpiredOutputs() {
    try {
      const result = await purgeExpiredOutputs();
      toast.success(
        result.removed > 0
          ? `${result.removed} expired ${result.removed === 1 ? "output" : "outputs"} deleted.`
          : "No expired outputs to delete.",
      );
      if (selected) {
        setOutputs((await listOutputs({ data: { projectId: selected.id } })) as OutputRow[]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove expired outputs.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Projects"
        description="Group conversations, instructions and generated outputs. Project instructions are applied to every chat in the project."
        actions={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-3.5 w-3.5 accent-[color:var(--foreground)]"
            />
            Show archived
          </label>
        }
      />

      {unavailable ? (
        (() => {
          const state = classifyUnavailable(unavailable, {
            migrationTitle: "Projects need the database migration",
            migrationNote:
              "The migration, RLS policies, rollback and verification SQL are prepared and ready to apply — projects will work as soon as it is applied.",
            loadTitle: "Projects couldn't be loaded",
          });
          return (
            <SetupRequiredState
              title={state.title}
              description={state.description}
              detail={state.detail}
              status={state.migrationMissing ? "setup_required" : "failed"}
              action={
                <button
                  type="button"
                  onClick={() => void refreshProjects()}
                  className="rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent/30"
                >
                  Try again
                </button>
              }
            />
          );
        })()
      ) : projects === null ? (
        <GlassPanel className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading projects…
        </GlassPanel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Project list + create */}
          <div className="flex flex-col gap-3">
            <GlassPanel className="p-3">
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate();
                  }}
                  placeholder="New project name"
                  aria-label="New project name"
                  className="h-9 text-sm"
                />
                <Button
                  onClick={() => void handleCreate()}
                  disabled={creating || !newName.trim()}
                  size="sm"
                  className="h-9 shrink-0"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span className="sr-only">Create project</span>
                </Button>
              </div>
              <Input
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                placeholder="Search projects"
                aria-label="Search projects"
                className="mt-2 h-8 text-xs"
              />
            </GlassPanel>

            {projects.length === 0 ? (
              <EmptyState
                icon={<FolderOpen className="h-6 w-6" aria-hidden />}
                title="No projects yet"
                description="Create a project to group related conversations, files and outputs."
              />
            ) : (
              <nav aria-label="Projects" className="flex flex-col gap-1">
                {visibleProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    aria-current={p.id === selectedId ? "true" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                      p.id === selectedId
                        ? "bg-sidebar-accent text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                    )}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{p.name}</span>
                    {p.archived ? (
                      <span className="ml-auto text-[9px] uppercase tracking-wide">Archived</span>
                    ) : null}
                  </button>
                ))}
                {visibleProjects.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No project matches “{projectSearch}”.
                  </p>
                ) : null}
              </nav>
            )}
          </div>

          {/* Detail */}
          {selected ? (
            <div className="flex flex-col gap-5">
              <GlassPanel className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    aria-label="Project name"
                    className="h-9 max-w-sm text-sm"
                  />
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleArchive(selected)}
                      disabled={busy}
                    >
                      {selected.archived ? (
                        <>
                          <ArchiveRestore className="mr-1.5 h-4 w-4" /> Restore
                        </>
                      ) : (
                        <>
                          <Archive className="mr-1.5 h-4 w-4" /> Archive
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(selected)}
                      disabled={busy}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>

                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="project-instructions"
                >
                  Project instructions — applied to every conversation in this project
                </label>
                <Textarea
                  id="project-instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={4}
                  placeholder="e.g. Always answer in British English and cite the source file."
                  className="text-sm"
                />
                <div>
                  <Button size="sm" onClick={() => void saveDetails()} disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              </GlassPanel>

              {/* Conversations */}
              <GlassPanel className="p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4" aria-hidden /> Conversations
                </h3>
                {conversations === null ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : conversations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No conversations filed here yet. Move one from the list below.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {conversations.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-sidebar-accent/40"
                      >
                        <Link to="/ocade" className="truncate text-foreground hover:underline">
                          {c.title}
                        </Link>
                        {c.pinned ? (
                          <span className="text-[9px] uppercase text-muted-foreground">Pinned</span>
                        ) : null}
                        <button
                          onClick={() => void moveConversation(c.id, null)}
                          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          Unfile
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {unfiled && unfiled.length > 0 ? (
                  <div className="mt-4 border-t border-border/60 pt-3">
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Unfiled conversations
                    </p>
                    <ul className="flex flex-col gap-1">
                      {unfiled.slice(0, 8).map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]"
                        >
                          <span className="truncate text-muted-foreground">{c.title}</span>
                          <button
                            onClick={() => void moveConversation(c.id, selected.id)}
                            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Move here
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </GlassPanel>

              <GlassPanel className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" aria-hidden />
                  <h3 className="text-sm font-semibold">Project files</h3>
                  <label className="ml-auto cursor-pointer rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-accent">
                    Add text files
                    <input
                      type="file"
                      multiple
                      accept=".txt,.md,.csv,.json,.xml,.yaml,.yml,.log,text/*"
                      className="hidden"
                      onChange={(event) => {
                        void addProjectFiles(event.currentTarget.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Stored on this device with SHA-256 fingerprints. These files are added to Chat
                  context when the conversation is filed in this project.
                </p>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Input
                    value={folderDraft}
                    onChange={(event) => setFolderDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addProjectFolder();
                    }}
                    placeholder="New folder, e.g. Research/Notes"
                    aria-label="New project folder"
                    className="h-8 min-w-[220px] flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={addProjectFolder}
                    disabled={!folderDraft.trim()}
                  >
                    <FolderPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Create folder
                  </Button>
                </div>
                {projectFolders && projectFolders.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    <button
                      aria-pressed={uploadFolder === ""}
                      type="button"
                      onClick={() => setUploadFolder("")}
                      className={cn(
                        "rounded border px-2 py-1 text-[10px]",
                        uploadFolder === "" ? "border-foreground/40" : "border-border/60",
                      )}
                    >
                      Root
                    </button>
                    {projectFolders.map((folder) => (
                      <span
                        key={folder.id}
                        className={cn(
                          "inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px]",
                          uploadFolder === folder.path
                            ? "border-foreground/40"
                            : "border-border/60",
                        )}
                      >
                        <button type="button" onClick={() => setUploadFolder(folder.path)}>
                          {folder.path}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProjectFolder(folder.path)}
                          aria-label={`Delete folder ${folder.path}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    New files go to {uploadFolder || "project root"}
                  </span>
                  <Input
                    value={fileSearch}
                    onChange={(event) => setFileSearch(event.target.value)}
                    placeholder="Search project files"
                    aria-label="Search project files"
                    className="ml-auto h-7 max-w-[220px] text-[11px]"
                  />
                </div>
                {projectFileError ? (
                  <p className="text-xs text-destructive">{projectFileError}</p>
                ) : projectFiles === null ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : projectFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No readable project files yet.</p>
                ) : visibleProjectFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No project file matches this search.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {visibleProjectFiles.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-xs"
                      >
                        <span className="truncate">
                          {file.folder ? `${file.folder}/` : ""}
                          {file.name}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {file.sha256.slice(0, 10)}…
                        </span>
                        <button
                          onClick={() => void deleteProjectFile(file.id, file.name)}
                          aria-label={`Delete ${file.name}`}
                          className="ml-auto text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassPanel>

              {/* Outputs */}
              <GlassPanel className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <FileOutput className="h-4 w-4" aria-hidden /> Outputs
                  </h3>
                  <button
                    type="button"
                    onClick={() => void removeExpiredOutputs()}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Remove expired
                  </button>
                </div>
                {outputs === null ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : outputs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing generated yet. Documents and exports OCADE creates in this project
                    appear here.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {outputs.map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-sidebar-accent/40"
                      >
                        <button
                          onClick={() => void openPreview(o.id)}
                          className="truncate text-left hover:underline"
                        >
                          {o.title}
                        </button>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {o.kind}
                        </span>
                        <span className="text-[10px] text-muted-foreground">v{o.version}</span>
                        {o.content_sha256 ? (
                          <span
                            className="hidden font-mono text-[9px] text-muted-foreground lg:inline"
                            title={`SHA-256 ${o.content_sha256}`}
                          >
                            {o.content_sha256.slice(0, 10)}…
                          </span>
                        ) : null}
                        {o.expires_at ? (
                          <span className="text-[9px] text-muted-foreground">
                            expires {new Date(o.expires_at).toLocaleDateString()}
                          </span>
                        ) : null}
                        <button
                          onClick={() => void removeOutput(o.id)}
                          aria-label={`Delete ${o.title}`}
                          className="ml-auto text-muted-foreground hover:text-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassPanel>
            </div>
          ) : (
            <EmptyState
              icon={<FolderOpen className="h-6 w-6" aria-hidden />}
              title="Select a project"
              description="Choose a project on the left, or create one to get started."
            />
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            “{confirmDelete?.name}” will be permanently deleted. Conversations inside it are{" "}
            <span className="font-medium text-foreground">kept</span> and become unfiled. This
            cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmDelete && void reallyDelete(confirmDelete)}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Output preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.title}</DialogTitle>
          </DialogHeader>
          {preview?.content !== null ? (
            <>
              <label
                htmlFor="output-version-content"
                className="text-xs font-medium text-foreground"
              >
                Output content
              </label>
              <Textarea
                id="output-version-content"
                value={previewDraft}
                onChange={(event) => setPreviewDraft(event.target.value)}
                rows={14}
                className="max-h-[50vh] font-mono text-xs"
              />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Editing does not overwrite this version. Save creates the next hashed version.
                </span>
                <label className="flex shrink-0 items-center gap-2">
                  Retention
                  <select
                    value={outputRetention}
                    onChange={(event) =>
                      setOutputRetention(event.target.value as "keep" | "30" | "90" | "365")
                    }
                    className="rounded border border-border/60 bg-background px-2 py-1 text-foreground"
                  >
                    <option value="keep">Keep</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                  </select>
                </label>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This output has no inline preview. Export it to view the full file.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              <X className="mr-1.5 h-4 w-4" /> Close
            </Button>
            <Button variant="ghost" onClick={exportPreview} disabled={!previewDraft}>
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            <Button
              onClick={() => void saveNewOutputVersion()}
              disabled={!previewDraft.trim() || savingVersion}
            >
              {savingVersion ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save new version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
