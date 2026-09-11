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
import { useFormatters } from "@/lib/locale/use-formatters";

/** One message, as `ocade_read_support_case` returns it. */
type SupportCaseMessage = {
  id: string;
  ticket_id: string;
  author_role: string;
  body: string;
  created_at: string;
};

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
  const formatters = useFormatters();
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

  /*
   * READING A CASE IS AN ACT, NOT A QUERY.
   *
   * This used to select straight from `ocade_support_messages`, which worked
   * because any admin could read every message of every customer, for ever,
   * with no reason recorded. `PLAN.md` Phase 15 forbids exactly that. The read
   * now goes through `ocade_read_support_case`, which returns nothing unless a
   * case is open for this admin on this ticket and records one access event per
   * object it hands back. An empty answer here is not an error — it is what
   * "no case is open" looks like.
   */
  const messages = useQuery({
    queryKey: ["support-case", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase.rpc("ocade_read_support_case", {
        target_ticket: selectedId!,
      });
      if (error) throw error;
      return (data ?? []) as SupportCaseMessage[];
    },
  });

  /** The case this admin has open on the selected ticket, if any. */
  const openCase = useQuery({
    queryKey: ["support-grant", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase
        .from("ocade_support_grants")
        .select("id, reason, granted_at, expires_at")
        .eq("ticket_id", selectedId!)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });

  async function openCaseFor(ticketId: string) {
    const reason = window
      .prompt("Why do you need to read this customer's case? This is recorded.")
      ?.trim();
    if (!reason) return;
    if (reason.length < 10) {
      toast.error("Write a reason somebody could read back later — at least ten characters.");
      return;
    }
    setBusy(true);
    const supabase = await loadSupabaseClient();
    const { error } = await supabase.rpc("ocade_open_support_case", {
      target_ticket: ticketId,
      case_reason: reason,
      minutes: 60,
    });
    setBusy(false);
    if (error) {
      // The database refuses without a recent second factor, which is the
      // message worth passing on verbatim rather than rewording.
      toast.error(error.message);
      return;
    }
    toast.success("Case opened for one hour. What you read is recorded.");
    await qc.invalidateQueries({ queryKey: ["support-grant", ticketId] });
    await qc.invalidateQueries({ queryKey: ["support-case", ticketId] });
  }

  async function closeCase(grantId: string, ticketId: string) {
    setBusy(true);
    const supabase = await loadSupabaseClient();
    const { error } = await supabase.rpc("ocade_close_support_case", { grant_id: grantId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Case closed.");
    await qc.invalidateQueries({ queryKey: ["support-grant", ticketId] });
    await qc.invalidateQueries({ queryKey: ["support-case", ticketId] });
  }

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
              {/*
                THE CASE, AND WHETHER IT IS OPEN.
                Support content is not something a queue simply shows: it is a
                customer's own words, and reading them takes a reason, a clock
                and a record. This says which of those is missing rather than
                rendering an empty conversation and letting somebody conclude
                the customer never wrote anything.
              */}
              {openCase.data ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-[11px] text-muted-foreground">
                  <span>
                    Case open until {formatters.time(openCase.data.expires_at)} ·{" "}
                    {openCase.data.reason}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void closeCase(openCase.data!.id, selected.id)}
                    className="ml-auto rounded-md border border-border px-2 py-1 text-foreground"
                  >
                    Close case
                  </button>
                  <span className="w-full text-muted-foreground/80">
                    Every message you read here is recorded against this case.
                  </span>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-[11px] text-muted-foreground">
                  <span>
                    This customer&rsquo;s messages are closed. Opening the case needs a written
                    reason and a recent second factor, lasts an hour, and is recorded.
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void openCaseFor(selected.id)}
                    className="ml-auto rounded-md border border-border px-2 py-1 text-foreground"
                  >
                    Open case
                  </button>
                </div>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto py-4">
                {messages.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {!messages.isLoading && (messages.data?.length ?? 0) === 0 && !openCase.data ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing is shown because no case is open.
                  </p>
                ) : null}
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
                      {message.author_role} · {formatters.dateTime(message.created_at)}
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
