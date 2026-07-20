import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageSquare, Building2, Sparkles, Globe2, Settings } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { cn } from "@/lib/utils";

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

function accentClass(module: NavItem["module"]) {
  switch (module) {
    case "ocade":
      return "text-[color:var(--accent-ocade)]";
    case "ficia":
      return "text-[color:var(--accent-ficia)]";
    case "madee":
      return "text-[color:var(--accent-madee)]";
    case "cania":
      return "text-[color:var(--accent-cania)]";
    default:
      return "text-foreground";
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen">
      {/* Desktop rail */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/70 backdrop-blur md:flex">
        <div className="flex h-16 items-center px-5">
          <Link to="/home" aria-label="CAERA CADANE home">
            <BrandMark />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("h-4 w-4", active ? accentClass(n.module) : "")}
                  aria-hidden
                />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <Settings className="h-4 w-4" aria-hidden />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main workspace */}
      <main className="min-w-0 flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border/60 bg-background/85 backdrop-blur md:hidden">
        {nav.map((n) => {
          const active = pathname === n.to || pathname.startsWith(n.to + "/");
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active ? accentClass(n.module) : "")} aria-hidden />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
