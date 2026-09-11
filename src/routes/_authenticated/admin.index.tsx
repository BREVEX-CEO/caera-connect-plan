import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Building2,
  ClipboardCheck,
  CreditCard,
  Gauge,
  LifeBuoy,
  Rocket,
  Siren,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { requireAdminRole } from "@/lib/admin/route-gate";

/**
 * ADMINISTRATION — the route PLAN.md §4 names, which did not exist.
 *
 * Four admin screens were reachable only by typing their full paths. §4's table
 * gives `/admin` as the Administration area, and an area whose entrance is
 * missing is an area only the person who wrote it can find.
 *
 * IT IS A DIRECTORY, NOT A DASHBOARD. A dashboard here would have to summarise
 * accounts, tickets and gate state on one screen, which means four queries a
 * person did not ask for and a number that is stale the moment it renders. What
 * an administrator wants from `/admin` is to get to the right screen; the
 * screens themselves already hold their own truth.
 *
 * THE GATE IS THE SHARED ONE. `requireAdminRole` is the single authority every
 * `/admin/*` route uses, so adding a screen here cannot accidentally add one
 * without a check.
 */
export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Administration — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: () => requireAdminRole("the administration area"),
  component: AdminIndexPage,
});

const AREAS = [
  {
    to: "/organization",
    label: "Organizations",
    icon: Building2,
    detail: "Members, roles, invitations and groups for the workspaces you administer.",
  },
  {
    to: "/admin/users",
    label: "Accounts",
    icon: Users,
    detail: "Every account, its roles, and the support cases attached to it.",
  },
  {
    to: "/admin/operations",
    label: "Operations",
    icon: Gauge,
    detail:
      "Allowance windows, the organization audit log, and whether notifications are arriving.",
  },
  {
    to: "/admin/billing",
    label: "Billing",
    icon: CreditCard,
    detail:
      "Subscriptions, payment events, invoices, seats per organization, and audited entitlement grants.",
  },
  {
    to: "/admin/status",
    label: "Status incidents",
    icon: Siren,
    detail: "Publish an incident or a maintenance window. Signed-out visitors read it immediately.",
  },
  {
    to: "/admin/help",
    label: "Help content",
    icon: BookOpen,
    detail: "Edit an answer or write a new one, as a draft or published, without a deploy.",
  },
  {
    to: "/admin/support",
    label: "Support queue",
    icon: LifeBuoy,
    detail: "Open customer cases, oldest and highest priority first.",
  },
  {
    to: "/admin/launch-gate",
    label: "Launch gate",
    icon: Rocket,
    detail: "What is still blocking launch, and who last moved it.",
  },
  {
    to: "/admin/payments-checklist",
    label: "Payments checklist",
    icon: ClipboardCheck,
    detail: "The payment scenarios that must pass before money can be taken.",
  },
] as const;

function AdminIndexPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="CARCC CADANE"
        title="Administration"
        description="Screens that act on other people's accounts. Every one of them is recorded."
      />
      <GlassPanel className="mt-6 divide-y divide-border/40">
        {AREAS.map((area) => (
          <Link
            key={area.to}
            to={area.to}
            className="flex items-start gap-3 p-4 transition-colors hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <area.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-foreground">{area.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                {area.detail}
              </span>
            </span>
          </Link>
        ))}
      </GlassPanel>
    </AppShell>
  );
}
