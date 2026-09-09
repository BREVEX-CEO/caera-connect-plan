import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  Download,
  FileCode2,
  FileOutput,
  FolderOpen,
  Keyboard,
  MonitorCog,
  Pencil,
  Pin,
  PinOff,
  Share2,
  Trash2,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatSidebar } from "./ChatSidebar";
import type { ChatConversationView } from "./chat-types";
import type { Conversation } from "./conversation-model";

/**
 * The rail beside Chat: recent conversations, and the few things a person does
 * to one of them.
 *
 * Extracted from the Chat route with the rows it renders — `SidebarLink`,
 * `StaticRow`, `ConvRow` and `IconMini` are only ever used here, and leaving
 * them in a six-thousand-line route file is what made the route impossible to
 * read. Behaviour is unchanged.
 */
export function OcadeContextualSidebar(props: {
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
  /** PLAN.md §8's share. Opens the dialog; nothing is published by opening it. */
  onShare: (c: Conversation) => void;
  /** PLAN.md §8's delete-all. Confirmed by typing, and it says what it spares. */
  onDeleteAll: () => void;
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
    onShare,
    onDeleteAll,
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
              <IconMini title="Share" onClick={() => onShare(c)}>
                <Share2 className="h-3 w-3" />
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
            <SidebarLink icon={MonitorCog} label="Cowork" to="/ocade/cowork" />
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
            {/*
              PLAN.md §8's delete-all, in the sidebar because that is where the
              history it clears is. Discoverable rather than buried in Settings:
              somebody who wants their chat history gone should not have to
              guess which of eleven settings pages owns it.
            */}
            <StaticRow icon={Trash2} label="Delete all chats" onClick={onDeleteAll} />
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
  to:
    "/ocade/cowork" | "/ocade/code" | "/ocade/projects" | "/ocade/artifacts" | "/ocade/automations";
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
