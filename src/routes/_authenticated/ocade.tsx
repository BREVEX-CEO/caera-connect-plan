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
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
  FolderOpen,
  FileOutput,
  CalendarClock,
  Workflow,
  SlidersHorizontal,
  MessagesSquare,
  Bot,
  Terminal,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/shell/AppShell";
import { PrivacyBadge } from "@/components/shell/PrivacyBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import {
  createConversation,
  deleteConversation,
  exportConversation,
  improvePrompt,
  listConversations,
  listMessages,
  updateConversation,
} from "@/lib/ocade.functions";
import { getModeFor } from "@/lib/storage/resolver";
import { OCADE_DEFAULT_MODEL_ID, OCADE_MODELS, getOcadeModel } from "@/lib/ocade-models";
import { ocadeHonestDisclosure } from "@/lib/ocade-identity";

export const Route = createFileRoute("/_authenticated/ocade")({
  head: () => ({
    meta: [
      { title: "OCADE — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
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
};

type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  model_id: string | null;
  privacy_mode: string;
  updated_at: string;
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
  const [chatsMode, setChatsMode] = useState<"browser_only" | "pc_vault" | "private_sync">("private_sync");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [permission, setPermission] = useState<PermissionMode>("manual");

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
    void listMessages({ data: { conversationId: activeId } }).then((rows) => {
      setMessages(rows as unknown as Message[]);
      setLoadingMessages(false);
    });
  }, [activeId]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

  useEffect(() => {
    if (active?.model_id) setModel(active.model_id);
  }, [active?.id, active?.model_id]);

  async function handleNew() {
    setActiveId(null);
    setMode("chat");
  }

  async function ensureActive(): Promise<Conversation> {
    if (active) return active;
    const conv = (await createConversation({ data: { modelId: model } })) as Conversation;
    setConversations((prev) => [conv, ...prev]);
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
    await deleteConversation({ data: { id: deleteTarget.id } });
    if (deleteTarget.id === activeId) setActiveId(null);
    setDeleteTarget(null);
    await refreshList();
    toast.success("Conversation deleted");
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
          onSelect={(id) => { setActiveId(id); setMode("chat"); }}
          onPin={togglePin}
          onArchive={toggleArchive}
          onRename={(c) => setRenameTarget(c)}
          onDelete={(c) => setDeleteTarget(c)}
          onExport={handleExport}
        />

        {/* Main workspace canvas */}
        <div className="flex min-h-0 flex-1 flex-col">
          {mode === "work" ? (
            <WorkModePanel
              permission={permission}
              onExitWork={() => setMode("chat")}
            />
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
              ensureActive={ensureActive}
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
                // Route into ChatSurface by selecting; ChatSurface will send on mount is complex.
                // Instead: create then immediately send via inline transport.
                await sendViaApi({
                  conversationId: conv.id,
                  model,
                  text,
                  attachments: atts,
                  allowCloud: chatsMode !== "browser_only" || getOcadeModel(model).locality !== "cloud",
                });
                await refreshList();
                setActiveId(conv.id);
              }}
            />
          )}
        </div>
      </div>

      <RenameDialog target={renameTarget} onClose={() => setRenameTarget(null)} onSubmit={handleRenameSubmit} />
      <DeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
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
    onNew, search, setSearch, showArchived, setShowArchived, pinned, recent,
    loading, activeId, onSelect, onPin, onArchive, onRename, onDelete, onExport,
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
        <StaticRow icon={FolderOpen} label="Projects" state="planned" />
        <StaticRow icon={FileOutput} label="Outputs" state="planned" />
        <StaticRow icon={CalendarClock} label="Scheduled" state="planned" />
        <StaticRow icon={Workflow} label="Automations" state="planned" />
        <StaticRow icon={SlidersHorizontal} label="Customize" state="active" onClick={() => setShowArchived(!showArchived)} note={showArchived ? "Viewing archived" : undefined} />
      </div>

      <div className="mt-1 px-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
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
                <ConvRow key={c.id} c={c} active={c.id === activeId} onSelect={() => onSelect(c.id)}
                  onPin={() => onPin(c)} onArchive={() => onArchive(c)} onRename={() => onRename(c)}
                  onDelete={() => onDelete(c)} onExport={() => onExport(c)} />
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
              <ConvRow key={c.id} c={c} active={c.id === activeId} onSelect={() => onSelect(c.id)}
                onPin={() => onPin(c)} onArchive={() => onArchive(c)} onRename={() => onRename(c)}
                onDelete={() => onDelete(c)} onExport={() => onExport(c)} />
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

function StaticRow({
  icon: Icon,
  label,
  state,
  onClick,
  note,
}: {
  icon: typeof FolderOpen;
  label: string;
  state: "planned" | "active";
  onClick?: () => void;
  note?: string;
}) {
  const disabled = state === "planned";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `${label} — planned` : label}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors",
        disabled
          ? "cursor-not-allowed text-muted-foreground/60"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      {disabled ? <span className="ml-auto text-[9px] uppercase tracking-wide">Planned</span> : null}
      {note ? <span className="ml-auto text-[10px] text-muted-foreground">{note}</span> : null}
    </button>
  );
}

function ConvRow({
  c, active, onSelect, onPin, onArchive, onRename, onDelete, onExport,
}: {
  c: Conversation; active: boolean;
  onSelect: () => void; onPin: () => void; onArchive: () => void;
  onRename: () => void; onDelete: () => void; onExport: () => void;
}) {
  return (
    <li className={cn(
      "group flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] transition-colors",
      active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
    )}>
      <button onClick={onSelect} className="flex flex-1 items-center gap-1.5 truncate text-left">
        {c.pinned ? <Pin className="h-3 w-3 shrink-0 text-[color:var(--accent-ocade)]" /> : null}
        <span className="truncate">{c.title}</span>
      </button>
      <div className="flex opacity-0 transition group-hover:opacity-100">
        <IconMini title={c.pinned ? "Unpin" : "Pin"} onClick={onPin}>
          {c.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </IconMini>
        <IconMini title="Rename" onClick={onRename}><Pencil className="h-3 w-3" /></IconMini>
        <IconMini title="Export" onClick={onExport}><Download className="h-3 w-3" /></IconMini>
        <IconMini title={c.archived ? "Unarchive" : "Archive"} onClick={onArchive}>
          {c.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
        </IconMini>
        <IconMini title="Delete" onClick={onDelete}><Trash2 className="h-3 w-3 text-destructive" /></IconMini>
      </div>
    </li>
  );
}

function IconMini({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
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
  const { userLabel, model, setModel, chatsMode, mode, setMode, permission, setPermission, onSubmit } = props;
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
            <h1 className="text-[22px] font-semibold text-foreground">
              Welcome, {userLabel}.
            </h1>
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
          onStop={() => { /* not streaming on home */ }}
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
          {ocadeHonestDisclosure({ modelId: modelInfo.display, providerId: modelInfo.provider, locality: modelInfo.locality })}
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

function WorkModePanel({ permission, onExitWork }: { permission: PermissionMode; onExitWork: () => void }) {
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
              <h3 className="text-[14px] font-semibold text-foreground">Native Companion Required</h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                OCADE Work coordinates real desktop tasks — plan, permissions, live steps, pause, stop,
                verification and replay. In the browser alpha, OCADE cannot control your mouse, keyboard,
                terminal or filesystem. Install the CAERA Native Companion on your PC to enable this mode.
              </p>
              <div className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
                <PlanRow label="Task" value="Not started" />
                <PlanRow label="Plan" value="Awaiting request" />
                <PlanRow label="Application" value="—" />
                <PlanRow label="Project folder" value="—" />
                <PlanRow label="Permissions" value={permission} />
                <PlanRow label="Current step" value="—" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled className="cursor-not-allowed rounded-md border border-border/60 px-3 py-1.5 text-[12px] text-muted-foreground">Pause</button>
                <button disabled className="cursor-not-allowed rounded-md border border-border/60 px-3 py-1.5 text-[12px] text-muted-foreground">Stop</button>
                <button disabled className="cursor-not-allowed rounded-md border border-border/60 px-3 py-1.5 text-[12px] text-muted-foreground">Replay</button>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
                  <ShieldCheck className="h-3 w-3" /> Setup Required
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Native mouse, keyboard, screen, clipboard, terminal, PowerShell/shell, filesystem and application
          control are only performed when the CAERA Native Companion is installed and connected. OCADE will
          never pretend an OS action happened.
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
  ensureActive: () => Promise<Conversation>;
}) {
  const {
    conversation, messages, setMessages, loading, model, setModel, chatsMode,
    mode, setMode, permission, setPermission, onRefreshList,
  } = props;
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [improving, setImproving] = useState(false);
  const [listening, setListening] = useState(false);
  const [cloudApprovalNeeded, setCloudApprovalNeeded] = useState<null | { text: string; attachments: Attachment[] }>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<unknown>(null);
  const modelInfo = getOcadeModel(model);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText]);

  async function sendMessage(overrideText?: string, overrideAtts?: Attachment[], allowCloud = false) {
    const text = (overrideText ?? draft).trim();
    const atts = overrideAtts ?? attachments;
    if (!text && atts.length === 0) return;
    if (streaming) return;

    if (chatsMode === "browser_only" && !allowCloud && modelInfo.locality === "cloud") {
      setCloudApprovalNeeded({ text, attachments: atts });
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
    setDraft("");
    setAttachments([]);
    setStreaming(true);
    setStreamText("");

    const controller = new AbortController();
    abortRef.current = controller;

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
      if (!res.ok || !res.body) {
        const errTxt = await res.text().catch(() => "Chat request failed");
        throw new Error(errTxt || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamText(acc);
      }

      const rows = (await listMessages({ data: { conversationId: conversation.id } })) as unknown as Message[];
      setMessages(rows);
      setStreamText("");
      await onRefreshList();
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") {
        setMessages((m) => [
          ...m.filter((x) => x.id !== optimistic.id),
          { ...optimistic },
          {
            id: `local-a-${Date.now()}`,
            role: "assistant",
            content: streamText + "\n\n_[stopped by you]_",
            attachments: [],
            model_id: model,
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        toast.error((e as Error).message || "OCADE could not respond");
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(text);
        setAttachments(atts);
      }
    } finally {
      setStreaming(false);
      setStreamText("");
      abortRef.current = null;
    }
  }

  function stop() { abortRef.current?.abort(); }

  async function regenerate() {
    const idx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (idx === -1) return;
    const realIdx = messages.length - 1 - idx;
    const userMsg = messages[realIdx];
    setMessages(messages.slice(0, realIdx + 1));
    await sendMessage(userMsg.content, userMsg.attachments);
  }

  async function handleImprove() {
    if (!draft.trim()) return;
    setImproving(true);
    try {
      const { improved } = (await improvePrompt({ data: { text: draft.trim() } })) as { improved: string };
      setDraft(improved);
      toast.success("Prompt improved");
    } catch {
      toast.error("Could not improve prompt");
    } finally {
      setImproving(false);
    }
  }

  function toggleVoice() {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      SpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { toast.error("Voice input not supported in this browser"); return; }
    if (listening) {
      (recogRef.current as SpeechRecognitionLike | null)?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const transcript = ev.results[0]?.[0]?.transcript ?? "";
      setDraft((d) => (d ? d + " " : "") + transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recogRef.current = rec;
    setListening(true);
  }

  function readAloud(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Read-aloud not supported here"); return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
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
            <span title={modelInfo.provider}>{modelInfo.display}</span>
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
              {messages.map((m) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  onCopy={() => navigator.clipboard.writeText(m.content)}
                  onSpeak={() => readAloud(m.content)}
                  onEdit={m.role === "user" ? () => { setDraft(m.content); setAttachments(m.attachments ?? []); } : undefined}
                />
              ))}
              {streaming && streamText ? (
                <MessageRow
                  message={{
                    id: "streaming", role: "assistant", content: streamText,
                    attachments: [], model_id: model, created_at: new Date().toISOString(),
                  }}
                />
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
          />
        </div>
      </div>

      {/* Cloud approval */}
      <Dialog open={!!cloudApprovalNeeded} onOpenChange={(o) => !o && setCloudApprovalNeeded(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve cloud transfer</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Your chats are set to <span className="font-medium">Browser Only</span>. Sending this message uses{" "}
              <span className="font-medium">{modelInfo.display}</span> ({modelInfo.provider}), a cloud model.
            </p>
            <p className="text-muted-foreground">
              The message and any attached images will be sent to the cloud provider. Approve one-time transfer to continue.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloudApprovalNeeded(null)}>Cancel</Button>
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

/* ---------- Composer ---------- */

function Composer(props: {
  draft: string;
  setDraft: (v: string) => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  onSubmit: () => void;
  onStop: () => void;
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
}) {
  const {
    draft, setDraft, attachments, setAttachments, onSubmit, onStop, streaming,
    mode, setMode, permission, setPermission, model, setModel, chatsMode,
    onImprove, improving, onToggleVoice, listening, onRegenerate, floating,
  } = props;
  const modelInfo = getOcadeModel(model);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null, imagesOnly: boolean) {
    if (!files) return;
    const next: Attachment[] = [...attachments];
    for (const f of Array.from(files)) {
      if (next.length >= MAX_ATTACHMENTS) {
        toast.error(`Maximum ${MAX_ATTACHMENTS} attachments per message`); break;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name}: exceeds 20 MB limit`); continue;
      }
      if (imagesOnly && !f.type.startsWith("image/")) continue;
      const isImage = f.type.startsWith("image/");
      const dataUrl = isImage ? await fileToDataUrl(f) : undefined;
      next.push({
        kind: isImage ? "image" : "file",
        name: f.name, mime: f.type || "application/octet-stream", sizeBytes: f.size, dataUrl,
      });
      if (!isImage) {
        toast.info(`${f.name}: attached to record. Non-image files are not sent to the model in this build.`);
      }
    }
    setAttachments(next);
  }

  return (
    <div className={cn(
      "rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur",
      floating && "shadow-md",
    )}>
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-border/60 px-3 py-2">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-2 py-1 text-[11px]">
              {a.kind === "image" ? <Sparkles className="h-3 w-3" /> : <Paperclip className="h-3 w-3" />}
              <span className="max-w-[160px] truncate">{a.name}</span>
              <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove">
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
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
        }}
        rows={2}
        placeholder={mode === "work"
          ? "Describe the task for OCADE Work…"
          : "Message OCADE…  (Enter to send, Shift+Enter for newline)"}
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
          ref={fileRef} type="file" multiple className="hidden"
          onChange={(e) => { void handleFiles(e.target.files, false); e.currentTarget.value = ""; }}
        />
        <ComposerIcon
          title="Attach images"
          onClick={() => imageRef.current?.click()}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </ComposerIcon>
        <input
          ref={imageRef} type="file" multiple accept="image/*" className="hidden"
          onChange={(e) => { void handleFiles(e.target.files, true); e.currentTarget.value = ""; }}
        />
        {onToggleVoice ? (
          <ComposerIcon
            title={listening ? "Stop voice input" : "Voice input"}
            onClick={onToggleVoice}
            active={listening}
          >
            {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </ComposerIcon>
        ) : null}

        <div className="mx-1 h-4 w-px bg-border/60" />

        {/* Chat / Work switch */}
        <ModeSwitch mode={mode} setMode={setMode} />

        {/* Project or folder selector (planned) */}
        <button
          disabled
          title="Project or folder — planned"
          className="ml-1 hidden items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground/70 sm:inline-flex"
        >
          <FolderOpen className="h-3 w-3" /> Project <ChevronDown className="h-3 w-3" />
        </button>

        {/* Permission mode */}
        <Select value={permission} onValueChange={(v) => setPermission(v as PermissionMode)}>
          <SelectTrigger className="ml-1 hidden h-7 w-[128px] border-border/60 bg-background/40 text-[11px] sm:flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual" className="text-xs">Manual</SelectItem>
            <SelectItem value="assisted" className="text-xs">Assisted</SelectItem>
            <SelectItem value="autonomous" className="text-xs">Autonomous with approval</SelectItem>
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
          {chatsMode === "private_sync" ? "Private sync" : chatsMode === "pc_vault" ? "PC vault" : "Browser only"}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {onImprove ? (
            <button
              onClick={onImprove}
              disabled={improving || streaming || !draft.trim()}
              title="Improve prompt"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {improving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Improve
            </button>
          ) : null}
          {onRegenerate ? (
            <ComposerIcon title="Regenerate" onClick={onRegenerate}>
              <RefreshCcw className="h-3.5 w-3.5" />
            </ComposerIcon>
          ) : null}
          {streaming ? (
            <button
              onClick={onStop}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-destructive/90 px-2.5 text-[11px] font-medium text-destructive-foreground hover:bg-destructive"
            >
              <Square className="h-3 w-3" /> Stop
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={!draft.trim() && attachments.length === 0}
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
          mode === "chat" ? "bg-secondary text-foreground" : "bg-background/40 text-muted-foreground hover:text-foreground",
        )}
      >
        <MessagesSquare className="h-3 w-3" /> Chat
      </button>
      <button
        onClick={() => setMode("work")}
        className={cn(
          "inline-flex h-7 items-center gap-1 border-l border-border/60 px-2",
          mode === "work" ? "bg-secondary text-foreground" : "bg-background/40 text-muted-foreground hover:text-foreground",
        )}
      >
        <Bot className="h-3 w-3" /> OCADE Work
      </button>
    </div>
  );
}

function ComposerIcon({
  children, title, onClick, active,
}: { children: React.ReactNode; title: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
        active && "text-destructive",
      )}
    >
      {children}
    </button>
  );
}

/* ---------- Message row (minimal, no big card) ---------- */

function MessageRow({
  message, onCopy, onSpeak, onEdit,
}: {
  message: Message;
  onCopy?: () => void;
  onSpeak?: () => void;
  onEdit?: () => void;
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
          {onCopy ? <RowAction title="Copy" onClick={onCopy}><Copy className="h-3 w-3" /></RowAction> : null}
          {onSpeak ? <RowAction title="Read aloud" onClick={onSpeak}><Volume2 className="h-3 w-3" /></RowAction> : null}
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
        {onCopy ? <RowAction title="Copy" onClick={onCopy}><Copy className="h-3 w-3" /></RowAction> : null}
        {onEdit ? <RowAction title="Edit & resend" onClick={onEdit}><Pencil className="h-3 w-3" /></RowAction> : null}
      </div>
    </div>
  );
}

function AttachmentsInline({ atts }: { atts: Attachment[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {atts.map((a, i) => a.kind === "image" && a.dataUrl ? (
        <img key={i} src={a.dataUrl} alt={a.name} className="max-h-40 rounded-md border border-border/60" />
      ) : (
        <div key={i} className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px]">
          <Paperclip className="h-3 w-3" /> {a.name}
        </div>
      ))}
    </div>
  );
}

function RowAction({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
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
  target, onClose, onSubmit,
}: { target: Conversation | null; onClose: () => void; onSubmit: (title: string) => void }) {
  const [value, setValue] = useState("");
  useEffect(() => { setValue(target?.title ?? ""); }, [target]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rename conversation</DialogTitle></DialogHeader>
        <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => value.trim() && onSubmit(value.trim())} disabled={!value.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  target, onClose, onConfirm,
}: { target: Conversation | null; onClose: () => void; onConfirm: () => void }) {
  const [phrase, setPhrase] = useState("");
  useEffect(() => { setPhrase(""); }, [target]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete “{target?.title}”?</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            This permanently removes the conversation and all its messages. This cannot be undone.
          </p>
          <p className="text-xs">Type <span className="font-mono font-semibold">delete</span> to confirm.</p>
          <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="delete" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={phrase !== "delete"} onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Helpers ---------- */

async function sendViaApi(args: {
  conversationId: string;
  model: string;
  text: string;
  attachments: Attachment[];
  allowCloud: boolean;
}): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Session expired");
  const res = await fetch("/api/ocade/chat", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      conversationId: args.conversationId,
      model: args.model,
      allowCloud: args.allowCloud,
      message: { content: args.text, attachments: args.attachments },
    }),
  });
  if (res.status === 428) {
    throw new Error("This model is cloud-based. Approve cloud transfer from the chat to continue.");
  }
  if (!res.ok || !res.body) {
    const errTxt = await res.text().catch(() => "Chat request failed");
    throw new Error(errTxt || `HTTP ${res.status}`);
  }
  // Drain the stream so the server finishes writing rows.
  const reader = res.body.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  onresult: (ev: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void;
  onend: () => void;
  onerror: (ev: unknown) => void;
  start: () => void;
  stop: () => void;
};
