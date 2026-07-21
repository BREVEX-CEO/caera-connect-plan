import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Users, Receipt, LineChart, MessageCircle, Ban } from "lucide-react";
import { DemoShell } from "@/components/shell/DemoShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { useDemo } from "@/lib/demo/context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/demo/ficia")({
  component: DemoFicia,
});

type Tab = "dashboard" | "chat" | "timesheet" | "invoices" | "reports";

function DemoFicia() {
  const { state, addChatMessage } = useDemo();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [chatDraft, setChatDraft] = useState("");

  const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: "dashboard", label: "Dashboard", icon: Building2 },
    { id: "chat", label: "Company chat", icon: MessageCircle },
    { id: "timesheet", label: "Timesheet", icon: Users },
    { id: "invoices", label: "Invoices", icon: Receipt },
    { id: "reports", label: "Reports", icon: LineChart },
  ];

  return (
    <DemoShell>
      <PageHeader
        eyebrow="FICIA — commerce demo"
        title={state.company.name}
        description={`${state.company.entity} · ${state.company.country} · ${state.company.currency} · FY starts ${state.company.fyStart}`}
        actions={<StatusBadge status="active" />}
      />

      <div className="mt-6 flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1 text-xs">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {tab === "dashboard" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {state.reports.map((r) => (
              <GlassPanel key={r.id} className="p-4">
                <div className="text-xs text-muted-foreground">{r.title}</div>
                <div className="mt-1 text-xl font-semibold text-foreground">{r.value}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{r.trend}</div>
              </GlassPanel>
            ))}
          </div>
        ) : null}

        {tab === "chat" ? (
          <GlassPanel className="flex h-[480px] flex-col overflow-hidden">
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {state.companyChat.map((m) => (
                <div key={m.id} className="max-w-[85%] rounded-2xl bg-muted/40 px-4 py-2 text-sm">
                  <div className="mb-0.5 text-[11px] font-semibold text-foreground/90">
                    {m.author} <span className="font-normal text-muted-foreground">· {m.ts}</span>
                  </div>
                  {m.body}
                </div>
              ))}
            </div>
            <div className="border-t border-border/60 p-3">
              <div className="flex gap-2">
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder="Message the team (demo — in-memory only)…"
                  className="flex-1 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => {
                    if (!chatDraft.trim()) return;
                    addChatMessage("You (Demo)", chatDraft.trim());
                    setChatDraft("");
                  }}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  Send
                </button>
              </div>
            </div>
          </GlassPanel>
        ) : null}

        {tab === "timesheet" ? (
          <GlassPanel className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/20 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Person</th>
                  <th className="px-4 py-2 text-left">Project</th>
                  <th className="px-4 py-2 text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {state.timesheet.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{r.date}</td>
                    <td className="px-4 py-2 text-foreground">{r.person}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.project}</td>
                    <td className="px-4 py-2 text-right text-foreground">{r.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassPanel>
        ) : null}

        {tab === "invoices" ? (
          <GlassPanel className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/20 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Invoice</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-right">Amount (₹)</th>
                  <th className="px-4 py-2 text-left">Due</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.invoices.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2 text-foreground">{r.id}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.customer}</td>
                    <td className="px-4 py-2 text-right text-foreground">{r.amount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.due}</td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          r.status === "Paid" && "bg-emerald-500/15 text-emerald-300",
                          r.status === "Overdue" && "bg-red-500/15 text-red-300",
                          r.status === "Sent" && "bg-blue-500/15 text-blue-300",
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-2 border-t border-border/60 p-3 text-xs text-muted-foreground">
              <Ban className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              Sending, e-invoice filing, digital signature and payment collection are disabled in demo.
            </div>
          </GlassPanel>
        ) : null}

        {tab === "reports" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {state.reports.map((r) => (
              <GlassPanel key={r.id} className="p-5">
                <div className="text-sm font-semibold text-foreground">{r.title}</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{r.value}</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sample report. FICIA financial reports use deterministic rules, not model arithmetic.
                </p>
              </GlassPanel>
            ))}
          </div>
        ) : null}
      </div>
    </DemoShell>
  );
}
