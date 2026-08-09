import { useNavigate } from "@tanstack/react-router";
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
  Keyboard,
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
  ShieldCheck,
  FileCode2,
  /*
   * Aliased because `Lock` is also a DOM global — the Web Locks API interface —
   * and the unaliased name resolves to that instead of the icon, producing a
   * "cannot be used as a JSX component" error that reads as nonsense.
   */
  Lock as LockIcon,
  Unlock as UnlockIcon,
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
import { matchChatShortcut, CHAT_SHORTCUTS } from "@/lib/chat-shortcuts";
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
import { useDevicePolicy } from "@/lib/use-device-policy";
import { useChatPrefs, readChatPrefs } from "@/lib/use-chat-prefs";
import { MessageList } from "@/components/ocade/chat/MessageList";
import { ChatSidebar } from "@/components/ocade/chat/ChatSidebar";
import { EngineBadge } from "@/components/ocade/chat/EngineBadge";
import { useBrain } from "@/lib/brain/use-brain";
import { resolveEngine } from "@/lib/engine/resolve";
import { NetworkWitness, limits as networkLimits } from "@/lib/provenance/network-witness";
import { buildReceipt, type AnswerReceipt, type SourceUse } from "@/lib/provenance/receipt";
import { sha256OfText } from "@/lib/provenance/digest";
import { splitIntoPassages } from "@/lib/retrieval/passages";
import { AnswerReceiptPanel } from "@/components/ocade/chat/AnswerReceiptPanel";
import { ConversationIntegrity } from "@/components/ocade/chat/ConversationIntegrity";
import { Seal, describeSeal } from "@/lib/edge/sealed-mode";
import { installConversationSeal } from "@/lib/edge/seal-policy";
import { preflight, summarise as summarisePreflight } from "@/lib/edge/preflight";
import { measureRun, total as totalCost, describeTotals, type RunCost } from "@/lib/edge/meter";
import { CLOUD_ALLOWANCE } from "@/lib/payments/pricing";
import { append as appendLedger, type LedgerEntry } from "@/lib/edge/ledger";
import { emptyTree, type Tree } from "@/lib/edge/checkpoints";
import { recordTurn } from "@/lib/edge/session";
import type { BrainMessage } from "@/lib/brain/adapter";
import type { ChatMessageView, ChatConversationView } from "@/components/ocade/chat/chat-types";
import { reason } from "@/lib/reasoning/engine";
import { browserReasonDeps } from "@/lib/reasoning/browser-deps";
import {
  buildLocalFirstPlan,
  planContextWindow,
  SLOW_READ_WARNING_SECONDS,
  DEFAULT_LOCAL_BRIDGE_URL,
  type LocalChatMessage,
} from "@/lib/ocade-local";
import { PerfLedger, routeTask } from "@/lib/local/router-policy";

/**
 * One ledger per tab. Routing prefers the fastest MEASURED model, so
 * measurements must outlive a single send — but not the session, because a
 * machine's speed changes with whatever else is running on it.
 */
const localPerfLedger = new PerfLedger();
import {
  classifyFile,
  isNativeTextKind,
  extractDocument,
  extractBinaryDocument,
  clampForContext,
  DOCUMENT_RETAIN_MAX_CHARS,
  type ExtractResult,
} from "@/lib/ocade-documents";
import { isDecodableBinary } from "@/lib/ocade-decoders";
import { scanUntrustedContent, describeScan } from "@/lib/ocade-injection-guard";
import {
  buildSourceIndex,
  parseCitations,
  stripCitationMarkers,
  describeLocator,
  type IndexedSource,
  type Citation,
} from "@/lib/ocade-citations";
import { buildDocumentContext } from "@/lib/retrieval/document-context";
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
import { buildContextTray, type ContextEntry } from "@/lib/chat/context-tray";
import { ContextTray } from "@/components/ocade/chat/ContextTray";
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

/**
 * Adapt a stored row to what the shared chat components render.
 *
 * Kept as a function rather than changing the row type: the row is what the
 * database and the vault hand back, and reshaping those to suit a component
 * would put presentation concerns into storage.
 */
function toMessageView(message: Message): ChatMessageView {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
    attachments: message.attachments?.map((a) => ({
      kind: a.kind,
      name: a.name,
      mime: a.mime,
      sizeBytes: a.sizeBytes,
      dataUrl: a.dataUrl,
    })),
    engineLabel: message.model_id
      ? capabilityLabelFor({ locality: getOcadeModel(message.model_id).locality })
      : null,
  };
}

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
  const [permission, setPermission] = useState<PermissionMode>("manual");
  const [pendingMessage, setPendingMessage] = useState<PendingChatMessage | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);

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
  }

  /*
   * Keyboard shortcuts.
   *
   * What each one may do is decided by `matchChatShortcut`, which is where the
   * two rules that matter live: never fire on a bare letter while somebody is
   * writing, and never take a combination the browser owns. This listener only
   * carries out the decision.
   *
   * Focus moves by id rather than through a ref chain because the two targets
   * live in different subtrees — the search box is inside the shared sidebar
   * and the message box inside the composer — and threading refs through both
   * for two shortcuts would be more fragile than the query.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = matchChatShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: event.target as { tagName?: string; isContentEditable?: boolean } | null,
      });
      // Escape belongs to whatever is streaming, and to any open dialog. It is
      // deliberately not handled here.
      if (!action || action === "stop") return;

      event.preventDefault();
      switch (action) {
        case "new_chat":
          void handleNew();
          break;
        case "search": {
          setSidebarHidden(false);
          const field = document.getElementById("ocade-chat-search");
          if (field instanceof HTMLInputElement) {
            field.focus();
            field.select();
          }
          break;
        }
        case "focus_composer": {
          const box = document.getElementById("ocade-chat-composer");
          if (box instanceof HTMLTextAreaElement) box.focus();
          break;
        }
        case "toggle_sidebar":
          setSidebarHidden((hidden) => !hidden);
          break;
        case "show_help":
          setShortcutsOpen(true);
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
        {/* Contextual OCADE sidebar. Hidden on request (Ctrl+Shift+S) so a
            narrow screen or a long transcript can have the full width. */}
        {sidebarHidden ? null : (
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
            }}
            onPin={togglePin}
            onArchive={toggleArchive}
            onRename={(c) => setRenameTarget(c)}
            onDelete={(c) => setDeleteTarget(c)}
            onExport={handleExport}
            onShowShortcuts={() => setShortcutsOpen(true)}
          />
        )}

        {/* Main workspace canvas */}
        <div className="flex min-h-0 flex-1 flex-col">
          {active ? (
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
              }}
            />
          ) : (
            <HomeSurface
              userLabel={userLabel}
              model={model}
              setModel={setModel}
              chatsMode={chatsMode}
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
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </AppShell>
  );
}

