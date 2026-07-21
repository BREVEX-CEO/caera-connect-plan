import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home,
  MessageSquare,
  Building2,
  Sparkles,
  Globe2,
  Settings,
  Monitor,
  PanelLeft,
  ArrowLeft,
  ArrowRight,
  Search,
  Bell,
  Sun,
  Moon,
  Waves,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { cn } from "@/lib/utils";
import { useAppearance } from "@/lib/theme-provider";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  module?: "ocade" | "ficia" | "madee" | "cania";
};

const nav: NavItem[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/ocade", label: "OCADE", icon: MessageSquare, module: "ocade" },
  { to: "/ficia", label: "FICIA", icon: Building2, module: "ficia" },
  { to: "/madee", label: "MADEE", icon: Sparkles, module: "madee" },
  { to: "/cania", label: "CANIA", icon: Globe2, module: "cania" },
];

const utility: NavItem[] = [
  { to: "/settings/devices", label: "Devices", icon: Monitor },
  { to: "/settings", label: "Settings", icon: Settings },
];

function accentClass(module: NavItem["module"]) {
  switch (module) {
    case "ocade": return "text-[color:var(--accent-ocade)]";
    case "ficia": return "text-[color:var(--accent-ficia)]";
    case "madee": return "text-[color:var(--accent-madee)]";
    case "cania": return "text-[color:var(--accent-cania)]";
    default: return "";
  }
}

const COLLAPSE_KEY = "caera:shell:collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { theme, update } = useAppearance();

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

  const activeItem = useMemo(() => {
    return [...nav, ...utility].find(
      (n) => pathname === n.to || pathname.startsWith(n.to + "/"),
    );
  }, [pathname]);

  function cycleTheme() {
    const next = theme === "dark" ? "light" : theme === "light" ? "real" : "dark";
    void update({ theme: next });
  }

  const ThemeIcon = theme === "light" ? Sun : theme === "real" ? Waves : Moon;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top utility bar */}
      <header className="sticky top-0 z-30 flex h-11 items-center gap-1 border-b border-border/70 bg-background/95 px-2 backdrop-blur">
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              setMobileOpen((v) => !v);
            } else {
              setCollapsed((v) => !v);
            }
          }}
          aria-label="Toggle sidebar"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <PanelLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="mx-1 hidden h-4 w-px bg-border/70 md:block" />
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

        <button
          onClick={() => navigate({ to: "/cania/search" })}
          className="ml-2 hidden h-8 flex-1 max-w-md items-center gap-2 rounded-md border border-border/70 bg-secondary/50 px-2.5 text-xs text-muted-foreground hover:bg-secondary md:inline-flex"
          aria-label="Global search"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span>Search workspace</span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={cycleTheme}
            aria-label={`Theme: ${theme}. Click to change.`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ThemeIcon className="h-4 w-4" aria-hidden />
          </button>
          <Link
            to="/settings/activity"
            aria-label="Activity & notifications"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Bell className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Mobile overlay */}
        {mobileOpen ? (
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        {/* Sidebar */}
        <aside
          className={cn(
            "z-40 flex shrink-0 flex-col border-r border-border/70 bg-sidebar transition-[width] duration-150",
            "fixed inset-y-0 left-0 top-11 md:sticky md:top-11 md:h-[calc(100vh-2.75rem)]",
            collapsed ? "w-[60px]" : "w-[248px]",
            mobileOpen ? "flex" : "hidden md:flex",
          )}
        >
          <div className={cn("flex h-12 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-3")}>
            <Link to="/home" aria-label="CAERA CADANE home" className="inline-flex">
              {collapsed ? (
                <BrandMark className="[&_.flex-col]:hidden" />
              ) : (
                <BrandMark />
              )}
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-2">
            <SidebarSection collapsed={collapsed} items={nav} pathname={pathname} />
            <div className="my-2 border-t border-sidebar-border/70" />
            <SidebarSection collapsed={collapsed} items={utility} pathname={pathname} />
          </nav>

          <div className={cn("border-t border-sidebar-border p-2", collapsed && "flex justify-center")}>
            <Link
              to="/settings"
              className={cn(
                "flex items-center gap-2.5 rounded-md text-[13px] text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                collapsed ? "h-9 w-9 justify-center" : "h-9 px-2.5",
              )}
              title="Account & settings"
            >
              <Settings className="h-4 w-4" aria-hidden />
              {!collapsed && <span>Account</span>}
            </Link>
          </div>
        </aside>

        {/* Main workspace */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8">{children}</div>
        </main>
      </div>

      {/* Screen-reader hint */}
      <span className="sr-only">{activeItem ? `Active section: ${activeItem.label}` : ""}</span>
    </div>
  );
}

function SidebarSection({
  items, pathname, collapsed,
}: { items: NavItem[]; pathname: string; collapsed: boolean }) {
  return (
    <ul className="space-y-0.5">
      {items.map((n) => {
        const active = pathname === n.to || pathname.startsWith(n.to + "/");
        const Icon = n.icon;
        return (
          <li key={n.to}>
            <Link
              to={n.to}
              title={n.label}
              className={cn(
                "group flex items-center gap-2.5 rounded-md text-[13px] transition-colors",
                collapsed ? "h-9 w-9 justify-center mx-auto" : "h-9 px-2.5",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", active ? accentClass(n.module) : "")}
                aria-hidden
              />
              {!collapsed && <span className="truncate">{n.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
