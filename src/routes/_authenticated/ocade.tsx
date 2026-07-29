import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCcw,
  Search,
  Save,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  GitBranch,
  X,
  FolderOpen,
  FileOutput,
  CalendarClock,
  Workflow,
  SlidersHorizontal,
  MessagesSquare,
  Bot,
  Terminal,
  ShieldCheck,
  FileCode2,
  BriefcaseBusiness,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/shell/AppShell";
import { PrivacyBadge } from "@/components/shell/PrivacyBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import {
  createConversation,
  deleteConversation,
  exportConversation,
  improvePrompt,
  appendOcadeMessage,
  listConversations,
  listMessages,
  updateConversation,
} from "@/lib/ocade.functions";
import { getModeFor } from "@/lib/storage/resolver";
import { OCADE_DEFAULT_MODEL_ID, OCADE_MODELS, getOcadeModel } from "@/lib/ocade-models";
import { ocadeChatCapabilityDisclosure } from "@/lib/ocade-identity";
import { capabilityLabelFor } from "@/lib/ocade-capability-labels";
import { useOnline } from "@/lib/use-online";
import { useLocalEngine } from "@/lib/use-local-engine";
import {
  pickLocalModel,
  buildLocalFirstPlan,
  streamLocalChat,
  DEFAULT_LOCAL_BRIDGE_URL,
  type LocalChatMessage,
} from "@/lib/ocade-local";
import {
  classifyFile,
  isNativeTextKind,
  extractDocument,
  extractBinaryDocument,
  clampForContext,
  type ExtractResult,
} from "@/lib/ocade-documents";
import { isDecodableBinary } from "@/lib/ocade-decoders";
import {
  scanUntrustedContent,
  wrapUntrustedContent,
  describeScan,
} from "@/lib/ocade-injection-guard";
import {
  buildSourceIndex,
  citationInstruction,
  parseCitations,
  stripCitationMarkers,
  describeLocator,
  type IndexedSource,
  type Citation,
} from "@/lib/ocade-citations";
import { CopilotMount } from "@/components/ocade/CopilotPanel";
import { VisualResponse } from "@/components/ocade/VisualResponse";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import { saveDraft, recoverDraft, clearDraft } from "@/lib/offline-queue";
import {
  branchConversation,
  forkConversationBeforeMessage,
  getProject,
  setConversationProject,
  type OcadeProject,
} from "@/lib/ocade-projects.functions";
import {
  persistChatMessage,
  loadChatMessages,
  deleteVaultConversation,
  describeStorageError,
} from "@/lib/ocade-chat-store";
import { globalMultimodalRegistry } from "@/lib/providers/multimodal-registry";
import { assertStreamWithinLimit } from "@/lib/stream-limits";
import {
  detectVoiceCapabilities,
  registerSystemVoice,
  toVoiceOptions,
  pickVoice,
  resolveVoiceLanguage,
  captionSentenceAt,
  matchesWakePhrase,
  buildGreeting,
  type VoiceGender,
} from "@/lib/ocade-voice";
import { redactForSpeech, redactSpokenSecrets } from "@/lib/voice/transcript-redaction";
import { useVoicePrefs } from "@/lib/use-voice-prefs";
import { saveChatOutput } from "@/lib/artifacts/chat-output-flow";
import { listProjectFiles, saveProjectFile, type ProjectFile } from "@/lib/project-files";
import { localMemoryContext } from "@/lib/local-memory";
import {
  getChatCitations,
  removeConversationCitations,
  saveChatCitations,
} from "@/lib/chat-citation-store";

export const Route = createFileRoute("/_authenticated/ocade")({
  head: () => ({
    meta: [{ title: "OCADE — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: OcadePage,
});

/* ---------- Types ---------- */

type Attachment = {
  kind: "image" | "file";
  name: string;
  mime: string;
  sizeBytes: number;
  dataUrl?: string;
  /** Text extracted on-device for readable documents (never uploaded raw). */
  extractedText?: string;
  /** Honest note when a file could not be read (e.g. needs the document pack). */
  extractNote?: string;
  /**
   * The full extraction result, kept so citations can point at a real position.
   * Without it the source locator is empty and a citation can only name the
   * file, never the page, sheet or line it came from.
   */
  extract?: ExtractResult;
};

type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  model_id: string | null;
  privacy_mode: string;
  updated_at: string;
  project_id?: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: Attachment[];
  model_id: string | null;
  created_at: string;
};

type Mode = "chat" | "work";
type PermissionMode = "manual" | "assisted" | "autonomous";
type PendingChatMessage = {
  id: string;
  conversationId: string;
  text: string;
  attachments: Attachment[];
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

/* ---------- Root ---------- */

function OcadePage() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }
  if (!user) {
    return (
      <AppShell>
        <div className="mx-auto mt-10 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Sign-in required to use OCADE.</p>
        </div>
      </AppShell>
    );
  }
  return <OcadeWorkspace userId={user.id} userLabel={user.email?.split("@")[0] ?? "there"} />;
}

/* ---------- Workspace ---------- */

function OcadeWorkspace({ userId, userLabel }: { userId: string; userLabel: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [model, setModel] = useState<string>(OCADE_DEFAULT_MODEL_ID);
  const [chatsMode, setChatsMode] = useState<"browser_only" | "pc_vault" | "private_sync">(
    "private_sync",
  );
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [permission, setPermission] = useState<PermissionMode>("manual");
  const [pendingMessage, setPendingMessage] = useState<PendingChatMessage | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const list = (await listConversations()) as Conversation[];
      setConversations(list);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
    void getModeFor(userId, "chats").then((m) => setChatsMode(m));
  }, [userId, refreshList]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    // Read from wherever this conversation lives (vault for Browser Only).
    void loadChatMessages({ userId, chatsMode, conversationId: activeId })
      .then((rows) => setMessages(rows as unknown as Message[]))
      .catch((e) => {
        toast.error(describeStorageError(e));
        setMessages([]);
      })
      .finally(() => setLoadingMessages(false));
  }, [activeId, chatsMode, userId]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  useEffect(() => {
    if (active?.model_id) setModel(active.model_id);
  }, [active?.id, active?.model_id]);

  async function handleNew() {
    setPendingMessage(null);
    setActiveId(null);
    setMode("chat");
  }

  async function ensureActive(): Promise<Conversation> {
    if (active) return active;
    const conv = (await createConversation({ data: { modelId: model } })) as Conversation;
    setConversations((prev) => [conv, ...prev]);
    setLoadingMessages(true);
    setActiveId(conv.id);
    return conv;
  }

  async function togglePin(c: Conversation) {
    await updateConversation({ data: { id: c.id, pinned: !c.pinned } });
    await refreshList();
  }
  async function toggleArchive(c: Conversation) {
    await updateConversation({ data: { id: c.id, archived: !c.archived } });
    await refreshList();
    if (c.id === activeId && !c.archived) setActiveId(null);
  }
  async function handleRenameSubmit(newTitle: string) {
    if (!renameTarget) return;
    await updateConversation({ data: { id: renameTarget.id, title: newTitle } });
    setRenameTarget(null);
    await refreshList();
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;

    // Delete the conversation record...
    await deleteConversation({ data: { id: target.id } });

    /*
     * ...AND the message bodies held on this device.
     *
     * With a Browser Vault or PC Vault privacy mode the message text never went
     * to the server, so removing the server row alone would leave the actual
     * content sitting in local storage while the user is told "Conversation
     * deleted". Deleting only half of it and reporting success is worse than
     * failing loudly.
     */
    let vaultRemoved = 0;
    let vaultError: unknown = null;
    try {
      vaultRemoved = await deleteVaultConversation(userId, target.id);
    } catch (e) {
      vaultError = e;
    }
    const citationRemoval = removeConversationCitations(target.id);

    if (target.id === activeId) setActiveId(null);
    setDeleteTarget(null);
    await refreshList();

    if (vaultError || !citationRemoval.ok) {
      // Honest: the record is gone but the on-device copy is not.
      toast.error(
        vaultError
          ? `Conversation removed, but its messages on this device could not be deleted. ${describeStorageError(vaultError)}`
          : `Conversation removed, but its citation history on this device could not be deleted. ${citationRemoval.ok ? "" : citationRemoval.reason}`,
      );
    } else {
      toast.success(
        vaultRemoved > 0
          ? `Conversation deleted, including ${vaultRemoved} ${vaultRemoved === 1 ? "message" : "messages"} stored on this device.`
          : "Conversation deleted",
      );
    }
  }
  async function handleExport(c: Conversation) {
    const bundle = await exportConversation({ data: { conversationId: c.id } });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.title.replace(/[^a-z0-9-]+/gi, "_")}_ocade.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pinned = useMemo(
    () => conversations.filter((c) => c.pinned && !c.archived),
    [conversations],
  );
  const recent = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => (showArchived ? c.archived : !c.archived && !c.pinned))
      .filter((c) => (q ? c.title.toLowerCase().includes(q) : true));
  }, [conversations, search, showArchived]);

  return (
    <AppShell>
      {/* Offer the Desktop Copilot in the shell's adaptive right-hand panel. */}
      <CopilotMount />
      {/* Break out of centered workspace column and take the full height under the top bar. */}
      <div className="-mx-5 -my-6 flex h-[calc(100vh-2.75rem)] min-h-0 sm:-mx-8">
        {/* Contextual OCADE sidebar */}
        <OcadeContextualSidebar
          onNew={handleNew}
          search={search}
          setSearch={setSearch}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
          pinned={pinned}
          recent={recent}
          loading={loadingList}
          activeId={activeId}
          onSelect={(id) => {
            setActiveId(id);
            setMode("chat");
          }}
          onPin={togglePin}
          onArchive={toggleArchive}
          onRename={(c) => setRenameTarget(c)}
          onDelete={(c) => setDeleteTarget(c)}
          onExport={handleExport}
        />

        {/* Main workspace canvas */}
        <div className="flex min-h-0 flex-1 flex-col">
          {mode === "work" ? (
            <WorkModePanel permission={permission} onExitWork={() => setMode("chat")} />
          ) : active ? (
            <ChatSurface
              key={active.id}
              conversation={active}
              messages={messages}
              setMessages={setMessages}
              loading={loadingMessages}
              model={model}
              setModel={async (m) => {
                setModel(m);
                await updateConversation({ data: { id: active.id, modelId: m } });
                await refreshList();
              }}
              chatsMode={chatsMode}
              mode={mode}
              setMode={setMode}
              permission={permission}
              setPermission={setPermission}
              onRefreshList={refreshList}
              userLabel={userLabel}
              userId={userId}
              ensureActive={ensureActive}
              initialMessage={pendingMessage?.conversationId === active.id ? pendingMessage : null}
              onInitialMessageHandled={(id) =>
                setPendingMessage((current) => (current?.id === id ? null : current))
              }
              onOpenConversation={(id) => {
                setActiveId(id);
                setMode("chat");
              }}
            />
          ) : (
            <HomeSurface
              userLabel={userLabel}
              model={model}
              setModel={setModel}
              chatsMode={chatsMode}
              mode={mode}
              setMode={setMode}
              permission={permission}
              setPermission={setPermission}
              onSubmit={async (text, atts) => {
                const conv = await ensureActive();
                setPendingMessage({
                  id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  conversationId: conv.id,
                  text,
                  attachments: atts,
                });
                setActiveId(conv.id);
              }}
            />
          )}
        </div>
      </div>

      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRenameSubmit}
      />
      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </AppShell>
  );
}

