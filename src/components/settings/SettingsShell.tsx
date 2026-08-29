import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, ExternalLink, Search, X } from "lucide-react";
import { SETTINGS_GROUPS } from "@/lib/settings-sections";
import { useSettingsAccess } from "./use-settings-access";
import { cn } from "@/lib/utils";

/** Where the opt-in for the Advanced group is remembered. */
const ADVANCED_KEY = "ocade.settings.advanced.v1";

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
  /*
   * WHERE "CLOSE" GOES DEPENDS ON WHETHER THERE IS AN ACCOUNT.
   *
   * Settings is deliberately readable signed out — that is the whole point of
   * `SettingsAccessProvider`. But this button navigated to `/home` for
   * everyone, and `/home` is auth-gated, so the one exit from the screen threw
   * a signed-out visitor into a sign-in wall with a hard document reload. The
   * product invites them in and then punishes them for leaving.
   *
   * Signed out, "close" means back to the public site.
   */
  const { canEdit: signedIn } = useSettingsAccess();

  /*
   * ADVANCED IS OPT-IN, AND STAYS OPTED IN.
   *
   * Remembered per device rather than per session: someone who turned it on to
   * reach Diagnostics should not have to find the switch again on their next
   * visit, and someone who never turns it on never sees eight engineering
   * sections presented as peers of "Voice".
   *
   * Reading storage inside the initialiser rather than in an effect keeps the
   * first paint correct — revealing the group a frame after the list has
   * already been drawn is a visible jump.
   */
  const [showAdvanced, setShowAdvanced] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(ADVANCED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleAdvanced = () => {
    setShowAdvanced((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(ADVANCED_KEY, next ? "1" : "0");
      } catch {
        /* Private browsing. The choice lasts this session, which is enough. */
      }
      return next;
    });
  };

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Searching reaches the advanced sections whether or not they are revealed:
    // someone typing "diagnostics" has already asked for it, and hiding the
    // answer to a direct search is how a settings screen earns a reputation for
    // not containing the thing you are looking for.
    const groups = SETTINGS_GROUPS.filter((g) => !g.advanced || showAdvanced || q.length > 0);
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => {
          const hay = [i.label, i.description, ...(i.keywords ?? [])].join(" ").toLowerCase();
          return hay.includes(q);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [query, showAdvanced]);

  const onList = active === "" && (pathname === "/settings" || pathname === "/settings/");
  const isDetail = !onList;

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col md:flex-row md:gap-0">
      {/* Nav column: always visible on md+, on mobile only when on the list view */}
      <aside
        className={cn(
          /*
            The navigation column is CHROME, so it sits on the floating plane —
            the same depth the workspace sidebar uses, which is what keeps
            settings feeling like part of the application rather than a page
            that happens to have a list down one side. Depth composes with
            sticky positioning: `position: sticky` is resolved before the
            transform, so the column still pins under the utility bar.
          */
          "ocade-depth depth-floating flex w-full flex-col border-b border-border/60 bg-sidebar/40 md:sticky md:top-12 md:h-[calc(100vh-3rem)] md:w-[260px] md:shrink-0 md:border-b-0 md:border-r",
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
                            // A row lifts a few pixels toward the viewer on
                            // hover and on focus. Nested inside the column's
                            // surface it inherits the tilt rather than doubling
                            // it, so the lift reads as the row rising out of
                            // the list instead of shearing against it.
                            "ocade-depth ocade-depth-lift depth-base",
                            "group flex h-8 items-center gap-2 rounded-md px-2 text-[13px] transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {/*
                            The "Setup" pill is gone with the sixteen
                            placeholder sections it labelled. A badge that says
                            a destination does not work yet is a queue of
                            promises rendered as navigation.
                          */}
                          {item.status === "external" ? (
                            <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
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

          {/*
            The one switch that reveals the engineering sections. Placed at the
            bottom, styled as a quiet line rather than a control, because it is
            not something an ordinary reader needs to decide about — it is a
            door for the people who already know they want it.
          */}
          {!query ? (
            <button
              type="button"
              onClick={toggleAdvanced}
              aria-pressed={showAdvanced}
              className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight
                className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-90")}
                aria-hidden
              />
              {showAdvanced ? "Hide advanced" : "Show advanced"}
            </button>
          ) : null}
        </nav>

        <div className="border-t border-border/50 px-3 py-2">
          <button
            onClick={() => navigate({ to: signedIn ? "/home" : "/" })}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden /> Close settings
          </button>
        </div>
      </aside>

      {/* Content panel */}
      <section
        aria-label="Settings content"
        className={cn(
          // Settings are a dense interactive form. Chromium can exclude controls
          // inside nested preserve-3d surfaces from pointer hit testing even while
          // painting them normally. Keep the raised shadow cue, but make this
          // subtree a deliberately flat, reliable interaction plane.
          "ocade-depth-cue ocade-interactive-plane depth-raised min-w-0 flex-1",
          onList ? "hidden md:block" : "block",
        )}
      >
        <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8">
          <div className="mb-3 md:hidden">
            <Link
              to="/settings"
              className="inline-flex min-h-[24px] items-center gap-1 px-1 py-1 text-xs text-muted-foreground hover:text-foreground"
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
