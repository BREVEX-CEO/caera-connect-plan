import { QualityControl } from "@/lib/intelligence/QualityControl";
/**
 * The OCADE JARVIS workspace: a compact rail, the conversation and the composer.
 *
 * Send opens a task on the chosen paired computer through the server task
 * authority; the task panel follows it, with STOP, Take Over, Resume and step
 * confirmation. JARVIS's own answer is written into the conversation by the
 * server when the task settles, so history is the same whoever is watching.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUp,
  Menu,
  MessageSquare,
  MessagesSquare,
  Mic,
  LibraryBig,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { useFollowBottom } from "@/lib/use-follow-bottom";
import { Prose } from "@/components/chat/MessageList";
import { useSettingsPanel } from "@/components/settings/settings-panel";
import { loadChatMessages } from "@/lib/ocade-chat-store";
import { cn, typedBeforeHydration } from "@/lib/utils";
import { useJarvisPreferences, readPreferences, writePreferences } from "./preferences";
import { SectionPanel, TaskPanel, type Section } from "./JarvisPanels";
import { takeHandOff } from "./bubble-state";
import { appendOcadeMessage, createConversation } from "@/lib/ocade.functions";
import {
  getJarvisTask,
  latestJarvisTask,
  listJarvisDevices,
  startJarvisTask,
} from "@/lib/jarvis/functions";

const OPEN_STATUSES = ["running", "waiting", "taken_over"];

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "conversations", label: "Conversations", icon: MessagesSquare },
];

export function JarvisWorkspace({
  conversationId,
  ask,
}: {
  conversationId: string | null;
  /** Words a Shortcut opened JARVIS with: they wait in the box. */
  ask?: string;
}) {
  const { user, loading } = useSession();
  const signedIn = Boolean(user);
  const navigate = useNavigate();
  const settings = useSettingsPanel();
  const prefs = useJarvisPreferences();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  // Words typed while the page was still loading, or carried from Chat, stay in the box.
  useEffect(() => {
    const typed = typedBeforeHydration("jarvis-composer") || takeHandOff()?.text;
    if (typed) setDraft((current) => current || typed);
  }, []);
  // Taken once and dropped from the address, so a reload or Back does not type it again.
  const asked = useRef(false);
  useEffect(() => {
    if (!ask?.trim() || asked.current) return;
    asked.current = true;
    setDraft((current) => current || ask.replace(/\s+/g, " ").trim().slice(0, 1000));
    void navigate({
      to: "/ocade-jarvis",
      search: (previous) => ({ ...previous, ask: undefined }),
      replace: true,
    });
  }, [ask, navigate]);
  const [section, setSection] = useState<Section | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ONE OWNER for everything on screen: this account and this conversation.
  const owner = `${user?.id ?? ""}:${conversationId ?? ""}`;
  const [transcript, setTranscript] = useState<"ready" | "loading" | "failed">("ready");
  const [reloads, setReloads] = useState(0);
  useEffect(() => {
    setTurns([]);
    if (!conversationId || !user) {
      setTranscript("ready");
      return;
    }
    setTranscript("loading");
    let current = true;
    loadChatMessages({ conversationId })
      .then((rows) => {
        if (!current) return;
        setTurns(
          rows
            .filter((r) => r.role === "user" || r.role === "assistant")
            .map((r) => ({ id: r.id, role: r.role as Turn["role"], content: r.content })),
        );
        setTranscript("ready");
      })
      .catch(() => current && setTranscript("failed"));
    return () => {
      current = false;
    };
    // The owner string is the whole identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, reloads]);

  // The phone drawer closes with Escape, whatever section is open inside it.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const queryClient = useQueryClient();
  const devices = useQuery({
    queryKey: ["jarvis", "devices"],
    queryFn: () => listJarvisDevices(),
    enabled: signedIn,
  });
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const device = devices.data?.find((d) => d.id === deviceId) ?? devices.data?.[0] ?? null;
  const latest = useQuery({
    queryKey: ["jarvis", "latest", conversationId],
    queryFn: () => latestJarvisTask({ data: { conversationId: conversationId! } }),
    enabled: signedIn && Boolean(conversationId),
  });
  const taskId = latest.data?.taskId ?? null;
  // Bounded polling while a task is open; the server, not this tab, holds the task.
  const task = useQuery({
    queryKey: ["jarvis", "task", taskId],
    queryFn: () => getJarvisTask({ data: { taskId: taskId! } }),
    enabled: Boolean(taskId),
    refetchInterval: (query) =>
      query.state.data && OPEN_STATUSES.includes(query.state.data.status) ? 2_000 : false,
  });
  const taskOpen = Boolean(task.data && OPEN_STATUSES.includes(task.data.status));
  // When a task settles, its answer is in the conversation: read it again.
  const settled = task.data && !taskOpen ? task.data.status : null;
  useEffect(() => {
    if (settled) setReloads((n) => n + 1);
  }, [settled]);
  const [sending, setSending] = useState(false);

  const send = async () => {
    const objective = draft.trim();
    if (!objective || !device || sending) return;
    setSending(true);
    try {
      const conversation =
        conversationId ??
        (await createConversation({ data: { surface: "jarvis", title: objective.slice(0, 80) } }))
          .id;
      await appendOcadeMessage({
        data: { conversationId: conversation, role: "user", content: objective },
      });
      await startJarvisTask({
        data: { conversationId: conversation, deviceId: device.id, objective },
      });
      setDraft("");
      if (conversation !== conversationId) {
        void navigate({ to: "/ocade-jarvis", search: { c: conversation } });
      } else {
        setReloads((n) => n + 1);
      }
      void queryClient.invalidateQueries({ queryKey: ["jarvis"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "JARVIS could not start that.");
    } finally {
      setSending(false);
    }
  };

  const bottom = useRef<HTMLDivElement>(null);
  const followScroll = useFollowBottom(bottom, `${turns.length}`, `${conversationId}`);
  const sendBlockedReason = !signedIn
    ? null
    : loading || devices.isPending
      ? "Loading your account…"
      : !device
        ? "Pair a computer in Settings › Devices to give JARVIS somewhere to work."
        : taskOpen
          ? "JARVIS is working on a task in this conversation."
          : sending
            ? "Starting…"
            : null;

  const rail = (mobile: boolean, expanded = mobile || prefs.railExpanded) => (
    <nav
      aria-label="JARVIS"
      className={cn(
        "flex h-full flex-col gap-1 border-r border-border/60 bg-background/80 p-2",
        expanded ? "w-56" : "w-14",
      )}
    >
      <Link
        to="/"
        aria-label={expanded ? undefined : "Chat"}
        title="Chat"
        className="flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <MessageSquare className="h-[18px] w-[18px] shrink-0" aria-hidden />
        {expanded ? <span className="truncate">Chat</span> : null}
      </Link>
      <RailButton
        icon={PenSquare}
        label="New conversation"
        expanded={expanded}
        onClick={() => {
          setDrawerOpen(false);
          void navigate({ to: "/ocade-jarvis", search: {} });
        }}
      />
      <div className="my-1 h-px bg-border/60" />
      {SECTIONS.map(({ id, label, icon }) => (
        <RailButton
          key={id}
          icon={icon}
          label={label}
          expanded={expanded}
          active={section === id}
          onClick={() => setSection((current) => (current === id ? null : id))}
        />
      ))}
      <Link
        to="/library"
        aria-label={expanded ? undefined : "Files"}
        title="Files"
        className="flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <LibraryBig className="h-[18px] w-[18px] shrink-0" aria-hidden />
        {expanded ? <span className="truncate">Files</span> : null}
      </Link>
      <div className="flex-1" />
      <RailButton
        icon={Settings}
        label="Settings"
        expanded={expanded}
        onClick={() => {
          setDrawerOpen(false);
          settings.open();
        }}
      />
      {mobile ? null : (
        <RailButton
          icon={prefs.railExpanded ? PanelLeftClose : PanelLeftOpen}
          label={prefs.railExpanded ? "Collapse" : "Expand"}
          expanded={prefs.railExpanded}
          onClick={() =>
            writePreferences({ ...readPreferences(), railExpanded: !prefs.railExpanded })
          }
        />
      )}
      {signedIn ? null : (
        <Link
          to="/auth"
          search={{ next: "/ocade-jarvis" }}
          className="mt-1 flex h-9 items-center justify-center rounded-md bg-primary px-2 text-sm font-medium text-primary-foreground"
        >
          Sign in
        </Link>
      )}
    </nav>
  );

  const sectionPanel = section ? (
    <SectionPanel
      section={section}
      signedIn={signedIn}
      activeConversation={conversationId}
      onClose={() => setSection(null)}
      onOpenConversation={(id) => {
        setDrawerOpen(false);
        void navigate({ to: "/ocade-jarvis", search: id ? { c: id } : {} });
      }}
    />
  ) : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <a href="#jarvis-composer" className="skip-link">
        Skip to the message box
      </a>
      <div className="hidden h-full md:flex">
        {rail(false)}
        {sectionPanel}
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative flex h-full max-w-full overflow-x-auto bg-background">
            {rail(true)}
            {sectionPanel}
          </div>
        </div>
      ) : null}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-2 px-3">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent md:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden />
          </button>
          <h1 className="text-sm font-medium tracking-wide">OCADE JARVIS</h1>
          <div className="flex-1" />
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <section
            aria-label="Conversation"
            onScroll={followScroll}
            className="ocade-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4"
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-4 pt-4">
              {transcript === "loading" ? (
                <div role="status" aria-label="Opening the conversation" className="space-y-3">
                  <div className="ocade-skeleton ml-auto h-9 w-2/5 rounded-2xl" />
                  <div className="ocade-skeleton h-16 w-3/4 rounded-2xl" />
                  <div className="ocade-skeleton ml-auto h-9 w-1/3 rounded-2xl" />
                </div>
              ) : transcript === "failed" ? (
                <div className="mt-[24vh] flex flex-col items-center gap-3 text-center text-sm">
                  <p className="text-muted-foreground">This conversation could not be opened.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReloads((n) => n + 1)}
                      className="rounded-full border border-border px-4 py-1.5 hover:bg-accent"
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={() => void navigate({ to: "/ocade-jarvis", search: {} })}
                      className="rounded-full bg-foreground px-4 py-1.5 text-background"
                    >
                      New conversation
                    </button>
                  </div>
                </div>
              ) : null}
              {transcript === "ready" && turns.length === 0 ? (
                <div className="mt-[22vh] text-center">
                  <h2 className="text-2xl font-semibold tracking-tight">What should JARVIS do?</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Describe the outcome. JARVIS works on your paired computer and checks the
                    result.
                  </p>
                </div>
              ) : null}
              {/* A question is a compact bubble; an answer is prose to read, as in Chat. */}
              {turns.map((turn) =>
                turn.role === "user" ? (
                  <p
                    key={turn.id}
                    className="max-w-[85%] self-end whitespace-pre-wrap rounded-3xl bg-secondary px-4 py-2.5 text-[15px] leading-relaxed text-secondary-foreground"
                  >
                    {turn.content}
                  </p>
                ) : (
                  <div key={turn.id} className="self-stretch text-[15px] leading-relaxed">
                    <Prose text={turn.content} />
                  </div>
                ),
              )}
              <div ref={bottom} />
            </div>
          </section>
        </div>

        <div className="px-3 pb-3">
          {task.data ? (
            <TaskPanel
              task={task.data}
              onChanged={() => void queryClient.invalidateQueries({ queryKey: ["jarvis"] })}
            />
          ) : null}
          <div className="mx-auto max-w-2xl">
            <div className="flex flex-wrap items-start justify-between gap-x-3">
              <QualityControl value="standard" onChange={() => undefined} disabled />
              {(devices.data?.length ?? 0) > 1 ? (
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  Computer
                  <select
                    value={device?.id ?? ""}
                    onChange={(event) => setDeviceId(event.target.value)}
                    className="rounded-md border border-border bg-transparent px-1 py-0.5"
                  >
                    {devices.data!.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!signedIn) void navigate({ to: "/auth", search: { next: "/ocade-jarvis" } });
                else void send();
              }}
              className="glass-strong relative flex items-end gap-2 rounded-[28px] p-2 pl-3 shadow-sm transition-shadow focus-within:shadow-md"
            >
              <label htmlFor="jarvis-composer" className="sr-only">
                Message JARVIS
              </label>
              <textarea
                id="jarvis-composer"
                value={draft}
                rows={1}
                maxLength={8000}
                placeholder={signedIn ? "What should JARVIS do?" : "Sign in to talk to JARVIS"}
                onChange={(event) => setDraft(event.target.value)}
                className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                aria-label="Start voice"
                disabled
                title="Voice is not available in JARVIS yet"
                className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground disabled:opacity-40"
              >
                <Mic className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="submit"
                aria-label={signedIn ? "Send" : "Sign in to send"}
                disabled={Boolean(sendBlockedReason)}
                aria-describedby={sendBlockedReason ? "jarvis-send-status" : undefined}
                title={sendBlockedReason ?? undefined}
                className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
            </form>
            {sendBlockedReason ? (
              <p
                id="jarvis-send-status"
                role="status"
                className="mt-2 text-xs text-muted-foreground"
              >
                {sendBlockedReason}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  expanded,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  expanded: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? undefined : label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {expanded ? <span className="truncate">{label}</span> : null}
    </button>
  );
}