/* ---------- Contextual OCADE Sidebar ---------- */

function OcadeContextualSidebar(props: {
  onNew: () => void;
  search: string;
  setSearch: (v: string) => void;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  pinned: Conversation[];
  recent: Conversation[];
  loading: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onPin: (c: Conversation) => void;
  onArchive: (c: Conversation) => void;
  onRename: (c: Conversation) => void;
  onDelete: (c: Conversation) => void;
  onExport: (c: Conversation) => void;
}) {
  const {
    onNew,
    search,
    setSearch,
    showArchived,
    setShowArchived,
    pinned,
    recent,
    loading,
    activeId,
    onSelect,
    onPin,
    onArchive,
    onRename,
    onDelete,
    onExport,
  } = props;

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border/70 bg-sidebar md:flex">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={onNew}
          className="flex flex-1 items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-sidebar-accent"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
        <Link
          to="/ocade/models"
          className="rounded-md border border-sidebar-border px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          title="Model control (technical)"
        >
          Models
        </Link>
      </div>

      {/* Static context sections */}
      <div className="space-y-0.5 px-2">
        <SidebarLink icon={BriefcaseBusiness} label="Work" to="/ocade/work" />
        <SidebarLink icon={FileCode2} label="Code" to="/ocade/code" />
        <SidebarLink icon={FolderOpen} label="Projects" to="/ocade/projects" />
        <SidebarLink icon={FileOutput} label="Outputs" to="/ocade/artifacts" />
        <SidebarLink icon={CalendarClock} label="Scheduled" to="/ocade/automations" />
        <SidebarLink icon={Workflow} label="Automations" to="/ocade/automations" />
        <StaticRow
          icon={SlidersHorizontal}
          label="Customize"
          onClick={() => setShowArchived(!showArchived)}
          note={showArchived ? "Viewing archived" : undefined}
        />
      </div>

      <div className="mt-1 px-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            // A placeholder is not an accessible name: it disappears as soon as
            // the user types and is not reliably announced.
            aria-label="Search conversations"
            type="search"
            className="h-8 border-sidebar-border bg-background/50 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {pinned.length > 0 && !showArchived ? (
          <>
            <SectionLabel>Pinned</SectionLabel>
            <ul className="mb-2 space-y-0.5">
              {pinned.map((c) => (
                <ConvRow
                  key={c.id}
                  c={c}
                  active={c.id === activeId}
                  onSelect={() => onSelect(c.id)}
                  onPin={() => onPin(c)}
                  onArchive={() => onArchive(c)}
                  onRename={() => onRename(c)}
                  onDelete={() => onDelete(c)}
                  onExport={() => onExport(c)}
                />
              ))}
            </ul>
          </>
        ) : null}

        <SectionLabel>
          {showArchived ? "Archived" : "Recent"}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="ml-auto text-[10px] font-normal text-muted-foreground hover:text-foreground"
          >
            {showArchived ? "← Active" : "Archived →"}
          </button>
        </SectionLabel>

        {loading ? (
          <div className="p-3 text-center text-xs text-muted-foreground">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground">
            {showArchived ? "No archived chats." : "No conversations yet."}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {recent.map((c) => (
              <ConvRow
                key={c.id}
                c={c}
                active={c.id === activeId}
                onSelect={() => onSelect(c.id)}
                onPin={() => onPin(c)}
                onArchive={() => onArchive(c)}
                onRename={() => onRename(c)}
                onDelete={() => onDelete(c)}
                onExport={() => onExport(c)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 mt-1 flex items-center px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function SidebarLink({
  icon: Icon,
  label,
  to,
}: {
  icon: typeof FolderOpen;
  label: string;
  to: "/ocade/work" | "/ocade/code" | "/ocade/projects" | "/ocade/artifacts" | "/ocade/automations";
}) {
  return (
    <Link
      to={to}
      className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function StaticRow({
  icon: Icon,
  label,
  onClick,
  note,
}: {
  icon: typeof FolderOpen;
  label: string;
  onClick?: () => void;
  note?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      {note ? <span className="ml-auto text-[10px] text-muted-foreground">{note}</span> : null}
    </button>
  );
}

function ConvRow({
  c,
  active,
  onSelect,
  onPin,
  onArchive,
  onRename,
  onDelete,
  onExport,
}: {
  c: Conversation;
  active: boolean;
  onSelect: () => void;
  onPin: () => void;
  onArchive: () => void;
  onRename: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  return (
    <li
      className={cn(
        "group flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <button onClick={onSelect} className="flex flex-1 items-center gap-1.5 truncate text-left">
        {c.pinned ? <Pin className="h-3 w-3 shrink-0 text-[color:var(--accent-ocade)]" /> : null}
        <span className="truncate">{c.title}</span>
      </button>
      <div className="flex opacity-0 transition group-hover:opacity-100">
        <IconMini title={c.pinned ? "Unpin" : "Pin"} onClick={onPin}>
          {c.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </IconMini>
        <IconMini title="Rename" onClick={onRename}>
          <Pencil className="h-3 w-3" />
        </IconMini>
        <IconMini title="Export" onClick={onExport}>
          <Download className="h-3 w-3" />
        </IconMini>
        <IconMini title={c.archived ? "Unarchive" : "Archive"} onClick={onArchive}>
          {c.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
        </IconMini>
        <IconMini title="Delete" onClick={onDelete}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </IconMini>
      </div>
    </li>
  );
}

function IconMini({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

/* ---------- Home Surface (empty state) ---------- */

function HomeSurface(props: {
  userLabel: string;
  model: string;
  setModel: (m: string) => void;
  chatsMode: "browser_only" | "pc_vault" | "private_sync";
  mode: Mode;
  setMode: (m: Mode) => void;
  permission: PermissionMode;
  setPermission: (p: PermissionMode) => void;
  onSubmit: (text: string, atts: Attachment[]) => Promise<void>;
}) {
  const {
    userLabel,
    model,
    setModel,
    chatsMode,
    mode,
    setMode,
    permission,
    setPermission,
    onSubmit,
  } = props;
  const modelInfo = getOcadeModel(model);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const text = draft.trim();
    if (!text && attachments.length === 0) return;
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(text, attachments);
      setDraft("");
      setAttachments([]);
    } catch (e) {
      toast.error((e as Error).message || "Could not start conversation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border/70 text-[color:var(--accent-ocade)]"
            aria-hidden
          >
            <span className="text-[15px] font-semibold tracking-tighter">CC</span>
          </div>
          <div>
            <h1 className="text-[22px] font-semibold text-foreground">Welcome, {userLabel}.</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              OCADE by CAERA CADANE. Ask a question or start a task.
            </p>
          </div>
        </div>

        <Composer
          draft={draft}
          setDraft={setDraft}
          attachments={attachments}
          setAttachments={setAttachments}
          onSubmit={submit}
          // No onStop: creating a conversation is a single round trip with
          // nothing to cancel, so no Stop button is offered. Send disables
          // itself while the request is in flight.
          streaming={busy}
          mode={mode}
          setMode={setMode}
          permission={permission}
          setPermission={setPermission}
          model={model}
          setModel={setModel}
          chatsMode={chatsMode}
          floating
        />

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setDraft(s)}
              className="rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-[12px] text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/80">
          {ocadeChatCapabilityDisclosure(capabilityLabelFor({ locality: modelInfo.locality }))}
        </p>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "Summarize this document",
  "Draft a professional email",
  "Explain a concept simply",
  "Plan my next work session",
];

/* ---------- Work Mode Panel ---------- */

function WorkModePanel({
  permission,
  onExitWork,
}: {
  permission: PermissionMode;
  onExitWork: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-4 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[color:var(--accent-ocade)]" />
          <h2 className="text-[18px] font-semibold">OCADE Work</h2>
          <button
            onClick={onExitWork}
            className="ml-auto rounded-md border border-border/60 px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            Exit Work mode
          </button>
        </div>

        <div className="rounded-lg border border-border/70 bg-card p-5">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-5 w-5 text-[color:var(--accent-ocade)]" />
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold text-foreground">
                Native Companion Required
              </h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                OCADE Work coordinates real desktop tasks — plan, permissions, live steps, pause,
                stop, verification and replay. In the browser alpha, OCADE cannot control your
                mouse, keyboard, terminal or filesystem. Install the CAERA Native Companion on your
                PC to enable this mode.
              </p>
              <div className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
                <PlanRow label="Task" value="Not started" />
                <PlanRow label="Plan" value="Awaiting request" />
                <PlanRow label="Application" value="—" />
                <PlanRow label="Project folder" value="—" />
                <PlanRow label="Permissions" value={permission} />
                <PlanRow label="Current step" value="—" />
              </div>
              {/*
                These three controls are disabled until the Native Companion is
                connected. The "Setup Required" badge explains that visually,
                but a badge sitting next to a button is not programmatically
                associated with it: a screen-reader user tabbing here would hear
                "Pause, dimmed" and no reason at all. Each control therefore
                states its own blocked reason and points at the badge.
              */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  disabled
                  title="Pause is available once the Native Companion is connected."
                  aria-describedby="run-controls-setup-required"
                  className="cursor-not-allowed rounded-md border border-border/60 px-3 py-1.5 text-[12px] text-muted-foreground"
                >
                  Pause
                </button>
                <button
                  disabled
                  title="Stop is available once the Native Companion is connected."
                  aria-describedby="run-controls-setup-required"
                  className="cursor-not-allowed rounded-md border border-border/60 px-3 py-1.5 text-[12px] text-muted-foreground"
                >
                  Stop
                </button>
                <button
                  disabled
                  title="Replay is available once the Native Companion is connected."
                  aria-describedby="run-controls-setup-required"
                  className="cursor-not-allowed rounded-md border border-border/60 px-3 py-1.5 text-[12px] text-muted-foreground"
                >
                  Replay
                </button>
                <span
                  id="run-controls-setup-required"
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300"
                >
                  <ShieldCheck className="h-3 w-3" /> Setup Required
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Native mouse, keyboard, screen, clipboard, terminal, PowerShell/shell, filesystem and
          application control are only performed when the CAERA Native Companion is installed and
          connected. OCADE will never pretend an OS action happened.
        </p>
      </div>
    </div>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

/* ---------- Chat Surface (open conversation) ---------- */

function ChatSurface(props: {
  conversation: Conversation;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  loading: boolean;
  model: string;
  setModel: (m: string) => void;
  chatsMode: "browser_only" | "pc_vault" | "private_sync";
  mode: Mode;
  setMode: (m: Mode) => void;
  permission: PermissionMode;
  setPermission: (p: PermissionMode) => void;
  onRefreshList: () => Promise<void>;
  userLabel: string;
  userId: string;
  ensureActive: () => Promise<Conversation>;
  initialMessage: PendingChatMessage | null;
  onInitialMessageHandled: (id: string) => void;
  onOpenConversation: (id: string) => void;
}) {
  const {
    conversation,
    messages,
    setMessages,
    loading,
    model,
    setModel,
    chatsMode,
    mode,
    setMode,
    permission,
    setPermission,
    onRefreshList,
    userId,
    initialMessage,
    onInitialMessageHandled,
    onOpenConversation,
  } = props;
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [improving, setImproving] = useState(false);
  const [listening, setListening] = useState(false);
  // Event handlers can run before React commits the next render. This ref is
  // the immediate authority, so a short press cannot strand the microphone on.
  const listeningRef = useRef(false);
  const [cloudApprovalNeeded, setCloudApprovalNeeded] = useState<null | {
    text: string;
    attachments: Attachment[];
  }>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<unknown>(null);
  const modelInfo = getOcadeModel(model);
  const online = useOnline();
  const localEngine = useLocalEngine();
  const [engineTier, setEngineTier] = useState<"auto" | "local" | "cloud">("auto");
  // Sources attached to the in-flight request, so the reply's [S1] markers can
  // be resolved back to real documents (never to an invented id).
  const sourceIndexRef = useRef<IndexedSource[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [citationError, setCitationError] = useState<string | null>(null);
  // Voice: shared preferences drive captions, wake phrase, device and output.
  const { prefs: voicePrefs, emergencyMute } = useVoicePrefs();
  const [caption, setCaption] = useState("");
  /** What OCADE is currently reading aloud, for output captions. */
  const [spokenCaption, setSpokenCaption] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const wakeRef = useRef<SpeechRecognitionLike | null>(null);
  // Visual responses are opt-in per answer.
  const [visualAnswer, setVisualAnswer] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [projectFileError, setProjectFileError] = useState<string | null>(null);
  const [projectDetails, setProjectDetails] = useState<OcadeProject | null>(null);
  const [projectContextError, setProjectContextError] = useState<string | null>(null);
  const [projectContextLoading, setProjectContextLoading] = useState(false);
  const initialMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!conversation.project_id) {
      setProjectFiles([]);
      setProjectFileError(null);
      setProjectDetails(null);
      setProjectContextError(null);
      setProjectContextLoading(false);
      return;
    }
    const result = listProjectFiles(conversation.project_id);
    if (result.ok) {
      setProjectFiles(result.data);
      setProjectFileError(null);
    } else {
      setProjectFiles([]);
      setProjectFileError(result.reason);
    }
    let live = true;
    setProjectContextLoading(true);
    void getProject({ data: { id: conversation.project_id } })
      .then((project) => {
        if (!live) return;
        setProjectDetails(project);
        setProjectContextError(null);
      })
      .catch((error) => {
        if (!live) return;
        setProjectDetails(null);
        setProjectContextError(
          error instanceof Error ? error.message : "Project context could not be loaded.",
        );
      })
      .finally(() => {
        if (live) setProjectContextLoading(false);
      });
    return () => {
      live = false;
    };
  }, [conversation.project_id]);

  useEffect(() => {
    if (streaming) return;
    const assistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!assistant) {
      setCitations([]);
      setCitationError(null);
      return;
    }
    const restored = getChatCitations(conversation.id, assistant.id);
    if (!restored.ok) {
      setCitations([]);
      setCitationError(restored.reason);
      return;
    }
    setCitations(restored.data ?? []);
    setCitationError(null);
  }, [conversation.id, messages, streaming]);

  // Crash recovery: restore anything typed but not sent for THIS conversation,
  // and keep it saved as the user types (Plan §39).
  useEffect(() => {
    const recovered = recoverDraft(conversation.id);
    if (recovered?.text) {
      setDraft((current) => (current.trim() ? current : recovered.text));
      toast.info("Restored the message you were writing.");
    }
    // Only on conversation change — never clobber what the user is typing now.
  }, [conversation.id]);

  useEffect(() => {
    if (streaming) return;
    const id = setTimeout(() => saveDraft(conversation.id, draft), 400);
    return () => clearTimeout(id);
  }, [draft, conversation.id, streaming]);
  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].content;
    }
    return null;
  }, [messages]);
  // No assumed default voice — OCADE speaks with the platform voice until the
  // user chooses male or female (decision #22). Device-level preference.
  const [voiceGender, setVoiceGender] = useState<VoiceGender | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem("caera:voice:gender");
    return v === "male" || v === "female" ? v : null;
  });

  function chooseVoice(g: VoiceGender) {
    setVoiceGender(g);
    if (typeof window !== "undefined") window.localStorage.setItem("caera:voice:gender", g);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText]);

  async function sendMessage(
    overrideText?: string,
    overrideAtts?: Attachment[],
    allowCloud = false,
  ) {
    const text = (overrideText ?? draft).trim();
    const atts = overrideAtts ?? attachments;
    if (!text && atts.length === 0) return;
    if (streaming) return;
    if (
      conversation.project_id &&
      (projectContextLoading || projectFileError || projectContextError || !projectDetails)
    ) {
      toast.error(
        `Project context is unavailable: ${
          projectContextLoading
            ? "still loading"
            : (projectFileError ?? projectContextError ?? "project record missing")
        }`,
      );
      return;
    }

    // Local-first routing (P4c). On-device inference is unlimited and keeps the
    // prompt on the machine — no cloud approval needed. "Automatic" prefers
    // local when a suitable engine is ready, else falls through to cloud.
    const localReady = localEngine.status === "ready" && localEngine.models.length > 0;
    const hasImage = atts.some((a) => a.kind === "image");
    const localPick = localReady
      ? pickLocalModel(localEngine.models, hasImage ? "vision" : "general")
      : null;

    if (engineTier === "local" && (!localReady || !localPick)) {
      toast.error(
        !localReady
          ? "OCADE Local isn't available right now. Switch to OCADE Cloud or Automatic."
          : hasImage
            ? "Image understanding needs a local vision engine or OCADE Cloud."
            : "No suitable on-device engine is installed.",
      );
      return;
    }
    if ((engineTier === "local" || engineTier === "auto") && localReady && localPick) {
      await sendViaLocal(text, atts, hasImage);
      return;
    }

    if (chatsMode !== "private_sync" && !allowCloud) {
      setCloudApprovalNeeded({ text, attachments: atts });
      return;
    }
    const requestContext = buildRequestContext(atts, chatsMode !== "private_sync");
    if (!requestContext.ok) {
      toast.error(requestContext.reason);
      return;
    }

    const optimistic: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      attachments: atts,
      model_id: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    saveDraft(conversation.id, text);
    setDraft("");
    setAttachments([]);
    setStreaming(true);
    setStreamText("");

    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Session expired");

      const res = await fetch("/api/ocade/chat", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversationId: conversation.id,
          model,
          allowCloud,
          documentContext: requestContext.data,
          ...(chatsMode !== "private_sync"
            ? {
                history: messages
                  .filter((message) => message.role !== "system")
                  .slice(-200)
                  .map((message) => ({ role: message.role, content: message.content })),
              }
            : {}),
          message: { content: text, attachments: atts },
        }),
        signal: controller.signal,
      });

      if (res.status === 428) {
        setStreaming(false);
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(text);
        setAttachments(atts);
        setCloudApprovalNeeded({ text, attachments: atts });
        return;
      }
      // Cloud allowance exhausted — restore the message and point at the local
      // alternative rather than failing generically (decision #12).
      if (res.status === 429) {
        setStreaming(false);
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(text);
        setAttachments(atts);
        const info = (await res.json().catch(() => null)) as {
          message?: string;
          resetsAt?: string;
        } | null;
        const resets = info?.resetsAt ? new Date(info.resetsAt) : null;
        const localReady = localEngine.status === "ready" && localEngine.models.length > 0;
        toast.error(
          localReady
            ? "OCADE Cloud allowance is used up. Switch to OCADE Local — it's unlimited."
            : (info?.message ??
                `OCADE Cloud allowance is used up${resets ? ` until ${resets.toLocaleTimeString()}` : ""}.`),
        );
        if (localReady) setEngineTier("local");
        return;
      }
      if (!res.ok || !res.body) {
        const errTxt = await res.text().catch(() => "Chat request failed");
        throw new Error(readChatError(errTxt, res.status));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        /*
         * Stop a reply that never ends. Cancellation covers the case where the
         * USER wants out; nothing bounded a server that simply keeps sending,
         * and every chunk here also triggers a re-render, so the page degrades
         * long before memory does.
         */
        assertStreamWithinLimit(acc.length);
        setStreamText(acc);
      }

      let rows: Message[];
      if (chatsMode === "private_sync") {
        rows = (await listMessages({
          data: { conversationId: conversation.id },
        })) as unknown as Message[];
      } else {
        try {
          await persistChatMessage({
            userId,
            chatsMode,
            conversationId: conversation.id,
            role: "user",
            content: text,
            attachments: atts.map((attachment) => ({
              kind: attachment.kind,
              name: attachment.name,
              mime: attachment.mime,
              sizeBytes: attachment.sizeBytes,
            })),
          });
          await persistChatMessage({
            userId,
            chatsMode,
            conversationId: conversation.id,
            role: "assistant",
            content: acc,
            modelId: model,
            providerId: "ocade-cloud",
          });
          rows = (await loadChatMessages({
            userId,
            chatsMode,
            conversationId: conversation.id,
          })) as unknown as Message[];
        } catch (storageError) {
          const reason = describeStorageError(storageError);
          setMessages((current) => [
            ...current.filter((message) => message.id !== optimistic.id),
            optimistic,
            {
              id: `unsaved-cloud-${Date.now()}`,
              role: "assistant",
              content: `${acc}\n\n_[Cloud response completed but could not be saved on this device: ${reason}]_`,
              attachments: [],
              model_id: model,
              created_at: new Date().toISOString(),
            },
          ]);
          setCitationError(
            "The response was not saved in the selected vault, so its citation history was not recorded.",
          );
          toast.error(`Cloud response completed, but vault persistence failed. ${reason}`);
          setStreamText("");
          await onRefreshList();
          return;
        }
      }
      const assistant = [...rows].reverse().find((message) => message.role === "assistant");
      recordCitations(acc, assistant?.id);
      setMessages(rows);
      clearDraft(conversation.id);
      setStreamText("");
      await onRefreshList();
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") {
        const stopped = `${acc}\n\n_[stopped by you]_`;
        try {
          let rows: Message[];
          if (chatsMode === "private_sync") {
            rows = (await listMessages({
              data: { conversationId: conversation.id },
            })) as unknown as Message[];
            const persistedUser = rows.some(
              (message) =>
                message.role === "user" &&
                message.content === text &&
                Date.parse(message.created_at) >= Date.parse(optimistic.created_at) - 5_000,
            );
            if (!persistedUser) {
              await appendOcadeMessage({
                data: {
                  conversationId: conversation.id,
                  role: "user",
                  content: text,
                  attachments: atts.map((attachment) => ({
                    kind: attachment.kind,
                    name: attachment.name,
                    mime: attachment.mime,
                    sizeBytes: attachment.sizeBytes,
                  })),
                },
              });
            }
            const completedAssistant = rows.find(
              (message) =>
                message.role === "assistant" &&
                Date.parse(message.created_at) >= Date.parse(optimistic.created_at) - 5_000,
            );
            if (!completedAssistant) {
              await appendOcadeMessage({
                data: {
                  conversationId: conversation.id,
                  role: "assistant",
                  content: stopped,
                  modelId: model,
                  providerId: "ocade-cloud",
                },
              });
            }
            rows = (await listMessages({
              data: { conversationId: conversation.id },
            })) as unknown as Message[];
          } else {
            await persistChatMessage({
              userId,
              chatsMode,
              conversationId: conversation.id,
              role: "user",
              content: text,
              attachments: atts.map((attachment) => ({
                kind: attachment.kind,
                name: attachment.name,
                mime: attachment.mime,
                sizeBytes: attachment.sizeBytes,
              })),
            });
            await persistChatMessage({
              userId,
              chatsMode,
              conversationId: conversation.id,
              role: "assistant",
              content: stopped,
              modelId: model,
              providerId: "ocade-cloud",
            });
            rows = (await loadChatMessages({
              userId,
              chatsMode,
              conversationId: conversation.id,
            })) as unknown as Message[];
          }
          const assistant = [...rows].reverse().find((message) => message.role === "assistant");
          recordCitations(assistant?.content ?? acc, assistant?.id);
          setMessages(rows);
          clearDraft(conversation.id);
          await onRefreshList();
        } catch (storageError) {
          const reason = describeStorageError(storageError);
          setMessages((current) => [
            ...current.filter((message) => message.id !== optimistic.id),
            optimistic,
            {
              id: `unsaved-stopped-${Date.now()}`,
              role: "assistant",
              content: `${stopped}\n\n_[This stopped response could not be persisted: ${reason}]_`,
              attachments: [],
              model_id: model,
              created_at: new Date().toISOString(),
            },
          ]);
          setCitationError(
            "The stopped response was not persisted, so its citations were not saved.",
          );
          toast.error(`The response stopped, but persistence failed. ${reason}`);
        }
      } else {
        toast.error((e as Error).message || "OCADE could not respond");
        let persisted = false;
        if (chatsMode === "private_sync") {
          try {
            const rows = (await listMessages({
              data: { conversationId: conversation.id },
            })) as unknown as Message[];
            persisted = rows.some(
              (message) =>
                message.role === "user" &&
                message.content === text &&
                Date.parse(message.created_at) >= Date.parse(optimistic.created_at) - 5_000,
            );
            if (persisted) setMessages(rows);
          } catch {
            // Preserve the visible failure state below when persistence itself
            // cannot be inspected.
          }
        }
        if (!persisted) {
          setMessages((m) => m.filter((x) => x.id !== optimistic.id));
          setDraft(text);
          setAttachments(atts);
        } else {
          clearDraft(conversation.id);
        }
      }
    } finally {
      setStreaming(false);
      setStreamText("");
      abortRef.current = null;
    }
  }

  /**
   * On-device send with the capability-aware fallback chain: preferred local →
   * secondary → lightweight. Only after every local engine fails do we ask
   * permission to cross to OCADE Cloud (never silently). Cancellation is
   * honoured at any step and the partial answer is preserved.
   */
  async function sendViaLocal(text: string, atts: Attachment[], hasImage: boolean) {
    const plan = buildLocalFirstPlan({
      desired: hasImage ? "vision" : "general",
      models: localEngine.models,
      cloudAllowed: online,
      online,
    });
    const localSteps = plan.filter((s) => s.modelId);
    if (localSteps.length === 0) {
      toast.error("No on-device engine can serve this request.");
      return;
    }
    const requestContext = buildRequestContext(atts, true);
    if (!requestContext.ok) {
      toast.error(requestContext.reason);
      return;
    }

    const optimistic: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      attachments: atts,
      model_id: null,
      created_at: new Date().toISOString(),
    };
    const priorMessages = messages;
    setMessages((m) => [...m, optimistic]);
    saveDraft(conversation.id, text);
    setDraft("");
    setAttachments([]);
    setStreaming(true);
    setStreamText("");

    const controller = new AbortController();
    abortRef.current = controller;

    let userTurnPersisted = false;
    let completedUnsavedText = "";
    const failures: string[] = [];

    try {
      for (const step of localSteps) {
        const label = step.label ?? "OCADE Local";
        const sys =
          `You are OCADE, developed and created by CAERA CADANE, running as ${label} on the user's own device. ` +
          `Refer to your engine only as "${label}"; never print raw model or provider names. ` +
          `Never claim to be another product. Be helpful, concise, and honest about your limits.` +
          (projectDetails
            ? ` This conversation belongs to the user project "${projectDetails.name}".` +
              (projectDetails.instructions?.trim()
                ? ` Apply these user-authored project instructions: ${projectDetails.instructions.slice(0, 20_000)}`
                : "")
            : "");
        const localMessages: LocalChatMessage[] = [{ role: "system", content: sys }];
        for (const m of priorMessages) {
          if (m.role === "system") continue;
          localMessages.push({ role: m.role, content: m.content });
        }
        const docContext = requestContext.data;
        if (docContext) {
          localMessages.push({
            role: "user",
            content: `Context from files the user attached (extracted on this device):\n\n${docContext}`,
          });
        }
        const images = atts
          .filter(
            (attachment): attachment is Attachment & { dataUrl: string } =>
              attachment.kind === "image" && typeof attachment.dataUrl === "string",
          )
          .map((attachment) => attachment.dataUrl.split(",", 2)[1])
          .filter((payload): payload is string => Boolean(payload));
        localMessages.push({
          role: "user",
          content: text,
          ...(images.length > 0 ? { images } : {}),
        });

        let acc = "";
        setStreamText("");
        const result = await streamLocalChat(
          DEFAULT_LOCAL_BRIDGE_URL,
          step.modelId!,
          localMessages,
          {
            onToken: (c) => {
              acc += c;
              setStreamText(acc);
            },
            signal: controller.signal,
          },
        );

        if (result.reason === "cancelled") {
          completedUnsavedText = `${acc}\n\n_[stopped by you]_`;
          await persistChatMessage({
            userId,
            chatsMode,
            conversationId: conversation.id,
            role: "user",
            content: text,
            attachments: atts.map((attachment) => ({
              kind: attachment.kind,
              name: attachment.name,
              mime: attachment.mime,
              sizeBytes: attachment.sizeBytes,
            })),
          });
          userTurnPersisted = true;
          await persistChatMessage({
            userId,
            chatsMode,
            conversationId: conversation.id,
            role: "assistant",
            content: completedUnsavedText,
            modelId: step.modelId,
            providerId: "ocade-local",
          });
          const rows = await refreshAfterLocal();
          const assistant = [...rows].reverse().find((message) => message.role === "assistant");
          recordCitations(acc, assistant?.id);
          clearDraft(conversation.id);
          return;
        }

        if (result.ok && acc.trim()) {
          completedUnsavedText = acc;
          await persistChatMessage({
            userId,
            chatsMode,
            conversationId: conversation.id,
            role: "user",
            content: text,
            attachments: atts.map((attachment) => ({
              kind: attachment.kind,
              name: attachment.name,
              mime: attachment.mime,
              sizeBytes: attachment.sizeBytes,
            })),
          });
          userTurnPersisted = true;
          await persistChatMessage({
            userId,
            chatsMode,
            conversationId: conversation.id,
            role: "assistant",
            content: acc,
            modelId: step.modelId,
            providerId: "ocade-local",
          });
          const rows = await refreshAfterLocal();
          const assistant = [...rows].reverse().find((message) => message.role === "assistant");
          recordCitations(acc, assistant?.id);
          clearDraft(conversation.id);
          return;
        }

        // This engine failed — record and try the next one in the chain.
        failures.push(`${label}: ${result.reason ?? "no response"}`);
      }

      // Every on-device engine failed. Never cross to cloud silently.
      setStreaming(false);
      setStreamText("");
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setDraft(text);
      setAttachments(atts);
      const why = failures.length > 0 ? ` (${failures[failures.length - 1]})` : "";
      if (online) {
        setCloudApprovalNeeded({ text, attachments: atts });
        toast.error(`On-device engines couldn't answer${why}. Approve OCADE Cloud to continue.`);
      } else {
        toast.error(`You're offline and no on-device engine could answer${why}.`);
      }
    } catch (e) {
      // Surfaces vault-locked / companion-required reasons actionably.
      toast.error(describeStorageError(e));
      if (!userTurnPersisted) {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(text);
        setAttachments(atts);
      } else {
        clearDraft(conversation.id);
        try {
          const rows = await refreshAfterLocal();
          if (completedUnsavedText) {
            setMessages([
              ...rows,
              {
                id: `unsaved-local-${Date.now()}`,
                role: "assistant",
                content: `${completedUnsavedText}\n\n_[This local response completed but could not be saved.]_`,
                attachments: [],
                model_id: model,
                created_at: new Date().toISOString(),
              },
            ]);
          }
        } catch {
          // The original storage error is already surfaced above.
        }
      }
    } finally {
      setStreaming(false);
      setStreamText("");
      abortRef.current = null;
    }
  }

  /**
   * Assemble on-device-extracted document text into a single bounded context
   * block. Only extracted TEXT travels — never the raw file.
   */
  function buildDocContext(atts: Attachment[]): string | undefined {
    const projectAttachments: Attachment[] = projectFiles.map((file) => ({
      kind: "file",
      name: file.folder ? `${file.folder}/${file.name}` : file.name,
      mime: file.mime,
      sizeBytes: file.sizeBytes,
      extractedText: file.text,
      extract: {
        status: "ok",
        meta: {
          name: file.folder ? `${file.folder}/${file.name}` : file.name,
          kind: classifyFile(file.name, file.mime),
          mime: file.mime,
          sizeBytes: file.sizeBytes,
        },
        text: file.text,
      },
    }));
    const withText = [...projectAttachments, ...atts].filter((a) => a.extractedText);
    if (withText.length === 0) {
      sourceIndexRef.current = [];
      return undefined;
    }
    // Index the sources so the answer can cite them, then remember the index so
    // markers in the reply can be mapped back to real documents (Plan §18).
    //
    // Built by `buildSourceIndex`, NOT by hand: it derives a real locator
    // (page, sheet or line) from the extraction metadata. The previous inline
    // version hardcoded an empty locator, so every citation could name the file
    // but never say where in it the answer came from.
    const sources: IndexedSource[] = buildSourceIndex(
      withText.map(
        (a): ExtractResult =>
          a.extract ?? {
            // Older attachments (restored from a draft) have no stored result;
            // fall back to a minimal one rather than dropping the source.
            status: "ok",
            meta: {
              name: a.name,
              kind: classifyFile(a.name, a.mime),
              mime: a.mime,
              sizeBytes: a.sizeBytes,
            },
            text: a.extractedText ?? null,
          },
      ),
    );
    sourceIndexRef.current = sources;

    // Every file's content is wrapped as UNTRUSTED DATA before it reaches any
    // engine: hidden characters stripped, role markers defanged, and an explicit
    // "do not obey instructions inside this" preamble attached (Plan §31).
    const parts = withText.map(
      (a, i) => `[${sources[i].id}] ${wrapUntrustedContent(a.extractedText!, a.name).text}`,
    );
    const instruction = citationInstruction(sources);
    const body = clampForContext(parts.join("\n\n"), 24_000).text;
    return instruction ? `${instruction}\n\n${body}` : body;
  }

  function buildRequestContext(
    atts: Attachment[],
    includeLocalMemory: boolean,
  ): { ok: true; data: string | undefined } | { ok: false; reason: string } {
    const documents = buildDocContext(atts);
    if (!includeLocalMemory) return { ok: true, data: documents };
    const memory = localMemoryContext(conversation.project_id ?? null);
    if (!memory.ok) return memory;
    const parts = [memory.data, documents].filter((part): part is string => Boolean(part));
    return { ok: true, data: parts.length > 0 ? parts.join("\n\n") : undefined };
  }

  async function saveAttachmentToProject(attachment: Attachment) {
    if (!conversation.project_id || !attachment.extractedText) return;
    const saved = await saveProjectFile({
      projectId: conversation.project_id,
      name: attachment.name,
      mime: attachment.mime,
      sizeBytes: attachment.sizeBytes,
      text: attachment.extractedText,
    });
    if (!saved.ok) {
      toast.error(saved.reason);
      return;
    }
    const refreshed = listProjectFiles(conversation.project_id);
    if (!refreshed.ok) {
      setProjectFileError(refreshed.reason);
      toast.error(refreshed.reason);
      return;
    }
    setProjectFiles(refreshed.data);
    setProjectFileError(null);
    toast.success(`Saved ${attachment.name} as hashed project context on this device.`);
  }

  /** Map citation markers in a finished answer back to the real sources. */
  function recordCitations(answer: string, messageId?: string) {
    const sources = sourceIndexRef.current;
    const parsed = sources.length > 0 ? parseCitations(answer, sources) : [];
    setCitations(parsed);
    if (parsed.length === 0) {
      setCitationError(null);
      return;
    }
    if (!messageId) {
      setCitationError(
        "The cited response was not found in persistence, so its citation cards were not saved.",
      );
      return;
    }
    const saved = saveChatCitations({
      conversationId: conversation.id,
      messageId,
      citations: parsed,
    });
    setCitationError(saved.ok ? null : saved.reason);
  }

  /**
   * Fork the conversation at a message into a new thread (Plan §17). The
   * original is never modified — every turn up to and including this one is
   * copied, so the user can explore an alternative without losing anything.
   */
  async function branchFrom(message: Message) {
    try {
      const created = (await branchConversation({
        data: { conversationId: conversation.id, fromMessageId: message.id },
      })) as { id: string; title: string };
      toast.success(`Branched into “${created.title}”. The original is unchanged.`);
      await onRefreshList();
      onOpenConversation(created.id);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't branch — this needs the database migration.",
      );
    }
  }

  async function forkBeforeUser(message: Message, title: string) {
    if (chatsMode === "private_sync") {
      return (await forkConversationBeforeMessage({
        data: {
          conversationId: conversation.id,
          fromMessageId: message.id,
          title,
        },
      })) as { id: string; title: string };
    }

    const created = (await createConversation({
      data: { title, modelId: model },
    })) as Conversation;
    try {
      if (conversation.project_id) {
        await setConversationProject({
          data: {
            conversationId: created.id,
            projectId: conversation.project_id,
          },
        });
      }
      const source = await loadChatMessages({
        userId,
        chatsMode,
        conversationId: conversation.id,
      });
      const pivot = source.findIndex((row) => row.id === message.id);
      if (pivot < 0 || source[pivot].role !== "user") {
        throw new Error("The message to branch from is no longer available in this vault.");
      }
      for (const row of source.slice(0, pivot)) {
        if (row.role === "system") {
          throw new Error(
            "This local branch contains a system record that cannot be copied safely.",
          );
        }
        await persistChatMessage({
          userId,
          chatsMode,
          conversationId: created.id,
          role: row.role,
          content: row.content,
          attachments: row.attachments,
          modelId: row.model_id,
          providerId: row.provider_id,
        });
      }
      return { id: created.id, title: created.title };
    } catch (error) {
      let cleanupError: unknown = null;
      try {
        await deleteVaultConversation(userId, created.id);
        await deleteConversation({ data: { id: created.id } });
      } catch (cleanup) {
        cleanupError = cleanup;
      }
      if (cleanupError) {
        throw new Error(
          `${error instanceof Error ? error.message : "Could not create the local branch."} Cleanup also failed: ${describeStorageError(cleanupError)}`,
        );
      }
      throw error;
    }
  }

  async function prepareEdit(message: Message) {
    try {
      const created = await forkBeforeUser(message, `${conversation.title} (edited branch)`);
      saveDraft(created.id, message.content);
      await onRefreshList();
      onOpenConversation(created.id);
      toast.success("Created an independent branch. Edit the restored prompt, then send it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare the edited branch.");
    }
  }

  async function saveAssistantOutput(message: Message, index: number) {
    const sourceTurn = [...messages.slice(0, index)]
      .reverse()
      .find((candidate) => candidate.role === "user");
    const attachedFiles = (sourceTurn?.attachments ?? [])
      .filter(
        (attachment): attachment is Attachment & { extractedText: string } =>
          typeof attachment.extractedText === "string" && attachment.extractedText.length > 0,
      )
      .map((attachment) => ({
        name: attachment.name,
        content: attachment.extractedText,
      }));
    const files = [
      ...projectFiles.map((file) => ({
        name: file.folder ? `${file.folder}/${file.name}` : file.name,
        content: file.text,
      })),
      ...attachedFiles,
    ].filter(
      (file, index, all) =>
        all.findIndex(
          (candidate) => candidate.name === file.name && candidate.content === file.content,
        ) === index,
    );

    const saved = await saveChatOutput({
      title: conversation.title,
      content: message.content,
      conversationId: conversation.id,
      messageId: message.id,
      ...(conversation.project_id
        ? {
            project: {
              id: conversation.project_id,
              ...(projectDetails
                ? { name: projectDetails.name, instructions: projectDetails.instructions }
                : {}),
            },
          }
        : {}),
      files,
      // A complete model response is not independent evidence that its claims
      // are correct. The artifact is integrity-checked but stays NOT CONFIRMED.
      producerEvidence:
        "Saved from a completed OCADE Chat response and re-hashed after local storage. Factual claims were not independently verified by this save action.",
      producerVerified: false,
    });
    if (!saved.ok) {
      toast.error(saved.reason);
      return;
    }
    toast.success("Saved to Artifacts and recorded in on-device Activity.");
  }

  async function refreshAfterLocal(): Promise<Message[]> {
    const rows = (await loadChatMessages({
      userId,
      chatsMode,
      conversationId: conversation.id,
    })) as unknown as Message[];
    setMessages(rows);
    setStreamText("");
    await onRefreshList();
    return rows;
  }

  function stop() {
    abortRef.current?.abort();
  }

  useEffect(() => {
    if (
      loading ||
      !initialMessage ||
      initialMessage.conversationId !== conversation.id ||
      initialMessageRef.current === initialMessage.id
    ) {
      return;
    }
    initialMessageRef.current = initialMessage.id;
    onInitialMessageHandled(initialMessage.id);
    void sendMessage(initialMessage.text, initialMessage.attachments);
    // The message id is the one-shot authority. sendMessage is intentionally
    // excluded because its render identity changes while streaming.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, initialMessage, loading, onInitialMessageHandled]);

  async function regenerate() {
    const idx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (idx === -1) return;
    const realIdx = messages.length - 1 - idx;
    const userMsg = messages[realIdx];
    try {
      const created = await forkBeforeUser(userMsg, `${conversation.title} (retry branch)`);
      saveDraft(created.id, userMsg.content);
      await onRefreshList();
      onOpenConversation(created.id);
      toast.success("Created a retry branch with the prompt restored. Send when ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare the retry branch.");
    }
  }

  async function handleImprove() {
    if (!draft.trim()) return;
    setImproving(true);
    try {
      const { improved } = (await improvePrompt({ data: { text: draft.trim() } })) as {
        improved: string;
      };
      setDraft(improved);
      toast.success("Prompt improved");
    } catch {
      toast.error("Could not improve prompt");
    } finally {
      setImproving(false);
    }
  }

  /**
   * Push-to-talk through the browser speech engine. The browser/OS may process
   * recognition remotely; only the optional wake listener requires an explicit
   * local-processing capability.
   */
  function toggleVoice() {
    const w = window as unknown as {
      speechSynthesis?: unknown;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      SpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const caps = detectVoiceCapabilities(w);
    if (!caps.recognition) {
      toast.error(caps.reason ?? "Voice input isn't available in this browser.");
      return;
    }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice input isn't available in this browser.");
      return;
    }
    if (listeningRef.current) {
      (recogRef.current as SpeechRecognitionLike | null)?.stop();
      listeningRef.current = false;
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = false;
    // Interim results power live captions; without captions we only need finals.
    rec.interimResults = voicePrefs.captionsEnabled;
    // Only a verified language pack is used (decision #27).
    rec.lang = verifiedLanguage(voicePrefs.language);
    rec.onresult = (ev) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        const text = r?.[0]?.transcript ?? "";
        if (r?.isFinal) final += text;
        else interim += text;
      }
      /**
       * Redact BEFORE the transcript reaches anything that displays, stores or
       * transmits it. The draft feeds the composer, which feeds the model and
       * the saved conversation, so a spoken OTP left here would leak into all
       * three. Redaction is local and runs on interim results too, so a secret
       * never even flashes up in the live caption.
       */
      const safeFinal = redactSpokenSecrets(final).text;
      const safeInterim = redactSpokenSecrets(interim).text;
      if (voicePrefs.captionsEnabled) setCaption(safeFinal || safeInterim);
      if (safeFinal) setDraft((d) => (d ? d + " " : "") + safeFinal);
    };
    rec.onend = () => {
      listeningRef.current = false;
      setListening(false);
      setCaption("");
    };
    rec.onerror = () => {
      listeningRef.current = false;
      setListening(false);
      setCaption("");
    };
    recogRef.current = rec;
    try {
      rec.start();
      listeningRef.current = true;
      setListening(true);
    } catch {
      recogRef.current = null;
      listeningRef.current = false;
      setListening(false);
      setCaption("");
      toast.error("The browser couldn't start speech recognition.");
    }
  }

  /** Fall back to a verified pack rather than advertising an unverified one. */
  /**
   * The language voice will actually use.
   *
   * Delegates to `resolveVoiceLanguage` so region subtags resolve correctly —
   * matching on the exact code meant "en-GB" missed the "en" pack and fell back
   * for no reason.
   */
  function verifiedLanguage(code: string): string {
    return resolveVoiceLanguage(code).code;
  }

  /**
   * Optional local wake phrase (decision #23). It runs only when the recognition
   * engine explicitly exposes local processing; ordinary browser recognition
   * is not enough evidence for continuous background listening.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!voicePrefs.wakeEnabled || listening) return;
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      SpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const caps = detectVoiceCapabilities(w);
    if (!caps.wakePhrase) return;

    let stopped = false;
    const rec = new Ctor();
    rec.processLocally = true;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = verifiedLanguage(voicePrefs.language);
    rec.onresult = (ev) => {
      for (let i = 0; i < ev.results.length; i++) {
        const text = ev.results[i]?.[0]?.transcript ?? "";
        if (matchesWakePhrase(text)) {
          stopped = true;
          rec.stop();
          const greeting = buildGreeting(
            {
              style: voicePrefs.addressStyle,
              preferredName: voicePrefs.preferredName,
              customTitle: voicePrefs.preferredTitle,
              enabled: voicePrefs.greetingEnabled,
            },
            new Date().getHours(),
          );
          if (greeting) readAloud(greeting);
          toggleVoice();
          return;
        }
      }
    };
    // Keep the wake listener alive across the browser's idle auto-stops.
    rec.onend = () => {
      if (!stopped && voicePrefs.wakeEnabled) {
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      }
    };
    rec.onerror = () => {
      /* transient — onend restarts */
    };
    try {
      rec.start();
    } catch {
      /* already running */
    }
    wakeRef.current = rec;
    return () => {
      stopped = true;
      try {
        rec.stop();
      } catch {
        /* not running */
      }
      wakeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voicePrefs.wakeEnabled, voicePrefs.language, listening]);

  /**
   * Read a reply aloud with the user's chosen OCADE voice. Speaking again
   * cancels the previous utterance, so the user can always interrupt.
   */
  function readAloud(raw: string) {
    if (typeof window === "undefined") return;
    /*
     * Publish the platform speech engine to the multimodal registry the first
     * time speech is actually used, so the registry holds the provider that
     * really ships rather than an empty list. Idempotent: the registry refuses
     * a duplicate id and this reports the reason instead of throwing.
     */
    registerSystemVoice(
      globalMultimodalRegistry,
      window as unknown as Parameters<typeof registerSystemVoice>[1],
    );
    /*
     * Citation markers are for the EYE, not the ear. Speaking "[S1]" comes out
     * as "bracket S one" mid-sentence and makes a cited answer hard to follow.
     * The markers stay in the written answer, where they are clickable.
     */
    /**
     * A secret must never be READ ALOUD — spoken output is audible to everyone
     * in the room and to any recording in progress, and unlike text it cannot
     * be un-seen. Redaction runs locally, before the utterance and before the
     * caption derived from it.
     */
    const spoken = redactForSpeech(stripCitationMarkers(raw));
    const text = spoken.text;
    if (spoken.containedProtected) {
      toast.warning("OCADE didn't read protected details aloud.", {
        description: `Removed before speaking: ${spoken.categories.join(", ")}.`,
      });
    }
    const caps = detectVoiceCapabilities(window as unknown as { speechSynthesis?: unknown });
    if (!caps.synthesis) {
      toast.error(caps.reason ?? "Read-aloud isn't available here.");
      return;
    }
    // Emergency mute wins over everything.
    if (voicePrefs.muted) {
      toast.error("OCADE Voice is muted. Unmute it in Settings → Voice.");
      return;
    }
    window.speechSynthesis.cancel(); // interruption / barge-in
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = verifiedLanguage(voicePrefs.language);
    const chosen = pickVoice(toVoiceOptions(window.speechSynthesis.getVoices()), {
      gender: voicePrefs.gender !== "unknown" ? voicePrefs.gender : (voiceGender ?? undefined),
      lang,
    });
    if (chosen) {
      const match = window.speechSynthesis
        .getVoices()
        .find((v) => (v.voiceURI ?? v.name) === chosen.id);
      if (match) utterance.voice = match;
    }
    utterance.lang = lang;
    utterance.rate = voicePrefs.rate;
    utterance.pitch = voicePrefs.pitch;
    utterance.onstart = () => {
      setSpeaking(true);
      // Output captions: show what is being READ ALOUD, not only what was
      // heard. Without this, a deaf or hard-of-hearing user — or anyone with
      // the sound off — gets nothing from read-aloud at all.
      if (voicePrefs.captionsEnabled) setSpokenCaption(text);
    };
    utterance.onend = () => {
      setSpeaking(false);
      setSpokenCaption("");
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setSpokenCaption("");
    };
    // Track progress through the utterance so the caption follows the voice
    // rather than dumping the whole answer at once.
    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (!voicePrefs.captionsEnabled) return;
      setSpokenCaption(captionSentenceAt(text, e.charIndex ?? 0));
    };
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setSpokenCaption("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Minimal top strip — no big rectangle */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{conversation.title}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <PrivacyBadge mode={chatsMode === "private_sync" ? "private_sync" : "device_only"} />
            <span>·</span>
            <span>{capabilityLabelFor({ locality: modelInfo.locality })}</span>
            {!online ? (
              <span
                className="rounded bg-[color:var(--warning)]/15 px-1.5 py-0.5 text-[10px] text-[color:var(--warning)]"
                title="You're offline. Cloud features are paused; local features stay available."
              >
                Offline
              </span>
            ) : null}
            {localEngine.status === "ready" ? (
              <span
                className="rounded bg-[color:var(--success)]/15 px-1.5 py-0.5 text-[10px] text-[color:var(--success)]"
                title={`On-device engine detected — ${localEngine.models.length} local model${localEngine.models.length === 1 ? "" : "s"} available.`}
              >
                OCADE Local ready
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Conversation column */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto ocade-scroll">
        <div className="mx-auto w-full max-w-2xl px-5 py-6">
          {loading ? (
            <div className="flex justify-center py-10 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : messages.length === 0 && !streaming ? (
            <div className="space-y-2 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                New conversation. Ask a question or paste content to begin.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m, index) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  onCopy={() => navigator.clipboard.writeText(m.content)}
                  onSpeak={() => readAloud(m.content)}
                  onSave={
                    m.role === "assistant" && !m.id.startsWith("local-")
                      ? () => void saveAssistantOutput(m, index)
                      : undefined
                  }
                  onEdit={m.role === "user" ? () => void prepareEdit(m) : undefined}
                  onBranch={
                    m.role === "assistant" && !m.id.startsWith("local-")
                      ? () => void branchFrom(m)
                      : undefined
                  }
                />
              ))}
              {streaming && streamText ? (
                <MessageRow
                  message={{
                    id: "streaming",
                    role: "assistant",
                    content: streamText,
                    attachments: [],
                    model_id: model,
                    created_at: new Date().toISOString(),
                  }}
                />
              ) : null}
              {/* Visual response is OFFERED, never auto-rendered (decision #41). */}
              {!streaming && lastAssistantText ? (
                visualAnswer ? (
                  <ErrorBoundary label="Visual response">
                    <VisualResponse
                      answer={visualAnswer}
                      onClose={() => setVisualAnswer(null)}
                      onNarrate={(t) => readAloud(t)}
                      projectId={conversation.project_id}
                      conversationId={conversation.id}
                    />
                  </ErrorBoundary>
                ) : (
                  <button
                    onClick={() => setVisualAnswer(lastAssistantText)}
                    className="mt-2 self-start rounded-md border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Create visual response
                  </button>
                )
              ) : null}
              {!streaming && citationError ? (
                <div className="mt-3 rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/5 p-3 text-xs text-muted-foreground">
                  Citation evidence could not be restored or saved: {citationError}
                </div>
              ) : null}
              {!streaming && citations.length > 0 ? (
                <div className="mt-3 rounded-lg border border-border/60 bg-secondary/25 p-3">
                  {/*
                    A real heading, associated with the list via aria-labelledby.
                    A bare <p> left the list unlabelled, so a screen reader
                    announced "list, 2 items" with no indication these are the
                    sources backing the answer.
                  */}
                  <h3
                    id={`sources-${conversation.id}`}
                    className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Sources
                  </h3>
                  <ul
                    aria-labelledby={`sources-${conversation.id}`}
                    className="flex flex-col gap-1.5"
                  >
                    {citations.map((c) => {
                      const where = describeLocator(c.locator);
                      return (
                        <li key={c.sourceId} className="text-[12px]">
                          <span className="mr-1.5 rounded bg-secondary px-1 py-0.5 text-[10px] text-muted-foreground">
                            {c.sourceId}
                          </span>
                          <span className="font-medium text-foreground">{c.name}</span>
                          {where ? <span className="text-muted-foreground"> · {where}</span> : null}
                          {c.snippet ? (
                            <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                              “{c.snippet}”
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {streaming && !streamText ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> OCADE is thinking…
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Composer pinned to bottom */}
      <div className="border-t border-border/60 bg-background/60 px-5 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl">
          {/* Microphone privacy indicator + live captions (Plan §22). */}
          {listening || speaking ? (
            <div className="mb-1.5 flex items-start gap-2 rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-[12px]">
              <span
                className={cn(
                  "mt-1 inline-block h-2 w-2 shrink-0 rounded-full",
                  listening ? "animate-pulse bg-destructive" : "bg-[color:var(--state-success)]",
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="text-muted-foreground">
                  {listening ? "Microphone on — OCADE is listening" : "OCADE is speaking"}
                </span>
                {/*
                  Two caption tracks: what was HEARD while listening, and what
                  is being READ ALOUD while speaking. aria-live so a screen
                  reader announces the spoken text as it progresses.
                */}
                {voicePrefs.captionsEnabled && caption ? (
                  <span className="mt-0.5 block truncate text-foreground">{caption}</span>
                ) : null}
                {voicePrefs.captionsEnabled && spokenCaption ? (
                  <span
                    aria-live="polite"
                    className="mt-0.5 block text-foreground"
                    data-testid="spoken-caption"
                  >
                    {spokenCaption}
                  </span>
                ) : null}
              </span>
              <button
                onClick={() => {
                  stopSpeaking();
                  if (listening) toggleVoice();
                }}
                className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {listening ? "Stop listening" : "Stop speaking"}
              </button>
              <button
                onClick={() => {
                  emergencyMute();
                  stopSpeaking();
                  if (listening) toggleVoice();
                  toast.success("Voice muted.");
                }}
                title="Emergency mute — stop all voice immediately"
                className="shrink-0 text-[11px] text-destructive hover:underline"
              >
                Mute
              </button>
            </div>
          ) : null}
          <div className="mb-1.5 flex items-center gap-1 text-[11px]">
            <span className="text-muted-foreground">Engine</span>
            {(["auto", "local", "cloud"] as const).map((t) => {
              const lbl = t === "auto" ? "Automatic" : t === "local" ? "Local" : "Cloud";
              const disabled = t === "local" && localEngine.status !== "ready";
              return (
                <button
                  key={t}
                  type="button"
                  disabled={disabled}
                  onClick={() => setEngineTier(t)}
                  title={
                    disabled
                      ? "No on-device engine detected"
                      : t === "local"
                        ? "Run on your device — unlimited, private"
                        : t === "cloud"
                          ? "Use OCADE Cloud (counts toward your allowance)"
                          : "Prefer on-device, fall back to cloud with approval"
                  }
                  className={cn(
                    "rounded px-2 py-0.5 transition-colors",
                    engineTier === t
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  OCADE {lbl}
                </button>
              );
            })}

            <span className="mx-1 h-3 w-px bg-border/70" />
            <span className="text-muted-foreground">Voice</span>
            {(["female", "male"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => chooseVoice(g)}
                title={`Use the ${g} OCADE voice for read-aloud`}
                className={cn(
                  "rounded px-2 py-0.5 capitalize transition-colors",
                  voiceGender === g
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {g}
              </button>
            ))}
            <button
              type="button"
              onClick={stopSpeaking}
              title="Stop speaking"
              className="rounded px-2 py-0.5 text-muted-foreground hover:text-foreground"
            >
              Stop
            </button>
          </div>
          <Composer
            draft={draft}
            setDraft={setDraft}
            attachments={attachments}
            setAttachments={setAttachments}
            onSubmit={() => sendMessage()}
            onStop={stop}
            streaming={streaming}
            mode={mode}
            setMode={setMode}
            permission={permission}
            setPermission={setPermission}
            model={model}
            setModel={setModel}
            chatsMode={chatsMode}
            onImprove={handleImprove}
            improving={improving}
            onToggleVoice={toggleVoice}
            listening={listening}
            onRegenerate={messages.some((m) => m.role === "assistant") ? regenerate : undefined}
            projectAssigned={Boolean(conversation.project_id)}
            onSaveAttachmentToProject={
              conversation.project_id ? saveAttachmentToProject : undefined
            }
          />
        </div>
      </div>

      {/* Cloud approval */}
      <Dialog open={!!cloudApprovalNeeded} onOpenChange={(o) => !o && setCloudApprovalNeeded(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve cloud transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Your chats are set to{" "}
              <span className="font-medium">
                {chatsMode === "pc_vault" ? "PC Vault" : "Browser Only"}
              </span>
              . Sending this message uses <span className="font-medium">OCADE Cloud</span>, a cloud
              engine.
            </p>
            <p className="text-muted-foreground">
              The current message, relevant conversation history, extracted context and any attached
              images will be sent for this request. Message storage remains in your selected vault.
              Approve this one-time transfer to continue.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloudApprovalNeeded(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const payload = cloudApprovalNeeded!;
                setCloudApprovalNeeded(null);
                void sendMessage(payload.text, payload.attachments, true);
              }}
            >
              Approve & send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function readChatError(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
  } catch {
    // Plain-text gateway and infrastructure errors remain valid user-facing
    // evidence; JSON parsing is only an optional improvement.
  }
  return body.trim() || `Chat request failed (HTTP ${status}).`;
}

/* ---------- Composer ---------- */

function Composer(props: {
  draft: string;
  setDraft: (v: string) => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  onSubmit: () => void;
  /**
   * Cancel the in-flight response. OPTIONAL on purpose: a surface that has
   * nothing cancellable must omit it rather than pass a no-op, because the Stop
   * button is only rendered when a real handler exists. A required prop forced
   * `onStop={() => {}}` on the home composer, which put a red Stop button on
   * screen that did nothing when clicked.
   */
  onStop?: () => void;
  /** Something is in flight. With `onStop`, shows Stop; without it, disables Send. */
  streaming: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  permission: PermissionMode;
  setPermission: (p: PermissionMode) => void;
  model: string;
  setModel: (m: string) => void;
  chatsMode: "browser_only" | "pc_vault" | "private_sync";
  onImprove?: () => void;
  improving?: boolean;
  onToggleVoice?: () => void;
  listening?: boolean;
  onRegenerate?: () => void;
  floating?: boolean;
  projectAssigned?: boolean;
  onSaveAttachmentToProject?: (attachment: Attachment) => Promise<void>;
}) {
  const {
    draft,
    setDraft,
    attachments,
    setAttachments,
    onSubmit,
    onStop,
    streaming,
    mode,
    setMode,
    permission,
    setPermission,
    model,
    setModel,
    chatsMode,
    onImprove,
    improving,
    onToggleVoice,
    listening,
    onRegenerate,
    floating,
    projectAssigned,
    onSaveAttachmentToProject,
  } = props;
  const modelInfo = getOcadeModel(model);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  // React may not rerender between pointer-down and pointer-up on a short
  // press, so remember whether this gesture started recognition.
  const voiceHoldStartedRef = useRef(false);

  async function handleFiles(files: FileList | null, imagesOnly: boolean) {
    if (!files) return;
    const next: Attachment[] = [...attachments];
    for (const f of Array.from(files)) {
      if (next.length >= MAX_ATTACHMENTS) {
        toast.error(`Maximum ${MAX_ATTACHMENTS} attachments per message`);
        break;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name}: exceeds 20 MB limit`);
        continue;
      }
      if (imagesOnly && !f.type.startsWith("image/")) continue;
      const isImage = f.type.startsWith("image/");
      const dataUrl = isImage ? await fileToDataUrl(f) : undefined;

      // Read readable documents on-device and extract text (Plan §18). The raw
      // file is never uploaded — only the extracted text becomes model context.
      let extractedText: string | undefined;
      let extractNote: string | undefined;
      // Hoisted so the extraction metadata survives past this block — the
      // citation locator is derived from it.
      let result: ExtractResult | undefined;
      if (!isImage) {
        const kind = classifyFile(f.name, f.type);
        // PDF / DOCX / XLSX are decoded on-device by the real decoders; text
        // formats are read directly. Either way the raw file stays local.
        if (isDecodableBinary(kind)) {
          /*
           * A large PDF or workbook can take seconds to decode on-device. The
           * decoder has always honoured an AbortSignal, but nothing passed one,
           * so "Stop" was unreachable and the user had to wait it out.
           */
          const controller = new AbortController();
          const toastId = toast.loading(`${f.name}: reading on your device…`, {
            action: { label: "Stop", onClick: () => controller.abort() },
            duration: Infinity,
          });
          try {
            result = await extractBinaryDocument(
              {
                name: f.name,
                mime: f.type,
                sizeBytes: f.size,
                buffer: await f.arrayBuffer(),
              },
              controller.signal,
            );
          } finally {
            toast.dismiss(toastId);
          }
          // A cancelled read adds nothing at all — not an errored attachment.
          if (result.status === "cancelled") {
            toast.info(`${f.name}: ${result.reason ?? "Reading was cancelled."}`);
            continue;
          }
        } else {
          const content = isNativeTextKind(kind) ? await f.text() : undefined;
          result = extractDocument({
            name: f.name,
            mime: f.type,
            sizeBytes: f.size,
            content,
          });
        }
        if (result.status === "ok" && result.text) {
          extractedText = clampForContext(result.text).text;
          // File contents are untrusted input: warn immediately if the document
          // tries to issue instructions (Plan §31). It is wrapped as data on send.
          const scan = scanUntrustedContent(extractedText);
          if (scan.risk === "high") {
            toast.warning(`${f.name}: ${describeScan(scan)}`);
          } else {
            toast.success(`${f.name}: read on your device and added as context.`);
          }
        } else {
          extractNote = result.reason;
          toast.info(`${f.name}: attached. ${result.reason ?? "No text could be read."}`);
        }
      }

      next.push({
        kind: isImage ? "image" : "file",
        name: f.name,
        mime: f.type || "application/octet-stream",
        sizeBytes: f.size,
        dataUrl,
        extractedText,
        extractNote,
        // Carry the clamped text inside the result so the citation index and
        // the model context are built from exactly the same string.
        extract: result ? { ...result, text: extractedText ?? result.text } : undefined,
      });
    }
    setAttachments(next);
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur",
        floating && "shadow-md",
      )}
    >
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-border/60 px-3 py-2">
          {attachments.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-2 py-1 text-[11px]"
            >
              {a.kind === "image" ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <Paperclip className="h-3 w-3" />
              )}
              <span className="max-w-[160px] truncate">{a.name}</span>
              {a.extractedText && onSaveAttachmentToProject ? (
                <button
                  type="button"
                  onClick={() => void onSaveAttachmentToProject(a)}
                  title="Save extracted text to this project"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Save className="h-3 w-3" />
                  <span className="sr-only">Save {a.name} to project</span>
                </button>
              ) : null}
              <button
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={2}
        placeholder={
          mode === "work"
            ? "Describe the task for OCADE Work…"
            : "Message OCADE…  (Enter to send, Shift+Enter for newline)"
        }
        className="min-h-[52px] resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0"
        disabled={streaming}
      />

      <div className="flex flex-wrap items-center gap-1 border-t border-border/60 px-2 py-1.5">
        {/* Left cluster: attachments / voice */}
        <ComposerIcon
          title="Attach files (max 10, 20 MB each)"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
        </ComposerIcon>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files, false);
            e.currentTarget.value = "";
          }}
        />
        <ComposerIcon title="Attach images" onClick={() => imageRef.current?.click()}>
          <Sparkles className="h-3.5 w-3.5" />
        </ComposerIcon>
        <input
          ref={imageRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files, true);
            e.currentTarget.value = "";
          }}
        />
        {onToggleVoice ? (
          /*
           * Push-to-talk AND click-to-toggle.
           *
           * Hold is the privacy-safer default: the microphone stops the moment
           * you let go, so walking away can never leave it live. A plain toggle
           * on its own has exactly that failure mode.
           *
           * `onPointerDown`/`onPointerUp` covers mouse, touch and pen. Releasing
           * outside the button (pointerleave / pointercancel) still stops it —
           * otherwise dragging off would strand the mic on.
           */
          <ComposerIcon
            title={
              listening
                ? "Release to stop — or click to toggle"
                : "Hold to talk, or click to toggle"
            }
            onPointerDown={() => {
              if (!listening) {
                voiceHoldStartedRef.current = true;
                onToggleVoice();
              }
            }}
            onPointerUp={() => {
              if (voiceHoldStartedRef.current) {
                voiceHoldStartedRef.current = false;
                onToggleVoice();
              }
            }}
            onPointerLeave={() => {
              if (voiceHoldStartedRef.current) {
                voiceHoldStartedRef.current = false;
                onToggleVoice();
              }
            }}
            onPointerCancel={() => {
              if (voiceHoldStartedRef.current) {
                voiceHoldStartedRef.current = false;
                onToggleVoice();
              }
            }}
            // Keyboard users get the toggle: Enter/Space fire click, and there
            // is no reliable key-hold equivalent that does not repeat.
            onClick={(e) => {
              // Pointer already handled it; only act for real keyboard activation.
              if (e.detail === 0) onToggleVoice();
            }}
            active={listening}
          >
            {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </ComposerIcon>
        ) : null}

        <div className="mx-1 h-4 w-px bg-border/60" />

        {/* Chat / Work switch */}
        <ModeSwitch mode={mode} setMode={setMode} />

        {/* Project assignment is managed on the live Projects surface. */}
        <Link
          to="/ocade/projects"
          title="Manage this conversation's project"
          className="ml-1 hidden items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground/70 sm:inline-flex"
        >
          <FolderOpen className="h-3 w-3" />{" "}
          {projectAssigned ? "Project assigned" : "Choose project"}
        </Link>

        {/* Permission mode */}
        <Select value={permission} onValueChange={(v) => setPermission(v as PermissionMode)}>
          <SelectTrigger className="ml-1 hidden h-7 w-[128px] border-border/60 bg-background/40 text-[11px] sm:flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual" className="text-xs">
              Manual
            </SelectItem>
            <SelectItem value="assisted" className="text-xs">
              Assisted
            </SelectItem>
            <SelectItem value="autonomous" className="text-xs">
              Autonomous with approval
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Model */}
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="ml-1 h-7 w-[168px] border-border/60 bg-background/40 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OCADE_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                <div>
                  <div>{m.display}</div>
                  <div className="text-[10px] text-muted-foreground">{m.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Privacy indicator */}
        <span
          className="ml-1 hidden items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground sm:inline-flex"
          title={`Storage mode: ${chatsMode}`}
        >
          <ShieldCheck className="h-3 w-3" />
          {chatsMode === "private_sync"
            ? "Private sync"
            : chatsMode === "pc_vault"
              ? "PC vault"
              : "Browser only"}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {onImprove ? (
            <button
              onClick={onImprove}
              disabled={improving || streaming || !draft.trim()}
              title="Improve prompt"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {improving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Improve
            </button>
          ) : null}
          {onRegenerate ? (
            <ComposerIcon title="Retry in a new branch" onClick={onRegenerate}>
              <RefreshCcw className="h-3.5 w-3.5" />
            </ComposerIcon>
          ) : null}
          {/* Stop is offered ONLY when there is a real handler to cancel with. */}
          {streaming && onStop ? (
            <button
              onClick={onStop}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-destructive/90 px-2.5 text-[11px] font-medium text-destructive-foreground hover:bg-destructive"
            >
              <Square className="h-3 w-3" /> Stop
            </button>
          ) : (
            <button
              onClick={onSubmit}
              /* While something is in flight with nothing to cancel, Send is
                 disabled — honest "working" feedback, not a fake Stop. */
              disabled={streaming || (!draft.trim() && attachments.length === 0)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-3 w-3" /> Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeSwitch({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border/60 text-[11px]">
      <button
        onClick={() => setMode("chat")}
        className={cn(
          "inline-flex h-7 items-center gap-1 px-2",
          mode === "chat"
            ? "bg-secondary text-foreground"
            : "bg-background/40 text-muted-foreground hover:text-foreground",
        )}
      >
        <MessagesSquare className="h-3 w-3" /> Chat
      </button>
      <button
        onClick={() => setMode("work")}
        className={cn(
          "inline-flex h-7 items-center gap-1 border-l border-border/60 px-2",
          mode === "work"
            ? "bg-secondary text-foreground"
            : "bg-background/40 text-muted-foreground hover:text-foreground",
        )}
      >
        <Bot className="h-3 w-3" /> OCADE Work
      </button>
    </div>
  );
}

function ComposerIcon({
  children,
  title,
  onClick,
  active,
  ...pointer
}: {
  children: React.ReactNode;
  title: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
} & Pick<
  React.ComponentPropsWithoutRef<"button">,
  "onPointerDown" | "onPointerUp" | "onPointerLeave" | "onPointerCancel"
>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...pointer}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
        // Holding to talk must not select surrounding text or fire the OS
        // touch-and-hold menu.
        "select-none touch-none",
        active && "text-destructive",
      )}
    >
      {children}
    </button>
  );
}

/* ---------- Message row (minimal, no big card) ---------- */

function MessageRow({
  message,
  onCopy,
  onSpeak,
  onEdit,
  onBranch,
  onSave,
}: {
  message: Message;
  onCopy?: () => void;
  onSpeak?: () => void;
  onEdit?: () => void;
  /** Fork the conversation from this point into a new thread. */
  onBranch?: () => void;
  /** Save this exact response as a hashed artifact and activity entry. */
  onSave?: () => void;
}) {
  const isAssistant = message.role === "assistant";

  if (isAssistant) {
    return (
      <div className="group">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-ocade)]">
          OCADE
        </div>
        {message.attachments && message.attachments.length > 0 ? (
          <AttachmentsInline atts={message.attachments} />
        ) : null}
        <div className="prose prose-sm prose-invert max-w-none text-[14px] leading-relaxed text-foreground whitespace-pre-wrap break-words [&_p]:my-1.5 [&_pre]:my-2 [&_code]:text-xs">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
          {onCopy ? (
            <RowAction title="Copy" onClick={onCopy}>
              <Copy className="h-3 w-3" />
            </RowAction>
          ) : null}
          {onSpeak ? (
            <RowAction title="Read aloud" onClick={onSpeak}>
              <Volume2 className="h-3 w-3" />
            </RowAction>
          ) : null}
          {onSave ? (
            <RowAction title="Save to Artifacts and Activity" onClick={onSave}>
              <FileOutput className="h-3 w-3" />
            </RowAction>
          ) : null}
          {onBranch ? (
            <RowAction
              title="Branch from here — explore an alternative without losing this thread"
              onClick={onBranch}
            >
              <GitBranch className="h-3 w-3" />
            </RowAction>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end">
      <div className="max-w-[85%] rounded-2xl bg-secondary/70 px-3.5 py-2 text-[14px] text-foreground">
        {message.attachments && message.attachments.length > 0 ? (
          <AttachmentsInline atts={message.attachments} />
        ) : null}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
      <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
        {onCopy ? (
          <RowAction title="Copy" onClick={onCopy}>
            <Copy className="h-3 w-3" />
          </RowAction>
        ) : null}
        {onEdit ? (
          <RowAction title="Edit & resend" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </RowAction>
        ) : null}
      </div>
    </div>
  );
}

function AttachmentsInline({ atts }: { atts: Attachment[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {atts.map((a, i) =>
        a.kind === "image" && a.dataUrl ? (
          <img
            key={i}
            src={a.dataUrl}
            alt={a.name}
            className="max-h-40 rounded-md border border-border/60"
          />
        ) : (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px]"
          >
            <Paperclip className="h-3 w-3" /> {a.name}
          </div>
        ),
      )}
    </div>
  );
}

function RowAction({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

/* ---------- Dialogs ---------- */

function RenameDialog({
  target,
  onClose,
  onSubmit,
}: {
  target: Conversation | null;
  onClose: () => void;
  onSubmit: (title: string) => void;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue(target?.title ?? "");
  }, [target]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename conversation</DialogTitle>
        </DialogHeader>
        {/* No placeholder either — this field had no accessible name at all. */}
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={200}
          aria-label="Conversation name"
          autoFocus
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => value.trim() && onSubmit(value.trim())} disabled={!value.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: Conversation | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [phrase, setPhrase] = useState("");
  useEffect(() => {
    setPhrase("");
  }, [target]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{target?.title}”?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            This permanently removes the conversation and all its messages. This cannot be undone.
          </p>
          <p className="text-xs">
            Type <span className="font-mono font-semibold">delete</span> to confirm.
          </p>
          <Input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="delete"
            aria-label="Type delete to confirm"
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={phrase !== "delete"} onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Helpers ---------- */

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

/** One alternative transcription of a recognised phrase. */
type SpeechAlternativeLike = { transcript: string };

/**
 * A recognition result. `isFinal` distinguishes a settled phrase from an
 * in-progress guess, which is what drives live captions.
 */
type SpeechResultLike = {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechAlternativeLike;
};

type SpeechResultListLike = {
  readonly length: number;
  [index: number]: SpeechResultLike;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  /** BCP-47 language tag requested from the browser recognition engine. */
  lang: string;
  /** Experimental Web Speech flag; required for the continuous wake listener. */
  processLocally?: boolean;
  onresult: (ev: { results: SpeechResultListLike }) => void;
  onend: () => void;
  onerror: (ev: unknown) => void;
  start: () => void;
  stop: () => void;
};
