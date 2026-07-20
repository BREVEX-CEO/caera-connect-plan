import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { EmptyState } from "@/components/shell/EmptyState";

export const Route = createFileRoute("/_authenticated/ocade")({
  head: () => ({
    meta: [
      { title: "OCADE — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OcadePage,
});

function OcadePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="OCADE by CAERA CADANE"
        title="Your assistant, projects and files"
        description="OCADE is your private coworker. Chat with local or cloud models — you always see which mode is active."
        actions={<StatusBadge status="planned" />}
      />
      <div className="mt-6 grid gap-4">
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" aria-hidden />}
          title="Chat surface ships in the next slice"
          description="OCADE will always introduce itself as “OCADE by CAERA CADANE” and never reveal the underlying provider. The chat window, projects, files, prompt improvement and model routing arrive with the P10 slice."
        />
        <GlassPanel className="p-5">
          <h3 className="text-sm font-semibold text-foreground">What's ready today</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Your account, profile and privacy mode are provisioned.</li>
            <li>Feature registry entries for chat, models and copilot are in place.</li>
            <li>AI gateway is configured server-side so no user API key is required.</li>
          </ul>
        </GlassPanel>
      </div>
    </AppShell>
  );
}
