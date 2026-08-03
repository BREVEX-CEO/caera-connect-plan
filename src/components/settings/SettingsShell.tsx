import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, ExternalLink, Search, X } from "lucide-react";
import { SETTINGS_GROUPS } from "@/lib/settings-sections";
import { cn } from "@/lib/utils";

function slugToPath(slug: string) {
  return slug ? `/settings/${slug}` : "/settings";
}

function currentSlug(pathname: string): string {
  if (pathname === "/settings" || pathname === "/settings/") return "";
  const m = pathname.match(/^\/settings\/([^/]+)/);
  return m ? m[1] : "";
}

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const active = currentSlug(pathname);
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SETTINGS_GROUPS;
    return SETTINGS_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        const hay = [i.label, i.description, ...(i.keywords ?? [])].join(" ").toLowerCase();
        return hay.includes(q);
      }),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const onList = active === "" && (pathname === "/settings" || pathname === "/settings/");
  const isDetail = !onList;

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col md:flex-row md:gap-0">
      {/* Nav column: always visible on md+, on mobile only when on the list view */}
      <aside
        className={cn(
          "flex w-full flex-col border-b border-border/60 bg-sidebar/40 md:sticky md:top-12 md:h-[calc(100vh-3rem)] md:w-[260px] md:shrink-0 md:border-b-0 md:border-r",
          isDetail ? "hidden md:flex" : "flex",
        )}
      >
        <div className="border-b border-border/50 px-3 pb-3 pt-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Account
          </div>
          <h2 className="mt-0.5 text-[15px] font-semibold text-foreground">Settings</h2>
          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              aria-label="Search settings"
              className="h-8 w-full rounded-md border border-border/60 bg-background/70 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 ocade-scroll">
          {filteredGroups.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No settings match “{query}”.
            </p>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id} className="mb-3">
                <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                  {group.label}
                </div>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.slug === active;
                    const Icon = item.icon;
                    return (
                      <li key={item.slug || "__general__"}>
                        <Link
                          to={slugToPath(item.slug)}
                          className={cn(
                            "group flex h-8 items-center gap-2 rounded-md px-2 text-[13px] transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.status === "external" ? (
                            <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                          ) : item.status === "setup_required" ? (
                            <span
                              className="ml-1 rounded-sm bg-muted/50 px-1 py-[1px] text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
                              title="Setup Required"
                            >
                              Setup
                            </span>
                          ) : null}
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 opacity-0 transition-opacity",
                              isActive ? "opacity-70" : "group-hover:opacity-40",
                            )}
                            aria-hidden
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </nav>

        <div className="border-t border-border/50 px-3 py-2">
          <button
            onClick={() => navigate({ to: "/home" })}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden /> Close settings
          </button>
        </div>
      </aside>

      {/* Content panel */}
      <section
        aria-label="Settings content"
        className={cn("min-w-0 flex-1", onList ? "hidden md:block" : "block")}
      >
        <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8">
          <div className="mb-3 md:hidden">
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden /> All settings
            </Link>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
