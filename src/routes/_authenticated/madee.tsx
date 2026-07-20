import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { StatusBadge } from "@/components/shell/StatusBadge";

export const Route = createFileRoute("/_authenticated/madee")({
  head: () => ({
    meta: [
      { title: "MADEE — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MadeePage,
});

function MadeePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="MADEE — Studio & Resume Builder"
        title="Build resumes and creative projects that stay yours"
        description="Resume projects save to your account. Edit anytime, on any approved device."
        actions={<StatusBadge status="planned" />}
      />
      <div className="mt-6">
        <EmptyState
          icon={<FileText className="h-6 w-6" aria-hidden />}
          title="The Studio ships in the next slice"
          description="Resume Builder templates, the AI editor and export tools arrive after OCADE chat. Foundation Alpha reserves your account, projects table and privacy settings for it."
        />
      </div>
    </AppShell>
  );
}
