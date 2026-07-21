import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/shell/AppShell";
import { GlassPanel } from "@/components/shell/GlassPanel";
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
        <GlassPanel className="mx-auto mt-8 max-w-md p-6 text-center">
          <p className="text-sm text-muted-foreground">Sign-in required to use OCADE.</p>
        </GlassPanel>
      </AppShell>
    );
  }
  return <OcadeWorkspace userId={user.id} />;
}

/* ---------- Workspace ---------- */

function OcadeWorkspace({ userId }: { userId: string }) {
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

  const refreshList = useCallback(async () => {
    try {
      const list = (await listConversations()) as Conversation[];
      setConversations(list);
      if (!activeId && list.length > 0) {
        const firstOpen = list.find((c) => !c.archived) ?? list[0];
        setActiveId(firstOpen.id);
      }
    } finally {
      setLoadingList(false);
    }
  }, [activeId]);

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
    const conv = (await createConversation({ data: { modelId: model } })) as Conversation;
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setMessages([]);
  }

  async function togglePin(c: Conversation) {
    await updateConversation({ data: { id: c.id, pinned: !c.pinned } });
    await refreshList();
  }
  async function toggleArchive(c: Conversation) {
    await updateConversation({ data: { id: c.id, archived: !c.archived } });
    await refreshList();
    if (c.id === activeId && !c.archived) {
      setActiveId(null);
    }
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

  const filteredConvos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => showArchived ? c.archived : !c.archived)
      .filter((c) => (q ? c.title.toLowerCase().includes(q) : true));
  }, [conversations, search, showArchived]);

  return (
    <AppShell>
      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <GlassPanel className="hidden flex-col overflow-hidden md:flex">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--accent-ocade)]">OCADE</div>
              <div className="text-xs text-muted-foreground">by CAERA CADANE</div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                to="/ocade/models"
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                title="Model Control (technical)"
              >
                Models
              </Link>
              <Button size="sm" onClick={handleNew} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New
              </Button>
            </div>
          </div>
          <div className="border-b border-border/60 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="mt-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {showArchived ? "← Active conversations" : "Archived →"}
            </button>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {loadingList ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Loading…</div>
            ) : filteredConvos.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                {showArchived ? "No archived chats." : "No conversations yet."}
              </div>
            ) : (
              filteredConvos.map((c) => (
                <ConversationRow
                  key={c.id}
                  conv={c}
                  active={c.id === activeId}
                  onSelect={() => setActiveId(c.id)}
                  onPin={() => togglePin(c)}
                  onArchive={() => toggleArchive(c)}
                  onRename={() => setRenameTarget(c)}
                  onDelete={() => setDeleteTarget(c)}
                  onExport={() => handleExport(c)}
                />
              ))
            )}
          </div>
        </GlassPanel>

        {/* Workspace */}
        <div className="flex min-h-0 flex-col">
          {active ? (
            <ChatWindow
              key={active.id}
              conversation={active}
              messages={messages}
              setMessages={setMessages}
              loading={loadingMessages}
              model={model}
              setModel={setModel}
              chatsMode={chatsMode}
              onRefreshList={refreshList}
            />
          ) : (
            <GlassPanel className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="text-xs uppercase tracking-wide text-[color:var(--accent-ocade)]">OCADE by CAERA CADANE</div>
              <h2 className="text-xl font-semibold">Start a new conversation</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Your assistant, projects and files. OCADE always identifies as “OCADE by CAERA CADANE” and tells you
                which model is active when you ask.
              </p>
              <Button onClick={handleNew} className="gap-1.5">
                <Plus className="h-4 w-4" /> New chat
              </Button>
            </GlassPanel>
          )}
        </div>
      </div>

      {/* Rename dialog */}
      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRenameSubmit}
      />

      {/* Delete confirmation */}
      <DeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </AppShell>
  );
}

/* ---------- Sidebar row ---------- */

