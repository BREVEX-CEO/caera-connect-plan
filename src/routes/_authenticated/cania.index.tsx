import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { CANIA_SECTIONS } from "@/lib/cania-sections";
import { providersForSection } from "@/lib/cania-providers";

export const Route = createFileRoute("/_authenticated/cania/")({
  head: () => ({
    meta: [
      { title: "CANIA Overview — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const signals = CANIA_SECTIONS.filter((s) => !s.adminOnly && s.slug !== "");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        CANIA never fabricates live information. Each section below shows the
        provider adapters that can power it and the current setup status. Real
        data appears only after an operator connects the provider.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {signals.map((s) => {
          const Icon = s.icon;
          const providers = providersForSection(s.id);
          return (
            <Link
              key={s.id}
              to={`/cania/${s.slug}`}
              className="block"
            >
              <GlassPanel className="flex h-full flex-col gap-2 p-4 transition hover:border-border">
                <div className="flex items-start justify-between gap-2">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--accent-cania)]/15 text-[color:var(--accent-cania)]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <StatusBadge status="setup_required" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                </div>
                <div className="mt-auto text-[11px] text-muted-foreground">
                  {providers.length} adapter{providers.length === 1 ? "" : "s"} ready to connect
                </div>
              </GlassPanel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
