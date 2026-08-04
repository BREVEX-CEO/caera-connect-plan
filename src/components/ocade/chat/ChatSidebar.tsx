import { useMemo, useState } from "react";
import { Search, Plus, MessageSquare, Pin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatConversationView } from "./chat-types";

/**
 * Conversation history.
 *
 * GROUPED BY WHEN, NOT PAGED. People look for a chat by remembering roughly
 * when they had it, so "Today / Yesterday / Previous 7 days / Older" is how it
 * is found. A flat reverse-chronological list makes anything older than a
 * handful of chats effectively unreachable.
 *
 * SEARCH FILTERS THE SAME LIST rather than replacing it with a results view,
 * so the groups stay recognisable and clearing the box returns you exactly
 * where you were.
 *
 * A row is a link plus a menu trigger, NOT a link containing a button —
 * nesting interactive elements breaks keyboard navigation and screen readers,
 * and is the single most common defect in interfaces shaped like this one.
 */

export interface ChatSidebarProps {
  conversations: ChatConversationView[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  /** Rendered as the row's overflow menu. Omitted rows simply have no menu. */
  renderRowMenu?: (conversation: ChatConversationView) => React.ReactNode;
  /** Extra navigation (projects, files, models, settings) under the list. */
  footer?: React.ReactNode;
  emptyLabel?: string;
}

type Bucket = { label: string; items: ChatConversationView[] };

const DAY = 24 * 60 * 60 * 1000;

export function groupConversations(
  conversations: ChatConversationView[],
  now = Date.now(),
): Bucket[] {
  const pinned: ChatConversationView[] = [];
  const today: ChatConversationView[] = [];
  const yesterday: ChatConversationView[] = [];
  const week: ChatConversationView[] = [];
  const older: ChatConversationView[] = [];

  for (const c of conversations) {
    if (c.pinned) {
      pinned.push(c);
      continue;
    }
    const at = Date.parse(c.updatedAt);
    // An unparseable date sorts into Older rather than crashing or vanishing.
    const age = Number.isFinite(at) ? now - at : Number.POSITIVE_INFINITY;
    if (age < DAY) today.push(c);
    else if (age < 2 * DAY) yesterday.push(c);
    else if (age < 7 * DAY) week.push(c);
    else older.push(c);
  }

  return [
    { label: "Pinned", items: pinned },
    { label: "Today", items: today },
    { label: "Yesterday", items: yesterday },
    { label: "Previous 7 days", items: week },
    { label: "Older", items: older },
  ].filter((b) => b.items.length > 0);
}

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  renderRowMenu,
  footer,
  emptyLabel = "No conversations yet.",
}: ChatSidebarProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.projectName ?? "").toLowerCase().includes(q),
    );
  }, [conversations, query]);

  const buckets = useMemo(() => groupConversations(filtered), [filtered]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={onNewChat}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[13px] font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New chat
        </button>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <label htmlFor="ocade-chat-search" className="sr-only">
            Search conversations
          </label>
          <input
            id="ocade-chat-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="h-8 w-full rounded-lg border border-border/60 bg-background/50 pl-8 pr-7 text-[13px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-[color:var(--accent-ocade)]/50"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      <nav aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {buckets.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
            {query ? `No chats match “${query}”.` : emptyLabel}
          </p>
        ) : (
          buckets.map((bucket) => (
            <section key={bucket.label} className="mb-3">
              <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {bucket.label}
              </h3>
              <ul className="space-y-0.5">
                {bucket.items.map((c) => {
                  const active = c.id === activeId;
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onSelect(c.id)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                        )}
                      >
                        {c.pinned ? (
                          <Pin
                            className="h-3 w-3 shrink-0 text-[color:var(--accent-ocade)]"
                            aria-hidden
                          />
                        ) : (
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1 truncate">{c.title || "New chat"}</span>
                      </button>
                      {renderRowMenu ? (
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          {renderRowMenu(c)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </nav>

      {footer ? <div className="border-t border-border/60 p-2">{footer}</div> : null}
    </div>
  );
}
