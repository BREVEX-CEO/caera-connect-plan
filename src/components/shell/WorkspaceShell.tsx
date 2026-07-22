import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  PanelLeft,
  ArrowLeft,
  ArrowRight,
  Search,
  Bell,
  Sun,
  Moon,
  Waves,
  PanelRight,
  X,
  LogIn,
  RotateCcw,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { DemoBadge } from "./DemoBadge";
import { ShellProvider, useShell } from "./shell-context";
import { cn } from "@/lib/utils";
import { useAppearance } from "@/lib/theme-provider";
import {
  MODULES,
  UTILITY,
  DEMO_MODULES,
  MODULE_CONTEXT,
  activeModule,
  type ModuleDef,
  type NavItem,
} from "@/lib/shell-nav";

const COLLAPSE_KEY = "caera:shell:collapsed";

export interface WorkspaceShellProps {
  children: ReactNode;
  variant?: "app" | "demo";
  /** Demo-only controls. */
  onDemoReset?: () => void;
  onDemoExit?: () => void;
}

/**
 * The one OCADE workspace shell (Plan §37).
 *
 * Structure: compact module rail → contextual navigation → spacious workspace →
 * adaptive Copilot panel. Chrome is deliberately neutral — graphite ground,
 * silver text, black structural lines, no coloured accent — so content leads.
 * Below `md` the sidebar becomes a drawer; the workspace never crowds.
 */
export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <ShellProvider>
      <WorkspaceShellInner {...props} />
    </ShellProvider>
  );
}

