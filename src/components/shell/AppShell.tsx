/**
 * THE ONE SHELL. Sidebar, workspace, account.
 *
 * The product has four destinations and one navigation hierarchy, so there is
 * one shell rather than a workspace shell, a marketing shell, a settings shell
 * and a rail. `docs/design-references/grok/` supplies the proportions: a narrow
 * fixed sidebar, short rows, a section label above recent work, the account at
 * the bottom, and a workspace that takes everything else.
 *
 * MOBILE IS THE SAME SHELL WITH THE SIDEBAR OFF-CANVAS, not a second product.
 * The drawer is the same markup, translated, with a backdrop and Escape.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Images,
  LibraryBig,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PenSquare,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import { useSettingsPanel } from "@/components/settings/settings-panel";

interface Destination {
  to: string;
  label: string;
  icon: typeof MessageSquare;
}

const DESTINATIONS: Destination[] = [
  { to: "/", label: "Chat", icon: MessageSquare },
  { to: "/library", label: "Library", icon: LibraryBig },
  { to: "/cowork", label: "Cowork", icon: Sparkles },
];

export function AppShell({
  children,
  /** Recent conversations, owned by Chat because Chat owns that state. */
  sidebarExtra,
}: {
  children: ReactNode;
  sidebarExtra?: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // A navigation always closes the drawer; leaving it open over the new screen
  // is the classic way a mobile drawer becomes a trap.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a href="#workspace" className="skip-link">
        Skip to content
      </a>

      {/* Desktop rail. */}
      <Sidebar className="hidden w-64 shrink-0 border-r border-border/60 md:flex">
        {sidebarExtra}
      </Sidebar>

      {/* Mobile drawer. */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <Sidebar className="relative flex h-full w-72 max-w-[85vw] border-r border-border/60 bg-background">
            {sidebarExtra}
          </Sidebar>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-2 border-b border-border/60 px-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Menu className="h-4.5 w-4.5" aria-hidden />
          </button>
          <BrandMark />
        </header>

        <main id="workspace" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ className, children }: { className?: string; children?: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <aside className={cn("flex-col bg-background/60", className)}>
      <div className="flex h-14 items-center justify-between px-3">
        <Link to="/" aria-label="OCADE home" className="rounded-md p-1">
          <BrandMark />
        </Link>
        <span className="hidden text-muted-foreground md:inline-flex">
          <PanelLeftClose className="h-4 w-4 opacity-0" aria-hidden />
        </span>
      </div>

      <nav className="px-2" aria-label="Primary">
        <Link
          to="/"
          search={{ new: true }}
          className="mb-1 flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <PenSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
          New chat
        </Link>
        {DESTINATIONS.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="ocade-scroll mt-4 min-h-0 flex-1 overflow-y-auto px-2">{children}</div>

      <AccountRow />
    </aside>
  );
}

/**
 * The account, and the one menu it opens.
 *
 * Settings is reached from here and nowhere else — `docs/DECISIONS.md` #3 —
 * so there is no settings route to deep-link into and no second entry point to
 * keep in step.
 */
function AccountRow() {
  const { user, loading } = useSession();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const container = useRef<HTMLDivElement>(null);
  const settings = useSettingsPanel();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loading) {
    return <div className="h-14 shrink-0 border-t border-border/60" aria-hidden />;
  }

  if (!user) {
    return (
      <div className="shrink-0 border-t border-border/60 p-2">
        <Link
          to="/auth"
          className="flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const name = user.email ?? user.phone ?? "Account";
  const initial = name.trim().charAt(0).toUpperCase() || "O";

  return (
    <div ref={container} className="relative shrink-0 border-t border-border/60 p-2">
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="glass-strong absolute bottom-full left-2 right-2 mb-2 overflow-hidden rounded-lg p-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              settings.open();
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
          >
            <SettingsIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
            Settings
          </button>
          <Link
            to="/library"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
          >
            <Images className="h-4 w-4 text-muted-foreground" aria-hidden />
            Library
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void import("@/integrations/supabase/on-demand").then(({ loadSupabaseClient }) =>
                loadSupabaseClient().then((supabase) => supabase.auth.signOut()),
              );
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
          >
            <X className="h-4 w-4 text-muted-foreground" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
          {initial}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
      </button>
    </div>
  );
}