function ConversationRow(props: {
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
  onPin: () => void;
  onArchive: () => void;
  onRename: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const { conv, active, onSelect, onPin, onArchive, onRename, onDelete, onExport } = props;
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition",
        active ? "bg-primary/15 text-foreground" : "hover:bg-muted/40 text-muted-foreground",
      )}
    >
      <button onClick={onSelect} className="flex flex-1 items-center gap-1.5 truncate text-left">
        {conv.pinned ? <Pin className="h-3 w-3 shrink-0 text-[color:var(--accent-ocade)]" /> : null}
        <span className="truncate">{conv.title}</span>
      </button>
      <div className="flex opacity-0 transition group-hover:opacity-100">
        <IconMini title={conv.pinned ? "Unpin" : "Pin"} onClick={onPin}>
          {conv.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </IconMini>
        <IconMini title="Rename" onClick={onRename}>
          <Pencil className="h-3 w-3" />
        </IconMini>
        <IconMini title="Export JSON" onClick={onExport}>
          <Download className="h-3 w-3" />
        </IconMini>
        <IconMini title={conv.archived ? "Unarchive" : "Archive"} onClick={onArchive}>
          {conv.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
        </IconMini>
        <IconMini title="Delete" onClick={onDelete}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </IconMini>
      </div>
    </div>
  );
}