/**
 * The shortcut sheet.
 *
 * Read from `CHAT_SHORTCUTS` rather than written out again here, so a binding
 * cannot exist without appearing on this list — an undiscoverable keyboard
 * shortcut is, for almost every user, the same as one that was never built.
 */
function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ul className="mt-1 space-y-2">
          {CHAT_SHORTCUTS.map((entry) => (
            <li key={entry.action} className="flex items-center justify-between gap-4 text-[13px]">
              <span className="text-muted-foreground">{entry.description}</span>
              <span className="flex shrink-0 items-center gap-1">
                {entry.keys.map((cap) => (
                  <kbd
                    key={cap}
                    className="rounded border border-border/70 bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                  >
                    {cap}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-muted-foreground">
          On a Mac, use Command wherever Ctrl is shown.
        </p>
      </DialogContent>
    </Dialog>
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
  onShowShortcuts: () => void;
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
    onShowShortcuts,
  } = props;

  /*
   * Delegates to the SHARED chat sidebar, the same one the public demo uses.
   * Its own hand-rolled list had a flat "Pinned / Recent" split, which made
   * anything past a dozen conversations effectively unreachable — the shared
   * one groups by when the chat happened, which is how people actually look.
   *
   * Every action this sidebar used to own is preserved and passed through as a
   * row menu: pin, rename, export, archive, delete.
   */
  const view: ChatConversationView[] = (showArchived ? recent : [...pinned, ...recent]).map(
    (c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updated_at,
      pinned: !!c.pinned,
    }),
  );
  const byId = new Map<string, Conversation>([...pinned, ...recent].map((c) => [c.id, c]));

  return (
    <aside className="hidden w-[17.5rem] shrink-0 flex-col border-r border-border/70 bg-sidebar md:flex">
      <ChatSidebar
        conversations={view}
        activeId={activeId}
        onSelect={onSelect}
        onNewChat={onNew}
        emptyLabel={
          loading
            ? "Loading conversations…"
            : showArchived
              ? "Nothing archived."
              : "No conversations yet."
        }
        renderRowMenu={(row: ChatConversationView) => {
          const c = byId.get(row.id);
          if (!c) return null;
          return (
            <span className="flex items-center rounded-md bg-sidebar/90 backdrop-blur">
              <IconMini title={c.pinned ? "Unpin" : "Pin"} onClick={() => onPin(c)}>
                {c.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </IconMini>
              <IconMini title="Rename" onClick={() => onRename(c)}>
                <Pencil className="h-3 w-3" />
              </IconMini>
              <IconMini title="Export" onClick={() => onExport(c)}>
                <Download className="h-3 w-3" />
              </IconMini>
              <IconMini title={c.archived ? "Unarchive" : "Archive"} onClick={() => onArchive(c)}>
                {c.archived ? (
                  <ArchiveRestore className="h-3 w-3" />
                ) : (
                  <Archive className="h-3 w-3" />
                )}
              </IconMini>
              <IconMini title="Delete" onClick={() => onDelete(c)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </IconMini>
            </span>
          );
        }}
        footer={
          <div className="space-y-0.5">
            <SidebarLink icon={FileCode2} label="Code" to="/ocade/code" />
            <SidebarLink icon={FolderOpen} label="Projects" to="/ocade/projects" />
            <SidebarLink icon={FileOutput} label="Files" to="/ocade/artifacts" />
            <SidebarLink icon={Workflow} label="Automations" to="/ocade/automations" />
            <StaticRow
              icon={Archive}
              label={showArchived ? "Back to active chats" : "Archived chats"}
              onClick={() => setShowArchived(!showArchived)}
            />
            {/* A visible way in. Shortcuts that can only be found by already
                knowing the shortcut are shortcuts almost nobody finds. */}
            <StaticRow icon={Keyboard} label="Keyboard shortcuts" onClick={onShowShortcuts} />
          </div>
        }
      />
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
  to: "/ocade/code" | "/ocade/projects" | "/ocade/artifacts" | "/ocade/automations";
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
  permission: PermissionMode;
  setPermission: (p: PermissionMode) => void;
  onSubmit: (text: string, atts: Attachment[]) => Promise<void>;
}) {
  const { userLabel, model, setModel, chatsMode, permission, setPermission, onSubmit } = props;
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

/* ---------- Chat Surface (open conversation) ---------- */

function ChatSurface(props: {
  conversation: Conversation;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  loading: boolean;
  model: string;
  setModel: (m: string) => void;
  chatsMode: "browser_only" | "pc_vault" | "private_sync";
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
  /**
   * Models already asked to load in this session. Typing fires on EVERY
   * keystroke; without this the runtime would receive a load request per
   * character, which is a denial of service aimed at the user's own machine.
   */
  const warmedRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<unknown>(null);
  const modelInfo = getOcadeModel(model);
  const online = useOnline();
  const localEngine = useLocalEngine();
  /*
   * Measured device facts for engine selection. Routing on the browser's own
   * memory hint alone picked a model that needed three minutes for a one-word
   * answer on this hardware, and excluded an installed vision model that works.
   */
  const devicePolicy = useDevicePolicy();
  const { prefs: chatPrefs } = useChatPrefs();
  /** A local engine that is genuinely serving, not merely installed. */
  const localEngineReady = localEngine.status === "ready" && localEngine.models.length > 0;
  const navigate = useNavigate();
  /** Engine selection and honest refusals across every device mode. */
  const brain = useBrain();
  /*
   * The user's chosen starting engine, from Settings › Chat. Read once as the
   * initial value so switching engine inside a conversation is not overwritten
   * on every render — the preference decides where a chat BEGINS, not where it
   * must stay.
   */
  const [engineTier, setEngineTier] = useState<"auto" | "local" | "cloud">(
    () => readChatPrefs().defaultEngineTier,
  );
  // Sources attached to the in-flight request, so the reply's [S1] markers can
  // be resolved back to real documents (never to an invented id).
  const sourceIndexRef = useRef<IndexedSource[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [citationError, setCitationError] = useState<string | null>(null);
  /**
   * What retrieval did to the attachments on the last request, in one sentence.
   *
   * Shown rather than logged. The whole point of searching a document instead
   * of reading it is that OCADE answers from part of the file, and a user who
   * is not told that will read the answer as covering the whole of it.
   */
  const [retrievalNotice, setRetrievalNotice] = useState<string | null>(null);
  /**
   * Provenance receipts, keyed by the assistant message they describe.
   *
   * Held in component state rather than persisted: a receipt describes one
   * generation on one device, and restoring it from a database on a different
   * machine would present a claim nothing here measured.
   */
  const [receipts, setReceipts] = useState<Record<string, AnswerReceipt>>({});

  /**
   * Sealed mode for this conversation.
   *
   * The demo got this first because it was the easier surface to prove it on.
   * This is the one where it matters: real documents, real privacy modes, and
   * a user who may be pasting something they genuinely cannot afford to have
   * leave the machine.
   *
   * Off by default and per conversation, not global — sealing every chat would
   * break the ones that legitimately need the network, and a guarantee people
   * have to keep switching off is a guarantee they stop trusting.
   */
  const [sealed, setSealed] = useState(false);

  /**
   * Hold the seal for as long as the control says it is held.
   *
   * The send path below installs its own strict seal around `generate()`. That
   * covers the moment an answer is produced and nothing else, which is far less
   * than "Sealed: nothing may leave this device" claims. Overlapping seals
   * intersect, so this conversation-long barrier does not loosen the send-time
   * one — it only closes the gap between sends.
   *
   * See `edge/seal-policy.ts` for why assets and loopback are the two
   * exceptions, and why allowing them is what makes a persistent seal possible
   * at all.
   */
  useEffect(
    () =>
      installConversationSeal(
        sealed,
        (allow) => new Seal(undefined, allow),
        typeof window === "undefined" ? undefined : window.location.origin,
      ),
    [sealed],
  );

  /**
   * The tamper-evident record of this conversation, and its branch history.
   *
   * Refs because they are appended from inside async callbacks; `ledgerVersion`
   * is what tells the integrity panel to re-verify, since a ref change alone
   * does not re-render and a stale "intact" is the worst thing to be
   * confidently wrong about.
   */
  const ledgerRef = useRef<LedgerEntry[]>([]);
  const treeRef = useRef<Tree>(emptyTree());
  const [ledgerVersion, setLedgerVersion] = useState(0);

  /**
   * What this conversation has actually cost.
   *
   * More meaningful here than in the demo, because this surface has a REAL
   * allowance to compare against. "You have used 0 of your 28 cloud requests,
   * and about 0.02p of electricity" is a fact the user can check against their
   * own bill and their own usage page — which is the honest form of the claim
   * the whole product rests on.
   */
  const [costs, setCosts] = useState<RunCost[]>([]);

  /*
   * The chain describes ONE conversation. Switching to another must not leave
   * the panel verifying the previous one and reporting it intact — the same
   * defect the demo had across three separate reset paths.
   */
  useEffect(() => {
    ledgerRef.current = [];
    treeRef.current = emptyTree();
    setLedgerVersion((v) => v + 1);
    setReceipts({});
    // The tally describes THIS conversation's runs. Carrying it across would
    // attribute one conversation's electricity to another.
    setCosts([]);
  }, [conversation.id]);
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
  /**
   * Sources the user has excluded from the NEXT question.
   *
   * Per-question rather than persistent: removing a project file here means
   * "not for this one", not "detach it from the project". Silently unfiling a
   * document because someone skipped it once would be a destructive action
   * behind a dismissal control.
   */
  const [excludedContext, setExcludedContext] = useState<Set<string>>(() => new Set());

  /** What the tray shows: everything that will be read, minus what was removed. */
  const contextEntries = useMemo(
    () =>
      buildContextTray({
        attachments: attachments.map((a) => ({
          name: a.name,
          extractedText: a.extractedText,
          unreadableReason: a.extract?.status !== "ok" ? a.extract?.reason : undefined,
        })),
        projectFiles: projectFiles.map((f) => ({
          id: f.id,
          name: f.folder ? `${f.folder}/${f.name}` : f.name,
          text: f.text,
        })),
      }).filter((entry) => !excludedContext.has(entry.id)),
    [attachments, projectFiles, excludedContext],
  );

  const removeContextEntry = useCallback((entry: ContextEntry) => {
    // An attachment is detached outright — it belongs to this unsent message
    // and nothing else refers to it. A project file is only excluded, because
    // it belongs to the project and must survive the question.
    if (entry.origin === "attachment") {
      const index = Number(entry.id.split(":")[1]);
      setAttachments((current) => current.filter((_, i) => i !== index));
      return;
    }
    setExcludedContext((current) => new Set(current).add(entry.id));
  }, []);
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

  /*
   * The retrieval sentence describes the last request in THIS conversation.
   * Carrying it across a conversation switch would attribute one chat's
   * document search to another chat's answer.
   */
  useEffect(() => {
    setRetrievalNotice(null);
  }, [conversation.id]);

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
    // Settings › Chat › Keep unsent drafts. Someone who turned this off on a
    // shared computer must not be handed back what they typed last time.
    if (!chatPrefs.keepDrafts) return;
    const recovered = recoverDraft(conversation.id);
    if (recovered?.text) {
      setDraft((current) => (current.trim() ? current : recovered.text));
      toast.info("Restored the message you were writing.");
    }
    // Only on conversation change — never clobber what the user is typing now.
  }, [conversation.id, chatPrefs.keepDrafts]);

  useEffect(() => {
    if (streaming) return;
    if (!chatPrefs.keepDrafts) {
      // Turning the preference off must also remove what was already stored,
      // not merely stop adding to it.
      clearDraft(conversation.id);
      return;
    }
    const id = setTimeout(() => saveDraft(conversation.id, draft), 400);
    return () => clearTimeout(id);
  }, [draft, conversation.id, streaming, chatPrefs.keepDrafts]);
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

  /**
   * Warm the on-device engine while the user is still typing.
   *
   * Cold start is pure disk time and it dominates the first message: 26,932 ms
   * against 2,192 ms warm for the same question on the reference machine
   * (release/OCADE_TIER_BENCHMARK.json). Nothing is sent — the runtime is asked
   * to load weights only — and failure is deliberately silent, because this is
   * an optimisation for a message that has not been sent yet.
   *
   * Skipped entirely when the user has chosen the cloud engine: loading
   * gigabytes for a request that will never touch them is exactly the kind of
   * background weight this product is meant not to impose.
   */
  function warmLocalEngine() {
    if (engineTier === "cloud") return;
    if (localEngine.status !== "ready" || localEngine.models.length === 0) return;
    const route = routeTask("general", localEngine.models, localPerfLedger, devicePolicy.policy);
    if (!route.ok) return;
    const id = route.model.id;
    if (warmedRef.current.has(id)) return;
    warmedRef.current.add(id);
    /*
     * Warm at the window this message will actually need.
     *
     * The draft and whatever is already attached are handed over, because the
     * runtime reloads the weights when the context window changes: warming at
     * the default and then sending a long attachment pays the whole load again
     * AFTER the send, which is exactly the wait this optimisation exists to
     * remove. Measured on this machine, that reload plus prompt evaluation ran
     * past five minutes, against 40.6 seconds once warm at the same window.
     */
    const pending: BrainMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user" as const,
        content: draft,
        ...(attachments.some((a) => a.kind === "image") ? { images: [""] } : {}),
      },
    ];
    // Through the Brain, so one place owns "which engine, and get it ready" —
    // rather than the chat screen reaching for a specific runtime directly.
    brain.warm(pending);
  }

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

    /*
     * WHAT IS ABOUT TO BE EXPOSED, CHECKED BEFORE IT CAN BE.
     *
     * The rule here is stricter than the demo's, and deliberately so. The demo
     * skips the scan whenever the conversation is sealed, because sealed means
     * nothing can leave. That reasoning does not transfer: a signed-in message
     * is also PERSISTED, and on `private_sync` it is persisted to a server. A
     * credential pasted into a synced conversation ends up in a database even
     * if the answer never left the machine.
     *
     * So the trigger is exposure, not transmission: scan whenever the message
     * will be synced or may reach cloud. A Browser-Only conversation answered
     * on-device genuinely cannot expose it, and warning there would train the
     * user to dismiss the warning in the one case where it is harmless — which
     * is how it stops working in the case where it is not.
     */
    const willBeExposed = chatsMode === "private_sync" || engineTier === "cloud" || !sealed;
    if (willBeExposed) {
      const findings = preflight(text);
      const critical = findings.filter((f) => f.severity === "critical");
      if (critical.length > 0) {
        toast.error(summarisePreflight(findings), {
          description: `${critical[0].explain} Remove it, or seal this conversation, before sending.`,
          duration: 12_000,
        });
        return;
      }
    }

    // Local-first routing (P4c). On-device inference is unlimited and keeps the
    // prompt on the machine — no cloud approval needed. "Automatic" prefers
    // local when a suitable engine is ready, else falls through to cloud.
    const localReady = localEngine.status === "ready" && localEngine.models.length > 0;
    const hasImage = atts.some((a) => a.kind === "image");
    /*
     * Hardware-aware, not just capability-aware. Selecting purely on capability
     * picked the LARGEST installed model, which on a 16 GB machine holding an
     * 18.6 GB model returned something that cannot load — the user saw a
     * generic failure with no reason. Runtime evidence caught this; see
     * release/OCADE_LOCAL_ENGINE_RUNTIME_EVIDENCE.json (E10–E12).
     */
    const localRoute = localReady
      ? routeTask(
          hasImage ? "vision" : "general",
          localEngine.models,
          localPerfLedger,
          devicePolicy.policy,
        )
      : null;
    const localPick = localRoute?.ok ? localRoute.model : null;

    /*
     * Is there an image-capable engine on this device, independent of whether
     * THIS message needs one? `resolveEngine` wants the capability, not the
     * outcome for one request, so it can tell "no engine at all" apart from
     * "an engine that cannot read pictures" and refuse with the right words.
     */
    const localVisionRoute = localReady
      ? routeTask("vision", localEngine.models, localPerfLedger, devicePolicy.policy)
      : null;

    /*
     * ONE AUTHORITY DECIDES WHETHER THIS REQUEST MAY LEAVE THE DEVICE.
     *
     * This block used to make that decision itself, in three separate `if`s,
     * including its own copy of the privacy rule:
     *
     *     if (chatsMode !== "private_sync" && !allowCloud) { askApproval(); }
     *
     * That is the same rule `resolveEngine` already owns, written a second
     * time. Both were correct, and the failure mode was drift: relax one of
     * them — a new privacy mode, an added exemption, a flipped default — and a
     * Browser-Only conversation starts reaching a server while the authority
     * still says it must not. Nothing would fail; the product would just
     * quietly stop keeping its central promise.
     *
     * The order below is the policy, and it now exists in exactly one place:
     * privacy → local → cloud → a named refusal.
     */
    const decision = resolveEngine({
      preference:
        engineTier === "local" ? "local_only" : engineTier === "cloud" ? "cloud_only" : "auto",
      privacyMode: chatsMode,
      deviceMode: brain.mode,
      localAvailable: Boolean(localReady && localPick),
      localLabel: localPick ? "OCADE Local" : null,
      localVision: Boolean(localVisionRoute?.ok),
      visionRequired: hasImage,
      /*
       * The SERVER is the authority on these three, and it refuses with a real
       * message and a reset time when they fail — see the allowance handling
       * further down. The client genuinely does not know them at send time, so
       * it passes the permissive value rather than inventing a number and
       * refusing on a guess. Privacy, which the client DOES know, is decided
       * here and is never delegated.
       */
      cloudConfigured: true,
      cloudEntitled: true,
      cloudRemaining: 1,
      cloudResetsAt: null,
      cloudApprovedForConversation: allowCloud,
      online,
    });

    if (!decision.ok) {
      if (decision.needsCloudApproval) {
        setCloudApprovalNeeded({ text, attachments: atts });
        return;
      }
      /*
       * When the obstacle is the local engine, ask the Brain router for the
       * detail. It knows this device's mode and each adapter's own reason, so
       * the message names the real obstacle and the actions that clear it —
       * "Install OCADE", "Pair a computer", "Start the engine" — rather than a
       * blanket sentence telling the user to switch to cloud when cloud is
       * exactly what they turned off.
       */
      if (
        decision.code === "local_only_and_no_local_engine" ||
        decision.code === "vision_unavailable_locally"
      ) {
        const outcome = await brain.route({ visionRequired: hasImage });
        if (!outcome.ok) {
          const actions = outcome.remedies.map(brain.remedyLabel).join(" · ");
          toast.error(outcome.reason, actions ? { description: actions } : undefined);
          return;
        }
      }
      const actions = decision.remedies.map(brain.remedyLabel).join(" · ");
      toast.error(
        decision.reason ?? "OCADE cannot answer this here.",
        actions ? { description: actions } : undefined,
      );
      return;
    }

    if (decision.target?.kind === "local") {
      await sendViaLocal(text, atts, hasImage);
      return;
    }
    const requestContext = buildRequestContext(atts, chatsMode !== "private_sync", text);
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
  /**
   * Turn the retrieval index into per-document usage for a receipt.
   *
   * Reports the sections ACTUALLY put in front of the engine against the
   * sections the document was split into — the difference between "OCADE read
   * your file" and "OCADE searched your file and used four sections of it".
   * Both are legitimate; only one of them is what happened, and a user reads
   * the answer differently depending on which.
   *
   * An unreadable source is listed with zero sections rather than omitted: it
   * is visibly attached, so its absence here would read as inclusion.
   */
  async function sourceUsesFor(sources: IndexedSource[]): Promise<SourceUse[]> {
    return Promise.all(
      sources.map(async (source) => {
        const text = source.text ?? "";
        const passagesTotal = source.readable ? splitIntoPassages(text).length : 0;
        return {
          name: source.name,
          sha256: await sha256OfText(text),
          // The index holds exactly what was sent, so everything in it was used.
          passagesUsed: passagesTotal,
          passagesTotal,
        };
      }),
    );
  }

  async function sendViaLocal(text: string, atts: Attachment[], hasImage: boolean) {
    const plan = buildLocalFirstPlan({
      desired: hasImage ? "vision" : "general",
      models: localEngine.models,
      cloudAllowed: online,
      online,
      /*
       * The machine's real total RAM when it could be measured, and undefined
       * otherwise — undefined disables the fit check rather than filtering on
       * a guess. It used to be the browser's `deviceMemory`, which is capped
       * at 8 GiB: on this 16 GB machine that excluded the installed 5.97 GB
       * vision model from its own fallback chain.
       */
      totalRamBytes: devicePolicy.policy.totalRamBytes,
      // The chain must refuse the same models the primary route refused, or
      // falling back hands back exactly what was just rejected.
      hasDiscreteGpu: devicePolicy.policy.hasDiscreteGpu,
    });
    const localSteps = plan.filter((s) => s.modelId);
    if (localSteps.length === 0) {
      toast.error("No on-device engine can serve this request.");
      return;
    }
    const requestContext = buildRequestContext(atts, true, text);
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

        /*
         * Say so when the request is bigger than any window OCADE will
         * allocate. `streamLocalChat` sizes the context to the request, so an
         * ordinary long chat is now served in full rather than silently cut —
         * but past the ceiling something MUST be dropped, and the one thing
         * that must never happen is an answer drawn from a truncated document
         * with nothing on screen to say so.
         */
        const contextPlan = planContextWindow(
          localMessages,
          devicePolicy.policy.totalRamBytes,
          devicePolicy.policy.hasDiscreteGpu,
        );
        /*
         * Warn about a long WAIT, not just a long document.
         *
         * Reading is where the time goes on a machine without acceleration:
         * measured from the engine's own counters here, a 5,654-token prompt
         * took 458 seconds to read and 3.8 seconds to answer. Eight minutes of
         * spinner is indistinguishable from a hang, and someone told what it
         * will cost can trim the attachment instead of concluding the product
         * is broken.
         */
        if (
          contextPlan.estimatedReadSeconds !== null &&
          contextPlan.estimatedReadSeconds > SLOW_READ_WARNING_SECONDS
        ) {
          const minutes = Math.round(contextPlan.estimatedReadSeconds / 60);
          toast.info(
            minutes >= 2
              ? `This will take around ${minutes} minutes to read on this computer.`
              : "This will take about a minute to read on this computer.",
            {
              description:
                "This computer has no graphics acceleration, so reading a long document is the slow part — the answer itself arrives in seconds. Shortening the attachment is the quickest way to speed it up.",
            },
          );
        }
        if (contextPlan.exceedsCeiling) {
          /*
           * Names the attachments, rather than saying "an attachment".
           *
           * `planContextWindow` already owns context sizing for this surface,
           * so this deliberately does NOT introduce a second budget system —
           * two implementations of "what fits" would drift, and the one that
           * drifted would be silently wrong about what the engine actually
           * saw. What it adds is the part that was missing: a user who
           * attached a contract and is told only that "the oldest part" was
           * dropped has no idea whether their contract was in it.
           */
          const named = atts.map((a) => a.name).filter(Boolean);
          toast.warning("This conversation is longer than OCADE can hold on this device at once.", {
            description:
              named.length > 0
                ? `The oldest part will not be visible to the engine, and that may include ${named.join(", ")}. Start a new chat, or remove an attachment, to keep the whole thing in view.`
                : "The oldest part will not be visible to the engine. Start a new chat to keep the whole thing in view.",
            duration: 9000,
          });
        }

        let acc = "";
        setStreamText("");
        /*
         * Measure the stream so routing has something real to work from. The
         * router prefers the fastest MEASURED model, and it can only do that if
         * ordinary chat feeds it — a ledger nothing writes to is a ledger that
         * routes on nothing.
         */
        const routeStarted = Date.now();
        let firstTokenMs: number | null = null;
        /*
         * Open the provenance window around THIS generation.
         *
         * It reads the browser's own resource-timing log, so it records every
         * request the page made while answering — whatever issued it. On the
         * on-device branch that should be nothing, and this is what turns that
         * from an assurance into a measurement the user can see.
         */
        const witness = new NetworkWitness();
        witness.start();
        /*
         * The seal goes up around the generation itself, not around the whole
         * send. Narrower is correct: the persistence calls after an answer are
         * the user's own storage, and sealing those would break saving the
         * conversation they just asked to keep.
         */
        const seal = sealed ? new Seal() : null;
        seal?.seal();
        /*
         * Chat goes through the shared reasoning service (W1) rather than
         * calling the engine directly, so local-first, the deterministic-work
         * refusal and receipts are decided in one place for every surface
         * instead of per screen.
         *
         * `modelId` is passed because chat has ALREADY chosen: this call sits
         * inside an existing fallback chain that picked `step.modelId`. Letting
         * the service re-route here would silently override that decision.
         *
         * `allowCloud` stays false. This is the on-device branch; the cloud
         * branch is a separate step in the same chain, so a prompt can never
         * leave the machine as a side effect of the local path failing.
         */
        const reasoned = await reason(
          browserReasonDeps(DEFAULT_LOCAL_BRIDGE_URL, undefined, devicePolicy.policy.totalRamBytes),
          {
            messages: localMessages,
            task: hasImage ? "vision" : "general",
            modelId: step.modelId!,
            allowCloud: false,
            signal: controller.signal,
            onToken: (c) => {
              if (firstTokenMs === null) firstTokenMs = Date.now() - routeStarted;
              acc += c;
              setStreamText(acc);
            },
          },
        );
        /*
         * Unsealed FIRST, before anything else runs. A thrown persistence call
         * with the seal still up would leave the page offline for the rest of
         * the session, which is a worse bug than whatever caused it and would
         * look like the seal itself was broken.
         */
        const sealReport = seal?.unseal() ?? null;
        const observation = witness.stop();
        if (sealReport && sealReport.attempts.length > 0) {
          // Named, not swallowed. Something tried to leave while the user had
          // asked for silence, and they are entitled to know what.
          toast.warning(describeSeal(sealReport));
        }
        const result: { ok: boolean; reason?: string } = reasoned.ok
          ? { ok: true }
          : { ok: false, reason: reasoned.failure === "cancelled" ? "cancelled" : reasoned.reason };
        // A cancellation is the user's choice, not the model failing, so it is
        // not recorded as a failure against the model.
        if (result.reason !== "cancelled") {
          localPerfLedger.record({
            modelId: step.modelId!,
            task: hasImage ? "vision" : "general",
            firstTokenMs: firstTokenMs ?? Date.now() - routeStarted,
            totalMs: Date.now() - routeStarted,
            ok: result.ok,
          });
        }

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

          /*
           * The receipt for this answer.
           *
           * Richer than the demo's, because this chat HAS documents: each
           * source is listed with its fingerprint and how much of it was
           * actually used, so "did it read my file?" is answered with a count
           * rather than an impression. `leftDevice` still comes only from the
           * measurement — never from the fact that this is the local branch.
           */
          if (assistant?.id) {
            const receipt = await buildReceipt({
              messageId: assistant.id,
              producedOn: "this_device",
              engineLabel: label,
              prompt: text,
              answer: acc,
              sources: await sourceUsesFor(sourceIndexRef.current),
              observation,
              blindSpots: networkLimits(),
              startedAt: new Date(routeStarted),
              durationMs: Date.now() - routeStarted,
            });
            setReceipts((current) => ({ ...current, [assistant.id]: receipt }));

            /*
             * Cost derived from the RECEIPT, not from the branch this code sits
             * in. This is the on-device path, so it is tempting to record
             * "local" unconditionally — but then a cost line saying "free, no
             * allowance used" could sit directly beneath a receipt reporting
             * that data left. Reading the measurement keeps them consistent by
             * construction rather than by discipline.
             */
            setCosts((current) => [
              ...current,
              measureRun({
                where: receipt.leftDevice ? "cloud" : "local",
                durationMs: Date.now() - routeStarted,
              }),
            ]);
          }

          /*
           * The question AND the answer, into both records.
           *
           * The question goes in first because a branch point is identified by
           * what was asked before it — a tree of unlabelled answers cannot be
           * navigated, and a chain missing the questions would verify only
           * half the conversation.
           */
          const askedAt = new Date(routeStarted);
          ledgerRef.current = [
            ...ledgerRef.current,
            await appendLedger(ledgerRef.current, { role: "user", content: text, at: askedAt }),
          ];
          ledgerRef.current = [
            ...ledgerRef.current,
            await appendLedger(ledgerRef.current, {
              role: "assistant",
              content: acc,
              at: new Date(),
            }),
          ];
          treeRef.current = recordTurn(treeRef.current, {
            id: optimistic.id,
            role: "user",
            content: text,
            at: askedAt,
          }).tree;
          treeRef.current = recordTurn(treeRef.current, {
            id: assistant?.id ?? `a-${Date.now()}`,
            role: "assistant",
            content: acc,
            at: new Date(),
          }).tree;
          setLedgerVersion((v) => v + 1);

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
   *
   * `question` is what makes this a SEARCH rather than a dump: long attachments
   * are cut into sections, ranked against the question, and only the sections
   * that matched are sent. The user is told which of those two things happened
   * — see `setRetrievalNotice` below — because "OCADE read your file" and
   * "OCADE searched your file and read four sections of it" are different
   * claims and only one of them is true at a time.
   */
  function buildDocContext(atts: Attachment[], question: string): string | undefined {
    /*
     * Sources the user removed in the context tray are dropped HERE, at the
     * one place that decides what is actually sent. Filtering them only out of
     * the tray's own list would leave a control that changes a label and not
     * the request — which is worse than having no control, because it invites
     * the user to believe a document was withheld when it was not.
     */
    const projectAttachments: Attachment[] = projectFiles
      .filter((file) => !excludedContext.has(`project:${file.id}`))
      .map((file) => ({
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
    /*
     * Everything attached is indexed, not only what was readable. An image, a
     * password-protected PDF and a cancelled read each have to reach the
     * context builder so it can say WHY they contributed nothing; filtering
     * them out here is how they used to disappear without a word.
     */
    const withText = [...projectAttachments, ...atts];
    if (withText.length === 0) {
      sourceIndexRef.current = [];
      setRetrievalNotice(null);
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

    /*
     * Retrieval, citation instructions and untrusted-content wrapping all live
     * in `buildDocumentContext`. They used to be assembled inline here, which
     * meant the one claim the user reads — how much of their file was actually
     * consulted — was produced by code no test could reach.
     */
    const built = buildDocumentContext(question, sources);
    setRetrievalNotice(built.notice);
    return built.context;
  }

  function buildRequestContext(
    atts: Attachment[],
    includeLocalMemory: boolean,
    question: string,
  ): { ok: true; data: string | undefined } | { ok: false; reason: string } {
    const documents = buildDocContext(atts, question);
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

  /*
   * Escape stops the reply.
   *
   * Bound here rather than with the other shortcuts because this is the only
   * component that holds the abort controller, and it is bound ONLY while
   * something is actually streaming — an Escape that silently does nothing is
   * worse than no binding, since it trains people not to reach for it. It also
   * has to work while the cursor is in the message box, which is where it
   * already is when a reply starts going wrong.
   */
  useEffect(() => {
    if (!streaming) return;
    const onKey = (event: KeyboardEvent) => {
      if (matchChatShortcut({ key: event.key }) !== "stop") return;
      event.preventDefault();
      stop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [streaming]);

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
      {/*
        Top bar: what this chat is, and where its answers come from.
        Technical detail is deliberately absent — the raw model name lives in
        Settings › Models and About, and the badge here states the CAPABILITY
        and the locality, which is what a person needs to know before typing
        something private.
      */}
      <div className="flex h-14 shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {conversation.title}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/*
            Sealed mode, beside the privacy badge on purpose. The badge states
            where this conversation is STORED; this states whether anything may
            leave while it is being answered. Related, different, and easy to
            confuse if they are not next to each other.
          */}
          <button
            type="button"
            onClick={() => {
              setSealed((v) => !v);
              toast.info(
                sealed
                  ? "Conversation unsealed. OCADE can reach the network again."
                  : "Conversation sealed. Nothing can leave this device until you unseal it.",
                {
                  description: sealed
                    ? undefined
                    : "The on-device engine still works. Downloading one does not — unseal first if OCADE has not been set up here.",
                },
              );
            }}
            aria-pressed={sealed}
            title={sealed ? "Sealed: nothing may leave this device" : "Seal this conversation"}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] transition",
              sealed
                ? "border-[color:var(--state-success)]/50 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]"
                : "border-border/60 text-muted-foreground hover:bg-accent",
            )}
          >
            {sealed ? (
              <LockIcon className="h-3 w-3" aria-hidden />
            ) : (
              <UnlockIcon className="h-3 w-3" aria-hidden />
            )}
            {sealed ? "Sealed" : "Seal"}
          </button>
          <PrivacyBadge mode={chatsMode === "private_sync" ? "private_sync" : "device_only"} />
          <EngineBadge
            status={{
              locality: localEngineReady ? "local" : modelInfo.locality,
              label: localEngineReady
                ? "OCADE Local"
                : capabilityLabelFor({ locality: modelInfo.locality }),
              online,
              detail: localEngineReady
                ? "Answers are generated on this computer. Nothing is sent anywhere."
                : devicePolicy.because,
              preparing: localEngine.status === "checking",
            }}
            onClick={() =>
              void navigate({ to: "/settings/$section", params: { section: "local-engine" } })
            }
          />
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
            <div className={chatPrefs.density === "compact" ? "space-y-2.5" : "space-y-5"}>
              {/*
                The transcript renders through the SHARED chat components, the
                same ones the public demo uses. Two implementations of a message
                row is how a product ends up advertising an interface it does
                not ship — and it is also how the scroll-follow bug survived,
                because only one of the two ever got fixed.
              */}
              <MessageList
                messages={[
                  ...messages.map(toMessageView),
                  ...(streaming && streamText
                    ? [
                        {
                          id: "streaming",
                          role: "assistant" as const,
                          content: streamText,
                          createdAt: new Date().toISOString(),
                          engineLabel: capabilityLabelFor({ locality: modelInfo.locality }),
                          streaming: true,
                        },
                      ]
                    : []),
                ]}
                showTimestamps={chatPrefs.showTimestamps}
                renderMarkdown={chatPrefs.renderMarkdown}
                density={chatPrefs.density}
                /*
                 * The provenance receipt, under the answer it describes. Only
                 * present for answers this session actually generated — a
                 * message loaded from history was measured on some other run,
                 * possibly on another machine, and inventing a receipt for it
                 * would be exactly the unfounded claim the receipt exists to
                 * replace.
                 */
                renderFooter={(message) =>
                  chatPrefs.showDiagnostics && receipts[message.id] ? (
                    <AnswerReceiptPanel receipt={receipts[message.id]} className="pl-1" />
                  ) : null
                }
                actions={{
                  onSpeak: (m) => readAloud(m.content),
                  onEdit: (m) => {
                    const original = messages.find((x) => x.id === m.id);
                    if (original?.role === "user") void prepareEdit(original);
                  },
                  onSave: (m) => {
                    const index = messages.findIndex((x) => x.id === m.id);
                    const original = messages[index];
                    if (original?.role === "assistant" && !original.id.startsWith("local-")) {
                      void saveAssistantOutput(original, index);
                    }
                  },
                  onBranch: (m) => {
                    const original = messages.find((x) => x.id === m.id);
                    if (original?.role === "assistant" && !original.id.startsWith("local-")) {
                      void branchFrom(original);
                    }
                  },
                  // Offered only on the newest assistant turn: regenerating an
                  // answer from the middle of a thread would silently discard
                  // everything after it.
                  onRegenerate: (m) =>
                    m.id === messages.at(-1)?.id && m.role === "assistant"
                      ? void regenerate()
                      : undefined,
                }}
              />
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
              {/*
                What retrieval actually did, shown next to the answer it shaped.
                Rendered while streaming as well as after it: a user watching an
                answer form from four sections of a 200-page report needs to
                know that before they read it, not once they have finished.
              */}
              {retrievalNotice ? (
                <div
                  role="status"
                  className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2 text-[12px] text-muted-foreground"
                >
                  <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{retrievalNotice}</span>
                </div>
              ) : null}

              {/*
                Whether this conversation is the one that happened.

                Rendered only once there is something to verify — an integrity
                panel on an empty chat is a claim about nothing, and it would
                train people to skip past it before it ever mattered.
              */}
              {chatPrefs.showDiagnostics && ledgerRef.current.length > 0 ? (
                <ConversationIntegrity
                  key={ledgerVersion}
                  chain={ledgerRef.current}
                  tree={treeRef.current}
                  messages={messages.map((m) => m.content)}
                  className="mt-3"
                />
              ) : null}

              {/*
                What this conversation cost, against the allowance the user
                actually has. Hidden until there is something real to report —
                a running total of zero is noise.
              */}
              {costs.length > 0 ? (
                <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
                  {describeTotals(totalCost(costs), CLOUD_ALLOWANCE)}
                </p>
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
          {/*
            What will be read, ABOVE the composer — the only place the
            disclosure is still actionable. A note under the reply explains
            what already happened; this lets the user change it first.
          */}
          <ContextTray entries={contextEntries} onRemove={removeContextEntry} className="mb-2" />
          {/*
            Removing a source must be reversible. Without this the file simply
            vanishes from the tray with no way back, and the user is left
            wondering why OCADE has stopped knowing about a document that is
            still plainly in the project.
          */}
          {excludedContext.size > 0 ? (
            <button
              type="button"
              onClick={() => setExcludedContext(new Set())}
              className="mb-2 text-[11.5px] text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
            >
              {excludedContext.size} project {excludedContext.size === 1 ? "file is" : "files are"}{" "}
              being left out — use everything again
            </button>
          ) : null}

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
                aria-pressed={voiceGender === g}
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
            onTypingStarted={warmLocalEngine}
            onStop={stop}
            streaming={streaming}
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
  /**
   * Called on the first keystroke. Optional because a surface with no local
   * engine has nothing to warm, and a required no-op prop is how dead
   * handlers get introduced.
   */
  onTypingStarted?: () => void;
}) {
  const {
    draft,
    setDraft,
    attachments,
    setAttachments,
    onSubmit,
    onStop,
    streaming,
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
    onTypingStarted,
  } = props;
  const modelInfo = getOcadeModel(model);
  // Read directly rather than threaded through props: the composer is mounted
  // from two different screens and this is a per-browser display preference,
  // not conversation state either caller owns.
  const { prefs: composerPrefs } = useChatPrefs();
  const sendKey = composerPrefs.sendKey;
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  // React may not rerender between pointer-down and pointer-up on a short
  // press, so remember whether this gesture started recognition.
  const voiceHoldStartedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  /*
   * dragenter/dragleave fire for every child element the pointer crosses, so a
   * boolean alone flickers the overlay off the moment the cursor moves over the
   * textarea inside the drop zone. Counting enters and leaves is the only way
   * to know when the pointer has actually left.
   */
  const dragDepth = useRef(0);

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
          // Retain the whole document so retrieval can search all of it. The
          // send budget is applied later, to the passages retrieval chose.
          extractedText = clampForContext(result.text, DOCUMENT_RETAIN_MAX_CHARS).text;
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
        "relative rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur",
        floating && "shadow-md",
        dragging && "border-primary/70",
      )}
      /*
       * Dropping a file onto the composer.
       *
       * Without this the browser NAVIGATES AWAY to the dropped file — the
       * conversation is gone and the draft with it. That is the real reason
       * every drop target here calls preventDefault, not the overlay.
       */
      onDragEnter={(e) => {
        if (!e.dataTransfer?.types?.includes("Files")) return;
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer?.types?.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer?.files?.length) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (streaming) {
          toast.error("Wait for the current reply to finish before adding files.");
          return;
        }
        // Same path as the Attach button: one place decides the size limit, the
        // attachment count, and what gets read on this device.
        void handleFiles(e.dataTransfer.files, false);
      }}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/70 bg-background/85 text-[13px] font-medium text-foreground">
          <Paperclip className="mr-2 h-4 w-4" aria-hidden />
          Drop to attach — files are read on this device
        </div>
      ) : null}

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
        id="ocade-chat-composer"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          // Typing is the first honest signal that a message is coming. Warm
          // the on-device engine now so the send does not pay a cold start.
          onTypingStarted?.();
        }}
        /*
         * Pasting a screenshot.
         *
         * This is how most people send an image to an assistant — Win+Shift+S,
         * then Ctrl+V — and without it the paste dropped a filename or nothing
         * at all into the box. Text pastes are left entirely alone: the guard
         * is on `files.length`, so ordinary copy-paste keeps the browser's own
         * behaviour including undo.
         */
        onPaste={(e) => {
          const files = e.clipboardData?.files;
          if (!files || files.length === 0) return;
          e.preventDefault();
          if (streaming) {
            toast.error("Wait for the current reply to finish before adding files.");
            return;
          }
          void handleFiles(files, false);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          /*
           * Settings › Chat › Sending messages. Someone who writes long
           * multi-paragraph prompts loses them constantly to an Enter that
           * sends, so the choice is theirs — and the placeholder below states
           * whichever one is in force rather than a fixed sentence that would
           * be wrong half the time.
           */
          if (sendKey === "mod_enter") {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              onSubmit();
            }
            return;
          }
          if (!e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={2}
        placeholder={
          sendKey === "mod_enter"
            ? "Ask OCADE or describe an outcome…  (Ctrl+Enter to send, Enter for newline)"
            : "Ask OCADE or describe an outcome…  (Enter to send, Shift+Enter for newline)"
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
          aria-label="Attach files"
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
          aria-label="Attach images"
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

/**
 * Local time for a stored timestamp. An unparseable value yields nothing
 * rather than "Invalid Date" — a row with no time is better than a row that
 * looks broken.
 */
function formatMessageTime(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageRow({
  message,
  onCopy,
  onSpeak,
  onEdit,
  onBranch,
  onSave,
  showTimestamp = false,
  renderMarkdown = true,
}: {
  message: Message;
  onCopy?: () => void;
  onSpeak?: () => void;
  onEdit?: () => void;
  /** Fork the conversation from this point into a new thread. */
  onBranch?: () => void;
  /** Save this exact response as a hashed artifact and activity entry. */
  onSave?: () => void;
  /** Settings › Chat › Show message times. */
  showTimestamp?: boolean;
  /**
   * Settings › Chat › Format replies. When off the model's literal output is
   * shown, which is what someone debugging a prompt actually needs to see.
   */
  renderMarkdown?: boolean;
}) {
  const isAssistant = message.role === "assistant";
  const timestamp = showTimestamp ? formatMessageTime(message.created_at) : null;

  if (isAssistant) {
    return (
      <div className="group">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-ocade)]">
          OCADE
          {timestamp ? (
            <span className="font-normal normal-case tracking-normal text-muted-foreground">
              {timestamp}
            </span>
          ) : null}
        </div>
        {message.attachments && message.attachments.length > 0 ? (
          <AttachmentsInline atts={message.attachments} />
        ) : null}
        <div className="prose prose-sm prose-invert max-w-none text-[14px] leading-relaxed text-foreground whitespace-pre-wrap break-words [&_p]:my-1.5 [&_pre]:my-2 [&_code]:text-xs">
          {renderMarkdown ? (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          ) : (
            <span className="font-mono text-[13px]">{message.content}</span>
          )}
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
      {timestamp ? <div className="mb-1 text-[10px] text-muted-foreground">{timestamp}</div> : null}
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
