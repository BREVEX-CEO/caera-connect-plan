import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home, MessageSquare, Building2, Sparkles, Globe2, Settings, FolderOpen,
  ListChecks, LogIn, RotateCcw, X, PanelLeft, ArrowLeft, ArrowRight, Search,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { DemoBadge } from "./DemoBadge";
import { cn } from "@/lib/utils";
import { useDemo } from "@/lib/demo/context";

type NavItem = { to: string; label: string; icon: typeof Home };

const nav: NavItem[] = [
  { to: "/demo", label: "Home", icon: Home },
  { to: "/demo/ocade", label: "OCADE", icon: MessageSquare },
  { to: "/demo/ficia", label: "FICIA", icon: Building2 },
  { to: "/demo/madee", label: "MADEE", icon: Sparkles },
  { to: "/demo/cania", label: "CANIA", icon: Globe2 },
  { to: "/demo/files", label: "Files", icon: FolderOpen },
  { to: "/demo/tasks", label: "Tasks", icon: ListChecks },
  { to: "/demo/settings", label: "Settings", icon: Settings },
];

const COLLAPSE_KEY = "caera:demo-shell:collapsed";

export function DemoShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { reset, exit } = useDemo();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-11 items-center gap-1 border-b border-border/70 bg-background/95 px-2 backdrop-blur">
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) setMobileOpen((v) => !v);
            else setCollapsed((v) => !v);
          }}
          aria-label="Toggle sidebar"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <PanelLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          onClick={() => { if (typeof window !== "undefined") window.history.back(); }}
          aria-label="Back"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          onClick={() => { if (typeof window !== "undefined") window.history.forward(); }}
          aria-label="Forward"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
        <div className="ml-2 hidden h-8 flex-1 max-w-md items-center gap-2 rounded-md border border-border/70 bg-secondary/50 px-2.5 text-xs text-muted-foreground md:inline-flex">
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span>Search (available after sign-in)</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DemoBadge />
          <Link
            to="/auth"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden />
            Sign in
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {mobileOpen ? (
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <aside
          className={cn(
            "z-40 flex shrink-0 flex-col border-r border-border/70 bg-sidebar transition-[width] duration-150",
            "fixed inset-y-0 left-0 top-11 md:sticky md:top-11 md:h-[calc(100vh-2.75rem)]",
            collapsed ? "w-[60px]" : "w-[248px]",
            mobileOpen ? "flex" : "hidden md:flex",
          )}
        >
          <div className={cn("flex h-12 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-3")}>
            <Link to="/" aria-label="CAERA CADANE home" className="inline-flex">
              <BrandMark className={collapsed ? "[&_.flex-col]:hidden" : ""} />
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-2">
            <ul className="space-y-0.5">
              {nav.map((n) => {
                const active =
                  n.to === "/demo" ? pathname === "/demo" : pathname === n.to || pathname.startsWith(n.to + "/");
                const Icon = n.icon;
                return (
                  <li key={n.to}>
                    <Link
                      to={n.to}
                      title={n.label}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md text-[13px] transition-colors",
                        collapsed ? "h-9 w-9 justify-center mx-auto" : "h-9 px-2.5",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {!collapsed && <span className="truncate">{n.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className={cn("space-y-2 border-t border-sidebar-border p-2 text-xs", collapsed && "hidden")}>
            <div className="flex gap-1">
              <button
                onClick={() => reset()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Reset
              </button>
              <button
                onClick={() => { exit(); navigate({ to: "/" }); }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Exit demo
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
