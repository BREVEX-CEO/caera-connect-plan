/** The rail's Conversations, and JARVIS's place in Settings. */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import { deleteConversation, listConversations } from "@/lib/ocade.functions";
import { toast } from "sonner";
import { useSession } from "@/lib/session";

export type Section = "conversations";

const when = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

export function SectionPanel({
  section,
  signedIn,
  activeConversation,
  onClose,
  onOpenConversation,
}: {
  section: Section;
  signedIn: boolean;
  activeConversation: string | null;
  onClose: () => void;
  onOpenConversation: (id: string | null) => void;
}) {
  return (
    <aside
      aria-label="Conversations"
      className="flex h-full w-72 max-w-[80vw] flex-col border-r border-border/60 bg-background/90"
    >
      <div className="flex h-12 items-center justify-between px-3">
        <h2 className="text-sm font-medium">Conversations</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="ocade-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3 text-sm">
        {!signedIn ? (
          <p className="text-muted-foreground">Sign in to see your {section}.</p>
        ) : (
          <Conversations
            activeConversation={activeConversation}
            onOpenConversation={onOpenConversation}
          />
        )}
      </div>
    </aside>
  );
}

/** Past JARVIS conversations: readable, searchable and deletable. */
function Conversations({
  activeConversation,
  onOpenConversation,
}: {
  activeConversation: string | null;
  onOpenConversation: (id: string | null) => void;
}) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [find, setFind] = useState("");
  const queryKey = ["jarvis", "conversations", user?.id ?? ""];
  const conversations = useQuery({
    queryKey,
    queryFn: () => listConversations({ data: { surface: "jarvis" } }),
  });
  if (conversations.isPending) return null;
  if (conversations.isError) {
    return <p className="text-muted-foreground">Your conversations could not be loaded.</p>;
  }
  const list = conversations.data.filter((c) => !c.archived);
  if (list.length === 0) return <p className="text-muted-foreground">Nothing here yet.</p>;
  const wanted = find.trim().toLowerCase();
  const shown = wanted ? list.filter((c) => c.title.toLowerCase().includes(wanted)) : list;
  return (
    <>
      <input
        type="search"
        value={find}
        onChange={(event) => setFind(event.target.value)}
        placeholder="Search conversations"
        aria-label="Search conversations"
        className="mb-2 h-8 w-full rounded-md border border-border bg-transparent px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {shown.length === 0 ? (
        <p className="text-muted-foreground">No conversation matches.</p>
      ) : null}
      <ul className="flex flex-col gap-0.5">
        {shown.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenConversation(item.id)}
              aria-current={item.id === activeConversation ? "true" : undefined}
              className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left hover:bg-accent"
            >
              <span className="block truncate">{item.title}</span>
              <span className="block text-xs text-muted-foreground">{when(item.updated_at)}</span>
            </button>
            <button
              type="button"
              aria-label={`Delete ${item.title}`}
              onClick={() => {
                if (!window.confirm("Delete this conversation for good?")) return;
                void deleteConversation({ data: { id: item.id } })
                  .then(() => {
                    void queryClient.invalidateQueries({ queryKey });
                    if (item.id === activeConversation) onOpenConversation(null);
                  })
                  .catch(() => toast.error("That conversation could not be deleted."));
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Settings > Devices: device control is retired with the old JARVIS engine. */
export function JarvisAccess() {
  return (
    <p className="text-sm text-muted-foreground">
      Connecting computers and phones to OCADE JARVIS is unavailable while JARVIS is being rebuilt.
      Data JARVIS already holds stays in your account under Privacy & Security.
    </p>
  );
}
