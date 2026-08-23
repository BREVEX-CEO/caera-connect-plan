import { useEffect, useRef, useState, type ReactNode } from "react";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { MotionScope } from "@/components/motion/MotionScope";
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
  LogOut,
  Monitor,
  Settings,
  ScrollText,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { DemoBadge } from "./DemoBadge";
import { ShellProvider } from "./shell-context";
import { useShell } from "./use-shell";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { useAppearance } from "@/lib/use-appearance";
import { useSession } from "@/lib/session";
import { useHistoryReach } from "./use-history-reach";
import { supabase } from "@/integrations/supabase/client";
import { recordAction } from "@/lib/actions";
import { closeActiveCompanionSession } from "@/lib/native/tauri-companion";
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

function WorkspaceShellInner({
  children,
  variant = "app",
  onDemoReset,
  onDemoExit,
}: WorkspaceShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { theme, update } = useAppearance();
  const { user } = useSession();
  const shell = useShell();
  const isDemo = variant === "demo";
  const reach = useHistoryReach();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileNavigation, setMobileNavigation] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches,
  );
  const [accountOpen, setAccountOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobileNavigation(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    function closeTransientUi(event: KeyboardEvent) {
      /*
       * Cmd/Ctrl+K opens the palette from anywhere, including from inside a
       * text field — that is the shortcut people already have in their hands,
       * and refusing it while composing would make it useless exactly when it
       * is wanted. The palette owns Escape once it is open.
       */
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (event.key !== "Escape") return;
      setDrawerOpen(false);
      setAccountOpen(false);
      shell?.setCopilotOpen(false);
    }
    function closeAccountOnOutsidePointer(event: PointerEvent) {
      if (accountRef.current?.contains(event.target as Node)) return;
      setAccountOpen(false);
    }
    window.addEventListener("keydown", closeTransientUi);
    window.addEventListener("pointerdown", closeAccountOnOutsidePointer);
    return () => {
      window.removeEventListener("keydown", closeTransientUi);
      window.removeEventListener("pointerdown", closeAccountOnOutsidePointer);
    };
  }, [shell]);

  useEffect(() => {
    if (drawerOpen) navigationRef.current?.focus();
  }, [drawerOpen]);

  const modules: ModuleDef[] = isDemo ? DEMO_MODULES : MODULES;
  const current = activeModule(pathname);
  const contextItems: NavItem[] = isDemo ? [] : (MODULE_CONTEXT[current] ?? []);

  function cycleTheme() {
    const next = theme === "dark" ? "light" : theme === "light" ? "real" : "dark";
    void update({ theme: next });
  }

  /**
   * Send the top-bar search where a search actually exists.
   *
   * It used to open CANIA's search page — a different product, and now not a
   * product at all. What OCADE really has is the conversation filter in its own
   * sidebar, so this navigates there and puts the cursor in it. The label says
   * "Search chats" rather than "Search workspace" because chats are what it
   * searches; the wider label promised documents and projects too.
   */
  function openChatSearch() {
    void navigate({ to: "/ocade" }).then(() => {
      // The field belongs to the OCADE route, which may only mount after the
      // navigation resolves. One frame is enough and avoids a polling loop.
      requestAnimationFrame(() => {
        document.getElementById("ocade-chat-search")?.focus();
      });
    });
  }
  const ThemeIcon = theme === "light" ? Sun : theme === "real" ? Waves : Moon;
  const initials =
    (user?.user_metadata?.preferred_name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Account";
  const accountInitials =
    initials
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "CC";

  async function signOut() {
    setAccountError(null);
    // Record the audit entry BEFORE the session is revoked — recordAction
    // resolves the acting user from the live session, which signOut destroys.
    void recordAction({ actionId: "auth.sign_out" });
    try {
      await closeActiveCompanionSession();
    } catch (error) {
      setAccountError(
        error instanceof Error
          ? `The local companion session could not confirm closure: ${error.message}`
          : "The local companion session could not confirm closure.",
      );
    }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await navigate({ to: "/auth", replace: true });
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Sign out failed.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/*
        Skip link: the first thing a keyboard or screen-reader user reaches.
        Without it, every page forces a walk through the whole sidebar before
        the actual content. Visually hidden until focused.
      */}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Utility bar — compact, structural, no colour */}
      <header className="sticky top-0 z-40 flex h-12 items-center gap-1 border-b border-border/70 bg-background/95 px-2 backdrop-blur">
        <button
          onClick={() => {
            if (mobileNavigation) setDrawerOpen((v) => !v);
            else setCollapsed((v) => !v);
          }}
          aria-label="Toggle navigation"
          aria-controls="workspace-navigation"
          aria-expanded={mobileNavigation ? drawerOpen : !collapsed}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <PanelLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="mx-1 hidden h-4 w-px bg-border/70 md:block" />
        {/*
          Disabled when there is genuinely nowhere to go — see `useHistoryReach`
          for why `history.length` cannot answer this and why an unmeasurable
          browser leaves both enabled. The titles carry the reason so these do
          not become `silent-disabled` findings in the dead-control audit.
        */}
        <button
          onClick={() => typeof window !== "undefined" && window.history.back()}
          disabled={!reach.canGoBack}
          aria-label="Back"
          title={reach.canGoBack ? "Back" : "Nothing to go back to"}
          className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 md:inline-flex"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          onClick={() => typeof window !== "undefined" && window.history.forward()}
          disabled={!reach.canGoForward}
          aria-label="Forward"
          title={reach.canGoForward ? "Forward" : "Nothing to go forward to"}
          className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 md:inline-flex"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>

        {/*
          NO ACCOUNT MEANS NO CHATS TO SEARCH.

          This was keyed on `isDemo` alone, but the demo is not the only place
          the shell renders without a session: settings is deliberately readable
          signed out, and it renders `variant="app"`. So a signed-out visitor
          got a live "Search chats" button that navigated to `/ocade`, which is
          auth-gated — a hard redirect into the sign-in wall, from a screen the
          product had just invited them to browse.

          The honest placeholder the demo already used is the right answer for
          both cases, so both now use it.
        */}
        {isDemo || !user ? (
          <div className="ml-2 hidden h-8 max-w-md flex-1 items-center gap-2 rounded-md border border-border/70 bg-secondary/40 px-2.5 text-xs text-muted-foreground md:inline-flex">
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span>Search — available after sign-in</span>
          </div>
        ) : (
          <button
            onClick={openChatSearch}
            className="ml-2 hidden h-8 max-w-md flex-1 items-center gap-2 rounded-md border border-border/70 bg-secondary/40 px-2.5 text-xs text-muted-foreground hover:bg-secondary md:inline-flex"
            aria-label="Search chats"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span>Search chats</span>
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
                  aria-expanded={shell.copilotOpen}
                  aria-controls="copilot-desktop-panel copilot-mobile-panel"
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
          ref={navigationRef}
          id="workspace-navigation"
          tabIndex={-1}
          aria-label="Workspace navigation"
          className={cn(
            "z-40 flex shrink-0 flex-col border-r border-border/70 bg-sidebar transition-[width] duration-150",
            "fixed inset-y-0 left-0 top-12 md:sticky md:top-12 md:h-[calc(100vh-3rem)]",
            collapsed ? "w-[68px]" : "w-[264px]",
            drawerOpen ? "flex" : "hidden md:flex",
          )}
        >
          <div
            className={cn(
              "flex h-14 items-center border-b border-sidebar-border",
              collapsed ? "justify-center px-2" : "px-4",
            )}
          >
            <Link
              to={isDemo ? "/" : "/home"}
              aria-label="CAERA CADANE home"
              className="inline-flex"
            >
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
          <div
            ref={accountRef}
            className={cn(
              "relative border-t border-sidebar-border p-2",
              collapsed && "flex justify-center",
            )}
          >
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
              <>
                {accountOpen ? (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    className={cn(
                      "absolute bottom-[calc(100%+0.25rem)] z-50 w-56 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl",
                      collapsed ? "left-2" : "left-2 right-2",
                    )}
                  >
                    <div className="border-b border-border/60 px-2 py-2">
                      <div className="truncate text-xs font-medium">{initials}</div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {user?.email ?? user?.phone ?? "Signed-in account"}
                      </div>
                    </div>
                    <Link
                      role="menuitem"
                      to="/settings"
                      className="mt-1 flex h-8 items-center gap-2 rounded-md px-2 text-xs hover:bg-accent"
                    >
                      <Settings className="h-3.5 w-3.5" aria-hidden /> Settings
                    </Link>
                    <Link
                      role="menuitem"
                      to="/settings/devices"
                      className="flex h-8 items-center gap-2 rounded-md px-2 text-xs hover:bg-accent"
                    >
                      <Monitor className="h-3.5 w-3.5" aria-hidden /> Devices
                    </Link>
                    <Link
                      role="menuitem"
                      to="/settings/activity"
                      className="flex h-8 items-center gap-2 rounded-md px-2 text-xs hover:bg-accent"
                    >
                      <ScrollText className="h-3.5 w-3.5" aria-hidden /> Activity
                    </Link>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => void signOut()}
                      className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-accent"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
                    </button>
                    {accountError ? (
                      <p role="alert" className="px-2 py-1 text-[10px] text-destructive">
                        {accountError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  title="Account menu"
                  aria-label="Account menu"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((open) => !open)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md text-[13px] text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                    collapsed ? "h-9 w-9 justify-center" : "h-10 w-full px-3",
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/70 text-[10px] font-medium">
                    {accountInitials}
                  </span>
                  {!collapsed ? (
                    <>
                      <span className="min-w-0 flex-1 truncate text-left">Account</span>
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                    </>
                  ) : null}
                </button>
              </>
            )}
          </div>
        </aside>

        {/* Spacious workspace */}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          {/*
            The camera for the workspace. `ocade-scene` sits on the scrolling
            container rather than on each panel so every surface shares ONE
            vanishing point — per-element perspective gives each panel its own
            centre and the workspace stops reading as a single space.
          */}
          <div className="ocade-scene mx-auto w-full max-w-6xl px-6 py-8 sm:px-10">
            {/* Scroll motion for every workspace route. Content stays visible
                if the observer never runs — see MotionScope. */}
            <MotionScope>{children}</MotionScope>
          </div>
          {/* Three-step welcome, once per account. Renders nothing afterwards. */}
          <WelcomeTour />
        </main>

        {/* Adaptive Copilot panel */}
        {shell?.copilotOpen && shell.copilotContent ? (
          <aside
            id="copilot-desktop-panel"
            aria-label="Desktop Copilot"
            className="hidden w-[340px] shrink-0 border-l border-border/70 bg-sidebar/60 lg:block"
          >
            <div className="sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto p-4">
              {shell.copilotContent}
            </div>
          </aside>
        ) : null}

        {shell?.copilotOpen && shell.copilotContent ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Desktop Copilot"
            className="fixed inset-0 z-50 lg:hidden"
          >
            <button
              type="button"
              aria-label="Close Copilot panel"
              tabIndex={-1}
              onClick={() => shell.setCopilotOpen(false)}
              className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            />
            <aside
              id="copilot-mobile-panel"
              className="absolute inset-y-0 right-0 flex w-[min(92vw,380px)] flex-col border-l border-border bg-sidebar shadow-2xl"
            >
              <div className="flex h-12 items-center justify-between border-b border-border px-4">
                <span className="text-xs font-semibold uppercase tracking-[0.12em]">
                  Desktop Copilot
                </span>
                <button
                  type="button"
                  aria-label="Close Copilot panel"
                  autoFocus
                  onClick={() => shell.setCopilotOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">{shell.copilotContent}</div>
            </aside>
          </div>
        ) : null}
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
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
        const active = n.exact
          ? pathname === n.to
          : pathname === n.to || pathname.startsWith(n.to + "/");
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
