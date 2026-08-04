import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Menu } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { CANIA_SECTIONS } from "@/lib/cania-sections";
import { cn } from "@/lib/utils";

/**
 * CANIA shell — sidebar navigation for every intelligence surface, plus a
 * page header that stays consistent across sections. Each child leaf owns
 * its own DataCard grid and provider states.
 */
export function CaniaLayout() {
  const location = useLocation();
  const [openMobile, setOpenMobile] = useState(false);

  const groups = useMemo(
    () => ({
      overview: CANIA_SECTIONS.filter((s) => s.id === "overview"),
      signals: CANIA_SECTIONS.filter((s) => !s.adminOnly && s.id !== "overview"),
      tools: CANIA_SECTIONS.filter((s) => s.adminOnly),
    }),
    [],
  );

  const currentSlug =
    location.pathname.replace(/\/+$/, "").split("/cania")[1]?.replace(/^\//, "") ?? "";
  const current = CANIA_SECTIONS.find((s) => s.slug === currentSlug) ?? CANIA_SECTIONS[0];

  return (
    <AppShell>
      <PageHeader
        eyebrow="CANIA — World intelligence center"
        title={current.title}
        description={current.description}
        actions={<StatusBadge status="setup_required" />}
      />
      <div className="mt-6 flex flex-col gap-4 lg:flex-row">
        <aside className="lg:w-60 lg:shrink-0">
          <button
            type="button"
            onClick={() => setOpenMobile((v) => !v)}
            className="mb-2 inline-flex w-full items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm lg:hidden"
          >
            <span className="inline-flex items-center gap-2">
              <Menu className="h-4 w-4" aria-hidden />
              CANIA sections
            </span>
            <span className="text-muted-foreground">{current.title}</span>
          </button>
          <GlassPanel className={cn("p-2 lg:block", openMobile ? "block" : "hidden")}>
            <NavGroup
              label="Overview"
              items={groups.overview}
              onNavigate={() => setOpenMobile(false)}
            />
            <NavGroup
              label="Signals"
              items={groups.signals}
              onNavigate={() => setOpenMobile(false)}
            />
            <NavGroup label="Manage" items={groups.tools} onNavigate={() => setOpenMobile(false)} />
          </GlassPanel>
        </aside>

        <section className="min-w-0 flex-1">
          <Outlet />
        </section>
      </div>
    </AppShell>
  );
}

function NavGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: typeof CANIA_SECTIONS;
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="px-1 py-2">
      <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <ul className="flex flex-col gap-0.5">
        {items.map((s) => {
          const Icon = s.icon;
          const to = s.slug === "" ? "/cania" : `/cania/${s.slug}`;
          return (
            <li key={s.id}>
              <Link
                to={to}
                onClick={onNavigate}
                activeOptions={{ exact: true }}
                activeProps={{ "data-active": "true" }}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground data-[active=true]:bg-accent/60 data-[active=true]:text-foreground"
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{s.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
