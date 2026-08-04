import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect, useId } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Send,
  Search,
  Plus,
  Paperclip,
  Mic,
  Pin,
  Reply,
  Pencil,
  Trash2,
  Link2,
  Users,
  Shield,
  X,
  Check,
  Loader2,
  MoreHorizontal,
  Building2,
} from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { executeAction } from "@/lib/actions";
import { toast } from "sonner";
import {
  listMyThreads,
  createThread,
  updateThread,
  listMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  togglePin,
  listMembers,
  addMember,
  removeMember,
  registerAttachment,
  signedAttachmentUrl,
  searchMessages,
  listEdits,
  requestCrossCompanyGrant,
  decideCrossCompanyGrant,
  listCrossCompanyGrants,
  linkMessage,
  convertMessageToApproval,
} from "@/lib/messenger.functions";

export const Route = createFileRoute("/_authenticated/ficia/$tenantId/messenger")({
  head: () => ({ meta: [{ title: "Messenger — FICIA" }, { name: "robots", content: "noindex" }] }),
  component: MessengerPage,
});

type Kind = "company" | "department" | "role" | "project" | "private" | "cross_company";
type ScopeBadge = "company" | "private" | "cross_company";
type ChipVariant = "success" | "warning" | "danger" | "info" | "neutral";

const chipStyles: Record<ChipVariant, string> = {
  success:
    "bg-[color:var(--state-success)]/15 text-[color:var(--state-success)] ring-[color:var(--state-success)]/30",
  info: "bg-[color:var(--state-info)]/15 text-[color:var(--state-info)] ring-[color:var(--state-info)]/30",
  warning:
    "bg-[color:var(--state-warning)]/15 text-[color:var(--state-warning)] ring-[color:var(--state-warning)]/30",
  danger: "bg-destructive/15 text-destructive ring-destructive/30",
  neutral: "bg-muted text-muted-foreground ring-border",
};

