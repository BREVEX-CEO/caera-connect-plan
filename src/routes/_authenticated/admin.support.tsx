import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { requireAdminRole } from "@/lib/admin/route-gate";
import { cn } from "@/lib/utils";
import { LIST_CAP } from "@/lib/supabase/read-all";

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  last_message_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/support")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Support Queue — CARCC CADANE Admin" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: () => requireAdminRole("the customer support queue"),
  component: AdminSupportPage,
});

function AdminSupportPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const tickets = useQuery({
    queryKey: ["support-tickets", "admin"],
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase
        .from("ocade_support_tickets")
        .select("id, user_id, subject, category, priority, status, last_message_at")
        .order("priority", { ascending: false })
        .order("last_message_at", { ascending: true })
        .limit(LIST_CAP);
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

  const visible = useMemo(() => {
    const all = tickets.data ?? [];
    if (filter === "all") return all;
    if (filter === "active")
      return all.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
    return all.filter((ticket) => ticket.status === filter);
  }, [filter, tickets.data]);
  const selected = tickets.data?.find((ticket) => ticket.id === selectedId) ?? null;

  const messages = useQuery({
    queryKey: ["support-messages", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase
        .from("ocade_support_messages")
        .select("id, author_role, body, created_at")
        .eq("ticket_id", selectedId!)
        .order("created_at", { ascending: true })
        .limit(LIST_CAP);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function setStatus(status: string) {
    const supabase = await loadSupabaseClient();
    if (!selectedId) return;
    setBusy(true);
    const { error } = await supabase
      .from("ocade_support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", selectedId);
    setBusy(false);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["support-tickets", "admin"] });
  }

  async function sendReply() {
    const supabase = await loadSupabaseClient();
    if (!selectedId || reply.trim().length < 2) return;
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sign in again before replying.");
      const { error } = await supabase.from("ocade_support_messages").insert({
        ticket_id: selectedId,
        author_id: data.user.id,
        author_role: "support",
        body: reply.trim(),
      });
      if (error) throw error;
      setReply("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["support-messages", selectedId] }),
        qc.invalidateQueries({ queryKey: ["support-tickets", "admin"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reply could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Customer support queue"
        description="Sort cases, review the complete history, ask for safe details and close resolved work."
      />
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.4fr]">
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Inbox className="h-4 w-4" /> Queue ({visible.length})
            </h2>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
              aria-label="Filter support queue"
            >
              <option value="active">Active</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="needs_customer">Needs customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="mt-4 space-y-2">
            {visible.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                aria-pressed={selectedId === ticket.id}
                onClick={() => setSelectedId(ticket.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left",
                  selectedId === ticket.id
                    ? "border-primary/45 bg-primary/[0.06]"
                    : "border-border/60",
                )}
              >
                <span className="block text-sm font-medium">{ticket.subject}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {ticket.priority} · {ticket.category} · {ticket.status.replace(/_/g, " ")}
                </span>
              </button>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="flex min-h-[34rem] flex-col p-4">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <h2 className="text-sm font-semibold">{selected.subject}</h2>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {selected.id.slice(0, 8).toUpperCase()} · user {selected.user_id.slice(0, 8)}
                  </p>
                </div>
                <select
                  value={selected.status}
                  disabled={busy}
                  onChange={(event) => void setStatus(event.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  aria-label="Case status"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="needs_customer">Needs customer</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto py-4">
                {messages.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {messages.data?.map((message) => (
                  <article
                    key={message.id}
                    className={cn(
                      "max-w-[90%] rounded-xl border px-3 py-2 text-sm",
                      message.author_role === "support"
                        ? "ml-auto border-primary/30 bg-primary/[0.05]"
                        : "border-border/60",
                    )}
                  >
                    <p>{message.body}</p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {message.author_role} · {new Date(message.created_at).toLocaleString()}
                    </p>
                  </article>
                ))}
              </div>
              <div className="flex gap-2 border-t border-border/60 pt-3">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  maxLength={5000}
                  rows={3}
                  placeholder="Ask for the minimum safe details needed to resolve this case"
                  className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  aria-label="Support response"
                />
                <Button size="icon" disabled={busy} onClick={() => void sendReply()}>
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send support response</span>
                </Button>
              </div>
            </>
          ) : (
            <div className="m-auto text-center text-sm text-muted-foreground">Select a case.</div>
          )}
        </GlassPanel>
      </div>
    </AppShell>
  );
}