function WorkspaceShellInner({ children, variant = "app", onDemoReset, onDemoExit }: WorkspaceShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { theme, update } = useAppearance();
  const shell = useShell();
  const isDemo = variant === "demo";

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => setDrawerOpen(false), [pathname]);

  const modules: ModuleDef[] = isDemo ? DEMO_MODULES : MODULES;
  const current = activeModule(pathname);
  const contextItems: NavItem[] = isDemo ? [] : (MODULE_CONTEXT[current] ?? []);

  function cycleTheme() {
    const next = theme === "dark" ? "light" : theme === "light" ? "real" : "dark";
    void update({ theme: next });
  }
  const ThemeIcon = theme === "light" ? Sun : theme === "real" ? Waves : Moon;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Utility bar — compact, structural, no colour */}
      <header className="sticky top-0 z-40 flex h-12 items-center gap-1 border-b border-border/70 bg-background/95 px-2 backdrop-blur">
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) setDrawerOpen((v) => !v);
            else setCollapsed((v) => !v);
          }}
          aria-label="Toggle navigation"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <PanelLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="mx-1 hidden h-4 w-px bg-border/70 md:block" />
        <button
          onClick={() => typeof window !== "undefined" && window.history.back()}
          aria-label="Back"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:inline-flex"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          onClick={() => typeof window !== "undefined" && window.history.forward()}
          aria-label="Forward"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:inline-flex"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>

        {isDemo ? (
          <div className="ml-2 hidden h-8 max-w-md flex-1 items-center gap-2 rounded-md border border-border/70 bg-secondary/40 px-2.5 text-xs text-muted-foreground md:inline-flex">
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span>Search — available after sign-in</span>
          </div>
        ) : (
          <button
            onClick={() => navigate({ to: "/cania/search" })}
            className="ml-2 hidden h-8 max-w-md flex-1 items-center gap-2 rounded-md border border-border/70 bg-secondary/40 px-2.5 text-xs text-muted-foreground hover:bg-secondary md:inline-flex"
            aria-label="Search workspace"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span>Search workspace</span>
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          {isDemo ? <DemoBadge /> : null}
          <button
            onClick={cycleTheme}
            aria-label={`Theme: ${theme}. Change theme.`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ThemeIcon className="h-4 w-4" aria-hidden />
          </button>
          {isDemo ? (
            <Link
              to="/auth"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden /> Sign in
            </Link>
          ) : (
            <>
              <Link
                to="/settings/activity"
                aria-label="Activity and notifications"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Bell className="h-4 w-4" aria-hidden />
              </Link>
              {shell?.copilotContent ? (
                <button
                  onClick={() => shell.setCopilotOpen(!shell.copilotOpen)}
                  aria-label="Toggle Copilot panel"
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-md",
                    shell.copilotOpen
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <PanelRight className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {drawerOpen ? (
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}

        {/* Module rail + contextual navigation */}
        <aside
          className={cn(
            "z-40 flex shrink-0 flex-col border-r border-border/70 bg-sidebar transition-[width] duration-150",
            "fixed inset-y-0 left-0 top-12 md:sticky md:top-12 md:h-[calc(100vh-3rem)]",
            collapsed ? "w-[68px]" : "w-[264px]",
            drawerOpen ? "flex" : "hidden md:flex",
          )}
        >
          <div className={cn("flex h-14 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
            <Link to={isDemo ? "/" : "/home"} aria-label="CAERA CADANE home" className="inline-flex">
              <BrandMark className={collapsed ? "[&_.flex-col]:hidden" : ""} />
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3">
            <NavList items={modules} pathname={pathname} collapsed={collapsed} />

            {!collapsed && contextItems.length > 0 ? (
              <>
                <div className="mt-5 mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                  {modules.find((m) => m.id === current)?.label ?? "Section"}
                </div>
                <ContextList items={contextItems} pathname={pathname} />
              </>
            ) : null}

            {!collapsed && shell?.contextualNav ? (
              <div className="mt-3">{shell.contextualNav}</div>
            ) : null}

            {!isDemo ? (
              <>
                <div className="my-4 border-t border-sidebar-border/70" />
                <NavList items={UTILITY} pathname={pathname} collapsed={collapsed} />
              </>
            ) : null}
          </nav>

          {/* Account / session area, pinned */}
          <div className={cn("border-t border-sidebar-border p-2", collapsed && "flex justify-center")}>
            {isDemo ? (
              collapsed ? null : (
                <div className="flex gap-1">
                  <button
                    onClick={onDemoReset}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/60 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset
                  </button>
                  <button
                    onClick={onDemoExit}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/60 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden /> Exit
                  </button>
                </div>
              )
            ) : (
              <Link
                to="/settings"
                title="Account and settings"
                className={cn(
                  "flex items-center gap-2.5 rounded-md text-[13px] text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                  collapsed ? "h-9 w-9 justify-center" : "h-10 px-3",
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/70 text-[10px] font-medium">
                  CC
                </span>
                {!collapsed && <span className="truncate">Account</span>}
              </Link>
            )}
          </div>
        </aside>

        {/* Spacious workspace */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-10">{children}</div>
        </main>

        {/* Adaptive Copilot panel */}
        {shell?.copilotOpen && shell.copilotContent ? (
          <aside className="hidden w-[340px] shrink-0 border-l border-border/70 bg-sidebar/60 lg:block">
            <div className="sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto p-4">
              {shell.copilotContent}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function NavList({
  items,
  pathname,
  collapsed,
}: {
  items: ModuleDef[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <ul className="space-y-1">
      {items.map((m) => {
        const active = m.match.some((p) => pathname === p || pathname.startsWith(p + "/"));
        const Icon = m.icon;
        return (
          <li key={m.id}>
            <Link
              to={m.to}
              title={m.label}
              className={cn(
                "flex items-center gap-3 rounded-md text-[13px] transition-colors",
                collapsed ? "h-10 w-10 justify-center mx-auto" : "h-10 px-3",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{m.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ContextList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <ul className="space-y-0.5">
      {items.map((n, i) => {
        const Icon = n.icon;
        if (n.planned) {
          return (
            <li key={`${n.label}-${i}`}>
              <button
                type="button"
                disabled
                title={n.reason ?? `${n.label} — planned`}
                className="flex h-9 w-full cursor-not-allowed items-center gap-3 rounded-md px-3 text-[13px] text-muted-foreground/50"
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{n.label}</span>
                <span className="ml-auto text-[9px] uppercase tracking-wide">Planned</span>
              </button>
            </li>
          );
        }
        const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
        return (
          <li key={`${n.label}-${i}`}>
            <Link
              to={n.to}
              className={cn(
                "flex h-9 items-center gap-3 rounded-md px-3 text-[13px] transition-colors",
                active
                  ? "bg-sidebar-accent/70 text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{n.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