function Chip({
  variant = "neutral",
  children,
}: {
  variant?: ChipVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${chipStyles[variant]}`}
    >
      {children}
    </span>
  );
}

function scopeBadgeVariant(s?: string): ChipVariant {
  if (s === "company") return "info";
  if (s === "cross_company") return "warning";
  if (s === "private") return "neutral";
  if (s === "dm") return "success";
  return "neutral";
}

function MessengerPage() {
  const { tenantId } = Route.useParams();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const threadsQ = useQuery({
    queryKey: ["msg_threads", tenantId],
    queryFn: () => listMyThreads({ data: { tenant_id: tenantId } }),
  });

  const threads = threadsQ.data?.threads ?? [];
  const activeThread = useMemo(
    () => threads.find((t: any) => t.id === activeId),
    [threads, activeId],
  );

  const searchRes = useQuery({
    queryKey: ["msg_search", searchQ],
    queryFn: () => searchMessages({ data: { query: searchQ } }),
    enabled: searchQ.trim().length >= 2,
  });

  return (
    <AppShell>
      <PageHeader
        title="Business messenger"
        description="Company evidence-grade chat with retention, scope badges and audit-linked actions."
        actions={
          <Link
            to="/ficia/$tenantId"
            params={{ tenantId }}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to company
          </Link>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-14rem)]">
        {/* Left rail */}
        <GlassPanel className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search messages…"
                className="pl-7 h-9"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowNew(true)}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {searchQ.trim().length >= 2 ? (
              <div className="p-2 space-y-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-1">
                  Search results
                </div>
                {(searchRes.data?.hits ?? []).map((h: any) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setActiveId(h.thread_id);
                      setSearchQ("");
                    }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm"
                  >
                    <div className="text-xs text-muted-foreground">
                      {h.msg_threads?.name ?? "DM"}
                    </div>
                    <div className="line-clamp-2">{h.body}</div>
                  </button>
                ))}
                {searchRes.isSuccess && (searchRes.data?.hits ?? []).length === 0 && (
                  <div className="text-xs text-muted-foreground px-2 py-3">No matches.</div>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {threadsQ.isLoading && (
                  <div className="p-3 text-sm text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 inline animate-spin" /> Loading…
                  </div>
                )}
                {threads.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    className={`w-full text-left px-2 py-2 rounded hover:bg-muted flex items-start gap-2 ${activeId === t.id ? "bg-muted" : ""}`}
                  >
                    <div className="mt-0.5 text-muted-foreground">
                      {t.kind === "dm" ? (
                        <Users className="w-3.5 h-3.5" />
                      ) : t.kind === "cross_company" ? (
                        <Building2 className="w-3.5 h-3.5" />
                      ) : (
                        <Shield className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium truncate">
                          {t.name ?? "Direct message"}
                        </div>
                        <Chip variant={scopeBadgeVariant(t.scope_badge)}>{t.scope_badge}</Chip>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.kind} · retention {t.retention_days}d
                      </div>
                    </div>
                  </button>
                ))}
                {threads.length === 0 && !threadsQ.isLoading && (
                  <div className="text-xs text-muted-foreground p-3">
                    No threads yet. Create one to get started.
                  </div>
                )}
              </div>
            )}
          </div>
        </GlassPanel>

        {/* Right chat */}
        <GlassPanel className="flex flex-col overflow-hidden">
          {activeThread ? (
            <ThreadView
              key={activeThread.id}
              thread={activeThread}
              tenantId={tenantId}
              onUpdated={() => qc.invalidateQueries({ queryKey: ["msg_threads", tenantId] })}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select or create a thread.
            </div>
          )}
        </GlassPanel>
      </div>

      {showNew && (
        <NewThreadDialog
          tenantId={tenantId}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setActiveId(id);
            setShowNew(false);
            qc.invalidateQueries({ queryKey: ["msg_threads", tenantId] });
          }}
        />
      )}
    </AppShell>
  );
}

// ---------------- Thread view ----------------
function ThreadView({
  thread,
  tenantId,
  onUpdated,
}: {
  thread: any;
  tenantId: string;
  onUpdated: () => void;
}) {
  const qc = useQueryClient();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showGrants, setShowGrants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messagesQ = useQuery({
    queryKey: ["msg_messages", thread.id],
    queryFn: () => listMessages({ data: { thread_id: thread.id } }),
    // Realtime is primary; this slow poll is a truthful fallback if the socket drops.
    refetchInterval: 60_000,
  });

  // Live updates for this thread. RLS scopes the stream to threads you belong to.
  useEffect(() => {
    const channel = supabase
      .channel(`msg_thread_${thread.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "msg_messages",
          filter: `thread_id=eq.${thread.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["msg_messages", thread.id] });
          qc.invalidateQueries({ queryKey: ["msg_threads"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [thread.id, qc]);

  const messages = messagesQ.data?.messages ?? [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const sendM = useMutation({
    mutationFn: async (body: string) => {
      return executeAction("ficia.messenger.send", {
        run: () =>
          sendMessage({ data: { thread_id: thread.id, body, reply_to: replyTo ?? undefined } }),
        tenantId,
      });
    },
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["msg_messages", thread.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editM = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) =>
      executeAction("ficia.messenger.edit", {
        run: () => editMessage({ data: { message_id: id, body } }),
        tenantId,
      }),
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["msg_messages", thread.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) =>
      executeAction("ficia.messenger.delete", {
        run: () => deleteMessage({ data: { message_id: id } }),
        confirmed: true,
        tenantId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["msg_messages", thread.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const pinM = useMutation({
    mutationFn: async (id: string) =>
      executeAction("ficia.messenger.pin", {
        run: () => togglePin({ data: { thread_id: thread.id, message_id: id } }),
        tenantId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["msg_messages", thread.id] }),
  });

  const reactM = useMutation({
    mutationFn: async ({ id, emoji }: { id: string; emoji: string }) =>
      toggleReaction({ data: { message_id: id, emoji } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["msg_messages", thread.id] }),
  });

  async function handleFile(f: File) {
    if (f.size > 50 * 1024 * 1024) {
      toast.error("Max 50 MB");
      return;
    }
    const ext = f.name.split(".").pop() ?? "bin";
    const path = `${thread.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("messenger")
      .upload(path, f, { contentType: f.type, upsert: false });
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    try {
      await executeAction("ficia.messenger.attachment", {
        run: () =>
          registerAttachment({
            data: {
              thread_id: thread.id,
              storage_path: path,
              file_name: f.name,
              mime: f.type || "application/octet-stream",
              size_bytes: f.size,
            },
          }),
        tenantId,
      });
      qc.invalidateQueries({ queryKey: ["msg_messages", thread.id] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <>
      <div className="p-3 border-b border-border flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">{thread.name ?? "Direct message"}</div>
            <Chip variant={scopeBadgeVariant(thread.scope_badge)}>{thread.scope_badge}</Chip>
            {thread.is_archived && <Chip variant={"neutral"}>archived</Chip>}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {thread.topic ?? `${thread.kind} · retention ${thread.retention_days}d`}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowMembers(true)}>
          <Users className="w-3.5 h-3.5" />
        </Button>
        {thread.kind === "cross_company" && (
          <Button variant="ghost" size="sm" onClick={() => setShowGrants(true)}>
            <Building2 className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
          <MoreHorizontal className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m: any) => (
          <MessageRow
            key={m.id}
            m={m}
            onReply={() => setReplyTo(m.id)}
            onEdit={() => setEditing({ id: m.id, body: m.body ?? "" })}
            onDelete={() => deleteM.mutate(m.id)}
            onPin={() => pinM.mutate(m.id)}
            onReact={(emoji) => reactM.mutate({ id: m.id, emoji })}
            onLink={() => setLinking(m.id)}
            onConvertApproval={() => setConverting(m.id)}
          />
        ))}
        {messages.length === 0 && !messagesQ.isLoading && (
          <div className="text-xs text-muted-foreground text-center py-8">No messages yet.</div>
        )}
      </div>

      <div className="border-t border-border p-3 space-y-2">
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Reply className="w-3 h-3" /> Replying to a message
            <button onClick={() => setReplyTo(null)}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            aria-label="Attach file"
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" title="Voice note (coming soon)" disabled>
            <Mic className="w-3.5 h-3.5" />
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (text.trim()) sendM.mutate(text.trim());
              }
            }}
            placeholder="Message…"
            className="flex-1 min-h-[40px] max-h-40 resize-none"
            rows={1}
          />
          <Button
            onClick={() => text.trim() && sendM.mutate(text.trim())}
            disabled={sendM.isPending || !text.trim()}
          >
            {sendM.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        <div className="text-[10px] text-muted-foreground">
          Scope: <span className="font-medium">{thread.scope_badge}</span>.{" "}
          {thread.scope_badge === "company" || thread.scope_badge === "cross_company"
            ? "Company evidence — retention applies."
            : "Personal — not company evidence."}
        </div>
      </div>

      {editing && (
        <EditDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={(body) => editM.mutate({ id: editing.id, body })}
        />
      )}
      {showMembers && <MembersDialog thread={thread} onClose={() => setShowMembers(false)} />}
      {showGrants && (
        <CrossCompanyDialog
          thread={thread}
          tenantId={tenantId}
          onClose={() => setShowGrants(false)}
        />
      )}
      {showSettings && (
        <ThreadSettingsDialog
          thread={thread}
          tenantId={tenantId}
          onClose={() => {
            setShowSettings(false);
            onUpdated();
          }}
        />
      )}
      {linking && (
        <LinkDialog
          messageId={linking}
          tenantId={tenantId}
          onClose={() => setLinking(null)}
          onSaved={() => {
            setLinking(null);
            qc.invalidateQueries({ queryKey: ["msg_messages", thread.id] });
          }}
        />
      )}
      {converting && (
        <ConvertApprovalDialog
          messageId={converting}
          tenantId={tenantId}
          onClose={() => setConverting(null)}
          onDone={() => {
            setConverting(null);
            qc.invalidateQueries({ queryKey: ["msg_messages", thread.id] });
          }}
        />
      )}
    </>
  );
}

// ---------------- Message row ----------------
function MessageRow({
  m,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onLink,
  onConvertApproval,
}: {
  m: any;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  onReact: (emoji: string) => void;
  onLink: () => void;
  onConvertApproval: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const reactionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (m.reactions ?? []).forEach((r: any) => {
      map[r.emoji] = (map[r.emoji] ?? 0) + 1;
    });
    return map;
  }, [m.reactions]);
  const pinned = (m.pins ?? []).length > 0;
  return (
    <div className="group rounded-md p-2 hover:bg-muted/40 transition">
      <div className="flex items-baseline gap-2">
        <div className="text-sm font-medium">
          {m.profiles?.display_name ?? m.author_id?.slice(0, 8)}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {new Date(m.created_at).toLocaleString()}
        </div>
        <Chip variant={scopeBadgeVariant(m.scope_badge)}>{m.scope_badge}</Chip>
        {pinned && <Pin className="w-3 h-3 text-warning" />}
        {m.edited_at && (
          <button
            onClick={() => setShowHistory(true)}
            className="text-[10px] text-muted-foreground underline"
          >
            edited
          </button>
        )}
      </div>
      {m.is_deleted ? (
        <div className="text-sm italic text-muted-foreground">[deleted]</div>
      ) : (
        <>
          {m.body && <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>}
          {(m.attachments ?? []).map((a: any) => (
            <AttachmentChip key={a.id} attachment={a} />
          ))}
          {(m.links ?? []).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {m.links.map((l: any) => (
                <Chip key={l.id} variant={"info"}>
                  <Link2 className="w-2.5 h-2.5 inline mr-1" />
                  {l.link_kind}
                  {l.target_ref ? `: ${l.target_ref}` : ""}
                </Chip>
              ))}
            </div>
          )}
          {Object.keys(reactionCounts).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(reactionCounts).map(([e, c]) => (
                <button
                  key={e}
                  onClick={() => onReact(e)}
                  className="text-xs px-1.5 py-0.5 rounded border border-border bg-muted/40"
                >
                  {e} {c}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <div className="opacity-0 group-hover:opacity-100 transition mt-1 flex gap-1 text-xs">
        {["👍", "❤️", "🎉", "✅"].map((e) => (
          <button key={e} onClick={() => onReact(e)} className="px-1 hover:bg-muted rounded">
            {e}
          </button>
        ))}
        <button
          onClick={onReply}
          className="px-1.5 hover:bg-muted rounded inline-flex items-center gap-1"
        >
          <Reply className="w-3 h-3" />
          Reply
        </button>
        <button
          onClick={onPin}
          className="px-1.5 hover:bg-muted rounded inline-flex items-center gap-1"
        >
          <Pin className="w-3 h-3" />
          {pinned ? "Unpin" : "Pin"}
        </button>
        {!m.is_deleted && (
          <button
            onClick={onEdit}
            className="px-1.5 hover:bg-muted rounded inline-flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        )}
        {!m.is_deleted && (
          <button
            onClick={onDelete}
            className="px-1.5 hover:bg-muted rounded inline-flex items-center gap-1 text-destructive"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        )}
        <button
          onClick={onLink}
          className="px-1.5 hover:bg-muted rounded inline-flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" />
          Link
        </button>
        <button
          onClick={onConvertApproval}
          className="px-1.5 hover:bg-muted rounded inline-flex items-center gap-1"
        >
          <Shield className="w-3 h-3" />→ Approval
        </button>
      </div>
      {showHistory && <EditHistoryDialog messageId={m.id} onClose={() => setShowHistory(false)} />}
    </div>
  );
}

function AttachmentChip({ attachment }: { attachment: any }) {
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      const { url } = await signedAttachmentUrl({
        data: { storage_path: attachment.storage_path, expires_in: 300 },
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      onClick={open}
      className="mt-1 inline-flex items-center gap-2 px-2 py-1 rounded border border-border text-xs hover:bg-muted"
    >
      <Paperclip className="w-3 h-3" />
      <span>{attachment.file_name}</span>
      <span className="text-muted-foreground">{Math.round(attachment.size_bytes / 1024)} KB</span>
      {loading && <Loader2 className="w-3 h-3 animate-spin" />}
    </button>
  );
}

// ---------------- Dialogs ----------------
function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    (focusables()[0] ?? dialog).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <GlassPanel
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div id={titleId} className="font-medium">
            {title}
          </div>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose}>
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
        {children}
      </GlassPanel>
    </div>
  );
}

function NewThreadDialog({
  tenantId,
  onClose,
  onCreated,
}: {
  tenantId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [kind, setKind] = useState<Kind>("project");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [retention, setRetention] = useState(3650);
  const [scope, setScope] = useState<ScopeBadge>("company");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const result = await executeAction("ficia.messenger.thread.create", {
        run: () =>
          createThread({
            data: {
              kind,
              name: name.trim(),
              topic: topic.trim() || undefined,
              tenant_id: kind === "private" ? null : tenantId,
              retention_days: retention,
              scope_badge: scope,
            },
          }),
        tenantId,
      });
      onCreated((result as any).thread.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <DialogShell title="New thread" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>Kind</Label>
          <select
            aria-label="Thread kind"
            className="w-full h-9 rounded border border-border bg-background px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            <option value="company">Company (all members)</option>
            <option value="department">Department</option>
            <option value="role">Role</option>
            <option value="project">Project</option>
            <option value="private">Private (personal — not company evidence)</option>
            <option value="cross_company">Cross-company (approval required)</option>
          </select>
        </div>
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 close"
          />
        </div>
        <div>
          <Label>Topic (optional)</Label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Retention (days)</Label>
            <Input
              type="number"
              min={1}
              max={3650}
              value={retention}
              onChange={(e) => setRetention(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Scope badge</Label>
            <select
              aria-label="Thread scope badge"
              className="w-full h-9 rounded border border-border bg-background px-2 text-sm"
              value={scope}
              onChange={(e) => setScope(e.target.value as ScopeBadge)}
            >
              <option value="company">company</option>
              <option value="cross_company">cross_company</option>
              <option value="private">private</option>
            </select>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Company-scoped threads are visible to auditors and follow retention. Private threads are
          personal and never become company evidence silently.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}

function EditDialog({
  editing,
  onClose,
  onSave,
}: {
  editing: { id: string; body: string };
  onClose: () => void;
  onSave: (body: string) => void;
}) {
  const [body, setBody] = useState(editing.body);
  return (
    <DialogShell title="Edit message" onClose={onClose}>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
      <div className="text-xs text-muted-foreground mt-2">
        Original wording is preserved in the compliance edit history.
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => onSave(body)}>Save</Button>
      </div>
    </DialogShell>
  );
}

function EditHistoryDialog({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["msg_edits", messageId],
    queryFn: () => listEdits({ data: { message_id: messageId } }),
  });
  return (
    <DialogShell title="Edit history" onClose={onClose}>
      <div className="space-y-2">
        {(q.data?.edits ?? []).map((e: any) => (
          <div key={e.id} className="p-2 rounded border border-border text-sm">
            <div className="text-xs text-muted-foreground">
              {new Date(e.edited_at).toLocaleString()}
            </div>
            <div className="whitespace-pre-wrap">{e.previous_body ?? <em>[was empty]</em>}</div>
          </div>
        ))}
        {q.isSuccess && (q.data?.edits ?? []).length === 0 && (
          <div className="text-xs text-muted-foreground">No prior versions.</div>
        )}
      </div>
    </DialogShell>
  );
}

function MembersDialog({ thread, onClose }: { thread: any; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["msg_members", thread.id],
    queryFn: () => listMembers({ data: { thread_id: thread.id } }),
  });
  const [newId, setNewId] = useState("");
  const addM = useMutation({
    mutationFn: async (uid: string) =>
      executeAction("ficia.messenger.member.add", {
        run: () => addMember({ data: { thread_id: thread.id, user_id: uid } }),
      }),
    onSuccess: () => {
      setNewId("");
      qc.invalidateQueries({ queryKey: ["msg_members", thread.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const rmM = useMutation({
    mutationFn: async (uid: string) =>
      executeAction("ficia.messenger.member.remove", {
        run: () => removeMember({ data: { thread_id: thread.id, user_id: uid } }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["msg_members", thread.id] }),
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogShell title="Members" onClose={onClose}>
      <div className="space-y-2">
        {(q.data?.members ?? []).map((m: any) => (
          <div key={m.user_id} className="flex items-center gap-2 text-sm">
            <div className="flex-1">
              <div>{m.profiles?.display_name ?? m.user_id.slice(0, 8)}</div>
              <div className="text-xs text-muted-foreground">{m.role}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => rmM.mutate(m.user_id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
        <div className="border-t border-border pt-2">
          <Label className="text-xs">Add user by ID</Label>
          <div className="flex gap-2">
            <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="uuid" />
            <Button onClick={() => newId && addM.mutate(newId)} disabled={!newId}>
              Add
            </Button>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

function ThreadSettingsDialog({
  thread,
  tenantId,
  onClose,
}: {
  thread: any;
  tenantId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(thread.name ?? "");
  const [topic, setTopic] = useState(thread.topic ?? "");
  const [retention, setRetention] = useState(thread.retention_days ?? 3650);
  const [archived, setArchived] = useState(!!thread.is_archived);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await executeAction("ficia.messenger.thread.update", {
        run: () =>
          updateThread({
            data: {
              thread_id: thread.id,
              name: name || undefined,
              topic: topic || null,
              retention_days: retention,
              is_archived: archived,
            },
          }),
        tenantId,
      });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <DialogShell title="Thread settings" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Topic</Label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div>
          <Label>Retention (days)</Label>
          <Input
            type="number"
            min={1}
            max={3650}
            value={retention}
            onChange={(e) => setRetention(Number(e.target.value))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />{" "}
          Archive thread
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}

function CrossCompanyDialog({
  thread,
  tenantId,
  onClose,
}: {
  thread: any;
  tenantId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["msg_grants", thread.id],
    queryFn: () => listCrossCompanyGrants({ data: { thread_id: thread.id } }),
  });
  const [otherTenant, setOtherTenant] = useState("");
  const [reason, setReason] = useState("");
  const reqM = useMutation({
    mutationFn: async () =>
      executeAction("ficia.messenger.cross_company.request", {
        run: () =>
          requestCrossCompanyGrant({
            data: {
              thread_id: thread.id,
              from_tenant_id: tenantId,
              to_tenant_id: otherTenant,
              reason,
            },
          }),
        confirmed: true,
        tenantId,
      }),
    onSuccess: () => {
      setOtherTenant("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["msg_grants", thread.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const decideM = useMutation({
    mutationFn: async ({
      id,
      decision,
    }: {
      id: string;
      decision: "approve" | "reject" | "revoke";
    }) =>
      executeAction("ficia.messenger.cross_company.decide", {
        run: () => decideCrossCompanyGrant({ data: { grant_id: id, decision } }),
        confirmed: true,
        tenantId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["msg_grants", thread.id] }),
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogShell title="Cross-company access" onClose={onClose}>
      <div className="text-xs text-muted-foreground mb-3">
        Cross-company threads require explicit approval from both participating companies. Every
        grant is recorded in the compliance audit.
      </div>
      <div className="space-y-2 mb-3">
        {(q.data?.grants ?? []).map((g: any) => (
          <div key={g.id} className="p-2 rounded border border-border text-sm">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                {g.from_tenant?.name} → {g.to_tenant?.name}
              </div>
              <Chip
                variant={
                  g.status === "active"
                    ? "success"
                    : g.status === "pending_to"
                      ? "warning"
                      : "danger"
                }
              >
                {g.status}
              </Chip>
            </div>
            {g.reason && <div className="text-xs text-muted-foreground mt-1">{g.reason}</div>}
            <div className="mt-1 flex gap-1">
              {g.status === "pending_to" && g.to_tenant_id === tenantId && (
                <>
                  <Button
                    size="sm"
                    onClick={() => decideM.mutate({ id: g.id, decision: "approve" })}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => decideM.mutate({ id: g.id, decision: "reject" })}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </>
              )}
              {g.status === "active" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => decideM.mutate({ id: g.id, decision: "revoke" })}
                >
                  Revoke
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-3 space-y-2">
        <Label>Request access from another company</Label>
        <Input
          value={otherTenant}
          onChange={(e) => setOtherTenant(e.target.value)}
          placeholder="Other company tenant ID"
        />
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
        <Button onClick={() => reqM.mutate()} disabled={!otherTenant || reqM.isPending}>
          Request
        </Button>
      </div>
    </DialogShell>
  );
}

function LinkDialog({
  messageId,
  tenantId,
  onClose,
  onSaved,
}: {
  messageId: string;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<
    "task" | "approval" | "timesheet" | "evidence" | "invoice" | "expense" | "filing" | "signature"
  >("task");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await executeAction("ficia.messenger.link_action", {
        run: () =>
          linkMessage({
            data: {
              message_id: messageId,
              link_kind: kind,
              target_ref: ref || undefined,
              note: note || undefined,
            },
          }),
        tenantId,
      });
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <DialogShell title="Link message" onClose={onClose}>
      <div className="space-y-2">
        <div>
          <Label>Kind</Label>
          <select
            aria-label="Link kind"
            className="w-full h-9 rounded border border-border bg-background px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            {[
              "task",
              "approval",
              "timesheet",
              "evidence",
              "invoice",
              "expense",
              "filing",
              "signature",
            ].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Reference (id, invoice #, etc.)</Label>
          <Input value={ref} onChange={(e) => setRef(e.target.value)} />
        </div>
        <div>
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="text-xs text-muted-foreground">
          Private / DM messages cannot be linked as company evidence, filing or signature.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Link"}
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}

function ConvertApprovalDialog({
  messageId,
  tenantId,
  onClose,
  onDone,
}: {
  messageId: string;
  tenantId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [subject, setSubject] = useState<
    "expense" | "invoice" | "payroll" | "tax" | "files" | "payments" | "signatures" | "export"
  >("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState("INR");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await executeAction("ficia.messenger.convert_approval", {
        run: () =>
          convertMessageToApproval({
            data: {
              message_id: messageId,
              tenant_id: tenantId,
              subject,
              title: title.trim(),
              amount: amount ? Number(amount) : undefined,
              currency: amount ? currency : undefined,
            },
          }),
        confirmed: true,
        tenantId,
      });
      toast.success("Approval request created.");
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <DialogShell title="Convert message to approval" onClose={onClose}>
      <div className="space-y-2">
        <div>
          <Label>Subject</Label>
          <select
            aria-label="Approval subject"
            className="w-full h-9 rounded border border-border bg-background px-2 text-sm"
            value={subject}
            onChange={(e) => setSubject(e.target.value as typeof subject)}
          >
            {[
              "expense",
              "invoice",
              "payroll",
              "tax",
              "files",
              "payments",
              "signatures",
              "export",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Vendor advance ₹50,000"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Amount (optional)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Currency</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
            />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Only messages in company or cross-company threads can become approvals. Uses the tenant's
          active approval policy for the subject.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !title.trim()}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create request"}
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}
