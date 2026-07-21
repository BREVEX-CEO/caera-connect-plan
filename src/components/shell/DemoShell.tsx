import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home,
  MessageSquare,
  Building2,
  Sparkles,
  Globe2,
  Settings,
  FolderOpen,
  ListChecks,
  LogIn,
  RotateCcw,
  X,
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

export function DemoShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { reset, exit } = useDemo();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/70 backdrop-blur md:flex">
        <div className="flex h-16 items-center justify-between px-5">
          <Link to="/" aria-label="CAERA CADANE home">
            <BrandMark />
          </Link>
          <DemoBadge />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map((n) => {
            const active =
              n.to === "/demo" ? pathname === "/demo" : pathname === n.to || pathname.startsWith(n.to + "/");
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
                <Icon className="h-4 w-4" aria-hidden />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-sidebar-border p-3 text-xs">
          <Link
            to="/auth"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Sign up / Sign in
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => reset()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset
            </button>
            <button
              onClick={() => {
                exit();
                navigate({ to: "/" });
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Exit
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between md:hidden">
            <BrandMark />
            <DemoBadge />
          </div>
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-border/60 bg-background/85 backdrop-blur md:hidden">
        {nav.slice(0, 5).map((n) => {
          const active =
            n.to === "/demo" ? pathname === "/demo" : pathname === n.to || pathname.startsWith(n.to + "/");
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
              <Icon className="h-5 w-5" aria-hidden />
              {n.label}
            </Link>
          );
        })}
      </nav>

      {/* Permanent watermark — visible on every demo page */}
      <DemoBadge floating />
    </div>
  );
}