function IconMini({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
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

/* ---------- Chat window ---------- */

function ChatWindow(props: {
  conversation: Conversation;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  loading: boolean;
  model: string;
  setModel: (m: string) => void;
  chatsMode: "browser_only" | "pc_vault" | "private_sync";
  onRefreshList: () => Promise<void>;
}) {
  const { conversation, messages, setMessages, loading, model, setModel, chatsMode, onRefreshList } = props;
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

  async function persistModel(newId: string) {
    setModel(newId);
    await updateConversation({ data: { id: conversation.id, modelId: newId } });
    await onRefreshList();
  }

  async function sendMessage(overrideText?: string, overrideAtts?: Attachment[], allowCloud = false) {
    const text = (overrideText ?? draft).trim();
    const atts = overrideAtts ?? attachments;
    if (!text && atts.length === 0) return;
    if (streaming) return;

    if (chatsMode === "browser_only" && !allowCloud && modelInfo.locality === "cloud") {
      setCloudApprovalNeeded({ text, attachments: atts });
      return;
    }

    // Optimistic user message
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
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
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
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamText(acc);
      }

      // Reload from server to get real IDs.
      const rows = (await listMessages({ data: { conversationId: conversation.id } })) as unknown as Message[];
      setMessages(rows);
      setStreamText("");
      await onRefreshList();
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") {
        // Preserve partial text as an assistant message locally.
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

  function stop() {
    abortRef.current?.abort();
  }

  async function regenerate() {
    // Find last user message; remove trailing assistant + resend.
    const idx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (idx === -1) return;
    const realIdx = messages.length - 1 - idx;
    const userMsg = messages[realIdx];
    // Remove any assistant messages after it (locally).
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

  async function handleFiles(files: FileList | null) {
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
      const isImage = f.type.startsWith("image/");
      const dataUrl = isImage ? await fileToDataUrl(f) : undefined;
      next.push({
        kind: isImage ? "image" : "file",
        name: f.name,
        mime: f.type || "application/octet-stream",
        sizeBytes: f.size,
        dataUrl,
      });
      if (!isImage) {
        toast.info(`${f.name}: attached to record. Non-image files are not sent to the model in this build.`);
      }
    }
    setAttachments(next);
  }

  function toggleVoice() {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      SpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice input not supported in this browser");
      return;
    }
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
      toast.error("Read-aloud not supported here");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  }

  return (
    <GlassPanel className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{conversation.title}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <PrivacyBadge mode={chatsMode === "private_sync" ? "private_sync" : "device_only"} />
            <span>·</span>
            <span title={modelInfo.provider}>{modelInfo.display}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={model} onValueChange={persistModel}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
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
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-10 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : messages.length === 0 && !streaming ? (
          <div className="mx-auto max-w-md space-y-2 py-10 text-center">
            <div className="text-xs uppercase tracking-wide text-[color:var(--accent-ocade)]">
              OCADE by CAERA CADANE
            </div>
            <p className="text-sm text-muted-foreground">
              Ask a question, paste text, or drop an image. OCADE will introduce itself and answer honestly about its limits.
            </p>
            <p className="text-[11px] text-muted-foreground/80">{ocadeHonestDisclosure({ modelId: modelInfo.display, providerId: modelInfo.provider, locality: modelInfo.locality })}</p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} onCopy={() => navigator.clipboard.writeText(m.content)} onSpeak={() => readAloud(m.content)} onEdit={m.role === "user" ? () => { setDraft(m.content); setAttachments(m.attachments ?? []); } : undefined} />
          ))
        )}
        {streaming && streamText ? (
          <MessageBubble
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
        {streaming && !streamText ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> OCADE is thinking…
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 p-3">
        {attachments.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px]">
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[160px] truncate">{a.name}</span>
                <span className="text-muted-foreground">{Math.round(a.sizeBytes / 1024)}KB</span>
                <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <label className="cursor-pointer rounded-md border border-border/60 bg-background/40 p-2 text-muted-foreground hover:text-foreground" title="Attach files (max 10, 20 MB each)">
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <button
            onClick={toggleVoice}
            className={cn(
              "rounded-md border border-border/60 bg-background/40 p-2 text-muted-foreground hover:text-foreground",
              listening && "text-destructive",
            )}
            title="Voice input"
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            rows={1}
            placeholder="Message OCADE… (Enter to send, Shift+Enter for newline)"
            className="min-h-[40px] flex-1 resize-none text-sm"
            disabled={streaming}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleImprove}
            disabled={improving || streaming || !draft.trim()}
            title="Improve prompt (preserves your meaning)"
          >
            {improving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Improve
          </Button>
          {streaming ? (
            <Button variant="destructive" size="sm" onClick={stop} className="gap-1.5">
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => sendMessage()}
              disabled={!draft.trim() && attachments.length === 0}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" /> Send
            </Button>
          )}
          {!streaming && messages.some((m) => m.role === "assistant") ? (
            <Button variant="ghost" size="sm" onClick={regenerate} className="gap-1.5" title="Regenerate last answer">
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          OCADE by CAERA CADANE. If you ask which model powers this reply, OCADE will name it truthfully.
        </div>
      </div>

      {/* Cloud approval dialog */}
      <Dialog open={!!cloudApprovalNeeded} onOpenChange={(o) => !o && setCloudApprovalNeeded(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve cloud transfer</DialogTitle>
          </DialogHeader>
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
    </GlassPanel>
  );
}

/* ---------- Message bubble ---------- */

function MessageBubble({
  message,
  onCopy,
  onSpeak,
  onEdit,
}: {
  message: Message;
  onCopy?: () => void;
  onSpeak?: () => void;
  onEdit?: () => void;
}) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={cn("group flex flex-col gap-1", isAssistant ? "items-start" : "items-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isAssistant
            ? "bg-muted/40 text-foreground"
            : "bg-primary/15 text-foreground",
        )}
      >
        {isAssistant ? (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--accent-ocade)]">
            OCADE
          </div>
        ) : null}
        {message.attachments && message.attachments.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.attachments.map((a, i) =>
              a.kind === "image" && a.dataUrl ? (
                <img key={i} src={a.dataUrl} alt={a.name} className="max-h-40 rounded-md border border-border/60" />
              ) : (
                <div key={i} className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px]">
                  <Paperclip className="h-3 w-3" /> {a.name}
                </div>
              ),
            )}
          </div>
        ) : null}
        <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap break-words [&_p]:my-1 [&_pre]:my-2 [&_code]:text-xs">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
      <div className={cn("flex gap-1 opacity-0 transition group-hover:opacity-100", isAssistant ? "ml-1" : "mr-1")}>
        {onCopy ? (
          <button onClick={onCopy} className="rounded p-1 text-[10px] text-muted-foreground hover:text-foreground" title="Copy">
            <Copy className="h-3 w-3" />
          </button>
        ) : null}
        {onSpeak && isAssistant ? (
          <button onClick={onSpeak} className="rounded p-1 text-[10px] text-muted-foreground hover:text-foreground" title="Read aloud">
            <Volume2 className="h-3 w-3" />
          </button>
        ) : null}
        {onEdit ? (
          <button onClick={onEdit} className="rounded p-1 text-[10px] text-muted-foreground hover:text-foreground" title="Edit and resend">
            <Pencil className="h-3 w-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- Rename / Delete dialogs ---------- */

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
          <p className="text-xs">Type <span className="font-mono font-semibold">delete</span> to confirm.</p>
          <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="delete" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
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

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  onresult: (ev: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};
