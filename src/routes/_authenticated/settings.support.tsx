import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Loader2, MessageSquarePlus, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { preflight } from "@/lib/edge/preflight";
import { cn } from "@/lib/utils";
import { LIST_CAP } from "@/lib/supabase/read-all";
import { useFormatters } from "@/lib/locale/use-formatters";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  last_message_at: string;
};

type SupportMessage = {
  id: string;
  author_role: string;
  body: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/settings/support")({
  head: () => ({
    meta: [{ title: "Support — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  component: SupportPage,
});

function unsafeSupportDetail(text: string): string | null {
  const sensitive = preflight(text).find((finding) => finding.severity !== "medium");
  return sensitive
    ? `Remove the ${sensitive.kind.replace(/_/g, " ")} before sending. Support never needs credentials or payment secrets.`
    : null;
}

function SupportPage() {
  const formatters = useFormatters();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("technical");
  const [detail, setDetail] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const tickets = useQuery({
    queryKey: ["support-tickets", "mine"],
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase
        .from("ocade_support_tickets")
        .select("id, subject, category, priority, status, last_message_at")
        .order("last_message_at", { ascending: false })
        .limit(LIST_CAP);
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

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
      return (data ?? []) as SupportMessage[];
    },
  });

  const selected = useMemo(
    () => tickets.data?.find((ticket) => ticket.id === selectedId) ?? null,
    [selectedId, tickets.data],
  );

  async function createTicket() {
    const supabase = await loadSupabaseClient();
    const warning = unsafeSupportDetail(`${subject}\n${detail}`);
    if (warning) return toast.error(warning);
    if (subject.trim().length < 5 || detail.trim().length < 2) {
      return toast.error("Add a short subject and describe what happened.");
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("ocade_create_support_ticket", {
        p_subject: subject.trim(),
        p_category: category,
        p_body: detail.trim(),
      });
      if (error) throw error;
      setSubject("");
      setDetail("");
      setCreating(false);
      setSelectedId(data);
      await qc.invalidateQueries({ queryKey: ["support-tickets", "mine"] });
      toast.success("Support request created. Its history stays here.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Support request could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    const supabase = await loadSupabaseClient();
    if (!selectedId) return;
    const warning = unsafeSupportDetail(reply);
    if (warning) return toast.error(warning);
    if (reply.trim().length < 2) return toast.error("Write a reply first.");
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sign in again before replying.");
      const { error } = await supabase.from("ocade_support_messages").insert({
        ticket_id: selectedId,
        author_id: auth.user.id,
        author_role: "customer",
        body: reply.trim(),
      });
      if (error) throw error;
      setReply("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["support-messages", selectedId] }),
        qc.invalidateQueries({ queryKey: ["support-tickets", "mine"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reply could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Customer support"
        description="Create a case, answer follow-up questions and keep the complete history with your account."
      />

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.35fr]">
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <LifeBuoy className="h-4 w-4" aria-hidden /> Your cases
            </h2>
            <Button size="sm" onClick={() => setCreating((value) => !value)}>
              <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" aria-hidden /> New case
            </Button>
          </div>

          {creating ? (
            <div className="mt-4 space-y-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={120}
                placeholder="Short subject"
                aria-label="Support subject"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Support category"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="account">Account</option>
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="privacy">Privacy</option>
                <option value="security">Security</option>
                <option value="feedback">Feedback</option>
                <option value="legal">Legal</option>
                <option value="investor">Investor</option>
                <option value="partnership">Partnership</option>
              </select>
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                maxLength={5000}
                rows={5}
                placeholder="What happened, what you expected, and the exact safe-to-share details"
                aria-label="Support details"
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <Button size="sm" disabled={busy} onClick={() => void createTicket()}>
                {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Create case
              </Button>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            {tickets.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {tickets.data?.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                aria-pressed={selectedId === ticket.id}
                onClick={() => setSelectedId(ticket.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  selectedId === ticket.id
                    ? "border-primary/45 bg-primary/[0.07]"
                    : "border-border/60 hover:bg-white/[0.03]",
                )}
              >
                <span className="block text-sm font-medium">{ticket.subject}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {ticket.category} · {ticket.status.replace(/_/g, " ")} · {ticket.priority}
                </span>
              </button>
            ))}
            {!tickets.isLoading && tickets.data?.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No support cases yet.
              </p>
            ) : null}
          </div>
        </GlassPanel>

        <GlassPanel className="flex min-h-[28rem] flex-col p-4">
          {selected ? (
            <>
              <div className="border-b border-border/60 pb-3">
                <h2 className="text-sm font-semibold">{selected.subject}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Case {selected.id.slice(0, 8).toUpperCase()} ·{" "}
                  {selected.status.replace(/_/g, " ")}
                </p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto py-4">
                {messages.data?.map((message) => (
                  <article
                    key={message.id}
                    className={cn(
                      "max-w-[88%] rounded-xl border px-3 py-2 text-sm",
                      message.author_role === "support"
                        ? "border-primary/30 bg-primary/[0.05]"
                        : "ml-auto border-border/60 bg-white/[0.025]",
                    )}
                  >
                    <p>{message.body}</p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {message.author_role === "support" ? "OCADE Support" : "You"} ·{` `}
                      {formatters.dateTime(message.created_at)}
                    </p>
                  </article>
                ))}
              </div>
              {selected.status !== "closed" ? (
                <div className="flex gap-2 border-t border-border/60 pt-3">
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    maxLength={5000}
                    rows={2}
                    placeholder="Reply with safe-to-share details"
                    aria-label="Support reply"
                    className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <Button size="icon" disabled={busy} onClick={() => void sendReply()}>
                    <Send className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Send reply</span>
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="m-auto max-w-sm text-center">
              <LifeBuoy className="mx-auto h-8 w-8 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold">Select a support case</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Replies and status changes appear here. The complete thread remains available as
                your copy.
              </p>
            </div>
          )}
        </GlassPanel>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl border border-[color:var(--state-warning-line)] bg-[color:var(--state-warning-wash)] p-3 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]" />
        Never send passwords, one-time codes, Aadhaar or PAN images, full card numbers, UPI PINs,
        recovery codes or API secrets. The composer blocks common credential formats locally before
        submission.
      </p>
    </>
  );
}
