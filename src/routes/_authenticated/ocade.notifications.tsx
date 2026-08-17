import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Inbox, Settings } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { CapabilityBadge } from "@/components/capability/CapabilityBadge";

export const Route = createFileRoute("/_authenticated/ocade/notifications")({
  head: () => ({ meta: [{ title: "Notifications — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Notifications"
        description="Attention signals OCADE can substantiate. Background push delivery is not claimed until a real delivery service and permission grant exist."
      />
      <div className="mt-6 rounded-xl border border-border/60 bg-card/30 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-muted-foreground" aria-hidden /><h2 className="text-sm font-medium">Background push notifications</h2></div>
          <CapabilityBadge status="NOT_CONFIGURED" />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          No web-push, APNs, FCM, SMS or email notification channel is configured by this build. OCADE therefore does not promise an alert outside the open application.
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link to="/ocade/inbox" className="rounded-xl border border-border/60 p-4 transition hover:bg-accent/30"><div className="flex items-center gap-2 text-sm font-medium"><Inbox className="h-4 w-4" aria-hidden />Inbox</div><p className="mt-1 text-xs text-muted-foreground">See approvals, blocked work and terminal automation outcomes read from real run records.</p></Link>
        <Link to="/settings" className="rounded-xl border border-border/60 p-4 transition hover:bg-accent/30"><div className="flex items-center gap-2 text-sm font-medium"><Settings className="h-4 w-4" aria-hidden />Settings</div><p className="mt-1 text-xs text-muted-foreground">Review the permissions and preferences that are actually available.</p></Link>
      </div>
    </>
  );
}
